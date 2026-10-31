package expo.modules.officebeacon

/** サーバー（/users/me）の在室状態 */
data class ServerAttendance(
  val entered: Boolean,
  /** 入室の保留中（圏内になったが、まだ確認の時間が過ぎていない） */
  val enterPending: Boolean,
  /** 退室の保留中（圏外になったが、まだ猶予が過ぎていない） */
  val exitPending: Boolean,
)

/** ビーコンの状態とサーバーの在室状態から決める操作と、そのとき呼ぶ API */
enum class BeaconAction(val path: String?) {
  /** 入室の保留を始める */
  REQUEST_ENTER("arrive"),
  /** 退室の保留を取り消す（猶予の間に戻った） */
  CANCEL_EXIT("arrive"),
  /** 退室の保留を始める */
  REQUEST_EXIT("leave"),
  /** 入室の保留を取り消す（前を通っただけ） */
  CANCEL_ENTER("leave"),
  NONE(null),
}

/**
 * iOS の src/services/beacon/attendanceDecision.ts と同じ判定。
 * どちらも modules/office-beacon/test-fixtures/attendance-decisions.json の表でテストしている。
 */
object AttendanceDecision {
  fun decide(inside: Boolean, server: ServerAttendance): BeaconAction =
    when {
      inside && !server.entered && !server.enterPending -> BeaconAction.REQUEST_ENTER
      inside && server.exitPending -> BeaconAction.CANCEL_EXIT
      !inside && server.entered && !server.exitPending -> BeaconAction.REQUEST_EXIT
      !inside && server.enterPending -> BeaconAction.CANCEL_ENTER
      else -> BeaconAction.NONE
    }
}
