import type { FC, ReactNode } from "react";

interface ModuleGateProps {
  title: string;
  description: string;
  status?: "live" | "infra" | "backend";
  children?: ReactNode;
  action?: ReactNode;
}

/** Honest status for modules that need infra/backend not yet in the monorepo. */
export const ModuleGate: FC<ModuleGateProps> = ({
  title,
  description,
  status = "backend",
  children,
  action,
}) => {
  const badge =
    status === "live"
      ? "Live data"
      : status === "infra"
        ? "Requires realtime gateway"
        : "Backend scaffolding next";

  return (
    <div className="admin-module-gate">
      <div className="admin-module-gate-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={`admin-badge ${status === "live" ? "published" : "draft"}`}>
          {badge}
        </span>
      </div>
      {action}
      {children}
    </div>
  );
};
