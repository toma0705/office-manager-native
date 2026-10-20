package expo.modules.officebeacon

import android.app.Application
import android.content.Context
import expo.modules.core.interfaces.ApplicationLifecycleListener
import expo.modules.core.interfaces.Package

/**
 * AltBeacon がバックグラウンドでアプリのプロセスを起こしたときにも監視と通知先を
 * 登録し直せるよう、Application.onCreate で監視を再開する。
 */
class OfficeBeaconPackage : Package {
  override fun createApplicationLifecycleListeners(
    context: Context,
  ): List<ApplicationLifecycleListener> =
    listOf(
      object : ApplicationLifecycleListener {
        override fun onCreate(application: Application) {
          BeaconController.restore(application)
        }
      },
    )
}
