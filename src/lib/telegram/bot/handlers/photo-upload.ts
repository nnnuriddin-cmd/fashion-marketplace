/**
 * Seller sends a product photo: download → (Sharp studio processing + upload) ‖ (Gemini Vision)
 * → create a draft session and ask for the next step (price, category, or manual details).
 */
import crypto from 'crypto';
import { sendTelegramMessage } from '@/lib/telegram/notifier';
import { processAndStoreProductImage } from '@/lib/ai/image-processor';
import { analyzeClothingImage, VisionAnalysisResult } from '@/lib/ai/vision-analyzer';
import { getTelegramText, matchBrand, matchCategory } from '@/lib/telegram/product-draft';
import { createSession, deleteSellerSessions } from '../sessions';
import { startDraftStudioPhotos } from '../studio-photos';
import { downloadTelegramFile, sendTelegramChatAction } from '../telegram-api';
import type { SellerContext } from '../types';
import { Localized, buildPriceStepPromptAndKeyboard, cancelButtonRow } from '../ui';

export async function handlePhotoUpload(ctx: SellerContext, photoSizes: any[]) {
  const { supabase, chatId, store, lang } = ctx;
  const file = photoSizes.at(-1);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !file) {
    console.error('Telegram photo upload: TELEGRAM_BOT_TOKEN or file payload is missing');
    await sendTelegramMessage(chatId, '⚠️ Bot service configuration error. Please contact platform support.');
    return;
  }

  // Immediate "typing..." feedback before heavy processing
  sendTelegramChatAction(chatId, 'typing').catch(() => {});

  const download = await downloadTelegramFile(token, file.file_id);
  if (!download.ok) {
    const key = download.reason === 'get_file_failed' ? 'msg_photo_get_error' : 'msg_photo_download_error';
    await sendTelegramMessage(chatId, getTelegramText(lang, key));
    return;
  }

  // Re-trigger typing indicator so user sees activity throughout parallel processing
  sendTelegramChatAction(chatId, 'typing').catch(() => {});

  const sessionId = crypto.randomUUID();

  const imageProcessingPromise = processAndStoreProductImage({
    inputBuffer: download.buffer,
    storeId: store.id,
    fileId: sessionId,
  });
  const aiAnalysisPromise = analyzeClothingImage(download.buffer, 'image/jpeg', lang).catch((aiErr: any) => {
    console.warn('Gemini Vision extraction failed for store:', store.id, aiErr?.message || aiErr);
    return null;
  });

  let processedImage;
  let aiResult: VisionAnalysisResult | null = null;
  try {
    [processedImage, aiResult] = await Promise.all([imageProcessingPromise, aiAnalysisPromise]);
  } catch (procErr: any) {
    console.warn('Product image processing failed for store:', store.id, procErr?.message || procErr);
    const fallbackHelp: Localized = {
      uz: "Iltimos, hajmi 15MB dan kam bo'lgan aniq rasm (JPEG, PNG yoki WebP) yuboring.",
      ru: 'Пожалуйста, отправьте четкое фото (JPEG, PNG или WebP) размером менее 15 МБ.',
      en: 'Please send a clear photo (JPEG, PNG, or WebP) under 15MB.',
    };
    await sendTelegramMessage(
      chatId,
      `${getTelegramText(lang, 'msg_image_processing_failed')}\n\n${procErr?.message || fallbackHelp[lang]}`
    );
    return;
  }

  // Replace any previous unfinished draft of this seller & store
  await deleteSellerSessions(supabase, chatId, store.id);

  const baseSession = {
    id: sessionId,
    chatId,
    storeId: store.id,
    processedImageUrl: processedImage.publicUrl,
  };
  const baseDraft = {
    image: processedImage.publicUrl,
    storagePath: processedImage.storagePath,
  };

  if (!aiResult) {
    // AI extraction failed or unconfigured: save draft and offer manual details entry
    await createSession(supabase, { ...baseSession, step: 'AWAITING_DETAILS', draft: baseDraft });
    await sendTelegramMessage(
      chatId,
      '📸 <b>Photo processed & saved securely (1000x1000 WebP)!</b>\n\n' +
      'Please reply with the product details in format:\n' +
      '<code>Title | price | stock | description</code>\n\n' +
      '<i>Example: Linen Summer Blazer | 450000 | 10 | Premium European linen blazer</i>',
      { inline_keyboard: [[{ text: '❌ Cancel', callback_data: `cancel_${sessionId}` }]] }
    );
    return;
  }

  // Map AI output to real categories & brands from the database
  const [{ data: categories }, { data: brands }] = await Promise.all([
    supabase.from('categories').select('*'),
    supabase.from('brands').select('*'),
  ]);
  const mappedCat = matchCategory(aiResult.category, aiResult.gender, categories || []);
  const mappedBrand = matchBrand(aiResult.brand, brands || []);

  const aiDraft = {
    ...baseDraft,
    ai: aiResult,
    brand_id: mappedBrand.brandId,
    brand_name: mappedBrand.brandName,
    price: null,
    stock: null,
  };

  if (mappedCat) {
    // Category matched: proceed to price step
    const { error } = await createSession(supabase, {
      ...baseSession,
      step: 'AWAITING_PRICE',
      extractedMetadata: aiResult,
      draft: { ...aiDraft, category_id: mappedCat.categoryId, category_name: mappedCat.categoryName },
    });
    if (error) throw error;

    const { promptText, keyboard } = buildPriceStepPromptAndKeyboard(
      aiResult,
      mappedCat.categoryName,
      mappedBrand.brandName,
      sessionId,
      lang
    );
    await sendTelegramMessage(chatId, promptText, keyboard);
    await startDraftStudioPhotos(ctx, sessionId);
    return;
  }

  // Category could not be safely determined: ask seller to pick one
  const { error } = await createSession(supabase, {
    ...baseSession,
    step: 'AWAITING_CATEGORY',
    extractedMetadata: aiResult,
    draft: { ...aiDraft, category_id: null, category_name: null },
  });
  if (error) throw error;

  const rootCats = (categories || []).filter((c) => !c.parent_id).slice(0, 5);
  const inlineCatButtons = rootCats.map((c) => [
    { text: `📁 ${c.name}`, callback_data: `select_cat_${c.id}` },
  ]);
  inlineCatButtons.push(cancelButtonRow(lang, sessionId));

  await sendTelegramMessage(
    chatId,
    `✨ <b>${getTelegramText(lang, 'ai_complete')}</b>\n\n` +
    `🏷 <b>${getTelegramText(lang, 'label_title')}:</b> ${aiResult.title}\n` +
    `🎨 <b>${getTelegramText(lang, 'label_color')}:</b> ${aiResult.color}\n` +
    `👤 <b>${getTelegramText(lang, 'label_gender')}:</b> ${aiResult.gender}\n\n` +
    `❓ <b>${getTelegramText(lang, 'choose_category_prompt')}</b>`,
    { inline_keyboard: inlineCatButtons }
  );
  await startDraftStudioPhotos(ctx, sessionId);
}
