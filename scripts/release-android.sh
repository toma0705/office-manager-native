#!/usr/bin/env bash
# Android のリリース用ビルド（AAB）を作る。できたファイルを Google Play Console にアップロードする。
#
# 事前に:
#   - app.config.js の version と android.versionCode（毎回上げる）を書き換える
#   - ~/.gradle/gradle.properties にアップロード鍵の設定を書いておく（README の「リリース」）
# 使い方:
#   scripts/release-android.sh
set -euo pipefail
cd "$(dirname "$0")/.."

unset OFFICE_MANAGER_TEST_MODE

# 鍵の設定がないと debug の鍵で署名され、Play Console に弾かれる
if ! grep -q "^OFFICE_MANAGER_UPLOAD_STORE_FILE=" "$HOME/.gradle/gradle.properties" 2>/dev/null; then
  echo "❌ ~/.gradle/gradle.properties に OFFICE_MANAGER_UPLOAD_* の設定がありません（README の「リリース」）" >&2
  exit 1
fi

VERSION=$(node -p "require('./app.config.js').version")
CODE=$(node -p "require('./app.config.js').android.versionCode")
OUTPUT="build/office-manager-$VERSION-$CODE.aab"
echo "▶ Android $VERSION（versionCode $CODE）を作ります"

# android フォルダは生成物なので、毎回作り直す（手で直した内容は消える。直すなら plugins/ に書く）
npx expo prebuild --platform android --clean

(cd android && ./gradlew :app:bundleRelease)

mkdir -p build
cp android/app/build/outputs/bundle/release/app-release.aab "$OUTPUT"
echo "✅ $OUTPUT を作りました。Google Play Console の「内部テスト」などで新しいリリースを作り、アップロードしてください"
