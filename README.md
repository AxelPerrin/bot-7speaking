# 🤖 7Speaking AutoBot

> Automated bot for 7Speaking e-learning platform using Tampermonkey

![Chrome](https://img.shields.io/badge/Chrome-Supported-green?logo=googlechrome)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Required-orange?logo=tampermonkey)
![Version](https://img.shields.io/badge/Version-1.0-blue)

---

## 📋 Table of Contents

- [Features](#-features)
- [Requirements](#-requirements)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [How It Works](#-how-it-works)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎯 **Auto Quiz** | Automatically answers quizzes with configurable success rate |
| 📺 **Video Handling** | Auto-watches videos and skips when possible |
| 🔄 **Drag & Drop** | Handles drag & drop exercises automatically |
| 📊 **Smart Success Rate** | 80% success rate (92% after watching videos) |
| 🧭 **Auto Navigation** | Automatically navigates through lessons and workshops |
| 🐛 **Debug Mode** | Visual debugging to see bot activity in real-time |

---

## 📦 Requirements

1. **Google Chrome** browser (or any Chromium-based browser)
2. **Tampermonkey** extension installed

---

## 🚀 Installation

### Step 1: Install Tampermonkey

1. Open Chrome and go to the [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)

2. Click **"Add to Chrome"**

   ![Install Tampermonkey](https://img.shields.io/badge/Click-Add%20to%20Chrome-blue?style=for-the-badge)

3. Confirm by clicking **"Add extension"**

4. You should see the Tampermonkey icon in your browser toolbar:

   ```
   🔲 (Tampermonkey icon appears in toolbar)
   ```

### Step 2: Install the Bot Script

**Option A: Direct Install (Recommended)**

1. Click on the **Tampermonkey icon** in your toolbar
2. Select **"Create a new script..."**
3. Delete all the default code
4. Copy the entire content of `bot.js` and paste it
5. Press `Ctrl + S` to save

**Option B: Import from File**

1. Click on the **Tampermonkey icon**
2. Go to **Dashboard**
3. Click the **Utilities** tab
4. Under **"Import from file"**, select `bot.js`

### Step 3: Verify Installation

1. Click on the Tampermonkey icon
2. You should see **"7Speaking AutoBot v1 - Debug Clics"** in the list
3. Make sure the toggle is **ON** (enabled)

   ```
   ✅ 7Speaking AutoBot v1 - Debug Clics    [ON]
   ```

---

## ⚙️ Configuration

You can customize the bot behavior by editing the `CONFIG` object at the top of the script:

```javascript
const CONFIG = {
    successRate: 0.80,          // 80% correct answers (before video)
    successRateAfterVideo: 0.92, // 92% correct answers (after video)
    textWaitMin: 240,           // Minimum typing delay (ms)
    textWaitMax: 300,           // Maximum typing delay (ms)
    debug: true,                // Enable console logging
    visualDebug: true           // Highlight detected elements in red
};
```

### Config Options Explained

| Option | Default | Description |
|--------|---------|-------------|
| `successRate` | `0.80` | Probability of answering correctly (0-1) |
| `successRateAfterVideo` | `0.92` | Success rate after watching a video |
| `textWaitMin` | `240` | Minimum delay between keystrokes (ms) |
| `textWaitMax` | `300` | Maximum delay between keystrokes (ms) |
| `debug` | `true` | Show logs in browser console (`F12`) |
| `visualDebug` | `true` | Visually highlight elements being clicked |

---

## 🔧 How It Works

### Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    7Speaking AutoBot                        │
├─────────────────────────────────────────────────────────────┤
│  1. Bot detects current page type (quiz, video, lesson)    │
│                          ↓                                  │
│  2. Finds correct answers using React inspection           │
│                          ↓                                  │
│  3. Applies success rate to decide correct/wrong answer    │
│                          ↓                                  │
│  4. Simulates human-like typing and clicking               │
│                          ↓                                  │
│  5. Automatically navigates to next activity               │
└─────────────────────────────────────────────────────────────┘
```

### Supported Question Types

- ✅ Multiple choice questions
- ✅ Text input questions
- ✅ Drag and drop exercises
- ✅ Video watching
- ✅ Workshop navigation

### Debug Console

Press `F12` to open Developer Tools and see the bot's activity:

```
[7S] Quiz: traitement...
[7S] Quiz: réponse = "correct answer"
[7S] Q1: ✓ (100%)
[7S] 📍 Clic: Next button
```

---

## 🛠️ Troubleshooting

### Bot is not running

1. **Check Tampermonkey is enabled**
   - Click the Tampermonkey icon
   - Ensure the script shows as **ON**

2. **Check you're on the right domain**
   - The bot only works on `https://user.7speaking.com/*`

3. **Refresh the page**
   - Sometimes a hard refresh (`Ctrl + Shift + R`) is needed

### Bot is stuck

1. Open the console (`F12`) and check for errors
2. Try refreshing the page
3. Disable `visualDebug` if you see performance issues

### Quiz answers are wrong

The bot extracts answers from React internals. If 7Speaking updates their code, the answer detection might break. Check the console for:
```
[7S] Quiz: réponse non trouvée, skip
```

---

## ⚠️ Disclaimer

This bot is for **educational purposes only**. Using automation tools may violate 7Speaking's Terms of Service. Use at your own risk.

---

## 👤 Author

**axelito** - [GitHub](https://github.com/AxelPerrin/bot-7speaking)

---

## 📄 License

This project is open source. Feel free to modify and improve!