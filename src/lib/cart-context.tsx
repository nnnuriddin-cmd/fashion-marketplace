'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CartItem {
  id: string; // unique item key
  productId: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  selectedSize: string;
  selectedColor: string;
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
  getGroupedItemsByStore: () => Record<string, { storeName: string; storeSlug: string; items: CartItem[]; subtotal: number }>;
  getTotalAmount: () => number;
  getTotalItemsCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('trendmall_cart');
      if (saved) setCart(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load cart from localStorage:', e);
    }
  }, []);

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem('trendmall_cart', JSON.stringify(newCart));
    } catch (e) {
      console.warn('Failed to save cart:', e);
    }
  };

  const addToCart = (newItem: Omit<CartItem, 'id'>) => {
    const itemKey = `${newItem.productId}-${newItem.selectedSize}-${newItem.selectedColor}`;
    const existingIndex = cart.findIndex((i) => i.id === itemKey);

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += newItem.quantity;
      saveCart(updated);
    } else {
      saveCart([...cart, { ...newItem, id: itemKey }]);
    }
  };

  const removeFromCart = (id: string) => {
    saveCart(cart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    const updated = cart
      .map((item) => {
        if (item.id === id) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter(Boolean) as CartItem[];
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const getGroupedItemsByStore = () => {
    const groups: Record<string, { storeName: string; storeSlug: string; items: CartItem[]; subtotal: number }> = {};
    cart.forEach((item) => {
      if (!groups[item.storeId]) {
        groups[item.storeId] = {
          storeName: item.storeName,
          storeSlug: item.storeSlug,
          items: [],
          subtotal: 0,
        };
      }
      groups[item.storeId].items.push(item);
      groups[item.storeId].subtotal += item.price * item.quantity;
    });
    return groups;
  };

  const getTotalAmount = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const getTotalItemsCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getGroupedItemsByStore,
        getTotalAmount,
        getTotalItemsCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
