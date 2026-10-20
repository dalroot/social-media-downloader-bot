/**
 * Meta Twin Unofficial — Instagram Media Resolver for Telegram Serverless
 * 
 * Features:
 * - 100% Zero-Account Pure Guest Mode (0% account risk, no login cookies, no sessions)
 * - Multi-Item Carousel / Sidecar Ingestion (Multi-Photo & Multi-Video Albums)
 * - Comprehensive HTML Entity Decoder for Persian/Arabic/Unicode text
 * - Clean metadata formatting (Likes, Comments, Author, Clean Caption)
 * - Adaptive Bitrate & Highest Quality Selector
 */

import { fetch } from 'sdk';

// Official Custom Emoji IDs from Telegram Bot Updates
export const EMOJIS = {
  INSTAGRAM: '<tg-emoji emoji-id="5935998223045889696">📸</tg-emoji>',
  YOUTUBE: '<tg-emoji emoji-id="5934029049260150525">📹</tg-emoji>',
  APARAT: '<tg-emoji emoji-id="6003381410902055685">🎥</tg-emoji>',
  TIKTOK: '<tg-emoji emoji-id="5936080475964576264">📹</tg-emoji>',
  LINKEDIN: '<tg-emoji emoji-id="5346024520081751155">📱</tg-emoji>',
  TWITTER_X: '<tg-emoji emoji-id="5330337435500951363">📱</tg-emoji>',
  TELEGRAM: '<tg-emoji emoji-id="5330237710655306682">📱</tg-emoji>',
  CHECKMARK: '<tg-emoji emoji-id="5206607081334906820">✔️</tg-emoji>',
  WAVE: '<tg-emoji emoji-id="5472055112702629499">👋🏻</tg-emoji>',
};

/**
 * Decodes all HTML entities (hex, decimal, named) into clean UTF-8 text
 */
export function decodeHTMLEntities(text) {
  if (!text) return '';
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
    })
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'")
    .replace(/\u200e/g, '')
    .replace(/\u200f/g, '')
    .trim();
}

/**
 * Extracts and cleans metadata from raw og:description
 */
export function parseCaptionInfo(rawDesc) {
  const decoded = decodeHTMLEntities(rawDesc);
  // Pattern: "1,464 likes, 196 comments - author on October 19, 2026: "caption""
  const match = decoded.match(/^([0-9.,KMB]+)\s+likes,\s+([0-9.,KMB]+)\s+comments\s+-\s+([^\s]+)\s+on\s+[^:]+:\s*\"?(.*?)\"?$/s);
  if (match) {
    return {
      likes: match[1],
      comments: match[2],
      author: match[3],
      caption: (match[4] || '').replace(/\"$/, '').trim()
    };
  }
  return { likes: '', comments: '', author: '', caption: decoded };
}

/**
 * Extracts Instagram shortcode from text or URL
 */
export function extractShortcode(text) {
  if (!text) return null;
  const regex = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i;
  const match = text.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  if (/^[A-Za-z0-9_-]{9,15}$/.test(text.trim())) {
    return text.trim();
  }
  return null;
}

/**
 * Resolves Instagram media using 100% Zero-Account Pure Guest Mode.
 * Strictly no cookies, no accounts, 0% ban risk.
 */
export async function resolveInstagramMedia(shortcode) {
  const result = await fetchMediaPage(shortcode);
  if (!result || (!result.videoUrl && result.mediaType !== 'photo_only' && !result.carouselItems?.length && !result.photoUrl)) {
    throw new Error('محتوایی در صفحه اینستاگرام یافت نشد (احتمالاً پیج خصوصی است یا ریلز موقتاً در دسترس نیست).');
  }
  return result;
}

async function fetchMediaPage(shortcode) {
  const targetUrl = `https://www.instagram.com/reel/${shortcode}/`;
  
  // 100% Windows 11 Chrome Web Twin (Pure Guest Mode, Zero Account Risk)
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
    'X-IG-App-ID': '936619743392459',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '"15.0.0"',
    'sec-ch-ua-arch': '"x86"',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-model': '""',
  };

  let html = '';
  try {
    const response = await fetch(targetUrl, { method: 'GET', headers });
    if (response.ok || response.status === 200) {
      html = await response.text();
    }
  } catch (err) {
    console.warn(`[fetchMediaPage] Primary URL fetch error: ${err.message}`);
  }

  if (!html) {
    const fallbackUrl = `https://www.instagram.com/p/${shortcode}/`;
    const fallbackRes = await fetch(fallbackUrl, { method: 'GET', headers });
    if (!fallbackRes.ok && fallbackRes.status !== 200) {
      throw new Error(`Instagram returned HTTP ${fallbackRes.status} for shortcode ${shortcode}`);
    }
    html = await fallbackRes.text();
  }

  return parseHtmlPayload(html, shortcode);
}

function parseHtmlPayload(html, shortcode) {
  let videoUrl = null;
  let photoUrl = null;
  let videoQuality = '';
  let isGated = html.includes('gating_ruling');
  const carouselItems = [];

  // Check Post Type
  const isImageMedia = html.includes('XIGPolarisImageMedia');

  // 1. Parse og:description and author
  const ogDescMatch = html.match(/<meta property="og:description" content="([^"]*)"/i);
  const rawDesc = ogDescMatch ? ogDescMatch[1] : '';
  const parsedMeta = parseCaptionInfo(rawDesc);

  const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]*)"/i);
  const ogTitle = ogTitleMatch ? decodeHTMLEntities(ogTitleMatch[1]) : '';
  const author = parsedMeta.author || ogTitle || 'Instagram Creator';

  // 2. High-Fidelity Polaris video_versions extraction (Sorted by highest resolution)
  let videoVersions = [];
  const videoMatch = html.match(/"video_versions":\s*(\[[^\]]+\])/);
  if (videoMatch) {
    try {
      const versions = JSON.parse(videoMatch[1]);
      if (Array.isArray(versions) && versions.length > 0) {
        versions.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
        videoVersions = versions;
        videoUrl = versions[0].url;
        if (versions[0].width && versions[0].height) {
          videoQuality = `${versions[0].width}x${versions[0].height}`;
        }
      }
    } catch {}
  }

  // 3. Fallback to og:video, schema.org contentUrl, or direct JSON video_url
  if (!videoUrl) {
    const ogVideoMatch = html.match(/<meta property="og:video" content="([^"]*)"/i);
    if (ogVideoMatch) {
      videoUrl = ogVideoMatch[1].replace(/&amp;/g, '&');
      videoQuality = 'Standard Web';
    }
  }

  if (!videoUrl) {
    const ldJsonMatch = html.match(/"contentUrl":\s*"([^"]+)"/);
    if (ldJsonMatch) {
      videoUrl = ldJsonMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      videoQuality = 'HD (Schema)';
    }
  }

  if (!videoUrl) {
    const rawVideoMatch = html.match(/"video_url":\s*"([^"]+)"/);
    if (rawVideoMatch) {
      videoUrl = rawVideoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
      videoQuality = 'HD (Direct)';
    }
  }

  // 4. Photo Candidates extraction
  const candsMatch = html.match(/"candidates":\s*(\[[^\]]+\])/);
  if (candsMatch) {
    try {
      const cands = JSON.parse(candsMatch[1]);
      if (Array.isArray(cands) && cands.length > 0) {
        cands.sort((a, b) => ((b.width || 0) * (b.height || 0)) - ((a.width || 0) * (a.height || 0)));
        photoUrl = cands[0].url;
      }
    } catch {}
  }

  if (!photoUrl) {
    const ogImageMatch = html.match(/<meta property="og:image" content="([^"]*)"/i);
    if (ogImageMatch) {
      photoUrl = ogImageMatch[1].replace(/&amp;/g, '&');
    }
  }

  if (!photoUrl) {
    const rawPhotoMatch = html.match(/"display_url":\s*"([^"]+)"/);
    if (rawPhotoMatch) {
      photoUrl = rawPhotoMatch[1].replace(/\\u0026/g, '&').replace(/\\/g, '');
    }
  }

  // 5. Multi-Item Carousel Extraction
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    const content = s[1];
    if (content.includes('carousel_media') || content.includes('edge_sidecar_to_children')) {
      try {
        const json = JSON.parse(content);
        const findCarousel = (obj) => {
          if (!obj || typeof obj !== 'object') return null;
          if (Array.isArray(obj.carousel_media)) return obj.carousel_media;
          if (Array.isArray(obj.edge_sidecar_to_children?.edges)) {
            return obj.edge_sidecar_to_children.edges.map(e => e.node);
          }
          for (const k of Object.keys(obj)) {
            const found = findCarousel(obj[k]);
            if (found) return found;
          }
          return null;
        };
        const items = findCarousel(json);
        if (items && items.length > 1) {
          for (const it of items) {
            const vUrl = it.video_versions?.[0]?.url;
            const pUrl = it.image_versions2?.candidates?.[0]?.url || it.display_url;
            if (vUrl) {
              carouselItems.push({ type: 'video', url: vUrl });
            } else if (pUrl) {
              carouselItems.push({ type: 'photo', url: pUrl });
            }
          }
          break;
        }
      } catch {}
    }
  }

  if (!videoUrl && !photoUrl && carouselItems.length === 0) {
    throw new Error('محتوایی در صفحه اینستاگرام یافت نشد (احتمالاً پیج خصوصی است).');
  }

  const isCarousel = carouselItems.length > 1;

  return {
    shortcode,
    type: isCarousel ? 'carousel' : (videoUrl ? 'video' : 'photo'),
    mediaType: isCarousel ? 'carousel' : (isImageMedia ? 'photo_only' : (videoUrl ? 'video' : 'photo')),
    videoUrl,
    videoVersions,
    photoUrl,
    carouselItems,
    videoQuality,
    isGated,
    author,
    likes: parsedMeta.likes,
    comments: parsedMeta.comments,
    caption: parsedMeta.caption,
  };
}
