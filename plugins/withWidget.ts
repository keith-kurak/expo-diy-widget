import {
  ConfigPlugin,
  IOSConfig,
  withDangerousMod,
} from "expo/config-plugins";
import {
  PBXGroup,
  XcodeProject,
  PBXBuildFile,
  PBXFileReference,
  XCBuildConfiguration,
  XCConfigurationList,
  PBXSourcesBuildPhase,
  PBXFrameworksBuildPhase,
  PBXResourcesBuildPhase,
  PBXContainerItemProxy,
  PBXTargetDependency,
  PBXCopyFilesBuildPhase,
} from "@bacons/xcode";
import * as xcodeParse from "@bacons/xcode/json";
import path from "path";
import fs from "fs";
import { globSync } from "glob";

const withWidget: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      //See https://github.com/EvanBacon/expo-apple-targets/blob/9210dc22955a77647500c1246a448eaaefd8e328/packages/apple-targets/src/withWidget.ts#L133
      // for idea on determining the correct path instead of hardcoding it

      // constants
      const widgetFolderName = "Hello Widget";
      const widgetBundleId = config.ios!.bundleIdentifier! + "." + "Hello_Widget";
      const widgetExtensionFrameworks = ["WidgetKit", "SwiftUI"];

      // absolute directories we need when reading files from disk
      const projectRoot = config.modRequest.projectRoot;
      const widgetRoot = path.join(
        projectRoot,
        "widgets/ios/",
        widgetFolderName
      );

      // setup the relative directories we need to reference in pbxproj
      // important: do not use absolute paths!
      const widgetFolderRelativeToIosProject = path.join(
        "../widgets/ios/",
        widgetFolderName
      );

      // read

      const project = XcodeProject.open(
        IOSConfig.Paths.getPBXProjectPath(config.modRequest.projectRoot)
      );

      const mainAppTarget = project.rootObject.getMainAppTarget("ios");

      // grab all swift files in the project, create refs with their basenames
      const swiftFiles = globSync("*.swift", {
        absolute: true,
        cwd: widgetRoot,
      }).map((file) => {
        return PBXBuildFile.create(project, {
          fileRef: PBXFileReference.create(project, {
            path: path.basename(file),
            sourceTree: "<group>",
          }),
        });
      });

      let assetFiles = [
        // All assets`
        // "assets/*",
        // NOTE: Single-level only
        "*.xcassets",
      ]
        .map((glob) =>
          globSync(glob, {
            absolute: true,
            cwd: widgetRoot,
          }).map((file) => {
            return PBXBuildFile.create(project, {
              fileRef: PBXFileReference.create(project, {
                path: path.basename(file),
                sourceTree: "<group>",
              }),
            });
          })
        )
        .flat();

      // create widget group
      const group = PBXGroup.create(project, {
        name: "Hello Widget",
        sourceTree: "<group>",
        path: widgetFolderRelativeToIosProject,
        children: [
          // @ts-expect-error
          ...swiftFiles
            .map((buildFile) => buildFile.props.fileRef)
            .sort((a, b) =>
              a.getDisplayName().localeCompare(b.getDisplayName())
            ),
          // @ts-expect-error
          ...assetFiles
            .map((buildFile) => buildFile.props.fileRef)
            .sort((a, b) =>
              a.getDisplayName().localeCompare(b.getDisplayName())
            ),
          // @ts-expect-error
          PBXFileReference.create(project, {
            path: "Info.plist",
            sourceTree: "<group>",
          }),
        ],
      });

      //add widget group to main group
      project.rootObject.props.mainGroup.props.children.unshift(group);

      // Add the widget target to the display folder (cosmetic)
      addFrameworksToDisplayFolder(
        project,
        widgetExtensionFrameworks.map((framework) => getFramework(project, framework))
      );

      // create the native target

      // output file or something like that

      const appexBuildFile = PBXBuildFile.create(project, {
        fileRef: PBXFileReference.create(project, {
          explicitFileType: "wrapper.app-extension",
          includeInIndex: 0,
          path: widgetFolderName + ".appex",
          sourceTree: "BUILT_PRODUCTS_DIR",
        }),
        settings: {
          ATTRIBUTES: ["RemoveHeadersOnCopy"],
        },
      });

      project.rootObject.ensureProductGroup().props.children.push(
        // @ts-expect-error
        appexBuildFile.props.fileRef
      );

      // the target, this stuff has tentacles everywhere

      const widgetTarget = project.rootObject.createNativeTarget({
        buildConfigurationList: createConfigurationList(project, {
          name: widgetFolderName,
          cwd: widgetFolderRelativeToIosProject,
          bundleId: widgetBundleId,
          deploymentTarget: "17.4",
          currentProjectVersion: "1",
        }),
        name: widgetFolderName,
        productName: widgetFolderName,
        // @ts-expect-error
        productReference:
        appexBuildFile.props.fileRef /* .appex */,
        productType: "com.apple.product-type.app-extension",
      });

      widgetTarget.createBuildPhase(PBXSourcesBuildPhase, {
        files: [
          ...swiftFiles,
        ],
      });

      widgetTarget.createBuildPhase(PBXFrameworksBuildPhase, {
        files: widgetExtensionFrameworks.map((framework) =>
          getOrCreateBuildFile(project, getFramework(project, framework))
        ),
      });

      widgetTarget.createBuildPhase(PBXResourcesBuildPhase, {
        files: [...assetFiles],
      });
      const containerItemProxy = PBXContainerItemProxy.create(project, {
        containerPortal: project.rootObject,
        proxyType: 1,
        remoteGlobalIDString: widgetTarget.uuid,
        remoteInfo: widgetFolderName,
      });

      const targetDependency = PBXTargetDependency.create(project, {
        target: widgetTarget,
        targetProxy: containerItemProxy,
      });

      // Add the target dependency to the main app, should be only one.
      mainAppTarget!.props.dependencies.push(targetDependency);

      // plug into build phases
      mainAppTarget!.createBuildPhase(PBXCopyFilesBuildPhase, {
        dstSubfolderSpec: 13,
        buildActionMask: 2147483647,
        files: [appexBuildFile],
        name: "Embed Foundation Extensions",
        runOnlyForDeploymentPostprocessing: 0,
      });

      // save

      const contents = xcodeParse.build(project.toJSON());
      if (contents.trim().length) {
        await fs.promises.writeFile(
          IOSConfig.Paths.getPBXProjectPath(projectRoot),
          contents
        );
      }

      return config;
    },
  ]);
};

/** It's common for all frameworks to exist in the top-level "Frameworks" folder that shows in Xcode. */
function addFrameworksToDisplayFolder(
  project: XcodeProject,
  frameworks: PBXFileReference[]
) {
  const mainFrameworksGroup =
    project.rootObject.props.mainGroup
      .getChildGroups()
      .find((group) => group.getDisplayName() === "Frameworks") ??
    // If this happens, there's a big problem. But just in case...
    project.rootObject.props.mainGroup.createGroup({
      name: "Frameworks",
      sourceTree: "<group>",
    });

  frameworks.forEach((file) => {
    if (
      !mainFrameworksGroup.props.children.find(
        (child) => child.uuid === file.uuid
      )
    ) {
      mainFrameworksGroup.props.children.push(file);
    }
  });
}

function getOrCreateBuildFile(project: XcodeProject, file: PBXFileReference): PBXBuildFile {
  for (const entry of file.getReferrers()) {
    if (PBXBuildFile.is(entry) && entry.props.fileRef.uuid === file.uuid) {
      return entry;
    }
  }
  return PBXBuildFile.create(project, {
    fileRef: file,
  });
}

function getFramework(project: XcodeProject, name: string): PBXFileReference {
  const frameworkName = name + ".framework";
  for (const [, entry] of project.entries()) {
    if (
      PBXFileReference.is(entry) &&
      entry.props.lastKnownFileType === "wrapper.framework" &&
      entry.props.sourceTree === "SDKROOT" &&
      entry.props.name === frameworkName
    ) {
      return entry;
    }
  }
  return PBXFileReference.create(project, {
    path: "System/Library/Frameworks/" + frameworkName,
  });
}

function createConfigurationList(
  project: XcodeProject,
  {
    name,
    cwd,
    bundleId,
    deploymentTarget,
    currentProjectVersion,
  }: any
) {
  const debugBuildConfig = XCBuildConfiguration.create(project, {
    name: "Debug",
    buildSettings: {
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: "$accent",
      ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: "$widgetBackground",
      CLANG_ANALYZER_NONNULL: "YES",
      CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: "YES_AGGRESSIVE",
      CLANG_CXX_LANGUAGE_STANDARD: "gnu++20",
      CLANG_ENABLE_OBJC_WEAK: "YES",
      CLANG_WARN_DOCUMENTATION_COMMENTS: "YES",
      CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: "YES",
      CLANG_WARN_UNGUARDED_AVAILABILITY: "YES_AGGRESSIVE",
      CODE_SIGN_STYLE: "Automatic",
      CURRENT_PROJECT_VERSION: currentProjectVersion,
      DEBUG_INFORMATION_FORMAT: "dwarf",
      GCC_C_LANGUAGE_STANDARD: "gnu11",
      GENERATE_INFOPLIST_FILE: "YES",
      INFOPLIST_FILE: cwd + "/Info.plist",
      INFOPLIST_KEY_CFBundleDisplayName: name,
      INFOPLIST_KEY_NSHumanReadableCopyright: "",
      IPHONEOS_DEPLOYMENT_TARGET: deploymentTarget,
      LD_RUNPATH_SEARCH_PATHS:
        "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
      MARKETING_VERSION: "1.0",
      MTL_ENABLE_DEBUG_INFO: "INCLUDE_SOURCE",
      MTL_FAST_MATH: "YES",
      PRODUCT_BUNDLE_IDENTIFIER: bundleId,
      PRODUCT_NAME: "$(TARGET_NAME)",
      SKIP_INSTALL: "YES",
      SWIFT_ACTIVE_COMPILATION_CONDITIONS: "DEBUG",
      SWIFT_EMIT_LOC_STRINGS: "YES",
      SWIFT_OPTIMIZATION_LEVEL: "-Onone",
      SWIFT_VERSION: "5",
      TARGETED_DEVICE_FAMILY: "1,2",
    },
  });

  const releaseBuildConfig = XCBuildConfiguration.create(project, {
    name: "Release",
    buildSettings: {
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: "$accent",
      ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: "$widgetBackground",
      CLANG_ANALYZER_NONNULL: "YES",
      CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: "YES_AGGRESSIVE",
      CLANG_CXX_LANGUAGE_STANDARD: "gnu++20",
      CLANG_ENABLE_OBJC_WEAK: "YES",
      CLANG_WARN_DOCUMENTATION_COMMENTS: "YES",
      CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: "YES",
      CLANG_WARN_UNGUARDED_AVAILABILITY: "YES_AGGRESSIVE",
      CODE_SIGN_STYLE: "Automatic",
      COPY_PHASE_STRIP: "NO",
      CURRENT_PROJECT_VERSION: currentProjectVersion,
      DEBUG_INFORMATION_FORMAT: "dwarf-with-dsym",
      GCC_C_LANGUAGE_STANDARD: "gnu11",
      GENERATE_INFOPLIST_FILE: "YES",
      INFOPLIST_FILE: cwd + "/Info.plist",
      INFOPLIST_KEY_CFBundleDisplayName: name,
      INFOPLIST_KEY_NSHumanReadableCopyright: "",
      IPHONEOS_DEPLOYMENT_TARGET: deploymentTarget,
      LD_RUNPATH_SEARCH_PATHS:
        "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks",
      MARKETING_VERSION: "1.0",
      MTL_FAST_MATH: "YES",
      PRODUCT_BUNDLE_IDENTIFIER: bundleId,
      PRODUCT_NAME: "$(TARGET_NAME)",
      SKIP_INSTALL: "YES",
      SWIFT_EMIT_LOC_STRINGS: "YES",
      SWIFT_OPTIMIZATION_LEVEL: "-Owholemodule",
      SWIFT_VERSION: "5",
      TARGETED_DEVICE_FAMILY: "1,2",
    },
  });

  const configurationList = XCConfigurationList.create(project, {
    buildConfigurations: [debugBuildConfig, releaseBuildConfig],
    defaultConfigurationIsVisible: 0,
    defaultConfigurationName: "Release",
  });

  return configurationList;
}

export default withWidget;
