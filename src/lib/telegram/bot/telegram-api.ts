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
