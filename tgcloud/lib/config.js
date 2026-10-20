import { api, fetch } from 'sdk';

/**
 * MetaTwin Downloader Bot — Central Configuration
 * You can easily customize the bot name, default username, and supported languages here.
 */
export const CONFIG = {
  // Default display name if not fetched from Telegram Bot API
  BOT_NAME: 'سوشیال مدیا دانلودر',

  // Fallback username (without @)
  BOT_USERNAME: 'SocialHubDLbot',

  // Default system language for new users ('fa' = Persian, 'en' = English)
  DEFAULT_LANG: 'fa',

  // Supported languages list
  SUPPORTED_LANGS: ['fa', 'en'],

  // Dedicated Cloudflare Edge Worker for Clean Shortlinks (Zero Giant Links)
  // Worker: instagram.apominer.workers.dev
  // If set to null or empty '', the bot directly uses Instagram CDN URLs with 0% worker dependency.
  CLOUDFLARE_WORKER_URL: 'https://instagram.apominer.workers.dev',
};

/**
 * Builds an ultra-clean shortlink (e.g. https://instagram.apominer.workers.dev/d/:shortcode)
 * and registers the direct CDN URL in Cloudflare KV.
 * Completely safe fallback: if CLOUDFLARE_WORKER_URL is empty, returns direct URL.
 */
export async function buildDownloadUrl(directCdnUrl, shortcode = 'media') {
  if (!directCdnUrl) return '';
  if (CONFIG.CLOUDFLARE_WORKER_URL && shortcode) {
    const shortlink = `${CONFIG.CLOUDFLARE_WORKER_URL}/d/${shortcode}`;
    try {
      await fetch(`${CONFIG.CLOUDFLARE_WORKER_URL}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcode, url: directCdnUrl }),
      });
    } catch (err) {
      console.warn('[buildDownloadUrl] Failed to register KV mapping:', err?.message || err);
    }
    return shortlink;
  }
  return directCdnUrl;
}

let cachedBotInfo = null;

/**
 * Dynamically resolves bot name and username from Telegram Bot API
 * Fallback to CONFIG constants if offline.
 */
export async function getBotInfo() {
  if (cachedBotInfo) return cachedBotInfo;
  try {
    const me = await api.getMe();
    if (me?.username) {
      cachedBotInfo = {
        name: me.first_name || CONFIG.BOT_NAME,
        username: me.username,
      };
      return cachedBotInfo;
    }
  } catch (err) {
    console.warn('[getBotInfo] getMe error, using fallback config:', err?.message || err);
  }
  return {
    name: CONFIG.BOT_NAME,
    username: CONFIG.BOT_USERNAME,
  };
}
