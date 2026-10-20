import { api } from 'sdk';
import { getLocale } from './i18n.js';

function toPersianDigits(str) {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (d) => farsiDigits[d]);
}

export class LiveProgressTracker {
  constructor(chatId, shortcode, replyToMsgId = null, langCode = 'en') {
    this.chatId = chatId;
    this.shortcode = shortcode;
    this.replyToMsgId = replyToMsgId;
    this.langCode = langCode;
    this.locale = getLocale(langCode);
    this.messageId = null;
    this.startTime = Date.now();
    this.stage = 'CHECKING'; // 'CHECKING' | 'DOWNLOADING' | 'UPLOADING' | 'FINALIZING'
    this.info = '';
    this.timer = null;
    this.lastEditTime = 0;
    this.isFinished = false;
  }

  getElapsedFormatted() {
    const totalSec = Math.floor((Date.now() - this.startTime) / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    const rawTime = `${m}:${s}`;
    return this.langCode === 'fa' ? toPersianDigits(rawTime) : rawTime;
  }

  renderContent() {
    const p = this.locale.progress;
    const elapsed = this.getElapsedFormatted();
    let stageTitle = '';
    let stageDesc = '';
    let bar = '▰▰▱▱▱▱▱▱▱▱';
    let percent = this.langCode === 'fa' ? '۲۰%' : '20%';

    if (this.stage === 'CHECKING') {
      stageTitle = p.stage1Title;
      stageDesc = p.stage1Desc;
      bar = '▰▰▱▱▱▱▱▱▱▱';
      percent = this.langCode === 'fa' ? '۲۰%' : '20%';
    } else if (this.stage === 'DOWNLOADING') {
      stageTitle = p.stage2Title;
      stageDesc = p.stage2Desc(this.info);
      bar = '▰▰▰▰▰▰▱▱▱▱';
      percent = this.langCode === 'fa' ? '۶۰%' : '60%';
    } else if (this.stage === 'UPLOADING') {
      stageTitle = p.stage3Title;
      stageDesc = p.stage3Desc(this.info);
      bar = '▰▰▰▰▰▰▰▰▰▱';
      percent = this.langCode === 'fa' ? '۹۰%' : '90%';
    }

    return (
      `${p.title}\n\n` +
      `${stageTitle}\n` +
      `${stageDesc}\n\n` +
      `${bar}  <code>${percent}</code>\n` +
      `${p.elapsed(elapsed)}\n` +
      `${p.postId(this.shortcode)}`
    );
  }

  async start() {
    try {
      const msg = await api.sendMessage({
        chat_id: this.chatId,
        text: this.renderContent(),
        parse_mode: 'HTML',
        reply_to_message_id: this.replyToMsgId || undefined,
      });
      this.messageId = msg.message_id;
      this.lastEditTime = Date.now();

      // Safe timer check for V8 environments
      if (typeof setInterval !== 'undefined') {
        this.timer = setInterval(async () => {
          if (this.isFinished) return;
          const now = Date.now();
          if (now - this.lastEditTime >= 1800) {
            await this.sync();
          }
        }, 2000);
      }
    } catch (err) {
      console.warn('[ProgressTracker] Start error:', err?.message || err);
    }
  }

  async setStage(stage, info = '') {
    if (this.isFinished) return;
    this.stage = stage;
    this.info = info;
    await this.sync();
  }

  async sync() {
    if (!this.messageId || this.isFinished) return;
    try {
      this.lastEditTime = Date.now();
      await api.editMessageText({
        chat_id: this.chatId,
        message_id: this.messageId,
        text: this.renderContent(),
        parse_mode: 'HTML',
      });
    } catch (e) {
      // Ignored: 'message is not modified' or temporary rate-limiting
    }
  }

  async showError(errorMessage) {
    this.cleanupTimer();
    if (!this.messageId) return;
    try {
      const p = this.locale.progress;
      const elapsed = this.getElapsedFormatted();
      await api.editMessageText({
        chat_id: this.chatId,
        message_id: this.messageId,
        text: `${p.errorTitle}\n${errorMessage}\n\n${p.elapsed(elapsed)}`,
        parse_mode: 'HTML',
      });
    } catch {}
  }

  cleanupTimer() {
    this.isFinished = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async finish() {
    this.cleanupTimer();
    if (!this.messageId) return;
    try {
      await api.deleteMessage({
        chat_id: this.chatId,
        message_id: this.messageId,
      });
    } catch {}
  }
}
