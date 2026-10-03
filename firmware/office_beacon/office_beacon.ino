// オフィス用 iBeacon (ESP32 / Arduino-ESP32 core 2.x 系の BLE ライブラリ)
// UUID / Major / Minor は native/src/constants/beacon.ts と一致させること。
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEBeacon.h>
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

void setup() {
  Serial.begin(115200);
  BLEDevice::init("OfficeBeacon");

  // 送信出力を最大 (+9dBm) に。アドバタイズ・スキャン応答・デフォルトの全てに設定する。
  // 「40cm しか届かない」場合、既定の低出力や電源/アンテナ周りが原因のことが多い。
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_P9);
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_SCAN, ESP_PWR_LVL_P9);
  esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_DEFAULT, ESP_PWR_LVL_P9);

  BLEBeacon beacon;
  beacon.setManufacturerId(0x4C00);  // Apple (little-endian 指定)
  beacon.setProximityUUID(BLEUUID(BEACON_UUID));
  beacon.setMajor(BEACON_MAJOR);
  beacon.setMinor(BEACON_MINOR);
  beacon.setSignalPower(MEASURED_POWER);

  BLEAdvertisementData advData;
  advData.setFlags(0x04);  // BR/EDR 非対応
  std::string payload = "";
  payload += (char)26;     // 長さ
  payload += (char)0xFF;   // Manufacturer Specific Data
  payload += beacon.getData();
  advData.addData(payload);

  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->setAdvertisementData(advData);
  adv->setAdvertisementType(ADV_TYPE_NONCONN_IND);  // iBeacon は非接続型
  adv->setMinInterval(ADV_INTERVAL_UNITS);
  adv->setMaxInterval(ADV_INTERVAL_UNITS);
  adv->start();
  Serial.println("iBeacon advertising");
}

void loop() { delay(1000); }
