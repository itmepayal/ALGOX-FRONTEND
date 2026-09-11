import type { Problem } from "../api/problemApi";

const CODE_PREFIX = "algox:code:";
const BOOKMARK_PREFIX = "algox:bookmarks:";
const NOTES_PREFIX = "algox:notes:";
const FONT_KEY = "algox:editor-font-size";

export function getProblemId(problem: Pick<Problem, "id" | "_id"> | null | undefined): string {
  return (problem?.id || problem?._id || "").toString();
}

export function getStarterTemplate(problem: Problem, language: string): string {
  const fromStub = problem.codeStubs?.find((s) => s.language === language)?.userTemplate;
  const fromStarter = (problem as any).starterCode?.[language];
  if (fromStub) return fromStub;
  if (fromStarter) return fromStarter;

  switch (language) {
    case "cpp":
      return `class Solution {\npublic:\n    int solution(vector<int>& nums) {\n        // Write your code here\n    }\n};\n`;
    case "python":
      return `class Solution:\n    def solution(self, nums):\n        # Write your code here\n        pass\n`;
    case "java":
      return `class Solution {\n    public int solution(int[] nums) {\n        // Write your code here\n        return 0;\n    }\n}\n`;
    default:
      return `function solution(nums) {\n  // Write your code here\n}\n`;
  }
}

function codeKey(userId: string | undefined, problemId: string, language: string) {
  return `${CODE_PREFIX}${userId || "guest"}:${problemId}:${language}`;
}

export function loadSavedCode(
  userId: string | undefined,
  problemId: string,
  language: string
): string | null {
  try {
    return localStorage.getItem(codeKey(userId, problemId, language));
  } catch {
    return null;
  }
}

export function saveCode(
  userId: string | undefined,
  problemId: string,
  language: string,
  code: string
): void {
  try {
    localStorage.setItem(codeKey(userId, problemId, language), code);
  } catch {
    // ignore quota
  }
}

export function clearSavedCode(
  userId: string | undefined,
  problemId: string,
  language: string
): void {
  try {
    localStorage.removeItem(codeKey(userId, problemId, language));
  } catch {
    // ignore
  }
}

export function loadBookmarks(userId: string | undefined): string[] {
  try {
    const raw = localStorage.getItem(`${BOOKMARK_PREFIX}${userId || "guest"}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleBookmark(userId: string | undefined, problemId: string): string[] {
  const list = loadBookmarks(userId);
  const next = list.includes(problemId)
    ? list.filter((id) => id !== problemId)
    : [...list, problemId];
  try {
    localStorage.setItem(`${BOOKMARK_PREFIX}${userId || "guest"}`, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadNotes(userId: string | undefined, problemId: string): string {
  try {
    return localStorage.getItem(`${NOTES_PREFIX}${userId || "guest"}:${problemId}`) || "";
  } catch {
    return "";
  }
}

export function saveNotes(
  userId: string | undefined,
  problemId: string,
  notes: string
): void {
  try {
    const key = `${NOTES_PREFIX}${userId || "guest"}:${problemId}`;
    if (!notes.trim()) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, notes);
    }
  } catch {
    // ignore
  }
}

export function hasNote(userId: string | undefined, problemId: string): boolean {
  return Boolean(loadNotes(userId, problemId).trim());
}

/** Collect sheet resource links from problem fields (no broken icons). */
export function getProblemResources(problem: Problem): Array<{
  type: "youtube" | "article" | "editorial" | "docs" | "practice";
  url: string;
  label: string;
  isPremium?: boolean;
}> {
  const out: Array<{
    type: "youtube" | "article" | "editorial" | "docs" | "practice";
    url: string;
    label: string;
    isPremium?: boolean;
  }> = [];
  const seen = new Set<string>();

  const push = (
    type: "youtube" | "article" | "editorial" | "docs" | "practice",
    url: string | undefined,
    label: string,
    isPremium?: boolean
  ) => {
    const u = (url || "").trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ type, url: u, label, isPremium });
  };

  for (const r of problem.resources || []) {
    push(r.type, r.url, r.label || r.type, r.isPremium);
  }
  push("youtube", problem.videoUrl, "Video");
  push("article", problem.articleUrl, "Article");
  push("practice", problem.practiceUrl, "Practice");
  if (problem.editorial?.trim()) {
    // In-app editorial — open via special marker handled by sheet
    push("editorial", `editorial://${problem.slug || problem.id}`, "Editorial");
  }

  return out;
}

export function loadEditorFontSize(): number {
  try {
    const n = Number(localStorage.getItem(FONT_KEY));
    return Number.isFinite(n) && n >= 12 && n <= 22 ? n : 14;
  } catch {
    return 14;
  }
}

export function saveEditorFontSize(size: number): void {
  try {
    localStorage.setItem(FONT_KEY, String(size));
  } catch {
    // ignore
  }
}

/** Extract progressive hints from description / editorial text. */
export function extractHints(problem: Problem): string[] {
  const hints: string[] = [];
  const editorial = (problem as any).editorial as string | undefined;
  const constraints = (problem as any).constraints as string | undefined;
  const blobs = [problem.description || "", editorial || "", constraints || ""];

  for (const text of blobs) {
    const lines = text.split("\n");
    for (const line of lines) {
      const m = line.match(/^Hint\s*\d*\s*:\s*(.+)$/i);
      if (m?.[1]) hints.push(m[1].trim());
    }
    // Also match "Hint 1\n..." blocks lightly
    const block = text.match(/Hints?\s*:\s*([\s\S]+?)(?:\n\n|Constraints:|$)/i);
    if (block?.[1] && !hints.length) {
      block[1]
        .split("\n")
        .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
        .filter(Boolean)
        .forEach((h) => hints.push(h));
    }
  }

  // Deduplicate
  return [...new Set(hints)].slice(0, 5);
}
