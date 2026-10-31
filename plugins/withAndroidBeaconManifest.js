const { AndroidConfig, withAndroidManifest } = require("@expo/config-plugins");

// AltBeacon はフォアグラウンドサービス（種類: location）を宣言しているが、
// このアプリは常駐通知なしの IntentScanStrategy で検知するため使わない。
// 宣言が残ると Google Play Console でフォアグラウンドサービスの申告が必要になるので取り除く。
const BEACON_SERVICE = "org.altbeacon.beacon.service.BeaconService";

module.exports = function withAndroidBeaconManifest(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults;
    manifest.manifest.$["xmlns:tools"] ??= "http://schemas.android.com/tools";

    const application =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.service ??= [];
    const existing = application.service.find(
      service => service.$["android:name"] === BEACON_SERVICE
    );
    const attributes = {
      "android:name": BEACON_SERVICE,
      "tools:remove": "android:foregroundServiceType",
    };
    if (existing) {
      Object.assign(existing.$, attributes);
    } else {
      application.service.push({ $: attributes });
    }
    return config;
  });
};
