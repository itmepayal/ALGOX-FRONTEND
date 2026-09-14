import type { FC, ImgHTMLAttributes } from "react";

/** Public brand assets under /public/brand */
export const ALGOPATH_ICON_SRC = "/brand/algopath-icon-only.png";
export const ALGOPATH_LOGO_LIGHT_SRC = "/brand/algopath-logo-light.png";
export const ALGOPATH_LOGO_DARK_SRC = "/brand/algopath-logo-system-dark.png";

type BrandMarkProps = {
  size?: number;
  className?: string;
  alt?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "width" | "height">;

/** Icon-only AlgoPath mark (navbar, favicon-style chips). */
export const BrandMark: FC<BrandMarkProps> = ({
  size = 30,
  className = "",
  alt = "AlgoPath",
  ...rest
}) => (
  <img
    src={ALGOPATH_ICON_SRC}
    alt={alt}
    width={size}
    height={size}
    className={`algopath-brand-mark ${className}`.trim()}
    draggable={false}
    {...rest}
  />
);

type BrandLockupProps = {
  /** Show wordmark text next to the icon (default true). */
  showName?: boolean;
  /** Compact icon size for dense chrome. */
  size?: number;
  className?: string;
  nameClassName?: string;
};

/** Icon + AlgoPath wordmark for headers. */
export const BrandLockup: FC<BrandLockupProps> = ({
  showName = true,
  size = 30,
  className = "",
  nameClassName = "",
}) => (
  <span className={`algopath-brand-lockup ${className}`.trim()}>
    <BrandMark size={size} />
    {showName ? (
      <span className={`algopath-brand-name ${nameClassName}`.trim()}>AlgoPath</span>
    ) : null}
  </span>
);
