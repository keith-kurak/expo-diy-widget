import { ConfigPlugin, withXcodeProject, IOSConfig } from 'expo/config-plugins';


const withCustomProductName : ConfigPlugin<{customName: string}> = (config, props) => {
  return withXcodeProject(
    config,
    async (
      config
    ) => {
      config.modResults = IOSConfig.Name.setProductName({ name: props.customName }, config.modResults);
      return config;
    }
  );
};

export default withCustomProductName