#!/usr/bin/env bash
# iOS のリリース用ビルドを作り、App Store Connect にアップロードする。
#
# 事前に:
#   - app.config.js の version（前回から上げる）と ios.buildNumber（毎回上げる）を書き換える
#   - Xcode に、Apple Developer のチームのアカウントでログインしておく（署名は自動）
# 使い方:
#   scripts/release-ios.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# テストモードのままビルドしない
unset OFFICE_MANAGER_TEST_MODE
# CocoaPods は UTF-8 でないと失敗する
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

VERSION=$(node -p "require('./app.config.js').version")
BUILD=$(node -p "require('./app.config.js').ios.buildNumber")
ARCHIVE="$HOME/Library/Developer/Xcode/Archives/$(date +%F)/app $VERSION ($BUILD).xcarchive"
echo "▶ iOS $VERSION（ビルド $BUILD）を作ります"

# ios フォルダは生成物なので、毎回作り直す（手で直した内容は消える。直すなら plugins/ に書く）
npx expo prebuild --platform ios --clean

(cd ios && xcodebuild archive \
  -workspace app.xcworkspace -scheme app -configuration Release \
  -destination generic/platform=iOS -archivePath "$ARCHIVE" -allowProvisioningUpdates)

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" -exportOptionsPlist scripts/ios/ExportOptions.plist \
  -exportPath build/ios-export -allowProvisioningUpdates

echo "✅ アップロードしました。App Store Connect でバージョン $VERSION を作り、ビルド $BUILD を選んで審査に出してください"
