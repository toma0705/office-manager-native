const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Xcode 27 は iOS 15.0 未満の Pod を拒否するため、全 Pod の最低OSを引き上げる。
const MARKER = "# withPodsDeploymentTarget";

module.exports = (config, minimum = "15.1") =>
  withDangerousMod(config, [
    "ios",
    async cfg => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (contents.includes(MARKER)) return cfg;
      const snippet = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        current = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || Gem::Version.new(current) < Gem::Version.new('${minimum}')
          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${minimum}'
        end
      end
    end
`;
      contents = contents.replace(
        /(react_native_post_install\([\s\S]*?\n    \)\n)/,
        `$1${snippet}`
      );
      fs.writeFileSync(podfile, contents);
      return cfg;
    },
  ]);
