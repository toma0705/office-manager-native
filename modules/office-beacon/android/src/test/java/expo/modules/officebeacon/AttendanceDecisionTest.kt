package expo.modules.officebeacon

import java.io.File
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

/** iOS（attendanceDecision.test.ts）と同じ表で、判定がずれていないか確かめる */
class AttendanceDecisionTest {
  // Gradle はモジュールのフォルダ（modules/office-beacon/android）でテストを実行する
  private val fixture =
    JSONObject(File("../test-fixtures/attendance-decisions.json").readText())

  private val actions = mapOf(
    "requestEnter" to BeaconAction.REQUEST_ENTER,
    "cancelExit" to BeaconAction.CANCEL_EXIT,
    "requestExit" to BeaconAction.REQUEST_EXIT,
    "cancelEnter" to BeaconAction.CANCEL_ENTER,
    "none" to BeaconAction.NONE,
  )

  @Test
  fun decidesTheSameActionAsTheSharedTable() {
    val states = fixture.getJSONObject("serverStates")
    val cases = fixture.getJSONArray("cases")
    assertEquals(8, cases.length())

    for (i in 0 until cases.length()) {
      val case = cases.getJSONObject(i)
      val state = states.getJSONObject(case.getString("server"))
      val server = ServerAttendance(
        entered = state.getBoolean("entered"),
        enterPending = state.getBoolean("enterPending"),
        exitPending = state.getBoolean("exitPending"),
      )
      val actual = AttendanceDecision.decide(case.getString("beacon") == "inside", server)
      assertEquals(case.getString("name"), actions.getValue(case.getString("action")), actual)
    }
  }

  @Test
  fun insideActionsCallArriveAndOutsideActionsCallLeave() {
    assertEquals("arrive", BeaconAction.REQUEST_ENTER.path)
    assertEquals("arrive", BeaconAction.CANCEL_EXIT.path)
    assertEquals("leave", BeaconAction.REQUEST_EXIT.path)
    assertEquals("leave", BeaconAction.CANCEL_ENTER.path)
    assertEquals(null, BeaconAction.NONE.path)
  }
}
