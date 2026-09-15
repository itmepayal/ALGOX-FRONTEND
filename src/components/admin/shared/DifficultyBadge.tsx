import type { FC } from "react";
import { Badge } from "../../ui/badge";
import { cn } from "../../../lib/cn";

export type Difficulty = "easy" | "medium" | "hard" | string;

function normalizeDifficulty(raw?: string | null): "easy" | "medium" | "hard" | "unknown" {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (s === "easy") return "easy";
  if (s === "medium") return "medium";
  if (s === "hard") return "hard";
  return "unknown";
}

const TONE: Record<
  "easy" | "medium" | "hard" | "unknown",
  "success" | "warning" | "danger" | "default"
> = {
  easy: "success",
  medium: "warning",
  hard: "danger",
  unknown: "default",
};

const LABEL = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  unknown: "Unknown",
} as const;

/**
 * Difficulty badge without Lucide icons — avoids "svgEASY" text-extraction artifacts
 * from nested SVG + uppercase labels.
 */
export const DifficultyBadge: FC<{
  difficulty?: string | null;
  className?: string;
}> = ({ difficulty, className }) => {
  const key = normalizeDifficulty(difficulty);
  return (
    <Badge
      variant={TONE[key]}
      className={cn(
        "font-primary text-xs font-medium tracking-wide",
        className,
      )}
      title={LABEL[key]}
    >
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80"
        aria-hidden
      />
      <span>{LABEL[key]}</span>
    </Badge>
  );
};
