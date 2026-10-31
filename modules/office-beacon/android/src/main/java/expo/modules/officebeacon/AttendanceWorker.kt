package expo.modules.officebeacon

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit
import org.json.JSONObject

/**
 * ビーコンの状態を入退室に反映する（iOS は JS の backgroundBeacon.ts が同じことをしている）。
 * サーバーの在室状態を正とし、どの API を呼ぶかは AttendanceDecision が決める。
 * Android ではアプリが終了していると JS が動かないため、ここで API を呼ぶ。
 */
class AttendanceWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  private class HttpException(val code: Int, message: String) : IOException(message)

  override fun doWork(): Result {
    val state = inputData.getString(KEY_STATE) ?: return Result.failure()
    val config = BeaconController.loadConfig(applicationContext) ?: return Result.success()
    val inside = state == "inside"
    val label = if (inside) "入室" else "退室"

    return try {
      val server = fetchServerAttendance(config)
      val action = AttendanceDecision.decide(inside, server)
      action.path?.let { request(config, "POST", "/users/${config.userId}/$it") }
      Log.i(TAG, "beacon $state: $action")

      when (action) {
        BeaconAction.REQUEST_ENTER -> {
          notifyTest(
            config,
            "入室を保留しました",
            "1分の間に圏外にならなければ、サーバーが入室を記録して Discord に通知します。",
          )
          BeaconController.dispatchAttendanceChanged("arrive")
        }
        // 猶予の間に戻ってきたので保留を取り消した（Discord には通知しない）
        BeaconAction.CANCEL_EXIT ->
          notifyTest(config, "退室の保留を取り消しました", "猶予の間に戻ったため、入室中のままです。")
        BeaconAction.REQUEST_EXIT ->
          notifyTest(
            config,
            "退室を保留しました",
            "猶予の間に戻らなければ、サーバーが退室を記録して Discord に通知します。",
          )
        // 前を通っただけなので入室にしなかった（Discord には通知しない）
        BeaconAction.CANCEL_ENTER ->
          notifyTest(config, "入室の保留を取り消しました", "1分の間に圏外になったため、入室にしませんでした。")
        BeaconAction.NONE ->
          if (inputData.getString(KEY_SOURCE) == "event") {
            val current = when {
              server.exitPending -> "退室の保留中"
              server.enterPending -> "入室の保留中"
              server.entered -> "入室中"
              else -> "退室中"
            }
            notifyTest(config, "${current}のままです", "すでに${current}のため、記録は不要でした。")
          }
      }
      Result.success()
    } catch (e: HttpException) {
      Log.w(TAG, "attendance request failed: ${e.code} ${e.message}")
      // 認証切れなどは再試行しても直らない
      val retry = e.code >= 500 && runAttemptCount < MAX_ATTEMPTS
      notifyFailure(config, label, "サーバーエラー ${e.code}", retry)
      if (retry) Result.retry() else Result.failure()
    } catch (e: IOException) {
      Log.w(TAG, "attendance request failed", e)
      val retry = runAttemptCount < MAX_ATTEMPTS
      notifyFailure(config, label, e.message ?: "通信エラー", retry)
      if (retry) Result.retry() else Result.failure()
    }
  }

  private fun notifyFailure(config: AttendanceConfig, label: String, reason: String, retry: Boolean) {
    notifyTest(
      config,
      "${label}の記録に失敗しました",
      if (retry) "$reason。しばらくしてから再試行します。" else "$reason。再試行はしません。",
    )
  }

  /** テストモードのとき、検知時に出した通知を記録の結果で書き換える */
  private fun notifyTest(config: AttendanceConfig, title: String, text: String) {
    if (!config.testMode) return
    val id = inputData.getInt(KEY_NOTIFICATION_ID, NO_NOTIFICATION)
    if (id == NO_NOTIFICATION) return
    val detectedAt = inputData.getString(KEY_DETECTED_AT) ?: ""
    val trigger = if (inputData.getString(KEY_SOURCE) == "event") "検知" else "状態の確認"
    TestNotifier.notify(applicationContext, id, title, "$detectedAt $trigger: $text")
  }

  private fun fetchServerAttendance(config: AttendanceConfig): ServerAttendance {
    val user = JSONObject(request(config, "GET", "/users/me")).getJSONObject("user")
    val entered = user.getBoolean("entered")
    return ServerAttendance(
      entered = entered,
      enterPending = !entered && !user.isNull("enterPendingSince"),
      exitPending = entered && !user.isNull("exitPendingSince"),
    )
  }

  private fun request(config: AttendanceConfig, method: String, path: String): String {
    val connection = URL("${config.apiBaseUrl}$path").openConnection() as HttpURLConnection
    try {
      connection.requestMethod = method
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      connection.setRequestProperty("Authorization", "Bearer ${config.token}")
      if (method == "POST") {
        connection.doOutput = true
        connection.setFixedLengthStreamingMode(0)
      }
      val code = connection.responseCode
      val stream = if (code in 200..299) connection.inputStream else connection.errorStream
      val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
      if (code !in 200..299) throw HttpException(code, text.take(200))
      return text
    } finally {
      connection.disconnect()
    }
  }

  companion object {
    const val WORK_NAME = "office-beacon-attendance"
    private const val TAG = "OfficeBeacon"
    private const val KEY_STATE = "state"
    private const val KEY_SOURCE = "source"
    private const val KEY_DETECTED_AT = "detectedAt"
    private const val KEY_NOTIFICATION_ID = "notificationId"
    private const val NO_NOTIFICATION = -1
    private const val MAX_ATTEMPTS = 5
    private const val TIMEOUT_MS = 15_000

    fun enqueue(
      context: Context,
      state: String,
      source: String,
      detectedAt: String,
      notificationId: Int?,
    ) {
      val request = OneTimeWorkRequestBuilder<AttendanceWorker>()
        .setInputData(
          workDataOf(
            KEY_STATE to state,
            KEY_SOURCE to source,
            KEY_DETECTED_AT to detectedAt,
            KEY_NOTIFICATION_ID to (notificationId ?: NO_NOTIFICATION),
          ),
        )
        .setConstraints(
          Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        )
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()
      // 最新の状態だけを反映すればよい（入ってすぐ出たなら「退室」だけ処理する）
      WorkManager.getInstance(context)
        .enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.REPLACE, request)
    }
  }
}
