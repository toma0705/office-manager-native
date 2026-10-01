import ExpoModulesCore
import CoreLocation
import UIKit

/// CLLocationManager の delegate。モジュールより長く生きるよう保持し、
/// アプリがバックグラウンドで再起動された直後にもイベントを受け取れるよう
/// モジュール生成時（OnCreate）に作る。
final class BeaconDelegate: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var refreshing = Set<String>()
  var onState: ((String, String, String) -> Void)?

  override init() {
    super.init()
    manager.delegate = self
  }

  private func region(
    uuid: String, major: Int?, minor: Int?, identifier: String
  ) -> CLBeaconRegion? {
    guard let uuid = UUID(uuidString: uuid) else { return nil }
    let region: CLBeaconRegion
    if let major = major, let minor = minor {
      region = CLBeaconRegion(
        uuid: uuid, major: CLBeaconMajorValue(major),
        minor: CLBeaconMinorValue(minor), identifier: identifier)
    } else if let major = major {
      region = CLBeaconRegion(
        uuid: uuid, major: CLBeaconMajorValue(major), identifier: identifier)
    } else {
      region = CLBeaconRegion(uuid: uuid, identifier: identifier)
    }
    region.notifyOnEntry = true
    region.notifyOnExit = true
    region.notifyEntryStateOnDisplay = true
    return region
  }

  func start(uuid: String, major: Int?, minor: Int?, identifier: String) -> Bool {
    guard CLLocationManager.isMonitoringAvailable(for: CLBeaconRegion.self),
      let region = region(uuid: uuid, major: major, minor: minor, identifier: identifier)
    else { return false }
    manager.startMonitoring(for: region)
    refreshing.insert(identifier)
    manager.requestState(for: region)
    return true
  }

  func stopAll() {
    for region in manager.monitoredRegions {
      manager.stopMonitoring(for: region)
    }
    refreshing.removeAll()
  }

  func refresh() {
    for region in manager.monitoredRegions {
      refreshing.insert(region.identifier)
      manager.requestState(for: region)
    }
  }

  func isMonitoring() -> Bool {
    return !manager.monitoredRegions.isEmpty
  }

  func locationManager(
    _ manager: CLLocationManager, didDetermineState state: CLRegionState,
    for region: CLRegion
  ) {
    let source = refreshing.remove(region.identifier) != nil ? "refresh" : "event"
    let value: String
    switch state {
    case .inside: value = "inside"
    case .outside: value = "outside"
    default: return
    }
    // バックグラウンド起動時に JS が処理を終えるまで OS に待ってもらう
    var taskId = UIBackgroundTaskIdentifier.invalid
    taskId = UIApplication.shared.beginBackgroundTask(withName: "office-beacon") {
      UIApplication.shared.endBackgroundTask(taskId)
    }
    onState?(region.identifier, value, source)
    DispatchQueue.main.asyncAfter(deadline: .now() + 9) {
      if taskId != .invalid { UIApplication.shared.endBackgroundTask(taskId) }
    }
  }

  func locationManager(
    _ manager: CLLocationManager, monitoringDidFailFor region: CLRegion?,
    withError error: Error
  ) {
    NSLog("[OfficeBeacon] monitoring failed: \(error.localizedDescription)")
  }
}

public class OfficeBeaconModule: Module {
  private var delegate: BeaconDelegate?

  public func definition() -> ModuleDefinition {
    Name("OfficeBeacon")

    Events("onRegionState")

    OnCreate {
      DispatchQueue.main.async {
        let delegate = BeaconDelegate()
        delegate.onState = { [weak self] identifier, state, source in
          self?.sendEvent(
            "onRegionState",
            ["identifier": identifier, "state": state, "source": source])
        }
        self.delegate = delegate
      }
    }

    AsyncFunction("startMonitoringAsync") {
      (uuid: String, major: Int?, minor: Int?, identifier: String) -> Bool in
      return self.delegate?.start(
        uuid: uuid, major: major, minor: minor, identifier: identifier) ?? false
    }.runOnQueue(.main)

    AsyncFunction("stopMonitoringAsync") { () -> Void in
      self.delegate?.stopAll()
    }.runOnQueue(.main)

    AsyncFunction("refreshStateAsync") { () -> Void in
      self.delegate?.refresh()
    }.runOnQueue(.main)

    AsyncFunction("isMonitoringAsync") { () -> Bool in
      return self.delegate?.isMonitoring() ?? false
    }.runOnQueue(.main)
  }
}
