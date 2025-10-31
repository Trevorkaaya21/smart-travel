import { ExpoConfig, ConfigContext } from '@expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Smart Travel',
  slug: 'smart-travel',
  scheme: 'smarttravel',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#050713'
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#050713'
    }
  },
  extra: {
    router: {
      origin: process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    },
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000'
  },
  experiments: {
    typedRoutes: true
  }
})
