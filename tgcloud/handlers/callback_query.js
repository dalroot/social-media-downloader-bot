import { api, db, InputFile, fetch } from 'sdk';
import { resolveInstagramMedia } from '../lib/instagram.js';
import { downloads, users } from '../schema.js';
import { getUserLang, setUserLang, getLocale, buildReplyKeyboard } from '../lib/i18n.js';
import { getBotInfo, CONFIG, buildDownloadUrl } from '../lib/config.js';
import {
  isAdmin,
  getDetailedStats,
  getForcedChannels,
  deleteForcedChannel,
  setAdminState,
  buildAdminMenu,
  buildStatsMessage,
  buildChannelsView,
  buildAddChannelPrompt,
  checkUserMembership,
  registerUser,
  exportUsersCsv,
  buildBroadcastPrompt,
  toPersianDigits,
} from '../lib/admin.js';

export default async function (callbackQuery, ctx) {
  const queryId = callbackQuery.id;
  const data = callbackQuery.data || '';
  const message = callbackQuery.message;
  const chatId = message?.chat?.id;

  const currentLang = await getUserLang(chatId);
  const locale = getLocale(currentLang);
  const botInfo = await getBotInfo();

  // Auto-register user in DB for analytics
  await registerUser(chatId, currentLang);

  // -------------------------------------------------------------
  // 1. Language switcher callback (e.g. setlang:en, setlang:fa)
  // -------------------------------------------------------------
  if (data.startsWith('setlang:')) {
    const newLang = data.slice(8);
    await setUserLang(chatId, newLang);
    const newLocale = getLocale(newLang);

    await api.answerCallbackQuery({
      callback_query_id: queryId,
      text: newLocale.lang.changed,
      show_alert: true,
    });

    // Update persistent reply keyboard in chat to the new language
    await api.sendMessage({
      chat_id: chatId,
      text: newLocale.welcome(botInfo.name),
      parse_mode: 'HTML',
      reply_markup: buildReplyKeyboard(newLang),
    });
    return;
  }

  // -------------------------------------------------------------
  // 2. Forced Join Membership Verification (check_join)
  // -------------------------------------------------------------
  if (data === 'check_join') {
    const { isMember } = await checkUserMembership(chatId);
    if (isMember) {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: '✅ عضویت شما تایید شد! اکنون می‌توانید لینک اینستاگرام را ارسال کنید.',
        show_alert: true,
      });

      // Remove the join prompt and show welcome
      try {
        await api.deleteMessage({
          chat_id: chatId,
          message_id: message.message_id,
        });
      } catch {}

      await api.sendMessage({
        chat_id: chatId,
        text: locale.welcome(botInfo.name),
        parse_mode: 'HTML',
        reply_markup: buildReplyKeyboard(currentLang),
      });
    } else {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: '❌ شما هنوز در تمام کانال‌ها عضو نشده‌اید! لطفاً ابتدا در تمام کانال‌ها عضو شوید سپس مجدداً این دکمه را لمس کنید.',
        show_alert: true,
      });
    }
    return;
  }

  // -------------------------------------------------------------
  // 3. Admin Panel Callbacks
  // -------------------------------------------------------------
  if (data.startsWith('admin:')) {
    const userIsAdmin = await isAdmin(chatId);
    if (!userIsAdmin) {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: '⛔️ شما دسترسی به پنل مدیریت ندارید.',
        show_alert: true,
      });
      return;
    }

    // A. Main Admin Menu
    if (data === 'admin:menu') {
      await api.answerCallbackQuery({ callback_query_id: queryId });
      const menu = buildAdminMenu();
      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text: menu.text,
        parse_mode: 'HTML',
        reply_markup: menu.reply_markup,
      });
      return;
    }

    // B. Detailed Statistics View
    if (data === 'admin:stats') {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: '📊 در حال محاسبه و استخراج آمار...',
      });
      const stats = await getDetailedStats();
      const msg = buildStatsMessage(stats);
      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text: msg.text,
        parse_mode: 'HTML',
        reply_markup: msg.reply_markup,
      });
      return;
    }

    // C. Forced Join Channels List
    if (data === 'admin:channels') {
      await api.answerCallbackQuery({ callback_query_id: queryId });
      const channelList = await getForcedChannels();
      const view = buildChannelsView(channelList);
      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text: view.text,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      });
      return;
    }

    // D. Add Channel Prompt
    if (data === 'admin:add_channel') {
      await api.answerCallbackQuery({ callback_query_id: queryId });
      await setAdminState(chatId, 'WAITING_CHANNEL_FORWARD');
      const prompt = buildAddChannelPrompt();
      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text: prompt.text,
        parse_mode: 'HTML',
        reply_markup: prompt.reply_markup,
      });
      return;
    }

    // E. Delete Channel
    if (data.startsWith('admin:del:')) {
      const channelId = data.slice(10);
      await deleteForcedChannel(channelId);
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: '✅ کانال با موفقیت از جوین اجباری حذف شد.',
        show_alert: true,
      });
      const channelList = await getForcedChannels();
      const view = buildChannelsView(channelList);
      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text: view.text,
        parse_mode: 'HTML',
        reply_markup: view.reply_markup,
      });
      return;
    }

    // F. Export Users Backup CSV
    if (data === 'admin:export_users') {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: '📦 در حال ایجاد فایل پشتیبان کاربران...',
      });
      try {
        const file = await exportUsersCsv();
        const doc = new InputFile(file.bytes, file.filename, { type: 'text/csv' });
        await api.sendDocument({
          chat_id: chatId,
          document: doc,
          caption: `📦 <b>پشتیبان لیست کاربران ربات:</b>\n\nتعداد کل اعضا: <b>${toPersianDigits(file.count)}</b> کاربر\nفرمت: <code>CSV (سازگار با اکسل و متنی)</code>`,
          parse_mode: 'HTML',
        });
      } catch (err) {
        console.error('[exportUsersCsv] error:', err);
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ خطا در استخراج فایل پشتیبان: ${err?.message || err}`,
        });
      }
      return;
    }

    // G. Broadcast Prompt
    if (data === 'admin:broadcast_prompt') {
      await api.answerCallbackQuery({ callback_query_id: queryId });
      await setAdminState(chatId, 'WAITING_BROADCAST_MESSAGE');
      const prompt = buildBroadcastPrompt();
      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text: prompt.text,
        parse_mode: 'HTML',
        reply_markup: prompt.reply_markup,
      });
      return;
    }

    // H. Execute Broadcast
    if (data.startsWith('admin:send_broadcast:')) {
      const sourceMessageId = Number(data.slice(21));
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: '🚀 فرآیند ارسال همگانی آغاز شد...',
      });

      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text: '📢 <b>ارسال همگانی در جریان است...</b>\n\nلطفاً تا پایان ارسال و صدور گزارش نهایی صبور باشید.',
        parse_mode: 'HTML',
      });

      const allUsers = await db.select().from(users).all();
      let successCount = 0;
      let blockedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < allUsers.length; i++) {
        const targetUser = allUsers[i];
        try {
          await api.copyMessage({
            chat_id: targetUser.chatId,
            from_chat_id: chatId,
            message_id: sourceMessageId,
          });
          successCount++;
        } catch (err) {
          const desc = String(err?.description || err?.message || '');
          if (desc.includes('blocked') || desc.includes('bot was blocked') || err?.code === 403) {
            blockedCount++;
          } else if (err?.code === 429) {
            const retrySec = (err?.parameters?.retry_after || 1);
            await new Promise(r => setTimeout(r, retrySec * 1000));
            try {
              await api.copyMessage({
                chat_id: targetUser.chatId,
                from_chat_id: chatId,
                message_id: sourceMessageId,
              });
              successCount++;
            } catch {
              failedCount++;
            }
          } else {
            failedCount++;
          }
        }

        // Safe telegram pacing: ~25 msgs/sec
        if (i > 0 && i % 20 === 0) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      await api.editMessageText({
        chat_id: chatId,
        message_id: message.message_id,
        text:
          `✅ <b>ارسال پیام همگانی به پایان رسید!</b>\n\n` +
          `📊 <b>گزارش نهایی:</b>\n` +
          `• کل کاربران: <b>${toPersianDigits(allUsers.length)}</b> نفر\n` +
          `• ارسال موفق: <b>${toPersianDigits(successCount)}</b> نفر 🚀\n` +
          `• ربات را بلاک کرده‌اند: <b>${toPersianDigits(blockedCount)}</b> نفر ⛔️\n` +
          `• سایر خطاها: <b>${toPersianDigits(failedCount)}</b> عدد`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 بازگشت به پنل مدیریت', callback_data: 'admin:menu' }],
          ],
        },
      });
      return;
    }

    // I. Close Admin Menu
    if (data === 'admin:close') {
      await api.answerCallbackQuery({ callback_query_id: queryId });
      try {
        await api.deleteMessage({
          chat_id: chatId,
          message_id: message.message_id,
        });
      } catch {
        await api.editMessageText({
          chat_id: chatId,
          message_id: message.message_id,
          text: '🔒 منوی مدیریت بسته شد.',
        });
      }
      return;
    }
  }

  // -------------------------------------------------------------
  // 4. Audio / Music extraction button
  // -------------------------------------------------------------
  if (data.startsWith('audio:')) {
    const shortcode = data.slice(6);
    try {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: locale.media.audioPreparing,
      });

      const media = await resolveInstagramMedia(shortcode);
      if (media.videoUrl) {
        const title = media.caption ? media.caption.slice(0, 60) : `Audio ${shortcode}`;
        const performer = media.author ? `${media.author} (Instagram)` : botInfo.name;

        // Register with Cloudflare Worker so it can stream pure AAC audio
        await buildDownloadUrl(media.videoUrl, shortcode);

        const pureAudioUrl = CONFIG.CLOUDFLARE_WORKER_URL 
          ? `${CONFIG.CLOUDFLARE_WORKER_URL}/a/${shortcode}.aac`
          : null;

        let audioSent = false;
        if (pureAudioUrl) {
          try {
            await api.sendAudio({
              chat_id: chatId,
              audio: pureAudioUrl,
              title,
              performer,
              reply_to_message_id: message.message_id,
            });
            audioSent = true;
          } catch (audioErr) {
            console.log(`[sendAudio Worker AAC] Failed:`, audioErr?.description || audioErr?.message);
          }
        }

        if (!audioSent) {
          try {
            await api.sendAudio({
              chat_id: chatId,
              audio: media.videoUrl,
              title,
              performer,
              reply_to_message_id: message.message_id,
            });
            audioSent = true;
          } catch (audioErr2) {
            await api.sendMessage({
              chat_id: chatId,
              text: locale.media.audioFallback(media.videoUrl),
              reply_to_message_id: message.message_id,
            });
          }
        }

        // Record audio download in SQLite
        if (audioSent) {
          try {
            await db.insert(downloads)
              .values({
                chatId,
                shortcode,
                mediaType: 'audio',
              })
              .run();
          } catch {}
        }
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: locale.media.audioError,
          reply_to_message_id: message.message_id,
        });
      }
    } catch (err) {
      console.error('Audio extraction callback error:', err);
      try {
        await api.answerCallbackQuery({
          callback_query_id: queryId,
          text: locale.media.audioError,
          show_alert: true,
        });
      } catch {}
    }
    return;
  }

  // -------------------------------------------------------------
  // 5. Cover Image Download button
  // -------------------------------------------------------------
  if (data.startsWith('cover:')) {
    const shortcode = data.slice(6);
    try {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
        text: locale.media.coverPreparing,
      });

      const media = await resolveInstagramMedia(shortcode);
      if (media.photoUrl) {
        await api.sendPhoto({
          chat_id: chatId,
          photo: media.photoUrl,
          caption: locale.media.coverCaption(media.author || 'Instagram', botInfo.username),
          parse_mode: 'HTML',
          reply_to_message_id: message?.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: locale.media.photoDirectBtn, url: media.photoUrl }]
            ]
          }
        });
      }
    } catch (err) {
      console.error('Cover download callback error:', err);
    }
    return;
  }

  // -------------------------------------------------------------
  // 6. Full Caption 1-Tap Copy button (for captions > 256 chars)
  // -------------------------------------------------------------
  if (data.startsWith('copy:')) {
    const shortcode = data.slice(5);
    try {
      await api.answerCallbackQuery({
        callback_query_id: queryId,
      });

      const media = await resolveInstagramMedia(shortcode);
      if (media.caption) {
        await api.sendMessage({
          chat_id: chatId,
          text: `${locale.media.captionCopiedHeader}\n\n<pre><code class="language-text">${media.caption}</code></pre>\n\n${locale.media.tapToCopy}`,
          parse_mode: 'HTML',
          reply_to_message_id: message.message_id,
        });
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: locale.media.captionEmpty,
          reply_to_message_id: message.message_id,
        });
      }
    } catch (err) {
      console.error('Copy caption callback error:', err);
    }
    return;
  }

  // -------------------------------------------------------------
  // 7. General Stats & Help buttons
  // -------------------------------------------------------------
  if (data === 'action:stats') {
    let count = 0;
    try {
      count = await db.$count(downloads);
    } catch {}
    await api.answerCallbackQuery({
      callback_query_id: queryId,
      text: locale.stats(count).replace(/<[^>]+>/g, ''),
      show_alert: true,
    });
    return;
  }

  if (data === 'action:help') {
    await api.answerCallbackQuery({
      callback_query_id: queryId,
      text: locale.help(botInfo.name).replace(/<[^>]+>/g, ''),
      show_alert: true,
    });
    return;
  }

  // Default fallback
  try {
    await api.answerCallbackQuery({ callback_query_id: queryId });
  } catch {}
}
