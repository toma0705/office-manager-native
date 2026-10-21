package expo.modules.officebeacon

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.WorkManager
import org.altbeacon.beacon.BeaconManager
import org.altbeacon.beacon.BeaconParser
import org.altbeacon.beacon.Identifier
import org.altbeacon.beacon.MonitorNotifier
import org.altbeacon.beacon.Region
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONObject

/** 入退室 API を呼ぶのに必要な情報（JS 側の BackgroundAttendanceSnapshot から渡される） */
data class AttendanceConfig(
  val apiBaseUrl: String,
  val token: String,
  val userId: Int,
  val userName: String,
  val officeCode: String,
  /** 実機確認用。Discord に通知せず、端末の通知で検知と記録の結果を知らせる */
  val testMode: Boolean,
)

/**
 * AltBeacon による iBeacon 領域監視。
 *
 * iOS では OS がアプリを起こして JS に入退場を伝えるが、Android ではアプリが終了していると
 * JS が動かない。そのため検知後の入退室 API 呼び出しも Kotlin 側（AttendanceWorker）で行う。
 * アプリのプロセスが起こされるたびに Application.onCreate から restore() で監視を張り直す。
 */
object BeaconController {
  private const val TAG = "OfficeBeacon"
  private const val PREFS = "office_beacon"
  private const val KEY_REGION = "region"
  private const val KEY_CONFIG = "attendance_config"
  private const val IBEACON_LAYOUT = "m:2-3=0215,i:4-19,i:20-21,i:22-23,p:24-24"

  // iOS の領域退出（ビーコンが見えなくなってから約30秒）に合わせ、境界でのばたつきを抑える
  private const val REGION_EXIT_PERIOD_MS = 30_000L

  interface Listener {
    fun onRegionState(identifier: String, state: String, source: String)
    fun onAttendanceChanged(action: String)
  }

  @Volatile
  var listener: Listener? = null

  private var configured = false
  private val refreshing = mutableSetOf<String>()

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  @Synchronized
  private fun manager(context: Context): BeaconManager {
    val appContext = context.applicationContext
    val manager = BeaconManager.getInstanceForApplication(appContext)
    if (!configured) {
      configured = true
      manager.beaconParsers.clear()
      manager.beaconParsers.add(BeaconParser().setBeaconLayout(IBEACON_LAYOUT))
      BeaconManager.setRegionExitPeriod(REGION_EXIT_PERIOD_MS)
      // フォアグラウンドサービス（常駐通知）を使わず、OS の PendingIntent スキャンで検知する
      manager.setIntentScanningStrategyEnabled(true)
      manager.addMonitorNotifier(object : MonitorNotifier {
        override fun didEnterRegion(region: Region) = Unit
        override fun didExitRegion(region: Region) = Unit
        override fun didDetermineStateForRegion(state: Int, region: Region) {
          handleState(appContext, state, region)
        }
      })
    }
    return manager
  }

  private fun handleState(context: Context, state: Int, region: Region) {
    val value = if (state == MonitorNotifier.INSIDE) "inside" else "outside"
    val source = synchronized(refreshing) {
      if (refreshing.remove(region.uniqueId)) "refresh" else "event"
    }
    Log.i(TAG, "region ${region.uniqueId} is $value ($source)")
    listener?.onRegionState(region.uniqueId, value, source)

    val detectedAt = SimpleDateFormat("HH:mm:ss", Locale.JAPAN).format(Date())
    val notificationId = if (loadConfig(context)?.testMode == true) {
      TestNotifier.newId().also { id ->
        // アプリを開くたびの状態の確認では、記録を直したときだけ通知する（AttendanceWorker）
        if (source == "event") {
          TestNotifier.notify(
            context,
            id,
            if (value == "inside") "ビーコンの圏内に入りました" else "ビーコンの圏外に出ました",
            "$detectedAt 入退場で検知。入退室の記録を確認しています…",
          )
        }
      }
    } else {
      null
    }
    AttendanceWorker.enqueue(context, value, source, detectedAt, notificationId)
  }

  fun hasPermissions(context: Context): Boolean {
    val required = buildList {
      add(Manifest.permission.ACCESS_FINE_LOCATION)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        add(Manifest.permission.BLUETOOTH_SCAN)
      }
    }
    return required.all {
      ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun isBleAvailable(context: Context) =
    context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)

  private fun buildRegion(json: JSONObject): Region {
    fun optInt(key: String) =
      if (json.isNull(key)) null else Identifier.fromInt(json.getInt(key))
    return Region(
      json.getString("identifier"),
      Identifier.parse(json.getString("uuid")),
      optInt("major"),
      optInt("minor"),
    )
  }

  fun start(
    context: Context,
    uuid: String,
    major: Int?,
    minor: Int?,
    identifier: String,
  ): Boolean {
    if (!isBleAvailable(context) || !hasPermissions(context)) return false
    val json = JSONObject()
      .put("uuid", uuid)
      .put("major", major ?: JSONObject.NULL)
      .put("minor", minor ?: JSONObject.NULL)
      .put("identifier", identifier)
    val region = try {
      buildRegion(json)
    } catch (e: Exception) {
      Log.w(TAG, "invalid region", e)
      return false
    }
    prefs(context).edit().putString(KEY_REGION, json.toString()).apply()

    val manager = manager(context)
    manager.monitoredRegions
      .filter { it.uniqueId != identifier }
      .forEach { manager.stopMonitoring(it) }
    synchronized(refreshing) { refreshing.add(identifier) }
    manager.startMonitoring(region)
    manager.requestStateForRegion(region)
    return true
  }

  /** アプリのプロセスが（バックグラウンドを含め）起動されたときに監視を再開する */
  fun restore(context: Context) {
    val raw = prefs(context).getString(KEY_REGION, null) ?: return
    if (!isBleAvailable(context) || !hasPermissions(context)) return
    try {
      manager(context).startMonitoring(buildRegion(JSONObject(raw)))
    } catch (e: Exception) {
      Log.w(TAG, "failed to restore monitoring", e)
    }
  }

  fun stopAll(context: Context) {
    prefs(context).edit().remove(KEY_REGION).remove(KEY_CONFIG).apply()
    WorkManager.getInstance(context).cancelUniqueWork(AttendanceWorker.WORK_NAME)
    if (!configured) return
    val manager = manager(context)
    manager.monitoredRegions.toList().forEach { manager.stopMonitoring(it) }
    synchronized(refreshing) { refreshing.clear() }
  }

  fun refresh(context: Context) {
    if (!configured) restore(context)
    if (!configured) return
    val manager = manager(context)
    manager.monitoredRegions.forEach { region ->
      synchronized(refreshing) { refreshing.add(region.uniqueId) }
      manager.requestStateForRegion(region)
    }
  }

  fun isMonitoring(context: Context): Boolean =
    configured && manager(context).monitoredRegions.isNotEmpty()

  fun saveConfig(context: Context, config: AttendanceConfig?) {
    val editor = prefs(context).edit()
    if (config == null) {
      editor.remove(KEY_CONFIG)
    } else {
      editor.putString(
        KEY_CONFIG,
        JSONObject()
          .put("apiBaseUrl", config.apiBaseUrl)
          .put("token", config.token)
          .put("userId", config.userId)
          .put("userName", config.userName)
          .put("officeCode", config.officeCode)
          .put("testMode", config.testMode)
          .toString(),
      )
    }
    editor.apply()
  }

  fun loadConfig(context: Context): AttendanceConfig? {
    val raw = prefs(context).getString(KEY_CONFIG, null) ?: return null
    return try {
      val json = JSONObject(raw)
      AttendanceConfig(
        apiBaseUrl = json.getString("apiBaseUrl"),
        token = json.getString("token"),
        userId = json.getInt("userId"),
        userName = json.getString("userName"),
        officeCode = json.getString("officeCode"),
        testMode = json.optBoolean("testMode", false),
      )
    } catch (e: Exception) {
      // 例外のメッセージには保存した値（トークンを含む）が入ることがあるので出さない
      Log.w(TAG, "invalid attendance config")
      null
    }
  }

  fun dispatchAttendanceChanged(action: String) {
    listener?.onAttendanceChanged(action)
  }
}
