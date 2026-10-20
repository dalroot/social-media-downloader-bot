/**
 * MetaTwin Downloader — English Locale (Default)
 */
export default {
  code: 'en',
  name: 'English',

  welcome: (botName) =>
    `Welcome to <b>${botName}</b> 👋🏻\n\n` +
    `Send any link to download media immediately.\n\n` +
    `<b>Fast & High-Quality Support for:</b>\n` +
    `📸 <b>Instagram</b> — Reels, Carousels, and Posts in original highest HD quality ✔️`,

  help: (botName) =>
    `💡 <b>How to use ${botName}:</b>\n\n` +
    `1. Open Instagram and tap the <b>Share</b> button on any Reel, Post, or Story.\n` +
    `2. Select <b>Copy Link</b>.\n` +
    `3. Paste the link directly in this chat!\n\n` +
    `⚡️ <b>Features:</b>\n` +
    `• Instant audio / music extraction with 1 tap\n` +
    `• Multi-item carousel album downloads (photos & videos)\n` +
    `• 1-tap copy caption button\n` +
    `• Maximum available bitrate & resolution (1080p / 720p HD)`,

  stats: (count) =>
    `📊 <b>Download Statistics:</b>\n\n` +
    `Total media items extracted: <b>${count}</b> 🚀`,

  send_link_prompt:
    `📥 <b>Send Link:</b>\n\n` +
    `Paste any Instagram Reel, Post, or Story link here to download it in original HD quality ⚡️`,

  invalid_link:
    `⚠️ Please send a valid Instagram Reel, Post, or Story link.\n\n` +
    `Example:\n<code>https://www.instagram.com/reel/Dd_sxJDxH6G/</code>`,

  keyboard: {
    btnSendLink: '⚡️ Send Link',
    btnStats: '📊 Statistics',
    btnHelp: '💡 Help',
    btnLanguage: '🌐 Language',
    inputPlaceholder: 'Paste Instagram link here...',
  },

  progress: {
    title: '📥 <b>Downloading from Instagram</b>',
    stage1Title: '🔄 <b>Stage 1/3: Checking link and quality</b>',
    stage1Desc: '🔎 <i>Connecting directly to Instagram...</i>',
    stage2Title: '⚡️ <b>Stage 2/3: Fetching original media</b>',
    stage2Desc: (quality) => `📥 <i>Downloading highest available quality (${quality || 'HD'})...</i>`,
    stage3Title: '🚀 <b>Stage 3/3: Delivering to your Telegram</b>',
    stage3Desc: (info) => `📦 <i>Preparing and sending file (${info || 'HD'})...</i>`,
    elapsed: (time) => `⏱ Elapsed time: <b>${time}</b>`,
    postId: (shortcode) => `Post ID: <code>${shortcode}</code>`,
    errorTitle: '❌ <b>Download Error:</b>',
  },

  media: {
    audioBtn: '🎵 Extract Audio / Music',
    directHdBtn: '📥 Direct HD Link',
    copyCaptionBtn: '📋 Copy Caption',
    copyCaptionFullBtn: '📋 Copy Full Caption',
    albumTitle: (count) => `📚 <b>Instagram Album (${count} items)</b>`,
    albumActions: (shortcode) => `📋 Actions for Album <code>${shortcode}</code>:`,
    captionHeader: '📝 <b>Caption:</b>',
    qualityLabel: (q) => `🎬 Quality: <code>${q}</code>`,
    attribution: (username) => `⚡️ Downloaded via @${username}`,
    largeFileNotice: `⚠️ <b>This video is in Ultra HD and exceeds Telegram's direct upload limit.</b>\nTo download the full video file, tap the download button below:`,
    largeFileBtn: '📥 Direct Download Full Video (HD MP4)',
    photoTitle: '📸 <b>High-Quality Photo</b>',
    photoDirectBtn: '📥 Direct Original Image',
    captionEmpty: '⚠️ This post does not have a text caption.',
    captionCopiedHeader: '📋 <b>Full Caption:</b>',
    tapToCopy: '<i>(Tap the box above to copy full text)</i>',
    audioPreparing: '🎵 Preparing audio track...',
    audioError: '❌ Could not extract audio.',
    audioFallback: (url) => `🎵 Audio track available directly at:\n${url}`,
    coverBtn: '🖼 Cover Image',
    coverPreparing: '🖼 Sending original cover photo...',
    coverCaption: (author, username) => `🖼 <b>Original Cover Photo</b>\n👤 <b>${author}</b>\n\n⚡️ Downloaded via @${username}`,
  },

  lang: {
    choose: '🌐 <b>Choose your preferred language / زبان خود را انتخاب کنید:</b>',
    changed: '✅ Language changed to English.',
  },

  antiSpam: {
    alreadyProcessing: '⏳ <b>Your download is currently in progress!</b>\nPlease wait a moment until the current file is delivered.',
    cooldown: (sec) => `⏳ <b>Please slow down!</b>\nPlease wait ${sec}s between sending links.`,
  },

  userErrorFriendly: '⚠️ <b>Temporary Connection Issue with Instagram.</b>\n\nThis usually occurs if the post is private or Instagram is experiencing temporary delays.\nPlease try sending the link again in a few moments.',
};
