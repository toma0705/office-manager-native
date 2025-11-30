import type { Office } from "@office-manager/api-client";

export const DEFAULT_OFFICE_PRIORITY_KEYWORDS = ["東京", "岡山"] as const;

type PriorityKeyword = (typeof DEFAULT_OFFICE_PRIORITY_KEYWORDS)[number];

type Options = {
  priorityKeywords?: readonly PriorityKeyword[] | readonly string[];
};

const resolvePriority = (
  office: Office,
  priorityKeywords: readonly string[]
): number => {
  const name = office.name ?? "";
  const index = priorityKeywords.findIndex((keyword) => name.includes(keyword));
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

export const sortOfficesByPriority = (
  offices: Office[],
  { priorityKeywords = DEFAULT_OFFICE_PRIORITY_KEYWORDS }: Options = {}
): Office[] => {
  return offices.slice().sort((a, b) => {
    const priorityA = resolvePriority(a, priorityKeywords);
    const priorityB = resolvePriority(b, priorityKeywords);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    const nameA = a.name ?? "";
    const nameB = b.name ?? "";

    if (nameA && nameB) {
      return nameA.localeCompare(nameB, "ja");
    }

    if (nameA) return -1;
    if (nameB) return 1;

    return 0;
  });
};
