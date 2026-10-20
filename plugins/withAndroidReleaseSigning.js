const { withAppBuildGradle } = require("@expo/config-plugins");

// Google Play へのアップロード用の署名設定。
// 鍵ファイルとパスワードはリポジトリに置かず、~/.gradle/gradle.properties の
// OFFICE_MANAGER_UPLOAD_* から読む。未設定なら従来どおり debug 鍵で署名する。
const MARKER = "// withAndroidReleaseSigning";

const SIGNING_CONFIG = `
        release { ${MARKER}
            if (project.hasProperty('OFFICE_MANAGER_UPLOAD_STORE_FILE')) {
                storeFile file(OFFICE_MANAGER_UPLOAD_STORE_FILE)
                storePassword OFFICE_MANAGER_UPLOAD_STORE_PASSWORD
                keyAlias OFFICE_MANAGER_UPLOAD_KEY_ALIAS
                keyPassword OFFICE_MANAGER_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, config => {
    let gradle = config.modResults.contents;
    if (gradle.includes(MARKER)) return config;

    gradle = gradle.replace(
      /(signingConfigs\s*\{\s*\n\s*debug\s*\{[\s\S]*?\n\s*\})/,
      `$1${SIGNING_CONFIG}`
    );
    gradle = gradle.replace(
      /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('OFFICE_MANAGER_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`
    );
    config.modResults.contents = gradle;
    return config;
  });
};
