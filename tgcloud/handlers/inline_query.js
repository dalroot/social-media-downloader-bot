import { api } from 'sdk';
import { extractShortcode, resolveInstagramMedia } from '../lib/instagram.js';
import { getBotInfo } from '../lib/config.js';

export default async function (inlineQuery, ctx) {
  const query = (inlineQuery.query || '').trim();
  const shortcode = extractShortcode(query);
  const botInfo = await getBotInfo();

  if (!shortcode) {
    try {
      await api.answerInlineQuery({
        inline_query_id: inlineQuery.id,
        results: [],
        switch_pm_text: '⚡️ Paste Instagram link here / لینک پست را وارد کنید',
        switch_pm_parameter: 'start',
      });
    } catch {}
    return;
  }

  try {
    const media = await resolveInstagramMedia(shortcode);
    const results = [];

    if (media.videoUrl) {
      results.push({
        type: 'video',
        id: `vid_${shortcode}`,
        video_url: media.videoUrl,
        mime_type: 'video/mp4',
        thumbnail_url: media.photoUrl || 'https://instagram.com/favicon.ico',
        title: `🎬 ${media.author || shortcode}`,
        description: media.caption ? media.caption.slice(0, 80) : 'HD Video',
        caption: `🎬 <b>${media.author || 'Instagram'}</b>\n\n${media.caption ? media.caption.slice(0, 300) : ''}\n\n⚡️ Downloaded via @${botInfo.username}`,
        parse_mode: 'HTML',
      });
    } else if (media.photoUrl) {
      results.push({
        type: 'photo',
        id: `img_${shortcode}`,
        photo_url: media.photoUrl,
        thumbnail_url: media.photoUrl,
        title: `📸 ${media.author || shortcode}`,
        caption: `📸 <b>${media.author || 'Instagram'}</b>\n\n${media.caption ? media.caption.slice(0, 300) : ''}\n\n⚡️ Downloaded via @${botInfo.username}`,
        parse_mode: 'HTML',
      });
    }

    await api.answerInlineQuery({
      inline_query_id: inlineQuery.id,
      results,
      cache_time: 300,
    });
  } catch (err) {
    console.error('Inline query error:', err);
    try {
      await api.answerInlineQuery({
        inline_query_id: inlineQuery.id,
        results: [],
        switch_pm_text: '❌ Error resolving media',
        switch_pm_parameter: 'error',
      });
    } catch {}
  }
}
