# Inter Wallet — Mobile App (APK) & Chrome Extension Guide

This guide explains how to access, build, and run Inter as an **Android Mobile App (APK)** and a **Chrome Extension (Popup & Side Panel)**.

---

## 1. Chrome Extension (Manifest V3)

Inter is fully configured as a Manifest V3 Chrome Extension that supports **both**:
- **Toolbar Popup** (classic Web3 wallet popup, sized ~390px × 600px)
- **Side Panel** (keeps Inter docked open alongside any webpage)

### How to Load into Chrome / Brave / Edge
1. Build the extension:
   ```bash
   npm run build
   ```
   *(This builds into `dist/`, which contains `manifest.json`, `background.js`, `icons/`, and the web application)*

2. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```

3. In the top-right corner, turn on **Developer mode**.

4. Click **Load unpacked** (top-left) and select the `dist` folder:
   ```
   C:\Users\hp\.gemini\antigravity-ide\scratch\inter\dist
   ```

5. Pin **Inter Wallet** in your Chrome toolbar.
   - Click the extension icon to open the wallet in **Popup mode**.
   - In the top bar, click the **Side Panel** icon (next to notifications) or right-click the extension icon and select **Open side panel** to dock Inter on the right side of your screen!

### Packaging as a Zip (for sharing / distribution)
Run:
```bash
npm run build:extension
```
This generates `inter-chrome-extension.zip` in the project root.

---

## 2. Android Mobile App (APK)

Inter is equipped with a complete native **Capacitor Android Project (`android/`)** and automated GitHub Actions CI workflows in `.github/workflows/`.

### Method A: Cloud Build via GitHub Actions (Recommended — No Android Studio Needed)
1. GitHub Actions automatically triggers on push to `main` (or you can trigger it manually).
2. Go to the **Actions** tab on GitHub:
   - Click on the **Build Android APK** workflow (runs automatically on push, or click **Run workflow**).
   - Once completed (~2-3 minutes), scroll to the **Artifacts** section at the bottom of the run summary.
   - Download **`Inter-Wallet-Android-APK`**.
3. Unzip the downloaded file to find **`app-debug.apk`**.
4. Transfer `app-debug.apk` to your Android phone (via WhatsApp, Google Drive, Telegram, or USB cable) and tap to install!

---

### Method B: Local Build with Android Studio (Optional)
If you have Android Studio installed locally on your computer:
1. Build web assets:
   ```bash
   npm run build
   ```
2. Sync with Android project:
   ```bash
   npx cap sync android
   ```
3. Open the Android project:
   ```bash
   npx cap open android
   ```
   *(Or open the `android` folder directly in Android Studio)*
4. In Android Studio:
   - Select **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - Click the **locate** link in the bottom-right notification to find `app-debug.apk`.

---

## Summary of New NPM Scripts

| Script | Purpose |
|---|---|
| `npm run build` | Builds the universal web app and Chrome extension (`dist/`) |
| `npm run build:extension` | Packages `dist/` into `inter-chrome-extension.zip` |
| `npm run build:icons` | Generates all resolution PNG icons (16 to 512px) from the Inter logo |
| `npm run cap:sync` | Syncs web build into the native Android Capacitor project |
| `npm run cap:open` | Opens the native Android project in Android Studio |
