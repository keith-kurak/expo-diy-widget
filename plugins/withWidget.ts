import { ConfigPlugin, withXcodeProject, IOSConfig } from 'expo/config-plugins';


const withCustomProductName : ConfigPlugin<string> = (config, customName) => {
  return withXcodeProject(
    config,
    async (
      /* @info <b>{ modResults, modRequest }</b> */ config
      /* @end */
    ) => {
      //config.modResults = IOSConfig.Name.setProductName({ name: customName }, config.modResults);
      return config;
    }
  );
};

export default withCustomProductName