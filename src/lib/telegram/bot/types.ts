import type { SupabaseClient } from '@supabase/supabase-js';
import type { BotLang } from '@/lib/telegram/product-draft';

export type { BotLang };

export interface SellerUser {
  id: string;
  role: string;
}

export interface SellerStore {
  id: string;
  name: string;
  status: string;
}

/** Authenticated, APPROVED seller acting in a Telegram chat. */
export interface SellerContext {
  supabase: SupabaseClient;
  chatId: string;
  user: SellerUser;
  store: SellerStore;
  lang: BotLang;
}

export type SessionStep =
  | 'AWAITING_PHOTO'
  | 'AWAITING_CATEGORY'
  | 'AWAITING_DETAILS'
  | 'AWAITING_PRICE'
  | 'AWAITING_STOCK'
  | 'AWAITING_PUBLICATION_CONFIRMATION'
  | 'PUBLISHING'
  | 'EDITING_PRICE'
  | 'EDITING_STOCK';

/** Row of the `telegram_sessions` table (draft is free-form JSON). */
export interface TelegramSession {
  id: string;
  seller_telegram_id: string;
  store_id: string;
  step: SessionStep;
  raw_image_url: string | null;
  processed_image_url: string | null;
  extracted_metadata: any;
  draft: any;
  created_at: string;
  updated_at: string;
}

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };

export interface InlineKeyboard {
  inline_keyboard: InlineButton[][];
}
