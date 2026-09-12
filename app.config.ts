import { ConfigContext, ExpoConfig } from "expo/config";

const EAS_PROJECT_ID = "53ed0c51-a88c-4f35-89cc-a49c1f88bc88";

const PROJECT_SLUG = "modernchat";
const OWNER = "musdev13";

const APP_NAME = "Modern Chat";
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

  console.log("⚙️ Сборка Modern Chat для среды:", environment);

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
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: dynamicConfig.bundleIdentifier,
      buildNumber: "1",

      infoPlist: {
        NSCameraUsageDescription:
          "Додатку потрібен доступ до камери для фотографування та надсилання знімків у чат.",
        NSPhotoLibraryUsageDescription:
          "Додатку потрібен доступ до вашої медіатеки для надсилання фотографій та зміни аватарки.",
        NSMicrophoneUsageDescription:
          "Додатку потрібен доступ до мікрофона для запису голосових повідомлень.",
      },
    },

    android: {
      package: dynamicConfig.packageName,
      versionCode: 1,

      edgeToEdgeEnabled: true,

      adaptiveIcon: {
        backgroundColor: "#0F172A",
        foregroundImage: dynamicConfig.adaptiveIconForeground,
        backgroundImage: dynamicConfig.adaptiveIconBackground,
        monochromeImage: dynamicConfig.adaptiveIconMonochrome,
      },

      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.RECORD_AUDIO",
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
          photosPermission: "Додатку потрібен доступ до ваших фотографій.",
          cameraPermission: "Додатку потрібен доступ до камери.",
        },
      ],

      "expo-secure-store",
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
      bundleIdentifier: `${BUNDLE_IDENTIFIER}.preview`,
      packageName: `${PACKAGE_NAME}.preview`,
      icon: "./assets/images/icons/icon-preview.png",
      adaptiveIconForeground:
        "./assets/images/icons/android-icon-foreground-preview.png",
      adaptiveIconBackground: ADAPTIVE_ICON_BACKGROUND,
      adaptiveIconMonochrome: ADAPTIVE_ICON_MONOCHROME,
      scheme: `${SCHEME}-preview`,
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
