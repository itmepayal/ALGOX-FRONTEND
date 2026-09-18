import { useEffect, type FC } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { AuthModal } from "../AuthModal";

/** Overlay auth experience for contextual “Sign in to …” prompts. */
export const AuthPromptOverlay: FC = () => {
  const { user } = useAuth();
  const { open, options, closeAuth } = useAuthPrompt();

  useEffect(() => {
    if (user && open) closeAuth();
  }, [user, open, closeAuth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuth();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeAuth]);

  if (!open || user) return null;

  return (
    <div
      className="guest-auth-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-auth-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuth();
      }}
    >
      <div className="guest-auth-dialog">
        <button
          type="button"
          className="guest-auth-close"
          aria-label="Close"
          onClick={closeAuth}
        >
          <X size={18} />
        </button>
        {(options.title || options.message) &&
        options.title !== "Welcome back" &&
        options.title !== "Create your AlgoPath account" ? (
          <div className="guest-auth-banner">
            {options.title ? (
              <h2 className="guest-auth-banner-title">{options.title}</h2>
            ) : null}
            {options.message ? (
              <p className="guest-auth-banner-msg">{options.message}</p>
            ) : null}
          </div>
        ) : null}
        <AuthModal
          initialTab={options.tab || "login"}
          embed
          onSuccess={closeAuth}
        />
      </div>
    </div>
  );
};
