const { withGradleProperties } = require("@expo/config-plugins");

// テンプレートの既定値（-Xmx2048m -XX:MaxMetaspaceSize=512m）では
// リリースビルド中に Metaspace が足りず Gradle のデーモンが落ちる
const JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";

module.exports = function withAndroidGradleMemory(config) {
  return withGradleProperties(config, config => {
    const properties = config.modResults.filter(
      item => !(item.type === "property" && item.key === "org.gradle.jvmargs")
    );
    properties.push({
      type: "property",
      key: "org.gradle.jvmargs",
      value: JVM_ARGS,
    });
    config.modResults = properties;
    return config;
  });
};
