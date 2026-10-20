package expo.modules.officebeacon

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * テストモード（実機確認用）の通知。ビーコンの検知と入退室の記録の結果を端末に知らせる。
 * 検知時に出した通知を、記録の結果で同じ ID のまま書き換える。
 */
object TestNotifier {
  private const val CHANNEL_ID = "office-beacon-test"

  fun newId(): Int = (System.currentTimeMillis() % Int.MAX_VALUE).toInt()

  fun notify(context: Context, id: Int, title: String, text: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    val manager = NotificationManagerCompat.from(context)
    manager.createNotificationChannel(
      NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_DEFAULT)
        .setName("ビーコンのテスト")
        .build(),
    )
    val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setContentIntent(contentIntent)
      .setAutoCancel(true)
      .build()
    try {
      manager.notify(id, notification)
    } catch (e: SecurityException) {
      // 通知の許可が取り消された直後など
    }
  }
}
