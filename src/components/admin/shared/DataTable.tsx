import type { FC, ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  skeletonRows?: number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = "No results",
  emptyHint,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  page = 1,
  totalPages = 1,
  total,
  onPageChange,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const selectable = Boolean(onToggleSelect);
  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className="admin-datatable">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36 }}>
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
                <th key={c.key} style={c.width ? { width: c.width } : undefined}>
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
                    <td key={c.key}>
                      <div className="admin-skel" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={colCount}>
                  <div className="admin-empty admin-empty-rich">
                    <div className="admin-empty-title">{emptyTitle}</div>
                    {emptyHint ? (
                      <div className="admin-muted">{emptyHint}</div>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const id = rowKey(row);
                const selected = selectedIds?.has(id);
                return (
                  <tr key={id} className={selected ? "is-selected" : undefined}>
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
                      <td key={c.key}>{c.render(row)}</td>
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
          {typeof total === "number" ? <span>{total} total</span> : null}
          <button
            type="button"
            className="admin-btn"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            Prev
          </button>
          <span>
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
      )}
    </div>
  );
}

export const DataTableFC: FC = () => null;
