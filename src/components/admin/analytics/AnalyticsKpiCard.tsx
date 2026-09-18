import type { FC, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "../../../lib/cn";
import { Card, CardContent } from "../../ui/card";

export function formatTrendPct(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || Number.isNaN(Number(pct))) return null;
  const n = Number(pct);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

export const AnalyticsKpiCard: FC<{
  label: string;
  value: string | number;
  icon?: ReactNode;
  trendPct?: number | null;
  compareLabel?: string;
  sparkline?: number[];
  loading?: boolean;
  unavailable?: boolean;
  className?: string;
}> = ({
  label,
  value,
  icon,
  trendPct,
  compareLabel = "vs prior period",
  sparkline,
  loading,
  unavailable,
  className,
}) => {
  const trend = formatTrendPct(trendPct);
  const up = trendPct != null && trendPct > 0;
  const down = trendPct != null && trendPct < 0;
  const flat = trendPct != null && trendPct === 0;

  if (loading) {
    return (
      <Card className={cn("ax-kpi ax-kpi--skeleton", className)} aria-busy="true">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="ax-skel ax-skel-label" />
          <div className="ax-skel ax-skel-value" />
          <div className="ax-skel ax-skel-hint" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("ax-kpi", className)}>
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-primary text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {icon ? (
            <span className="text-primary shrink-0 opacity-80" aria-hidden>
              {icon}
            </span>
          ) : null}
        </div>
        <div className="font-technical text-2xl font-semibold leading-none tracking-tight text-foreground tabular-nums">
          {unavailable ? "Unavailable" : value}
        </div>
        <div className="mt-auto flex min-h-[1.25rem] items-center justify-between gap-2">
          {trend && !unavailable ? (
            <p
              className={cn(
                "font-primary inline-flex items-center gap-1 text-xs font-medium",
                up && "text-success",
                down && "text-destructive",
                flat && "text-muted-foreground"
              )}
            >
              {up ? <ArrowUpRight size={14} strokeWidth={2} aria-hidden /> : null}
              {down ? (
                <ArrowDownRight size={14} strokeWidth={2} aria-hidden />
              ) : null}
              {flat ? <Minus size={14} strokeWidth={2} aria-hidden /> : null}
              <span>
                {trend} {compareLabel}
              </span>
            </p>
          ) : (
            <span className="font-primary text-xs text-muted-foreground">
              {unavailable ? "No backend signal" : "—"}
            </span>
          )}
          {sparkline && sparkline.length > 1 && !unavailable ? (
            <Sparkline values={sparkline} positive={up || (!down && !flat)} />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const Sparkline: FC<{ values: number[]; positive?: boolean }> = ({
  values,
  positive,
}) => {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const w = 56;
  const h = 18;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 opacity-80"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={positive ? "var(--chart-4)" : "var(--chart-2)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
};
