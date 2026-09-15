// @ts-check
const { tokens } = require("@civfix/shared/tokens")

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? null

const UPDATE_CHANNEL = process.env.CIVFIX_UPDATE_CHANNEL ?? null

const APPLE_TEAM_ID = process.env.CIVFIX_APPLE_TEAM_ID ?? "WMDUV888LH"

const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  "521996499476-d86mdmhsuopfp9gmqf7qarc2ousv6sqt.apps.googleusercontent.com"
const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  "521996499476-0oghodcp5h8o3anfob8k71ltj9h6ab1t.apps.googleusercontent.com"
const GOOGLE_IOS_URL_SCHEME =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ??
  "com.googleusercontent.apps.521996499476-0oghodcp5h8o3anfob8k71ltj9h6ab1t"

const CARTO_API_KEY = process.env.EXPO_PUBLIC_CARTO_API_KEY ?? "cb1_2800_1_9e1f147ec5d25247379fe9cf"

const SPLASH_BG_LIGHT = tokens.color.neutral.paper

const APP_LINK_HOSTS = ["civfix.org", "www.civfix.org"]

const APP_LINK_PATH_PREFIXES = [
  "/pin",
  "/cleanups",
  "/events",
  "/orgs",
  "/people",
  "/post",
  "/messages",
  "/leaderboard",
  "/reports",
  "/notifications",
  "/settings",
  "/profile",
  "/dashboard",
  "/saves",
  "/map",
  "/search",
  "/compose",
  "/host",
  "/groups",
  "/channels",
  "/report",
  "/about",
  "/discover",
]

const APP_LINK_DATA = APP_LINK_HOSTS.flatMap((host) =>
  APP_LINK_PATH_PREFIXES.map((pathPrefix) => ({ scheme: "https", host, pathPrefix })),
)

const CAMERA_USAGE =
  "civfix uses the camera so you can photograph or record civic issues (trash, hazards, graffiti) when you file a report, and so event hosts can scan attendee ticket QR codes at check-in."
const MIC_USAGE =
  "civfix uses the microphone when you record a short video of a civic issue for a report."
const LOCATION_WHEN_IN_USE =
  "civfix uses your location to place your civic report at the right spot and to show issues and cleanups near you."
const PHOTO_USAGE =
  "civfix needs access to your photos so you can attach an existing photo of a civic issue to a report."
const CONTACTS_USAGE =
  "civfix uses your contacts so you can invite people you know to volunteer events and cleanups. Only the contacts you choose to invite are used."

/** @type {(ctx: import("expo/config").ConfigContext) => import("expo/config").ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  name: "civfix",
  slug: "civfix-community",
  scheme: "civfix",
  version: "1.2.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: SPLASH_BG_LIGHT,
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    bundleIdentifier: "org.civfix.community",
    buildNumber: "23",
    appleTeamId: APPLE_TEAM_ID,
    supportsTablet: true,
    associatedDomains: ["applinks:civfix.org", "applinks:www.civfix.org"],
    usesAppleSignIn: true,
    config: {
      usesNonExemptEncryption: false,
    },
    entitlements: {
      "keychain-access-groups": ["$(AppIdentifierPrefix)org.civfix.community"],
    },
    infoPlist: {
      NSCameraUsageDescription: CAMERA_USAGE,
      NSMicrophoneUsageDescription: MIC_USAGE,
      NSLocationWhenInUseUsageDescription: LOCATION_WHEN_IN_USE,
      NSPhotoLibraryUsageDescription: PHOTO_USAGE,
      NSContactsUsageDescription: CONTACTS_USAGE,
    },
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
      ],
      NSPrivacyCollectedDataTypes: [
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeCoarseLocation",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePhotosorVideos",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeEmailAddress",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeName",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeUserContent",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
        {
          NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypeDeviceID",
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
        },
      ],
    },
  },
  android: {
    package: "org.civfix.community",
    versionCode: 3,
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: SPLASH_BG_LIGHT,
    },
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.POST_NOTIFICATIONS",
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: APP_LINK_DATA,
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-localization",
    [
      "expo-build-properties",
      {
        ios: {
          buildReactNativeFromSource: false,
          extraPods: [
            { name: "GoogleUtilities", modular_headers: true },
            { name: "RecaptchaInterop", modular_headers: true },
          ],
        },
      },
    ],
    "@maplibre/maplibre-react-native",
    "expo-secure-store",
    "expo-apple-authentication",
    [
      "expo-location",
      {
        locationWhenInUsePermission: LOCATION_WHEN_IN_USE,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#FF7A6B",
      },
    ],
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: CAMERA_USAGE,
        enableMicrophonePermission: true,
        microphonePermissionText: MIC_USAGE,
        enableCodeScanner: true,
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: PHOTO_USAGE,
      },
    ],
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: GOOGLE_IOS_URL_SCHEME,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        imageWidth: 320,
        resizeMode: "contain",
        backgroundColor: SPLASH_BG_LIGHT,
      },
    ],
  ],
  extra: {
    ...(API_URL ? { apiUrl: API_URL } : {}),
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
    },
    cartoApiKey: CARTO_API_KEY,
    eas: {
      projectId: "dea5514a-661e-4148-b099-ffe65443f806",
    },
  },
  updates: {
    url: "https://u.expo.dev/dea5514a-661e-4148-b099-ffe65443f806",
    ...(UPDATE_CHANNEL ? { requestHeaders: { "expo-channel-name": UPDATE_CHANNEL } } : {}),
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  owner: "civfix-app",
})
