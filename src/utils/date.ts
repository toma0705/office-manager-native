export const formatDateTime = (
  input: string | Date | null | undefined
): string => {
  if (!input) return "-";
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return "-";

  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};
