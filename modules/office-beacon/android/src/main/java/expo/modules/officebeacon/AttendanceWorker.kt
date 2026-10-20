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
 * ビーコンの状態を入退室に反映する（JS の backgroundBeacon.ts の applyBeaconState と同じ流れ）。
 * サーバーの在室状態を正とし、既に同じ状態なら何もしない。
 */
class AttendanceWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  private class HttpException(val code: Int, message: String) : IOException(message)

  override fun doWork(): Result {
    val state = inputData.getString(KEY_STATE) ?: return Result.failure()
    val config = BeaconController.loadConfig(applicationContext) ?: return Result.success()
    val action = if (state == "inside") "enter" else "exit"

    return try {
      val entered = fetchServerEntered(config)
      if ((action == "enter") == entered) return Result.success()

      request(config, "POST", "/users/${config.userId}/$action")
      notifyAttendance(config, action)
      Log.i(TAG, "recorded $action")
      BeaconController.dispatchAttendanceChanged(action)
      Result.success()
    } catch (e: HttpException) {
      Log.w(TAG, "attendance request failed: ${e.code} ${e.message}")
      // 認証切れなどは再試行しても直らない
      if (e.code >= 500 && runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
    } catch (e: IOException) {
      Log.w(TAG, "attendance request failed", e)
      if (runAttemptCount < MAX_ATTEMPTS) Result.retry() else Result.failure()
    }
  }

  private fun fetchServerEntered(config: AttendanceConfig): Boolean {
    val body = request(config, "GET", "/users/me")
    return JSONObject(body).getJSONObject("user").getBoolean("entered")
  }

  private fun notifyAttendance(config: AttendanceConfig, action: String) {
    val payload = JSONObject()
      .put("user", config.userName)
      .put("status", if (action == "enter") "入室" else "退室")
      .put("officeCode", config.officeCode)
    try {
      request(config, "POST", "/notify", payload)
    } catch (e: IOException) {
      Log.w(TAG, "failed to notify attendance", e)
    }
  }

  private fun request(
    config: AttendanceConfig,
    method: String,
    path: String,
    body: JSONObject? = null,
  ): String {
    val connection = URL("${config.apiBaseUrl}$path").openConnection() as HttpURLConnection
    try {
      connection.requestMethod = method
      connection.connectTimeout = TIMEOUT_MS
      connection.readTimeout = TIMEOUT_MS
      connection.setRequestProperty("Authorization", "Bearer ${config.token}")
      if (body != null) {
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write(body.toString().toByteArray()) }
      } else if (method == "POST") {
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
    private const val MAX_ATTEMPTS = 5
    private const val TIMEOUT_MS = 15_000

    fun enqueue(context: Context, state: String) {
      val request = OneTimeWorkRequestBuilder<AttendanceWorker>()
        .setInputData(workDataOf(KEY_STATE to state))
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
