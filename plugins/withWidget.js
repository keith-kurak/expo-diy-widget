const {  withXcodeProject } = require('expo/config-plugins');

const withCustomProductName = (config, customName) => {
  return withXcodeProject(
    config,
    async (
      config
    ) => {
      const xcodeProject = config.modResults;
      xcodeProject.productName = customName;
      console.log(xcodeProject.productName)
      return config;
    }
  );
};

module.exports = withCustomProductName;