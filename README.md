# 🚀 Social Media Downloader Bot (@SocialHubDLbot)

[![Telegram Bot](https://img.shields.io/badge/Telegram-@SocialHubDLbot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/SocialHubDLbot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Serverless](https://img.shields.io/badge/Platform-Telegram_Serverless_(@tgcloud)-0088cc?style=for-the-badge)](https://cloud.telegram.org)
[![Cloudflare](https://img.shields.io/badge/Accelerated_By-Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)

> **High-Performance, Zero-Account Guest Media Downloader Bot for Telegram.**
> Engineered for extreme speed, maximum audio/video bitrate, live progress tracking, forced channel subscription, deep analytics, and anti-flood protection.

---

## 🌟 Key Features

### 📸 1. Advanced Media Downloader Engine
- **100% Zero-Account Guest Mode:** No cookies, no session credentials, and zero risk of Instagram account bans or checkpoints.
- **Windows 11 Client Hints Emulation:** Authentic browser headers (`sec-ch-ua`, `sec-ch-ua-platform: "Windows"`) matching legitimate desktop traffic.
- **Full HD Resolution:** Automatically resolves and delivers the highest bitrate (1080p / 720p HD).
- **Multi-Item Carousel Support:** Seamlessly downloads up to 10 photos/videos in a unified native Telegram `MediaGroup`.
- **Pure AAC Audio Extraction:** Streams crystal-clear `.aac` music tracks (with waveform and cover art) in ~25ms via dedicated edge demuxing.
- **One-Tap Caption Copy:** Native Telegram Desktop `<pre>` block and inline copy button for original captions.

### 🛡 2. Anti-Spam & Anti-Flood Shield
- **Concurrent Download Lock:** Prevents users from overloading the engine by enforcing one active download per user at a time.
- **Smart Cooldown:** Implements a 3-second pacing interval between requests to defeat barrage and spam attacks.
- **User-Friendly Error Masking:** Replaces cryptic technical errors with polite, actionable status messages for end users while preserving raw diagnostics for admins.

### 👑 3. Interactive Admin Dashboard (`/admin`)
- **Auto-Bootstrapping Superadmin:** The first user to invoke `/admin` automatically receives full superadmin privileges.
- **Comprehensive Real-Time Analytics:**
  - 👥 **Users:** Total registered members, new users today (24h), this week (7d), and this month (30d).
  - 📥 **Downloads:** Total successful extractions, daily, weekly, and monthly activity.
  - 🎬 **Media Breakdown:** Live counts for Reels/Videos, Single Photos, Carousel Albums, and Extracted Audio.
- **Smart Forced-Join Channel Gate:**
  - Add mandatory subscription channels via simple message forwarding or username.
  - Automatically verifies bot administrator status in the target channel.
  - Non-members are restricted from downloading until they subscribe.
- **Safe Serverless Broadcast Engine:**
  - Sends text, photos, videos, or forwarded messages to all users.
  - Throttled pacing (~20 messages/sec) compliant with Telegram's `429 FloodWait` limits.
  - Automatic detection of users who blocked the bot (`403 Forbidden`).
  - Detailed final delivery report.
- **User Data Export:** One-click instant CSV backup generator delivered directly in Telegram.

### 🌐 4. Multilingual (i18n) Support
- Fully localized in **Persian (فارسی)** and **English**.
- In-memory V8 caching for zero-latency language lookups.
- Persistent interactive reply keyboards with custom input placeholders.

---

## 🏗 System Architecture

```mermaid
graph TD
    User([Telegram User]) <-->|Direct Interaction| Bot[Telegram Serverless Bot (@tgcloud)]
    Bot <-->|SQLite ORM| DB[(Embedded SQLite DB)]
    Bot -->|Windows 11 Guest Engine| IG[Instagram Web Graph Engine]
    Bot -->|KV & AAC Demuxing| CF[Cloudflare Edge Worker]
    CF -->|Direct CDN Streaming| User
```

---

## 📁 Repository Structure

```text
├── tgcloud/
│   ├── handlers/
│   │   ├── message.js          # Main message & command handler (Anti-spam, Gate)
│   │   ├── callback_query.js   # Inline keyboard router (Admin, Audio, Language)
│   │   └── inline_query.js     # Telegram inline mode query resolver
│   ├── lib/
│   │   ├── admin.js            # Admin panel, stats calculations & broadcast logic
│   │   ├── config.js           # Central bot settings & Cloudflare worker routing
│   │   ├── i18n.js             # Language persistence & localization manager
│   │   ├── instagram.js        # TwinGraph Guest resolver & Windows 11 client hints
│   │   ├── locales_en.js       # English translations
│   │   ├── locales_fa.js       # Persian translations
│   │   └── tracker.js          # Dynamic live in-place progress tracker
│   └── schema.js               # Database schema (users, admins, channels, downloads)
├── tgcloud.jsonc               # Telegram Serverless project configuration
└── package.json                # Project dependencies and deployment scripts
```

---

## 🚀 Quick Start & Deployment

### 1. Prerequisites
- Node.js 18+
- [tgcloud CLI](https://www.npmjs.com/package/@tgcloud/cli) installed:
  ```bash
  npm install -D @tgcloud/cli
  ```

### 2. Setup & Configuration
1. Clone the repository:
   ```bash
   git clone https://github.com/dalroot/social-media-downloader-bot.git
   cd social-media-downloader-bot
   ```
2. Link your bot token:
   ```bash
   npx tgcloud login
   ```
3. Deploy all modules to Telegram Serverless:
   ```bash
   npm run deploy
   ```
4. Run database migrations:
   ```bash
   npx tgcloud migrate --yes
   ```

---

## 🔒 Security & Privacy

This project strictly adheres to zero-account security. No user credentials, cookies, or private session IDs are required or stored. All environment secrets remain isolated in your serverless runtime environment.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
