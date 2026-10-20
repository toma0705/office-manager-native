package expo.modules.officebeacon

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AttendanceConfigRecord : Record {
  @Field val apiBaseUrl: String = ""
  @Field val token: String = ""
  @Field val userId: Int = 0
  @Field val userName: String = ""
  @Field val officeCode: String = ""
}

class OfficeBeaconModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("OfficeBeacon")

    Events("onRegionState", "onAttendanceChanged")

    OnCreate {
      BeaconController.listener = object : BeaconController.Listener {
        override fun onRegionState(identifier: String, state: String, source: String) {
          sendEvent(
            "onRegionState",
            mapOf("identifier" to identifier, "state" to state, "source" to source),
          )
        }

        override fun onAttendanceChanged(action: String) {
          sendEvent("onAttendanceChanged", mapOf("action" to action))
        }
      }
    }

    OnDestroy {
      BeaconController.listener = null
    }

    AsyncFunction("startMonitoringAsync") {
      uuid: String, major: Int?, minor: Int?, identifier: String ->
      BeaconController.start(context, uuid, major, minor, identifier)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("stopMonitoringAsync") {
      BeaconController.stopAll(context)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("refreshStateAsync") {
      BeaconController.refresh(context)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("isMonitoringAsync") {
      BeaconController.isMonitoring(context)
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setAttendanceConfigAsync") { config: AttendanceConfigRecord? ->
      BeaconController.saveConfig(
        context,
        config?.let {
          AttendanceConfig(
            apiBaseUrl = it.apiBaseUrl,
            token = it.token,
            userId = it.userId,
            userName = it.userName,
            officeCode = it.officeCode,
          )
        },
      )
    }
  }
}
