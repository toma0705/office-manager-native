// オフィス用 iBeacon (ESP32 / Arduino-ESP32 core 3.x)
// UUID / Major / Minor は native/src/constants/beacon.ts と一致させること。
//
// BLEBeacon クラスは使わない。BLEUUID が UUID をバイト逆順で保持し、
// setProximityUUID がそれをそのまま送信するため、iPhone からは別の UUID に見えてしまう。
// iBeacon のデータはここでバイト単位に組み立てる（UUID・Major・Minor はすべてビッグエンディアン）。
#include <BLEDevice.h>
#include <BLEAdvertising.h>
#include <esp_bt.h>

#define BEACON_UUID "12345678-1234-1234-1234-123456789ABC"
#define BEACON_MAJOR 1
#define BEACON_MINOR 1

// 1m 地点での実測 RSSI (dBm)。アプリの入退室判定（領域監視）には使われないが、
// 距離推定(accuracy)の基準になる。P9 設定なら -55〜-60 付近。
// iPhone + nRF Connect 等で 1m 離して RSSI を数十回平均して決める。
#define MEASURED_POWER -59

// アドバタイズ間隔 (単位 0.625ms)。160 = 100ms。
// 短いほど検知は速く確実だが消費電力が増える。常時給電なら 100ms 推奨。
#define ADV_INTERVAL_UNITS 160

static uint8_t hexValue(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return 0;
}

// "12345678-1234-..." を表記どおりの順で 16 バイトに変換する
static void parseUuid(const char *uuid, uint8_t out[16]) {
  int n = 0;
  for (const char *p = uuid; *p && n < 16;) {
    if (*p == '-') {
      p++;
      continue;
    }
    out[n++] = (hexValue(p[0]) << 4) | hexValue(p[1]);
    p += 2;
  }
}

void setup() {
  Serial.begin(115200);
  BLEDevice::init("OfficeBeacon");

  // 送信出力を最大 (+9dBm) に。アドバタイズ・スキャン応答・デフォルトの全てに設定する。
  // 「40cm しか届かない」場合、既定の低出力や電源/アンテナ周りが原因のことが多い。
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_P9);
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_SCAN, ESP_PWR_LVL_P9);
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_DEFAULT, ESP_PWR_LVL_P9);

  // Manufacturer Specific Data (iBeacon) の AD 構造: 長さ 26 バイト
  uint8_t ad[27];
  ad[0] = 26;                   // 長さ（この後ろのバイト数）
  ad[1] = 0xFF;                 // AD タイプ: Manufacturer Specific Data
  ad[2] = 0x4C;                 // Apple の Company ID 0x004C（リトルエンディアン）
  ad[3] = 0x00;
  ad[4] = 0x02;                 // iBeacon 種別
  ad[5] = 0x15;                 // 以降のデータ長 (21)
  parseUuid(BEACON_UUID, &ad[6]);
  ad[22] = BEACON_MAJOR >> 8;   // Major（ビッグエンディアン）
  ad[23] = BEACON_MAJOR & 0xFF;
  ad[24] = BEACON_MINOR >> 8;   // Minor（ビッグエンディアン）
  ad[25] = BEACON_MINOR & 0xFF;
  ad[26] = (uint8_t)(int8_t)MEASURED_POWER;

  BLEAdvertisementData advData;
  advData.setFlags(0x04);  // BR/EDR 非対応
  advData.addData((char *)ad, sizeof(ad));

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->setAdvertisementData(advData);
  adv->setAdvertisementType(ADV_TYPE_NONCONN_IND);  // iBeacon は非接続型
  adv->setMinInterval(ADV_INTERVAL_UNITS);
  adv->setMaxInterval(ADV_INTERVAL_UNITS);
  adv->start();

  Serial.print("iBeacon advertising:");
  for (size_t i = 0; i < sizeof(ad); i++) Serial.printf(" %02X", ad[i]);
  Serial.println();
}

void loop() { delay(1000); }
