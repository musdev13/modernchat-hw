import { ConfigContext, ExpoConfig } from "expo/config";

const EAS_PROJECT_ID = "9c5b6d3f-5ad1-41f0-9c68-4a8f7b44112a";

const PROJECT_SLUG = "modernchat";
const OWNER = "bukwa";

const APP_NAME = "SuperMegaModernChat";
const BUNDLE_IDENTIFIER = `com.${OWNER}.modernchat`;
const PACKAGE_NAME = `com.${OWNER}.modernchat`;
const SCHEME = "modernchat";

const ICON = "./assets/images/icon.png";
const ADAPTIVE_ICON_FOREGROUND = "./assets/images/android-icon-foreground.png";
const ADAPTIVE_ICON_BACKGROUND = "./assets/images/android-icon-background.png";
const ADAPTIVE_ICON_MONOCHROME = "./assets/images/android-icon-monochrome.png";

export default ({ config }: ConfigContext): ExpoConfig => {
  const environment =
    (process.env.APP_ENV as "development" | "preview" | "production") ||
    "development";

  console.log("⚙️ Сборка SuperMegaModernChat для среды:", environment);
  console.log("📦 Convex URL:", process.env.EXPO_PUBLIC_CONVEX_URL);

  const dynamicConfig = getDynamicAppConfig(environment);

  return {
    ...config,

    name: dynamicConfig.name,
    slug: PROJECT_SLUG,
    version: "1.0.0",
    orientation: "portrait",

    icon: dynamicConfig.icon,
    scheme: dynamicConfig.scheme,

    userInterfaceStyle: "dark",

    ios: {
      supportsTablet: true,
      bundleIdentifier: dynamicConfig.bundleIdentifier,
      buildNumber: "1",
      icon: dynamicConfig.icon,

      infoPlist: {
        NSCameraUsageDescription:
          "Додатку SuperMegaModernChat потрібен доступ до камери для запису відеокружечків та фотографій.",
        NSPhotoLibraryUsageDescription:
          "Додатку SuperMegaModernChat потрібен доступ до медіатеки для вибору та надсилання фотографій.",
        NSPhotoLibraryAddUsageDescription:
          "Додатку SuperMegaModernChat потрібен доступ для збереження фотографій у вашу галерею.",
        NSMicrophoneUsageDescription:
          "Додатку SuperMegaModernChat потрібен доступ до мікрофона для запису голосових повідомлень та відеокружечків.",
      },
    },

    android: {
      package: dynamicConfig.packageName,
      versionCode: 1,

      // 🔔 ДЗ 17: Firebase Cloud Messaging (FCM v1) конфигурация
      googleServicesFile: "./google-services.json",

      adaptiveIcon: {
        backgroundColor: "#0F172A",
        foregroundImage: dynamicConfig.adaptiveIconForeground,
        backgroundImage: dynamicConfig.adaptiveIconBackground,
        monochromeImage: dynamicConfig.adaptiveIconMonochrome,
      },

      predictiveBackGestureEnabled: false,

      permissions: [
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.VIBRATE",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",

        // 🔔 ДЗ 17: системные разрешения для push-уведомлений
        "android.permission.POST_NOTIFICATIONS", // Обязательно для Android 13+ (API 33+)
      ],
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",

      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#0F172A",
        },
      ],

      [
        "expo-image-picker",
        {
          photosPermission:
            "Додатку SuperMegaModernChat потрібен доступ до ваших фотографій.",
          cameraPermission: "Додатку SuperMegaModernChat потрібен доступ до камери.",
        },
      ],

      "expo-secure-store",

      // 🎥 ДЗ 15: камера для відеокружечків
      [
        "expo-camera",
        {
          cameraPermission:
            "Додатку SuperMegaModernChat потрібен доступ до камери для запису відеокружечків.",
          microphonePermission:
            "Додатку SuperMegaModernChat потрібен доступ до мікрофона для запису звуку у відеокружечках.",
          recordAudioAndroid: true,
        },
      ],

      // 🎬 ДЗ 15: нативный плеер видео
      [
        "expo-video",
        {
          supportsBackgroundPlayback: false,
          supportsPictureInPicture: false,
        },
      ],

      // 🎤 ДЗ 15: запись голосовых сообщений
      [
        "expo-audio",
        {
          microphonePermission:
            "Додатку SuperMegaModernChat потрібен доступ до мікрофона для запису голосових повідомлень.",
        },
      ],

      // 🔔 ДЗ 17: push-уведомления
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#3B82F6",
          defaultChannel: "default",
          sounds: [],
          enableBackgroundRemoteNotifications: false,
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    },

    runtimeVersion: {
      policy: "appVersion",
    },

    extra: {
      router: {},

      eas: {
        projectId: EAS_PROJECT_ID,
      },
    },

    owner: OWNER,
  };
};

export const getDynamicAppConfig = (
  environment: "development" | "preview" | "production",
) => {
  if (environment === "development") {
    return {
      name: `${APP_NAME} Dev`,
      bundleIdentifier: `${BUNDLE_IDENTIFIER}.dev`,
      packageName: `${PACKAGE_NAME}.dev`,
      icon: "./assets/images/icons/icon-dev.png",
      adaptiveIconForeground:
        "./assets/images/icons/android-icon-foreground-dev.png",
      adaptiveIconBackground: ADAPTIVE_ICON_BACKGROUND,
      adaptiveIconMonochrome: ADAPTIVE_ICON_MONOCHROME,
      scheme: `${SCHEME}-dev`,
    };
  }
  
  if (environment === "preview") {
    return {
      name: `${APP_NAME} Preview`,
      bundleIdentifier: BUNDLE_IDENTIFIER,   
      packageName: PACKAGE_NAME,             
      icon: "./assets/images/icons/icon-preview.png",
      adaptiveIconForeground:
        "./assets/images/icons/android-icon-foreground-preview.png",
      adaptiveIconBackground: ADAPTIVE_ICON_BACKGROUND,
      adaptiveIconMonochrome: ADAPTIVE_ICON_MONOCHROME,
      scheme: SCHEME,                        
    };
  }

  return {
    name: APP_NAME,
    bundleIdentifier: BUNDLE_IDENTIFIER,
    packageName: PACKAGE_NAME,
    icon: ICON,
    adaptiveIconForeground: ADAPTIVE_ICON_FOREGROUND,
    adaptiveIconBackground: ADAPTIVE_ICON_BACKGROUND,
    adaptiveIconMonochrome: ADAPTIVE_ICON_MONOCHROME,
    scheme: SCHEME,
  };
};