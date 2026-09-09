-- ============================================================================
-- TrendMall: Atomic Checkout RPC Migration (003)
-- Architecture: Single-Transaction Atomic Multi-Vendor Checkout with Inventory Handling
-- Target: Supabase PostgreSQL
-- ============================================================================

CREATE OR REPLACE FUNCTION process_checkout_order(
  p_customer_name     TEXT,
  p_customer_phone    TEXT,
  p_delivery_address  TEXT,
  p_delivery_method   TEXT,
  p_payment_method    TEXT,
  p_order_notes       TEXT,
  p_customer_id       UUID,
  p_cart_items        JSONB,
  p_order_number      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product_ids           UUID[];
  v_found_count           INTEGER;
  v_inactive_title        TEXT;
  v_failed_product_title  TEXT;
  v_available_stock       INTEGER;
  v_requested_stock       INTEGER;
  v_order_number          TEXT;
  v_total_amount          DECIMAL(12,2) := 0.0;
  v_parent_order_id       UUID;
  v_store_record          RECORD;
  v_seller_order_id       UUID;
  v_sub_order_number      TEXT;
  v_letter_idx            INTEGER := 0;
  v_commission_amount     DECIMAL(12,2);
  v_seller_earnings       DECIMAL(12,2);
  v_seller_orders_json    JSONB := '[]'::jsonb;
BEGIN
  -- 1. Validate payload structure
  IF p_cart_items IS NULL OR jsonb_typeof(p_cart_items) != 'array' OR jsonb_array_length(p_cart_items) = 0 THEN
    RAISE EXCEPTION 'Cannot create an order with empty cartItems';
  END IF;

  IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
    RAISE EXCEPTION 'Missing required checkout parameter: customerName';
  END IF;

  IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
    RAISE EXCEPTION 'Missing required checkout parameter: customerPhone';
  END IF;

  IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'Missing required checkout parameter: deliveryAddress';
  END IF;

  -- 2. Validate individual item fields & positive quantities
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_cart_items) AS elem
    WHERE (elem->>'productId') IS NULL
       OR (elem->>'productId') = ''
       OR (elem->>'quantity') IS NULL
       OR (elem->>'quantity')::INT <= 0
  ) THEN
    RAISE EXCEPTION 'Invalid purchase quantity in cart items.';
  END IF;

  -- 3. Extract and sort unique product IDs deterministically to eliminate deadlock risk
  SELECT ARRAY_AGG(DISTINCT (elem->>'productId')::UUID ORDER BY (elem->>'productId')::UUID ASC)
  INTO v_product_ids
  FROM jsonb_array_elements(p_cart_items) AS elem;

  -- 4. Acquire exclusive row-level locks on affected products in deterministic ascending order
  PERFORM id
  FROM products
  WHERE id = ANY(v_product_ids)
  ORDER BY id ASC
  FOR UPDATE;

  -- 5. Verify all requested products exist in the catalog
  SELECT COUNT(*) INTO v_found_count
  FROM products
  WHERE id = ANY(v_product_ids);

  IF v_found_count < array_length(v_product_ids, 1) THEN
    RAISE EXCEPTION 'One or more products not found in active catalog.';
  END IF;

  -- 6. Verify all products are in ACTIVE status
  SELECT title INTO v_inactive_title
  FROM products
  WHERE id = ANY(v_product_ids) AND status != 'ACTIVE'
  LIMIT 1;

  IF v_inactive_title IS NOT NULL THEN
    RAISE EXCEPTION 'Product "%" is currently not available for purchase.', v_inactive_title;
  END IF;

  -- 7. Validate inventory against consolidated requested quantities (handles duplicate items in cart)
  SELECT p.title, p.stock_quantity, req.total_qty
  INTO v_failed_product_title, v_available_stock, v_requested_stock
  FROM (
    SELECT (elem->>'productId')::UUID AS product_id, SUM((elem->>'quantity')::INT) AS total_qty
    FROM jsonb_array_elements(p_cart_items) AS elem
    GROUP BY (elem->>'productId')::UUID
  ) req
  JOIN products p ON p.id = req.product_id
  WHERE p.stock_quantity < req.total_qty
  LIMIT 1;

  IF v_failed_product_title IS NOT NULL THEN
    RAISE EXCEPTION 'Insufficient stock for "%". Available: %, Requested: %',
      v_failed_product_title, v_available_stock, v_requested_stock;
  END IF;

  -- 8. Atomically decrement inventory
  UPDATE products p
  SET stock_quantity = p.stock_quantity - req.total_qty
  FROM (
    SELECT (elem->>'productId')::UUID AS product_id, SUM((elem->>'quantity')::INT) AS total_qty
    FROM jsonb_array_elements(p_cart_items) AS elem
    GROUP BY (elem->>'productId')::UUID
  ) req
  WHERE p.id = req.product_id;

  -- 9. Calculate total order amount based strictly on authoritative database prices
  SELECT COALESCE(SUM(COALESCE(p.discount_price, p.price) * (elem->>'quantity')::INT), 0.0)
  INTO v_total_amount
  FROM jsonb_array_elements(p_cart_items) AS elem
  JOIN products p ON p.id = (elem->>'productId')::UUID;

  -- 10. Generate / sanitize unique order number
  v_order_number := COALESCE(NULLIF(trim(p_order_number), ''), 'ORD-' || FLOOR(10000 + random() * 90000)::TEXT);
  WHILE EXISTS (SELECT 1 FROM parent_orders WHERE order_number = v_order_number) LOOP
    v_order_number := 'ORD-' || FLOOR(10000 + random() * 90000)::TEXT;
  END LOOP;

  -- 11. Insert parent_orders
  INSERT INTO parent_orders (
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_method,
    payment_method,
    payment_status,
    total_amount,
    order_notes
  ) VALUES (
    v_order_number,
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_delivery_address,
    COALESCE(NULLIF(trim(p_delivery_method), ''), 'STANDARD'),
    COALESCE(NULLIF(trim(p_payment_method), ''), 'CASH'),
    'PENDING',
    v_total_amount,
    p_order_notes
  )
  RETURNING id INTO v_parent_order_id;

  -- 12. Create seller_orders grouped by store and insert order_items
  FOR v_store_record IN (
    SELECT
      p.store_id,
      COALESCE(s.commission_rate, 10.0) AS commission_rate,
      SUM(COALESCE(p.discount_price, p.price) * (elem->>'quantity')::INT) AS subtotal,
      COUNT(*) AS items_count
    FROM jsonb_array_elements(p_cart_items) AS elem
    JOIN products p ON p.id = (elem->>'productId')::UUID
    LEFT JOIN stores s ON s.id = p.store_id
    GROUP BY p.store_id, s.commission_rate
    ORDER BY p.store_id ASC
  ) LOOP
    v_sub_order_number := v_order_number || '-' || CHR(65 + (v_letter_idx % 26));
    v_letter_idx := v_letter_idx + 1;

    v_commission_amount := ROUND(((v_store_record.subtotal * v_store_record.commission_rate) / 100.0), 2);
    v_seller_earnings := v_store_record.subtotal - v_commission_amount;

    INSERT INTO seller_orders (
      sub_order_number,
      parent_order_id,
      store_id,
      status,
      subtotal,
      commission_amount,
      seller_earnings
    ) VALUES (
      v_sub_order_number,
      v_parent_order_id,
      v_store_record.store_id,
      'NEW',
      v_store_record.subtotal,
      v_commission_amount,
      v_seller_earnings
    )
    RETURNING id INTO v_seller_order_id;

    -- Insert snapshot order items for this seller order
    INSERT INTO order_items (
      seller_order_id,
      product_id,
      product_name,
      product_image,
      selected_size,
      selected_color,
      price,
      quantity,
      subtotal
    )
    SELECT
      v_seller_order_id,
      p.id,
      p.title,
      COALESCE(p.original_image, elem->>'image'),
      NULLIF(elem->>'selectedSize', ''),
      NULLIF(elem->>'selectedColor', ''),
      COALESCE(p.discount_price, p.price),
      (elem->>'quantity')::INT,
      COALESCE(p.discount_price, p.price) * (elem->>'quantity')::INT
    FROM jsonb_array_elements(p_cart_items) AS elem
    JOIN products p ON p.id = (elem->>'productId')::UUID
    WHERE p.store_id = v_store_record.store_id;

    v_seller_orders_json := v_seller_orders_json || jsonb_build_object(
      'sellerOrderId', v_seller_order_id,
      'subOrderNumber', v_sub_order_number,
      'storeId', v_store_record.store_id,
      'subtotal', v_store_record.subtotal,
      'commissionAmount', v_commission_amount,
      'sellerEarnings', v_seller_earnings,
      'itemsCount', v_store_record.items_count
    );
  END LOOP;

  -- 13. Return structured checkout result matching CreateOrderCheckoutResult
  RETURN jsonb_build_object(
    'parentOrderId', v_parent_order_id,
    'orderNumber', v_order_number,
    'totalAmount', v_total_amount,
    'sellerOrders', v_seller_orders_json
  );
END;
$$;

-- Security & Permissions: Restricted exclusively to service_role
REVOKE ALL ON FUNCTION process_checkout_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_checkout_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) FROM anon;
REVOKE ALL ON FUNCTION process_checkout_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION process_checkout_order(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TEXT) TO service_role;
