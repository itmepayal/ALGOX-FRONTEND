import type { FC, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { EmptyState } from "../../ui/empty-state";
import { cn } from "../../../lib/cn";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  /** Prefer for numeric / ID columns */
  technical?: boolean;
  align?: "left" | "right" | "center";
  /** Skeleton bar max width hint (px or css length) */
  skeletonWidth?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  skeletonRows?: number;
  /** Row ids that should briefly highlight (e.g. newly arrived events) */
  highlightIds?: Set<string>;
  className?: string;
  minWidth?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = "No results",
  emptyHint,
  emptyDescription,
  emptyIcon,
  emptyAction,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  page = 1,
  totalPages = 1,
  total,
  onPageChange,
  skeletonRows = 6,
  highlightIds,
  className,
  minWidth = "720px",
}: DataTableProps<T>) {
  const selectable = Boolean(onToggleSelect);
  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className={cn("admin-datatable", className)}>
      <div className="admin-table-wrap">
        <table className="admin-table" style={{ minWidth }}>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 40 }} scope="col">
                  <input
                    type="checkbox"
                    checked={
                      rows.length > 0 &&
                      rows.every((r) => selectedIds?.has(rowKey(r)))
                    }
                    onChange={onToggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  style={{
                    width: c.width,
                    textAlign: c.align || "left",
                  }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`sk-${i}`} className="admin-table-skeleton-row">
                  {selectable ? (
                    <td>
                      <div className="admin-skel admin-skel-check" />
                    </td>
                  ) : null}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align || "left" }}
                    >
                      <div
                        className="admin-skel"
                        style={{
                          maxWidth: c.skeletonWidth || c.width || "7rem",
                          width: "100%",
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="admin-table-empty-cell">
                  <EmptyState
                    compact
                    title={emptyTitle}
                    description={emptyDescription ?? emptyHint}
                    icon={emptyIcon ?? <Inbox size={18} strokeWidth={1.75} />}
                    action={emptyAction}
                    className="mx-auto max-w-lg"
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = rowKey(row);
                const selected = selectedIds?.has(id);
                const highlight = highlightIds?.has(id);
                return (
                  <tr
                    key={id}
                    className={cn(
                      selected && "is-selected",
                      highlight && "is-new",
                    )}
                  >
                    {selectable && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected || false}
                          onChange={() => onToggleSelect?.(id)}
                          aria-label={`Select ${id}`}
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          c.technical && "num",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                        )}
                        data-tech={c.technical ? "" : undefined}
                        style={{ textAlign: c.align || "left" }}
                      >
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {onPageChange && (
        <div className="admin-pagination">
          {typeof total === "number" ? (
            <span className="admin-pagination-total">{total} total</span>
          ) : (
            <span />
          )}
          <div className="admin-pagination-actions">
            <button
              type="button"
              className="admin-btn"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </button>
            <span className="admin-pagination-page">
              Page {page} / {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              className="admin-btn"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const DataTableFC: FC = () => null;
