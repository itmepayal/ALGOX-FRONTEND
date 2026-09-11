import type { FC } from "react";

/** Local YouTube badge — lucide-react@1.43 does not export `Youtube`. */
export const YouTubeResourceIcon: FC<{ size?: number; className?: string }> = ({
  size = 15,
  className = "",
}) => (
  <span
    className={`yt-resource-icon ${className}`.trim()}
    style={{ width: size, height: size }}
    aria-label="YouTube"
    title="YouTube"
    role="img"
  >
    <span className="yt-resource-icon-play" aria-hidden>
      ▶
    </span>
  </span>
);
