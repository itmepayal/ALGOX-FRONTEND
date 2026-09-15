import type { FC, ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card, CardContent } from "./card";

export const MetricCard: FC<{
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  className?: string;
}> = ({ label, value, hint, icon, className }) => (
  <Card className={cn("overflow-hidden", className)}>
    <CardContent className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-primary text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon ? (
          <span className="text-primary-bright" aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="font-technical text-2xl font-semibold leading-tight text-foreground">
        {value}
      </div>
      {hint ? (
        <p className="font-primary text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </CardContent>
  </Card>
);
