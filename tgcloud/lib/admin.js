import { db, api } from 'sdk';
import { eq, sql } from 'sdk/db';
import { users, downloads, channels, admins, adminStates } from '../schema.js';
import { getBotInfo } from './config.js';

export function toPersianDigits(str) {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (d) => farsiDigits[d]);
}

// -------------------------------------------------------------
// Anti-Flood & Concurrent Download Lock (In-Memory V8)
// -------------------------------------------------------------
const activeDownloads = new Set();
const lastDownloadTime = new Map();

export function isUserDownloading(chatId) {
  return activeDownloads.has(chatId);
}

export function lockUserDownload(chatId) {
  activeDownloads.add(chatId);
}

export function unlockUserDownload(chatId) {
  activeDownloads.delete(chatId);
  lastDownloadTime.set(chatId, Date.now());
}

export function getUserCooldownRemaining(chatId, cooldownMs = 3000) {
  const last = lastDownloadTime.get(chatId) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < cooldownMs) {
    return Math.ceil((cooldownMs - elapsed) / 1000);
  }
  return 0;
}

/**
 * Registers user in `users` table if not already present.
 */
export async function registerUser(chatId, lang = 'fa') {
  try {
    await db.insert(users)
      .values({ chatId, lang })
      .onConflictDoNothing({ target: users.chatId })
      .run();
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Checks if user is an admin.
 * If admins table is completely empty, auto-bootstraps the first user as superadmin.
 */
export async function isAdmin(chatId) {
  try {
    const adminCount = await db.$count(admins);
    if (adminCount === 0) {
      // First user to invoke /admin becomes superadmin
      await db.insert(admins).values({ chatId, role: 'superadmin' }).run();
      return true;
    }

    const row = await db.select().from(admins).where(eq(admins.chatId, chatId)).get();
    return !!row;
  } catch (err) {
    console.warn('[isAdmin] check error:', err?.message || err);
    return false;
  }
}

/**
 * Admin interactive states (e.g. WAITING_CHANNEL_FORWARD, WAITING_BROADCAST_MESSAGE)
 */
export async function getAdminState(chatId) {
  try {
    const row = await db.select().from(adminStates).where(eq(adminStates.chatId, chatId)).get();
    return row ? row.state : null;
  } catch {
    return null;
  }
}

export async function setAdminState(chatId, state) {
  try {
    await db.insert(adminStates)
      .values({ chatId, state })
      .onConflictDoUpdate({
        target: adminStates.chatId,
        set: { state },
      })
      .run();
  } catch (err) {
    console.warn('[setAdminState] error:', err?.message || err);
  }
}

export async function clearAdminState(chatId) {
  try {
    await db.delete(adminStates).where(eq(adminStates.chatId, chatId)).run();
  } catch {}
}

/**
 * Channels Management (Forced Join)
 */
export async function getForcedChannels() {
  try {
    return await db.select().from(channels).all();
  } catch (err) {
    console.warn('[getForcedChannels] error:', err?.message || err);
    return [];
  }
}

export async function addForcedChannel({ chatId, title, username, inviteLink }) {
  await db.insert(channels)
    .values({
      chatId: String(chatId),
      title,
      username: username || null,
      inviteLink: inviteLink || (username ? `https://t.me/${username}` : ''),
    })
    .onConflictDoUpdate({
      target: channels.chatId,
      set: {
        title,
        username: username || null,
        inviteLink: inviteLink || '',
      },
    })
    .run();
}

export async function deleteForcedChannel(id) {
  await db.delete(channels).where(eq(channels.id, Number(id))).run();
}

/**
 * Checks if a user has subscribed to all mandatory forced-join channels.
 * Admins bypass this check.
 */
export async function checkUserMembership(userId) {
  const channelList = await getForcedChannels();
  if (!channelList || channelList.length === 0) {
    return { isMember: true, missingChannels: [] };
  }

  const missingChannels = [];
  for (const ch of channelList) {
    try {
      const member = await api.getChatMember({
        chat_id: ch.chatId,
        user_id: userId,
      });

      const status = member?.status;
      if (!status || status === 'left' || status === 'kicked') {
        missingChannels.push(ch);
      } else if (status === 'restricted' && member.is_member === false) {
        missingChannels.push(ch);
      }
    } catch (err) {
      console.warn(`[checkUserMembership] Error for channel ${ch.chatId}:`, err?.message || err);
      const msg = String(err?.description || err?.message || '');
      if (msg.includes('user not found') || msg.includes('PARTICIPANT_ID_INVALID')) {
        missingChannels.push(ch);
      }
    }
  }

  return {
    isMember: missingChannels.length === 0,
    missingChannels,
  };
}

/**
 * Computes deep analytics for users, downloads, and media types.
 */
export async function getDetailedStats() {
  const nowSec = Math.floor(Date.now() / 1000);
  const dayAgo = nowSec - 86400;
  const weekAgo = nowSec - 7 * 86400;
  const monthAgo = nowSec - 30 * 86400;

  let totalUsers = 0;
  let usersToday = 0;
  let usersWeek = 0;
  let usersMonth = 0;

  let totalDownloads = 0;
  let downloadsToday = 0;
  let downloadsWeek = 0;
  let downloadsMonth = 0;

  const breakdown = {
    video: 0,
    photo: 0,
    carousel: 0,
    audio: 0,
  };

  try {
    totalUsers = await db.$count(users);
    const uToday = await db.get(sql`SELECT count(*) as c FROM users WHERE created_at >= ${dayAgo}`);
    usersToday = uToday?.c || 0;
    const uWeek = await db.get(sql`SELECT count(*) as c FROM users WHERE created_at >= ${weekAgo}`);
    usersWeek = uWeek?.c || 0;
    const uMonth = await db.get(sql`SELECT count(*) as c FROM users WHERE created_at >= ${monthAgo}`);
    usersMonth = uMonth?.c || 0;
  } catch (err) {
    console.warn('[getDetailedStats] users stats error:', err?.message || err);
  }

  try {
    totalDownloads = await db.$count(downloads);
    const dlToday = await db.get(sql`SELECT count(*) as c FROM downloads WHERE created_at >= ${dayAgo}`);
    downloadsToday = dlToday?.c || 0;
    const dlWeek = await db.get(sql`SELECT count(*) as c FROM downloads WHERE created_at >= ${weekAgo}`);
    downloadsWeek = dlWeek?.c || 0;
    const dlMonth = await db.get(sql`SELECT count(*) as c FROM downloads WHERE created_at >= ${monthAgo}`);
    downloadsMonth = dlMonth?.c || 0;

    const mediaRows = await db.all(sql`SELECT media_type, count(*) as cnt FROM downloads GROUP BY media_type`);
    if (Array.isArray(mediaRows)) {
      for (const r of mediaRows) {
        const type = String(r.media_type || '').toLowerCase();
        if (type.includes('photo') || type === 'image') breakdown.photo += (r.cnt || 0);
        else if (type.includes('audio') || type.includes('music')) breakdown.audio += (r.cnt || 0);
        else if (type.includes('carousel') || type.includes('album') || type.includes('sidecar')) breakdown.carousel += (r.cnt || 0);
        else breakdown.video += (r.cnt || 0);
      }
    }
  } catch (err) {
    console.warn('[getDetailedStats] downloads stats error:', err?.message || err);
  }

  const channelsCount = await db.$count(channels).catch(() => 0);

  return {
    users: { total: totalUsers, today: usersToday, week: usersWeek, month: usersMonth },
    downloads: { total: totalDownloads, today: downloadsToday, week: downloadsWeek, month: downloadsMonth },
    breakdown,
    channelsCount,
  };
}

/**
 * Exports all registered users as a downloadable CSV.
 */
export async function exportUsersCsv() {
  const allUsers = await db.select().from(users).all();
  let csv = 'ID,Chat_ID,Language,Joined_At\n';
  for (const u of allUsers) {
    const d = u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt || '');
    csv += `${u.id},${u.chatId},${u.lang || 'en'},${d}\n`;
  }
  const bytes = new TextEncoder().encode(csv);
  return {
    bytes,
    filename: `users_backup_${Date.now()}.csv`,
    count: allUsers.length,
  };
}

/**
 * UI Rendering functions for Admin Panel
 */
export function buildAdminMenu() {
  const text =
    `👑 <b>پنل مدیریت و کنترل ربات</b>\n\n` +
    `به کنترل‌پنل خوش آمدید. از منوی زیر بخش مورد نظر خود را انتخاب نمایید:`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '📊 آمار و تحلیل جامع', callback_data: 'admin:stats' },
        { text: '📢 قفل جوین اجباری', callback_data: 'admin:channels' },
      ],
      [
        { text: '📢 ارسال پیام همگانی', callback_data: 'admin:broadcast_prompt' },
        { text: '📥 دریافت فایل اعضا (Backup)', callback_data: 'admin:export_users' },
      ],
      [
        { text: '🔄 تازه‌سازی', callback_data: 'admin:menu' },
        { text: '❌ بستن منو', callback_data: 'admin:close' },
      ],
    ],
  };

  return { text, reply_markup };
}

export function buildStatsMessage(stats) {
  const u = stats.users;
  const d = stats.downloads;
  const b = stats.breakdown;

  const text =
    `📊 <b>گزارش و آمار تفصیلی سامانه:</b>\n\n` +
    `👥 <b>آمار کاربران:</b>\n` +
    `• کل کاربران: <b>${toPersianDigits(u.total)}</b> نفر\n` +
    `• کاربران امروز (۲۴ ساعت): <b>${toPersianDigits(u.today)}</b> نفر\n` +
    `• کاربران این هفته: <b>${toPersianDigits(u.week)}</b> نفر\n` +
    `• کاربران این ماه (۳۰ روز): <b>${toPersianDigits(u.month)}</b> نفر\n\n` +
    `📥 <b>آمار دانلودها:</b>\n` +
    `• کل دانلودها: <b>${toPersianDigits(d.total)}</b> فایل\n` +
    `• دانلودهای ۲۴ ساعت اخیر: <b>${toPersianDigits(d.today)}</b> عدد\n` +
    `• دانلودهای ۷ روز اخیر: <b>${toPersianDigits(d.week)}</b> عدد\n` +
    `• دانلودهای ۳۰ روز اخیر: <b>${toPersianDigits(d.month)}</b> عدد\n\n` +
    `🎬 <b>تفکیک بر اساس نوع رسانه:</b>\n` +
    `• 📹 ریلز و ویدیو: <b>${toPersianDigits(b.video)}</b>\n` +
    `• 📸 تصویر تک فریم: <b>${toPersianDigits(b.photo)}</b>\n` +
    `• 📚 آلبوم‌های چند اسلایدی: <b>${toPersianDigits(b.carousel)}</b>\n` +
    `• 🎵 صوت و آهنگ استخراج‌شده: <b>${toPersianDigits(b.audio)}</b>\n\n` +
    `📢 <b>جوین اجباری:</b>\n` +
    `• تعداد کانال‌های فعال قفل: <b>${toPersianDigits(stats.channelsCount)}</b> کانال`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '🔄 بروزرسانی آمار', callback_data: 'admin:stats' },
        { text: '🔙 بازگشت به منو', callback_data: 'admin:menu' },
      ],
    ],
  };

  return { text, reply_markup };
}

export function buildChannelsView(channelList) {
  let text = `📢 <b>مدیریت کانال‌های جوین اجباری:</b>\n\n`;

  if (!channelList || channelList.length === 0) {
    text += `<i>در حال حاضر هیچ کانالی برای جوین اجباری تنظیم نشده است. کاربران می‌توانند بدون قفل کانال از ربات استفاده نمایند.</i>\n\n`;
  } else {
    text += `لیست کانال‌های فعال که عضویت در آن‌ها اجباری است:\n\n`;
    channelList.forEach((ch, idx) => {
      const handle = ch.username ? `@${ch.username}` : `آیدی: <code>${ch.chatId}</code>`;
      text += `${toPersianDigits(idx + 1)}. <b>${ch.title}</b> (${handle})\n`;
    });
    text += `\n<i>جهت حذف هر کانال، روی دکمه حذف مربوط به آن در زیر کلیک کنید:</i>`;
  }

  const buttons = [];

  // Delete buttons for each channel
  if (channelList && channelList.length > 0) {
    channelList.forEach((ch) => {
      buttons.push([
        { text: `❌ حذف ${ch.title.slice(0, 20)}`, callback_data: `admin:del:${ch.id}` },
      ]);
    });
  }

  buttons.push([
    { text: '➕ افزودن کانال جدید', callback_data: 'admin:add_channel' },
  ]);
  buttons.push([
    { text: '🔙 بازگشت به پنل', callback_data: 'admin:menu' },
  ]);

  return { text, reply_markup: { inline_keyboard: buttons } };
}

export function buildAddChannelPrompt() {
  const text =
    `➕ <b>افزودن کانال به جوین اجباری:</b>\n\n` +
    `۱. ابتدا ربات را در کانال مورد نظر به عنوان <b>مدیر (Admin)</b> اضافه کنید تا امکان بررسی عضویت کاربران را داشته باشد.\n` +
    `۲. یک پیام از کانال را به این چت <b>فوروارد</b> کنید (یا آیدی عمومی مانند <code>@mychannel</code> یا آیدی عددی مانند <code>-100...</code> را بفرستید).\n\n` +
    `<i>جهت انصراف، دستور /cancel یا دکمه زیر را ارسال کنید.</i>`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: '❌ انصراف و بازگشت', callback_data: 'admin:channels' }],
    ],
  };

  return { text, reply_markup };
}

export function buildJoinGatePrompt(missingChannels) {
  const text =
    `⚠️ <b>جهت دانلود و استفاده از ربات، عضویت در کانال(های) زیر الزامی است:</b>\n\n` +
    `لطفاً در کانال(های) زیر عضو شوید و سپس دکمه <b>«🔄 بررسی عضویت»</b> را لمس نمایید:`;

  const buttons = [];
  for (const ch of missingChannels) {
    const link = ch.inviteLink || (ch.username ? `https://t.me/${ch.username}` : null);
    if (link) {
      buttons.push([{ text: `📢 عضویت در ${ch.title}`, url: link }]);
    }
  }

  buttons.push([
    { text: '🔄 بررسی عضویت / تایید', callback_data: 'check_join' },
  ]);

  return { text, reply_markup: { inline_keyboard: buttons } };
}

export function buildBroadcastPrompt() {
  const text =
    `📢 <b>ارسال پیام همگانی به تمام کاربران:</b>\n\n` +
    `پیام مورد نظر خود را ارسال یا فوروارد کنید.\n` +
    `• می‌تواند متن، عکس، ویدیو، گیف یا فایل صوتی باشد.\n` +
    `• دکمه‌های شیشه‌ای و فرمت‌های متن دقیقاً حفظ خواهند شد.\n\n` +
    `<i>برای انصراف، دستور /cancel را بفرستید یا دکمه زیر را لمس کنید:</i>`;

  const reply_markup = {
    inline_keyboard: [
      [{ text: '❌ انصراف و بازگشت', callback_data: 'admin:menu' }],
    ],
  };

  return { text, reply_markup };
}

export function buildBroadcastConfirm(sourceMessageId, totalUsers) {
  const text =
    `📋 <b>تایید ارسال پیام همگانی:</b>\n\n` +
    `پیام شما آماده ارسال به <b>${toPersianDigits(totalUsers)}</b> کاربر ثبت‌شده ربات است.\n\n` +
    `آیا از شروع ارسال همگانی اطمینان دارید؟`;

  const reply_markup = {
    inline_keyboard: [
      [
        { text: '🚀 تایید و شروع ارسال', callback_data: `admin:send_broadcast:${sourceMessageId}` },
      ],
      [
        { text: '❌ لغو ارسال', callback_data: 'admin:menu' },
      ],
    ],
  };

  return { text, reply_markup };
}
