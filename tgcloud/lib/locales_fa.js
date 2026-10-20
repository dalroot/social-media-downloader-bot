/**
 * MetaTwin Downloader — Persian Locale (فارسی)
 */
function toPersianDigits(str) {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (d) => farsiDigits[d]);
}

export default {
  code: 'fa',
  name: 'فارسی',

  welcome: (botName) =>
    `سلام به <b>${botName}</b> خوش اومدی 👋🏻\n\n` +
    `لینک هر پستی رو که می‌خوای بفرست تا فایلش رو فوری بهت بدم\n\n` +
    `<b>پشتیبانی هوشمند از:</b>\n` +
    `📸 <b>اینستاگرام</b> — ریلز، پست اسلایدی و استوری با بالاترین کیفیت اورجینال ✔️`,

  help: (botName) =>
    `💡 <b>راهنمای استفاده از ${botName}:</b>\n\n` +
    `۱. وارد اینستاگرام شوید و روی Share پست یا ریلز بزنید.\n` +
    `۲. گزینه <b>Copy Link</b> را انتخاب کنید.\n` +
    `۳. لینک کپی شده را مستقیماً در این چت ارسال نمایید.\n\n` +
    `⚡️ <b>امکانات ویژه:</b>\n` +
    `• استخراج خودکار صوت و آهنگ ریلز با یک کلیک\n` +
    `• پشتیبانی کامل از آلبوم‌های چند اسلایدی (عکس و ویدیو)\n` +
    `• کپی آسان متن کپشن با دکمه اختصاصی\n` +
    `• بالاترین رزولوشن و کیفیت بدون افت کیفیت (1080p / 720p HD)`,

  stats: (count) =>
    `📊 <b>آمار دانلودها:</b>\n\n` +
    `تعداد کل رسانه‌های استخراج شده: <b>${toPersianDigits(count)}</b> عدد 🚀`,

  send_link_prompt:
    `📥 <b>ارسال لینک:</b>\n\n` +
    `کافیست لینک ریلز، پست یا استوری مورد نظرت رو اینجا بفرستی تا با بالاترین کیفیت برات دانلود و ارسال بشه ⚡️`,

  invalid_link:
    `⚠️ لطفاً یک لینک معتبر ریلز، پست یا استوری اینستاگرام ارسال کنید.\n\n` +
    `مثال:\n<code>https://www.instagram.com/reel/Dd_sxJDxH6G/</code>`,

  keyboard: {
    btnSendLink: '⚡️ ارسال لینک',
    btnStats: '📊 آمار',
    btnHelp: '💡 راهنما',
    btnLanguage: '🌐 تغییر زبان',
    inputPlaceholder: 'لینک اینستاگرام را اینجا پیست کنید...',
  },

  progress: {
    title: '📥 <b>دانلود از اینستاگرام</b>',
    stage1Title: '🔄 <b>مرحله ۱ از ۳: بررسی لینک و کیفیت</b>',
    stage1Desc: '🔎 <i>در حال ارتباط مستقیم با اینستاگرام...</i>',
    stage2Title: '⚡️ <b>مرحله ۲ از ۳: دریافت فایل اورجینال</b>',
    stage2Desc: (quality) => `📥 <i>در حال دانلود بالاترین کیفیت موجود (${quality || 'HD'})...</i>`,
    stage3Title: '🚀 <b>مرحله ۳ از ۳: ارسال به تلگرام شما</b>',
    stage3Desc: (info) => `📦 <i>در حال آماده‌سازی و ارسال مستقیم فایل (${info || 'HD'})...</i>`,
    elapsed: (time) => `⏱ زمان سپری‌شده: <b>${toPersianDigits(time)}</b>`,
    postId: (shortcode) => `کد پست: <code>${shortcode}</code>`,
    errorTitle: '❌ <b>خطا در دریافت مدیا:</b>',
  },

  media: {
    audioBtn: '🎵 استخراج صوت / موزیک ریلز',
    directHdBtn: '📥 لینک مستقیم HD',
    copyCaptionBtn: '📋 کپی متن کپشن',
    copyCaptionFullBtn: '📋 کپی متن کامل کپشن',
    albumTitle: (count) => `📚 <b>آلبوم اسلایدی اینستاگرام (${toPersianDigits(count)} اسلاید)</b>`,
    albumActions: (shortcode) => `📋 عملیات مرتبط با آلبوم <code>${shortcode}</code>:`,
    captionHeader: '📝 <b>کپشن پست:</b>',
    qualityLabel: (q) => `🎬 کیفیت: <code>${q}</code>`,
    attribution: (username) => `⚡️ دانلود شده توسط @${username}`,
    largeFileNotice: `⚠️ <b>این ویدیو با کیفیت فوق‌العاده بالا ضبط شده و حجم آن بیش از سقف ارسال مستقیم تلگرام است.</b>\nجهت دریافت فایل کامل ویدیو، دکمه دانلود زیر را لمس نمایید:`,
    largeFileBtn: '📥 دانلود مستقیم فایل ویدیوی کامل (HD MP4)',
    photoTitle: '📸 <b>تصویر باکیفیت اینستاگرام</b>',
    photoDirectBtn: '📥 دانلود مستقیم تصویر اورجینال',
    captionEmpty: '⚠️ این پست متنی به عنوان کپشن ندارد.',
    captionCopiedHeader: '📋 <b>متن کامل کپشن:</b>',
    tapToCopy: '<i>(با لمس کادر بالا، کل متن در کلیپ‌بورد کپی می‌شود)</i>',
    audioPreparing: '🎵 در حال آماده‌سازی صوت ریلز...',
    audioError: '❌ خطا در استخراج صوت.',
    audioFallback: (url) => `🎵 فایل صوتی از طریق لینک زیر قابل دانلود است:\n${url}`,
    coverBtn: '🖼 دانلود کاور ریلز',
    coverPreparing: '🖼 در حال آماده‌سازی و ارسال کاور باکیفیت...',
    coverCaption: (author, username) => `🖼 <b>کاور باکیفیت ریلز:</b>\n👤 <b>${author}</b>\n\n⚡️ دانلود شده توسط @${username}`,
  },

  lang: {
    choose: '🌐 <b>Choose your preferred language / زبان خود را انتخاب کنید:</b>',
    changed: '✅ زبان ربات با موفقیت به فارسی تغییر یافت.',
  },

  antiSpam: {
    alreadyProcessing: '⏳ <b>درخواست شما در حال پردازش است!</b>\nلطفاً تا پایان ارسال فایل قبلی، چند لحظه صبور باشید.',
    cooldown: (sec) => `⏳ <b>کمی صبور باشید!</b>\nلطفاً ${toPersianDigits(sec)} ثانیه بین ارسال لینک‌ها فاصله بگذارید.`,
  },

  userErrorFriendly: '⚠️ <b>ارتباط با سرور اینستاگرام با تاخیر مواجه شد.</b>\n\nاین مورد معمولاً به دلیل پرایوت (خصوصی) بودن پست یا اختلال موقت اینستاگرام رخ می‌دهد.\nلطفاً دقایقی دیگر مجدداً لینک را ارسال فرمایید.',
};
