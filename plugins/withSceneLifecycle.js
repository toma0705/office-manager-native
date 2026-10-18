const {
  IOSConfig,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// iOS 27 では UIScene ライフサイクルに対応していないアプリは起動時に強制終了される。
// Expo SDK 54 のテンプレートは AppDelegate でウィンドウを作るため、
// ウィンドウの作成と React Native の起動を SceneDelegate に移す。

const SCENE_DELEGATE = `import React
import UIKit

// ウィンドウの作成と React Native の起動を行う（plugins/withSceneLifecycle.js が生成）
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = appDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    // 起動のきっかけになった URL を Linking.getInitialURL() に渡す
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let activity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        "UIApplicationLaunchOptionsUserActivityKey": activity,
        "UIApplicationLaunchOptionsUserActivityTypeKey": activity.activityType,
      ]
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions.isEmpty ? nil : launchOptions)
  }

  // 起動中に開かれた URL（AppDelegate の Linking 処理に渡す）
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = appDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  // Universal Links
  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

const withSceneManifest = config =>
  withInfoPlist(config, cfg => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });

const withoutWindowInAppDelegate = config =>
  withAppDelegate(config, cfg => {
    if (cfg.modResults.language !== "swift") {
      throw new Error("withSceneLifecycle: Swift の AppDelegate のみ対応しています");
    }
    const startBlock =
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;
    if (startBlock.test(cfg.modResults.contents)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        startBlock,
        "    // ウィンドウの作成と React Native の起動は SceneDelegate で行う（iOS 27 で UIScene が必須）\n"
      );
    } else if (!cfg.modResults.contents.includes("SceneDelegate で行う")) {
      throw new Error(
        "withSceneLifecycle: AppDelegate のウィンドウ作成部分が見つかりません。テンプレートが変わった可能性があります"
      );
    }
    return cfg;
  });

const withSceneDelegateFile = config =>
  withDangerousMod(config, [
    "ios",
    async cfg => {
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName
      );
      fs.writeFileSync(path.join(dir, "SceneDelegate.swift"), SCENE_DELEGATE);
      return cfg;
    },
  ]);

const withSceneDelegateInProject = config =>
  withXcodeProject(config, cfg => {
    const projectName = cfg.modRequest.projectName;
    const filepath = `${projectName}/SceneDelegate.swift`;
    if (!cfg.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath,
        groupName: projectName,
        project: cfg.modResults,
      });
    }
    return cfg;
  });

module.exports = config =>
  withSceneDelegateInProject(
    withSceneDelegateFile(withoutWindowInAppDelegate(withSceneManifest(config)))
  );
