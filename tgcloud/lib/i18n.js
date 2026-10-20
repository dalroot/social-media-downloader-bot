import { db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { CONFIG } from './config.js';
import en from './locales_en.js';
import fa from './locales_fa.js';

const LOCALES = {
  en,
  fa,
};

// In-memory cache for fast user language lookups
const userLangCache = new Map();

/**
 * Returns locale object for given language code (falls back to DEFAULT_LANG)
 */
export function getLocale(langCode) {
  return LOCALES[langCode] || LOCALES[CONFIG.DEFAULT_LANG] || LOCALES.en;
}

/**
 * Gets the preferred language for a user (DB backed with memory cache)
 */
export async function getUserLang(chatId) {
  if (userLangCache.has(chatId)) {
    return userLangCache.get(chatId);
  }

  try {
    const row = await db.select().from(users).where(eq(users.chatId, chatId)).get();
    if (row?.lang && LOCALES[row.lang]) {
      userLangCache.set(chatId, row.lang);
      return row.lang;
    }
  } catch (err) {
    console.warn('[getUserLang] DB read error:', err?.message || err);
  }

  const defaultLang = CONFIG.DEFAULT_LANG || 'en';
  userLangCache.set(chatId, defaultLang);
  return defaultLang;
}

/**
 * Updates the user's preferred language in SQLite DB
 */
export async function setUserLang(chatId, langCode) {
  const safeLang = LOCALES[langCode] ? langCode : CONFIG.DEFAULT_LANG;
  userLangCache.set(chatId, safeLang);

  try {
    await db.insert(users)
      .values({ chatId, lang: safeLang })
      .onConflictDoUpdate({
        target: users.chatId,
        set: { lang: safeLang },
      })
      .run();
  } catch (err) {
    console.warn('[setUserLang] DB update error:', err?.message || err);
  }

  return safeLang;
}

/**
 * Builds persistent reply keyboard with input_field_placeholder in the user's language
 */
export function buildReplyKeyboard(langCode) {
  const locale = getLocale(langCode);
  const kb = locale.keyboard;

  return {
    keyboard: [
      [{ text: kb.btnSendLink }, { text: kb.btnStats }],
      [{ text: kb.btnHelp }, { text: kb.btnLanguage }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: kb.inputPlaceholder,
  };
}

/**
 * Inline keyboard markup for switching languages
 */
export function buildLanguageInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🇬🇧 English', callback_data: 'setlang:en' },
        { text: '🇮🇷 فارسی', callback_data: 'setlang:fa' },
      ],
    ],
  };
}
