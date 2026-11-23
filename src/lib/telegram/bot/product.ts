/** Helpers for creating marketplace products from Telegram drafts. */

function timeSuffix(): string {
  return Date.now().toString().slice(-6);
}

/** Generates a clean, unique product slug from its title. */
export function buildProductSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${baseSlug || 'product'}-${timeSuffix()}`;
}

export function buildSku(): string {
  return `SKU-${timeSuffix()}`;
}

/**
 * SECURITY INVARIANT: product images must come from permanent Supabase Storage,
 * never from the Telegram Bot API (those URLs contain the bot token).
 */
export function isTelegramApiUrl(url: string): boolean {
  return url.includes('api.telegram.org') || url.includes('/bot');
}
