import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FC,
  type MouseEvent,
} from "react";
import { Check, Link2, Share2 } from "lucide-react";
import type { Problem } from "../api/problemApi";
import {
  canUseNativeShare,
  copyTextToClipboard,
  getProblemShareText,
  getProblemShareTitle,
  getProblemShareUrl,
  linkedInShareHref,
  whatsappShareHref,
  xShareHref,
} from "../utils/problemShare";

export interface ProblemShareProps {
  problem: Pick<Problem, "title" | "slug" | "id" | "_id">;
  /** Visual variant for sheet row vs workspace header */
  variant?: "icon" | "button";
  className?: string;
  /** Called after a successful share action (never blocks sharing) */
  onShared?: (method: "copy" | "native" | "whatsapp" | "linkedin" | "x") => void;
}

const BrandChip: FC<{
  label: string;
  bg: string;
  children: string;
}> = ({ label, bg, children }) => (
  <span
    className="ps-brand-chip"
    style={{ background: bg }}
    aria-hidden
    title={label}
  >
    {children}
  </span>
);

export const ProblemShare: FC<ProblemShareProps> = ({
  problem,
  variant = "icon",
  className = "",
  onShared,
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const showNative = canUseNativeShare();

  const shareUrl = getProblemShareUrl(problem);
  const shareText = getProblemShareText(problem, shareUrl);
  const shareTitle = getProblemShareTitle(problem);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleCopy = useCallback(
    async (e: MouseEvent) => {
      stop(e);
      setError("");
      const ok = await copyTextToClipboard(shareUrl);
      if (ok) {
        setCopied(true);
        onShared?.("copy");
      } else {
        setError("Unable to copy link. Please copy it manually.");
      }
    },
    [shareUrl, onShared]
  );

  const handleNative = useCallback(
    async (e: MouseEvent) => {
      stop(e);
      setError("");
      try {
        await navigator.share({
          title: shareTitle,
          text: `Solve ${shareTitle} on algoX`,
          url: shareUrl,
        });
        onShared?.("native");
        setOpen(false);
      } catch (err: any) {
        // User cancel — silent
        if (err?.name === "AbortError") return;
        setError(err?.message || "Unable to open share dialog.");
      }
    },
    [shareTitle, shareUrl, onShared]
  );

  const openExternal = (e: MouseEvent, href: string, method: "whatsapp" | "linkedin" | "x") => {
    stop(e);
    setError("");
    try {
      window.open(href, "_blank", "noopener,noreferrer");
      onShared?.(method);
    } catch {
      setError("Unable to open share window.");
    }
  };

  return (
    <div className={`ps-share ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className={
          variant === "button"
            ? "ps-share-trigger-btn"
            : "ps-share-trigger-icon"
        }
        aria-label="Share problem"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        title="Share"
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
          setError("");
        }}
      >
        <Share2 size={variant === "button" ? 14 : 13} />
        {variant === "button" && <span>Share</span>}
      </button>

      {open && (
        <div
          id={panelId}
          className="ps-share-popover"
          role="dialog"
          aria-label="Share problem"
          onClick={stop}
        >
          <div className="ps-share-heading">Share Problem</div>
          <p className="ps-share-sub">{shareTitle}</p>

          <button
            type="button"
            className="ps-share-item"
            aria-label="Copy problem link"
            onClick={(e) => void handleCopy(e)}
          >
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            <span>{copied ? "Link copied" : "Copy Link"}</span>
          </button>

          <button
            type="button"
            className="ps-share-item"
            aria-label="Share on WhatsApp"
            onClick={(e) => openExternal(e, whatsappShareHref(shareText), "whatsapp")}
          >
            <BrandChip label="WhatsApp" bg="#25D366">
              WA
            </BrandChip>
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            className="ps-share-item"
            aria-label="Share on LinkedIn"
            onClick={(e) =>
              openExternal(e, linkedInShareHref(shareUrl), "linkedin")
            }
          >
            <BrandChip label="LinkedIn" bg="#0A66C2">
              in
            </BrandChip>
            <span>LinkedIn</span>
          </button>

          <button
            type="button"
            className="ps-share-item"
            aria-label="Share on X"
            onClick={(e) =>
              openExternal(e, xShareHref(`Try this DSA problem: ${shareTitle}`, shareUrl), "x")
            }
          >
            <BrandChip label="X" bg="#111827">
              𝕏
            </BrandChip>
            <span>X</span>
          </button>

          {showNative && (
            <button
              type="button"
              className="ps-share-item ps-share-native"
              aria-label="Share via device"
              onClick={(e) => void handleNative(e)}
            >
              <Share2 size={15} />
              <span>Native Share</span>
            </button>
          )}

          {error && (
            <p className="ps-share-error" role="alert">
              {error}
            </p>
          )}

          <div className="ps-share-url" title={shareUrl}>
            {shareUrl}
          </div>
        </div>
      )}
    </div>
  );
};
