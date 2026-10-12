import type { CapacitorConfig } from '@capacitor/cli';

// iOS app wrapper (Capacitor). The web build in dist/ (BASE_PATH=/) is copied into the app, so OCR engine and
// language data ship inside the app and everything works offline. appId is a PLACEHOLDER: Ben must choose the final
// bundle id before registering it in App Store Connect (it cannot be changed after the first upload).
const config: CapacitorConfig = {
  appId: 'com.actioncard.app',
  appName: 'LetterScan',
  webDir: 'dist',
  ios: {
    contentInset: 'never', // the app handles safe areas itself (env(safe-area-inset-*))
    backgroundColor: '#f6f5f1',
  },
  plugins: {
    LocalNotifications: { iconColor: '#0f4c5c' },
  },
};

export default config;
