import {
  ConfigPlugin,
  withAndroidManifest,
  AndroidConfig,
  withDangerousMod,
  withStringsXml,
} from "expo/config-plugins";
import { ExpoConfig } from "expo/config";
import fs from 'fs';
import path from 'path';

const { getMainApplicationOrThrow } = AndroidConfig.Manifest;

const withAndroidWidget: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, async (androidManifestConfig) => {
    const mainApplication = getMainApplicationOrThrow(
      androidManifestConfig.modResults
    );

    setAndroidManifestReceiver(config, mainApplication);

    return androidManifestConfig;
  });

  config = withWidgetFiles(config);

  config = withWidgetDescriptions(config);

  return config;
};

function setAndroidManifestReceiver(
  config: ExpoConfig,
  mainApplication: AndroidConfig.Manifest.ManifestApplication
) {
  mainApplication.receiver = mainApplication.receiver ?? [];

  mainApplication.receiver?.push({
    $: {
      "android:name": `.HelloAppWidget`,
      "android:exported": "false",
    } as any,
    "intent-filter": [
      {
        action: [
          {
            $: {
              "android:name": "android.appwidget.action.APPWIDGET_UPDATE",
            },
          },
          {
            $: {
              "android:name": `${config.android?.package}.WIDGET_CLICK`,
            },
          },
        ],
      },
    ],
    "meta-data": {
      $: {
        "android:name": "android.appwidget.provider",
        "android:resource": `@xml/hello_app_widget_info`,
      },
    },
  } as any);
}

function withWidgetFiles(
  config: ExpoConfig,
) {
  return withDangerousMod(config, [
    'android',
    (dangerousConfig) => {
      const widgetFilesRoot = path.join(dangerousConfig.modRequest.projectRoot, 'widgets/android');

      const appPackageFolder = path.join(
        dangerousConfig.modRequest.platformProjectRoot,
        'app/src/main/java/' +
          config.android?.package?.split('.').join('/')
      );
      fs.copyFileSync(path.join(widgetFilesRoot, 'HelloAppWidget.kt'), path.join(appPackageFolder, 'HelloAppWidget.kt'));

      const resFolder = path.join(dangerousConfig.modRequest.platformProjectRoot, 'app/src/main/res');

      fs.mkdirSync(path.join(resFolder, 'xml'), { recursive: true });
      fs.copyFileSync(path.join(widgetFilesRoot, 'hello_app_widget_info.xml'), path.join(resFolder, 'xml', 'hello_app_widget_info.xml'));

      fs.mkdirSync(path.join(resFolder, 'layout'), { recursive: true });
      fs.copyFileSync(path.join(widgetFilesRoot, 'hello_app_widget.xml'), path.join(resFolder, 'layout', 'hello_app_widget.xml'));

      return dangerousConfig;
    },
  ]);
}

// I took out description but will probably add it back, maybe with a style
function withWidgetDescriptions(config: ExpoConfig) {
  return withStringsXml(config, (stringsXml) => {
    stringsXml.modResults = AndroidConfig.Strings.setStringItem(
      [
        {
          $: {
            name: `hello_app_widget_description`,
            translatable: 'false',
          },
          _: 'a widget that says hello',
        },
      ],
      stringsXml.modResults
    );
    return stringsXml;
  });
}


export default withAndroidWidget;
