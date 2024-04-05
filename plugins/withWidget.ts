import {
  ConfigPlugin,
  withXcodeProject,
  IOSConfig,
  withDangerousMod,
} from "expo/config-plugins";
import {
  PBXGroup,
  XcodeProject,
  PBXBuildFile,
  PBXFileReference,
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
        "../../widgets/ios/",
        widgetFolderName
      );

      // read

      const project = XcodeProject.open(
        IOSConfig.Paths.getPBXProjectPath(config.modRequest.projectRoot)
      );

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

export default withWidget;
