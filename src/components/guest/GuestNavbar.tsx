import type { FC } from "react";
import { BrandMark } from "../BrandLogo";
import { usePlatformSettings } from "../../context/PlatformSettingsContext";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export type GuestTab =
  | "home"
  | "problems"
  | "companies"
  | "contests"
  | "discuss"
  | "learn"
  | "ranks"
  | "pricing";

const NAV: { id: GuestTab; label: string; flag?: string }[] = [
  { id: "home", label: "Home" },
  { id: "problems", label: "Problems" },
  { id: "companies", label: "Companies" },
  { id: "contests", label: "Contests", flag: "contests" },
  { id: "discuss", label: "Discuss", flag: "discussions" },
  { id: "learn", label: "Learn" },
  { id: "ranks", label: "Ranks" },
  { id: "pricing", label: "Pricing" },
];

interface GuestNavbarProps {
  active: GuestTab;
  onNavigate: (tab: GuestTab) => void;
}

export const GuestNavbar: FC<GuestNavbarProps> = ({ active, onNavigate }) => {
  const { settings, isEnabled } = usePlatformSettings();
  const { openAuth } = useAuthPrompt();
  const [mobileOpen, setMobileOpen] = useState(false);
  const platformName = settings?.platformName || "AlgoPath";

  const items = NAV.filter((item) => {
    if (!item.flag) return true;
    return isEnabled(item.flag as "contests" | "discussions" | "submissions");
  });

  return (
    <header className="guest-navbar">
      <button
        type="button"
        className="guest-navbar-brand"
        onClick={() => {
          onNavigate("home");
          setMobileOpen(false);
        }}
      >
        <BrandMark size={28} />
        <span className="guest-navbar-name">
          {platformName.includes("Algo") ? (
            <>
              Algo<span className="guest-navbar-accent">Path</span>
            </>
          ) : (
            platformName
          )}
        </span>
      </button>

      <nav className="guest-navbar-nav" aria-label="Guest primary">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`guest-navbar-link ${active === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="guest-navbar-actions">
        <button
          type="button"
          className="guest-btn ghost"
          onClick={() => openAuth({ tab: "login", title: "Welcome back" })}
        >
          Log in
        </button>
        <button
          type="button"
          className="guest-btn primary"
          onClick={() =>
            openAuth({
              tab: "signup",
              title: "Create your account",
              message: "Track progress, save problems, and join contests.",
            })
          }
        >
          Sign up
        </button>
        <button
          type="button"
          className="guest-navbar-menu"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="guest-navbar-drawer" role="navigation">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`guest-drawer-link ${active === item.id ? "active" : ""}`}
              onClick={() => {
                onNavigate(item.id);
                setMobileOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            className="guest-drawer-link"
            onClick={() => {
              setMobileOpen(false);
              openAuth({ tab: "login" });
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className="guest-drawer-link accent"
            onClick={() => {
              setMobileOpen(false);
              openAuth({ tab: "signup" });
            }}
          >
            Sign up
          </button>
        </div>
      )}
    </header>
  );
};
