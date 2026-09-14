import sheetJson from "./dsa-best-sheet.json";

export type SheetDifficulty = "easy" | "medium" | "hard";

export interface SheetProblemRef {
  title: string;
  slug: string;
  difficulty: SheetDifficulty;
}

export interface SheetTopic {
  order: number;
  name: string;
  problems: SheetProblemRef[];
}

export interface DsaBestSheet {
  name: string;
  topics: SheetTopic[];
  uniqueProblems: Array<
    SheetProblemRef & { category: string; topics: string[] }
  >;
  stats: {
    topics: number;
    sheetEntries: number;
    uniqueProblems: number;
  };
}

export const DSA_BEST_SHEET = sheetJson as DsaBestSheet;

export const DSA_SHEET_TOPIC_ORDER = DSA_BEST_SHEET.topics.map((t) => t.name);

/** Canonical id used by sheet progress / reset APIs. */
export const STRIVER_A2Z_SHEET_ID = "striver-a2z";

/** Display name for confirmations and UI copy. */
export const STRIVER_A2Z_SHEET_NAME =
  "AlgoPath Sheet - Learn DSA from A to Z";

/** Stable topic order for sheet UI (unknown categories appended). */
export function orderTopics(categories: string[]): string[] {
  const known = new Set(DSA_SHEET_TOPIC_ORDER.map((t) => t.toLowerCase()));
  const ordered = DSA_SHEET_TOPIC_ORDER.filter((t) =>
    categories.some((c) => c.toLowerCase() === t.toLowerCase())
  );
  const extras = categories.filter((c) => !known.has(c.toLowerCase()));
  return [...ordered, ...extras];
}
