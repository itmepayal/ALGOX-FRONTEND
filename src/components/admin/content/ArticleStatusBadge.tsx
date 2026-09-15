import type { FC } from "react";
import { StatusBadge } from "../shared/StatusBadge";

/** Statuses ArticleStatusBadge can render (incl. future backend values). */
export type ArticleUiStatus =
  | "draft"
  | "pending"
  | "published"
  | "archived"
  | "rejected"
  | "unknown";

const KNOWN: ArticleUiStatus[] = [
  "draft",
  "pending",
  "published",
  "archived",
  "rejected",
];

/**
 * Resolve display status from article payload.
 * Current ContentService uses `isPublished` only; optional `status` is supported
 * for forward compatibility without inventing backend behavior.
 */
export function resolveArticleStatus(article: {
  isPublished?: boolean;
  status?: string | null;
}): ArticleUiStatus {
  const raw = String(article?.status || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (KNOWN.includes(raw as ArticleUiStatus)) {
    return raw as ArticleUiStatus;
  }
  if (article?.isPublished === true) return "published";
  if (article?.isPublished === false) return "draft";
  return "unknown";
}

export const ArticleStatusBadge: FC<{
  article?: { isPublished?: boolean; status?: string | null };
  status?: string | null;
  className?: string;
}> = ({ article, status, className }) => {
  const resolved = status
    ? resolveArticleStatus({ status })
    : resolveArticleStatus(article || {});
  return <StatusBadge status={resolved} className={className} />;
};
