
import 'ts-node/register'; // Add this to import TypeScript files
import { ExpoConfig } from 'expo/config';

module.exports = ({ config } : { config: ExpoConfig }) => {
  return {
    name: "expo-diy-widget",
    slug: "expo-diy-widget",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.keith-kurak.expo-diy-widget",
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: ["expo-router", ["./plugins/withWidget.ts", "custom"  ]],
    experiments: {
      typedRoutes: true,
    },
  };
};
