import { api, db, InputFile, fetch } from 'sdk';
import { extractShortcode, resolveInstagramMedia } from '../lib/instagram.js';
import { LiveProgressTracker } from '../lib/tracker.js';
import { downloads, users } from '../schema.js';
import { getUserLang, setUserLang, getLocale, buildReplyKeyboard, buildLanguageInlineKeyboard } from '../lib/i18n.js';
import { getBotInfo, buildDownloadUrl } from '../lib/config.js';
import {
  registerUser,
  isAdmin,
  getAdminState,
  clearAdminState,
  addForcedChannel,
  checkUserMembership,
  buildAdminMenu,
  buildJoinGatePrompt,
  getForcedChannels,
  buildChannelsView,
  isUserDownloading,
  lockUserDownload,
  unlockUserDownload,
  getUserCooldownRemaining,
  buildBroadcastConfirm,
} from '../lib/admin.js';

// Setup Telegram Bot commands in client popup menu
let commandsConfigured = false;
async function ensureBotCommands() {
  if (commandsConfigured) return;
  try {
    await api.setMyCommands({
      commands: [
        { command: 'start', description: '🚀 Start Bot / شروع ربات' },
        { command: 'stats', description: '📊 Download Statistics / آمار دانلودها' },
        { command: 'admin', description: '👑 Admin Dashboard / پنل مدیریت' },
        { command: 'help', description: '💡 Help & Guide / راهنمای ربات' },
        { command: 'lang', description: '🌐 Change Language / تغییر زبان' },
      ]
    });
    commandsConfigured = true;
  } catch (err) {
    console.warn('[setMyCommands] warning:', err?.message || err);
  }
}

export default async function (message, ctx) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  // Ensure commands menu is registered
  ensureBotCommands().catch(() => {});

  const botInfo = await getBotInfo();
  const currentLang = await getUserLang(chatId);
  const locale = getLocale(currentLang);
  const replyKeyboard = buildReplyKeyboard(currentLang);

  // Auto-register user in DB for analytics
  await registerUser(chatId, currentLang);

  // -------------------------------------------------------------
  // ADMIN INTERACTIVE STATE: Adding Forced Join Channel
  // -------------------------------------------------------------
  const adminState = await getAdminState(chatId);
  if (adminState === 'WAITING_CHANNEL_FORWARD') {
    if (text === '/cancel' || text === 'انصراف' || text === 'لغو' || text === 'cancel') {
      await clearAdminState(chatId);
      const channelList = await getForcedChannels();
      const view = buildChannelsView(channelList);
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ عملیات افزودن کانال لغو شد.\n\n${view.text}`,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      });
      return;
    }

    let targetChatId = null;
    let targetTitle = '';
    let targetUsername = null;

    // Option A: Message forwarded from channel
    if (message.forward_from_chat) {
      targetChatId = message.forward_from_chat.id;
      targetTitle = message.forward_from_chat.title || 'کانال تلگرام';
      targetUsername = message.forward_from_chat.username || null;
    } else if (text) {
      // Option B: Admin sent @username, t.me link, or numeric ID
      let cleanQuery = text.trim();
      const linkMatch = cleanQuery.match(/(?:t\.me\/|@)([a-zA-Z0-9_]{4,})/);
      if (linkMatch) {
        cleanQuery = '@' + linkMatch[1];
      }
      try {
        const chatInfo = await api.getChat({ chat_id: cleanQuery });
        if (chatInfo) {
          targetChatId = chatInfo.id;
          targetTitle = chatInfo.title || cleanQuery;
          targetUsername = chatInfo.username || null;
        }
      } catch (getChatErr) {
        console.warn('[getChat] failed:', getChatErr?.message || getChatErr);
      }
    }

    if (!targetChatId) {
      await api.sendMessage({
        chat_id: chatId,
        text:
          `⚠️ <b>کانال شناسایی نشد!</b>\n\n` +
          `لطفاً یک پیام را مستقیماً از کانال فوروارد کنید یا آیدی آن را به صورت <code>@channel_username</code> بفرستید.\n\n` +
          `<i>برای لغو، دستور /cancel را ارسال نمایید.</i>`,
        parse_mode: 'HTML',
      });
      return;
    }

    // Verify bot is admin in the target channel
    try {
      const me = await api.getMe();
      const member = await api.getChatMember({
        chat_id: targetChatId,
        user_id: me.id,
      });

      const isAdminMember = member && (member.status === 'administrator' || member.status === 'creator');
      if (!isAdminMember) {
        await api.sendMessage({
          chat_id: chatId,
          text:
            `❌ <b>ربات در این کانال ادمین نیست!</b>\n\n` +
            `برای فعال‌سازی قفل جوین اجباری، ابتدا باید ربات (<code>@${me.username}</code>) را در کانال <b>${targetTitle}</b> ادمین نمایید تا امکان استعلام عضویت اعضا را داشته باشد.\n\n` +
            `پس از ادمین کردن ربات، مجدداً یک پیام از آن فوروارد کنید (یا /cancel برای لغو).`,
          parse_mode: 'HTML',
        });
        return;
      }

      // Resolve invite link
      let inviteLink = targetUsername ? `https://t.me/${targetUsername}` : '';
      if (!targetUsername) {
        try {
          inviteLink = await api.exportChatInviteLink({ chat_id: targetChatId });
        } catch (linkErr) {
          console.warn('[exportChatInviteLink] error:', linkErr?.message || linkErr);
        }
      }

      // Add channel to SQLite
      await addForcedChannel({
        chatId: targetChatId,
        title: targetTitle,
        username: targetUsername,
        inviteLink,
      });

      await clearAdminState(chatId);

      const channelList = await getForcedChannels();
      const view = buildChannelsView(channelList);

      await api.sendMessage({
        chat_id: chatId,
        text:
          `✅ <b>کانال با موفقیت به قفل جوین اجباری افزوده شد!</b>\n\n` +
          `📢 عنوان: <b>${targetTitle}</b>\n` +
          `🆔 شناسه: <code>${targetChatId}</code>\n` +
          `🔗 لینک: ${inviteLink || 'بدون لینک عمومی'}\n\n` +
          `عضویت در این کانال اکنون برای تمام کاربران فعال شد.\n\n` +
          `${view.text}`,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      });
      return;
    } catch (verifyErr) {
      console.error('[verifyBotAdmin] error:', verifyErr);
      await api.sendMessage({
        chat_id: chatId,
        text:
          `❌ <b>خطا در استعلام کانال:</b>\n<code>${verifyErr?.description || verifyErr?.message || 'Unknown error'}</code>\n\n` +
          `مطمئن شوید ربات در کانال اضافه و ادمین شده است. برای لغو دستور /cancel را بزنید.`,
        parse_mode: 'HTML',
      });
      return;
    }
  }

  // -------------------------------------------------------------
  // ADMIN INTERACTIVE STATE: Broadcast Message Input
  // -------------------------------------------------------------
  if (adminState === 'WAITING_BROADCAST_MESSAGE') {
    if (text === '/cancel' || text === 'انصراف' || text === 'لغو' || text === 'cancel') {
      await clearAdminState(chatId);
      await api.sendMessage({
        chat_id: chatId,
        text: '❌ عملیات ارسال پیام همگانی لغو شد.',
        reply_markup: replyKeyboard,
      });
      return;
    }

    // Admin submitted the message to broadcast
    await clearAdminState(chatId);
    let totalUsers = 0;
    try {
      totalUsers = await db.$count(users);
    } catch {}

    const confirm = buildBroadcastConfirm(message.message_id, totalUsers);
    await api.sendMessage({
      chat_id: chatId,
      text: confirm.text,
      parse_mode: 'HTML',
      reply_markup: confirm.reply_markup,
      reply_to_message_id: message.message_id,
    });
    return;
  }

  // -------------------------------------------------------------
  // ADMIN PANEL (/admin)
  // -------------------------------------------------------------
  if (text === '/admin' || text === 'مدیریت' || text === 'admin' || text === 'پنل مدیریت') {
    const isUserAdmin = await isAdmin(chatId);
    if (!isUserAdmin) {
      await api.sendMessage({
        chat_id: chatId,
        text: '⛔️ <b>دسترسی غیرمجاز:</b> شما دسترسی به پنل مدیریت ربات را ندارید.',
        parse_mode: 'HTML',
        reply_markup: replyKeyboard,
      });
      return;
    }

    const menu = buildAdminMenu();
    await api.sendMessage({
      chat_id: chatId,
      text: menu.text,
      parse_mode: 'HTML',
      reply_markup: menu.reply_markup,
    });
    return;
  }

  // 1. /lang command or "🌐 Language" / "🌐 تغییر زبان"
  if (text === '/lang' || text === locale.keyboard.btnLanguage || text === '🌐 Language' || text === '🌐 تغییر زبان') {
    await api.sendMessage({
      chat_id: chatId,
      text: locale.lang.choose,
      parse_mode: 'HTML',
      reply_markup: buildLanguageInlineKeyboard(),
    });
    return;
  }

  // 2. /start command or "شروع"
  if (text === '/start' || text === 'شروع' || text === 'start') {
    await api.sendMessage({
      chat_id: chatId,
      text: locale.welcome(botInfo.name),
      parse_mode: 'HTML',
      reply_markup: replyKeyboard,
    });
    return;
  }

  // 3. /help command or "💡 Help" / "💡 راهنما"
  if (text === '/help' || text === locale.keyboard.btnHelp || text === '💡 Help' || text === '💡 راهنما' || text === 'راهنما') {
    await api.sendMessage({
      chat_id: chatId,
      text: locale.help(botInfo.name),
      parse_mode: 'HTML',
      reply_markup: replyKeyboard,
    });
    return;
  }

  // 4. /stats command or "📊 Statistics" / "📊 آمار"
  if (text === '/stats' || text === locale.keyboard.btnStats || text === '📊 Statistics' || text === '📊 آمار' || text === 'آمار') {
    let totalCount = 0;
    try {
      totalCount = await db.$count(downloads);
    } catch {}
    await api.sendMessage({
      chat_id: chatId,
      text: locale.stats(totalCount),
      parse_mode: 'HTML',
      reply_markup: replyKeyboard,
    });
    return;
  }

  // 5. Short Action Button: "⚡️ Send Link" / "⚡️ ارسال لینک"
  if (text === locale.keyboard.btnSendLink || text === '⚡️ Send Link' || text === '⚡️ ارسال لینک') {
    await api.sendMessage({
      chat_id: chatId,
      text: locale.send_link_prompt,
      parse_mode: 'HTML',
      reply_markup: replyKeyboard,
    });
    return;
  }

  // -------------------------------------------------------------
  // FORCED JOIN MEMBERSHIP GATE (For Regular Users)
  // -------------------------------------------------------------
  const userIsAdmin = await isAdmin(chatId);
  if (!userIsAdmin) {
    const { isMember, missingChannels } = await checkUserMembership(chatId);
    if (!isMember) {
      const gate = buildJoinGatePrompt(missingChannels);
      await api.sendMessage({
        chat_id: chatId,
        text: gate.text,
        parse_mode: 'HTML',
        reply_markup: gate.reply_markup,
        reply_to_message_id: message.message_id,
      });
      return;
    }
  }

  // 6. Extract Instagram Shortcode
  const shortcode = extractShortcode(text);
  if (!shortcode) {
    await api.sendMessage({
      chat_id: chatId,
      text: locale.invalid_link,
      parse_mode: 'HTML',
      reply_to_message_id: message.message_id,
      reply_markup: replyKeyboard,
    });
    return;
  }

  // -------------------------------------------------------------
  // Anti-Flood & Concurrent Lock (Zero-Spam Guard)
  // -------------------------------------------------------------
  if (isUserDownloading(chatId)) {
    await api.sendMessage({
      chat_id: chatId,
      text: locale.antiSpam.alreadyProcessing,
      parse_mode: 'HTML',
      reply_to_message_id: message.message_id,
      reply_markup: replyKeyboard,
    });
    return;
  }

  const waitSec = getUserCooldownRemaining(chatId, 3000);
  if (waitSec > 0) {
    await api.sendMessage({
      chat_id: chatId,
      text: locale.antiSpam.cooldown(waitSec),
      parse_mode: 'HTML',
      reply_to_message_id: message.message_id,
      reply_markup: replyKeyboard,
    });
    return;
  }

  // Lock user for download duration
  lockUserDownload(chatId);

  // 7. Live In-Place Progress Tracker (using localized messages)
  const tracker = new LiveProgressTracker(chatId, shortcode, message.message_id, currentLang);
  await tracker.start();

  try {
    // 8. Resolve media metadata via TwinGraph Web Engine
    const media = await resolveInstagramMedia(shortcode);

    // Update progress to Stage 2: Downloading
    await tracker.setStage('DOWNLOADING', media.videoQuality || 'HD');

    // Build clean caption with Collapsible Blockquote (Preserving 100% original text, NO translation)
    let caption = '';
    if (media.author) caption += `👤 <b>${media.author}</b>\n`;
    if (media.likes || media.comments) {
      caption += `❤️ ${media.likes || '0'} | 💬 ${media.comments || '0'}\n`;
    }
    if (media.videoQuality) {
      caption += `${locale.media.qualityLabel(media.videoQuality)}\n`;
    }
    if (media.caption) {
      const safeText = media.caption
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      caption += `\n${locale.media.captionHeader}\n<blockquote expandable>${safeText.slice(0, 650)}</blockquote>\n`;
    }
    caption += `\n${locale.media.attribution(botInfo.username)}`;

    // Telegram Bot API strictly limits copy_text to 1 - 256 characters.
    // For <= 256 chars: 1-tap instant copy without sending any extra message.
    // For > 256 chars: callback sends <pre> block with Telegram Desktop native [Copy] icon.
    const copyButton = media.caption ? (
      media.caption.length <= 256
        ? { text: locale.media.copyCaptionBtn, copy_text: { text: media.caption } }
        : { text: locale.media.copyCaptionFullBtn, callback_data: `copy:${media.shortcode}` }
    ) : null;

    // 9. Branch by Media Type

    // --- CASE A: Multi-Item Carousel Album (پست‌های اسلایدی) ---
    if (media.type === 'carousel' && media.carouselItems?.length > 1) {
      await tracker.setStage('UPLOADING', `${media.carouselItems.length}`);

      const mediaGroup = media.carouselItems.slice(0, 10).map((it, idx) => ({
        type: it.type === 'video' ? 'video' : 'photo',
        media: it.url,
        caption: idx === 0 ? `${locale.media.albumTitle(media.carouselItems.length)}\n\n${caption}` : undefined,
        parse_mode: idx === 0 ? 'HTML' : undefined,
      }));

      await api.sendMediaGroup({
        chat_id: chatId,
        media: mediaGroup,
        reply_to_message_id: message.message_id,
      });

      if (copyButton) {
        await api.sendMessage({
          chat_id: chatId,
          text: locale.media.albumActions(shortcode),
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[copyButton]]
          },
          reply_to_message_id: message.message_id,
        });
      }
    }

    // --- CASE B: Single Video / Reel ---
    else if (media.type === 'video' && media.videoUrl) {
      const videoDownloadUrl = await buildDownloadUrl(media.videoUrl, media.shortcode);
      const inlineButtons = [
        [
          { text: locale.media.audioBtn, callback_data: `audio:${media.shortcode}` },
          { text: locale.media.directHdBtn, url: videoDownloadUrl }
        ]
      ];
      if (media.photoUrl) {
        inlineButtons.push([
          { text: locale.media.coverBtn, callback_data: `cover:${media.shortcode}` }
        ]);
      }
      if (copyButton) {
        inlineButtons.push([copyButton]);
      }

      let videoDelivered = false;

      // Tier 1: Try sending via direct URL (instantaneous, 0 memory, perfect for files <= 20 MB)
      try {
        await api.sendVideo({
          chat_id: chatId,
          video: media.videoUrl,
          caption: caption,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: inlineButtons },
          reply_to_message_id: message.message_id,
        });
        videoDelivered = true;
      } catch (videoError) {
        const errDesc = videoError?.description || videoError?.message || '';
        console.log(`[sendVideo Primary] Failed for ${shortcode}: ${errDesc}`);

        // Adaptive Quality: If primary exceeds Telegram limits, try alternative optimized profiles
        if (media.videoVersions && media.videoVersions.length > 1) {
          for (let i = 1; i < media.videoVersions.length; i++) {
            const altVersion = media.videoVersions[i];
            if (!altVersion?.url || altVersion.url === media.videoUrl) continue;
            console.log(`[sendVideo Adaptive] Trying alternative profile ${i} for ${shortcode}...`);
            try {
              await tracker.setStage('UPLOADING', `HD`);
              await api.sendVideo({
                chat_id: chatId,
                video: altVersion.url,
                caption: caption,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: inlineButtons },
                reply_to_message_id: message.message_id,
              });
              videoDelivered = true;
              console.log(`[sendVideo Adaptive] Succeeded with alternative profile ${i}!`);
              break;
            } catch (altErr) {
              console.log(`[sendVideo Adaptive] Profile ${i} failed:`, altErr?.description || altErr?.message);
            }
          }
        }
      }

      // Tier 2: If file is > 50 MB (exceeding Telegram Bot hard upload limit)
      if (!videoDelivered) {
        console.log(`[Fallback] Delivering cover photo with high-priority direct link for ${shortcode}`);
        const largeFileButtons = [
          [{ text: locale.media.largeFileBtn, url: videoDownloadUrl }],
          [
            { text: locale.media.audioBtn, callback_data: `audio:${media.shortcode}` },
            { text: locale.media.coverBtn, callback_data: `cover:${media.shortcode}` }
          ]
        ];
        if (copyButton) largeFileButtons.push([copyButton]);

        await api.sendPhoto({
          chat_id: chatId,
          photo: media.photoUrl,
          caption: `${caption}\n\n${locale.media.largeFileNotice}`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: largeFileButtons },
          reply_to_message_id: message.message_id,
        });
      }
    }

    // --- CASE C: Single Photo ---
    else if (media.photoUrl) {
      await tracker.setStage('UPLOADING', 'Photo');
      const photoDownloadUrl = await buildDownloadUrl(media.photoUrl, media.shortcode);

      const photoButtons = [
        [{ text: locale.media.photoDirectBtn, url: photoDownloadUrl }]
      ];
      if (copyButton) {
        photoButtons.push([copyButton]);
      }

      await api.sendPhoto({
        chat_id: chatId,
        photo: media.photoUrl,
        caption: `${locale.media.photoTitle}\n\n${caption}`,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: photoButtons },
        reply_to_message_id: message.message_id,
      });
    }

    // 10. Save record in SQLite
    try {
      await db.insert(downloads)
        .values({
          chatId,
          shortcode: media.shortcode,
          mediaType: media.type,
        })
        .run();
    } catch (dbErr) {
      console.warn('DB insert error:', dbErr);
    }

    // 11. Cleanly finish & remove progress tracker
    await tracker.finish();

  } catch (error) {
    console.error('Media resolution error for', shortcode, ':', error);
    const isCallerAdmin = await isAdmin(chatId);
    if (isCallerAdmin) {
      const errorMessage = error?.description || error?.message || 'Error resolving media';
      await tracker.showError(`🔧 <b>خطای فنی (مخصوص ادمین):</b>\n<code>${errorMessage}</code>`);
    } else {
      await tracker.showError(locale.userErrorFriendly);
    }
  } finally {
    // Release anti-spam lock
    unlockUserDownload(chatId);
  }
}
