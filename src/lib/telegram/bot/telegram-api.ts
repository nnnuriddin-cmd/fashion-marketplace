/**
 * Low-level Telegram Bot API helpers used only by the webhook bot.
 * (Message sending lives in '@/lib/telegram/notifier'.)
 */

/**
 * Sends chat action (e.g. 'typing') to Telegram so user sees immediate feedback.
 * Non-blocking / fire-and-forget safe so network errors never break product flow.
 */
export async function sendTelegramChatAction(chatId: string | number, action: string = 'typing') {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.warn('sendChatAction failed (non-critical):', err);
  }
}

/**
 * Replaces the text and inline keyboard of an existing bot message (in-place navigation).
 * Returns false if Telegram refused (e.g. message too old), so the caller can send a new one.
 */
export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: unknown
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: replyMarkup,
      }),
    });
    const data = await res.json();
    // "message is not modified" means the content is already up to date
    return Boolean(data?.ok) || String(data?.description || '').includes('message is not modified');
  } catch (err) {
    console.warn('editMessageText failed:', err);
    return false;
  }
}

async function callTelegram(method: string, body: BodyInit, json: boolean): Promise<any> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: false };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: json ? { 'Content-Type': 'application/json' } : undefined,
      body,
    });
    return await res.json();
  } catch (err) {
    console.warn(`${method} failed:`, err);
    return { ok: false };
  }
}

/** Sends a photo (uploaded as bytes) with an HTML caption. Returns true on success. */
export async function sendTelegramPhoto(
  chatId: string | number,
  photo: Buffer,
  caption: string,
  replyMarkup?: unknown
): Promise<boolean> {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('photo', new Blob([new Uint8Array(photo)], { type: 'image/jpeg' }), 'product.jpg');
  form.append('caption', caption);
  form.append('parse_mode', 'HTML');
  if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup));
  const data = await callTelegram('sendPhoto', form, false);
  if (!data?.ok) console.warn('sendPhoto rejected:', data?.description);
  return Boolean(data?.ok);
}

/** Replaces the caption and keyboard of a photo message. */
export async function editTelegramCaption(
  chatId: string | number,
  messageId: number,
  caption: string,
  replyMarkup?: unknown
): Promise<boolean> {
  const data = await callTelegram(
    'editMessageCaption',
    JSON.stringify({ chat_id: chatId, message_id: messageId, caption, parse_mode: 'HTML', reply_markup: replyMarkup }),
    true
  );
  return Boolean(data?.ok) || String(data?.description || '').includes('message is not modified');
}

export async function deleteTelegramMessage(chatId: string | number, messageId: number): Promise<void> {
  await callTelegram('deleteMessage', JSON.stringify({ chat_id: chatId, message_id: messageId }), true);
}

export type TelegramFileDownload =
  | { ok: true; buffer: Buffer }
  | { ok: false; reason: 'get_file_failed' | 'download_failed' };

/**
 * Downloads a Telegram file into server memory.
 * SECURITY INVARIANT: The download URL contains the bot token, so it is kept strictly
 * in local memory and NEVER saved or exposed.
 */
export async function downloadTelegramFile(token: string, fileId: string): Promise<TelegramFileDownload> {
  const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const getFileResult = await getFileRes.json();
  if (!getFileResult.ok || !getFileResult.result?.file_path) {
    console.warn('Telegram getFile returned error for file_id:', fileId);
    return { ok: false, reason: 'get_file_failed' };
  }

  const downloadUrl = `https://api.telegram.org/file/bot${token}/${getFileResult.result.file_path}`;
  const imgRes = await fetch(downloadUrl);
  if (!imgRes.ok) {
    console.warn('Failed to download image bytes from Telegram API for file_id:', fileId);
    return { ok: false, reason: 'download_failed' };
  }

  return { ok: true, buffer: Buffer.from(await imgRes.arrayBuffer()) };
}
