/**
 * ホーム画面に出す、ビーコンの自動検知の状態の説明
 */
export type MonitoringResult =
  | { started: true }
  | {
      started: false;
      reason:
        | "unsupported-office"
        | "beacon-unavailable"
        | "disclosure-declined"
        | "foreground-denied"
        | "background-denied"
        | "bluetooth-denied";
    };

export const monitoringMessage = (
  result: MonitoringResult,
  os: "ios" | "android" | string
) => {
  if (result.started) {
    return "オフィスのビーコンを監視中です。圏内に入ると自動で入退室します。";
  }
  switch (result.reason) {
    case "background-denied":
      return os === "android"
        ? "位置情報が「常に許可」でないため、ビーコンの自動検知を開始できません。設定アプリの「位置情報」で「常に許可」に変更してください。"
        : "位置情報が「常に許可」でないため、ビーコンの自動検知を開始できません。設定アプリで「常に」に変更してください。";
    case "disclosure-declined":
      return "位置情報の利用に同意されていないため、ビーコンの自動検知を開始できません。アプリを開き直すと、もう一度確認できます。";
    case "bluetooth-denied":
      return "「付近のデバイス」が未許可のため、ビーコンの自動検知を開始できません。設定アプリで許可してください。";
    case "foreground-denied":
      return "位置情報が未許可のため、ビーコンの自動検知を開始できません。";
    case "beacon-unavailable":
      return "この実行環境ではビーコン検知を利用できません（Development Build が必要です）。";
    case "unsupported-office":
      return "このオフィスはまだバックグラウンド監視の対象外です。";
  }
};
