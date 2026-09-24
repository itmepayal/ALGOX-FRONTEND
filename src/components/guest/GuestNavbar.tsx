import { useEffect, useState, type FC } from "react";
import { BrandMark } from "../BrandLogo";
import { usePlatformSettings } from "../../context/PlatformSettingsContext";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/button";

interface GuestNavbarProps {
  onGoHome: () => void;
}

const NAV = [
  { label: "Problems", message: "Sign in to explore problems." },
  { label: "Sheets", message: "Sign in to open structured DSA sheets." },
  { label: "Learn", message: "Sign in to open the learning library." },
  { label: "Contests", message: "Sign in to browse contests." },
  { label: "Discuss", message: "Sign in to read and join discussions." },
] as const;

/** Landing navbar — brand, product links, Sign In / Get Started. */
export const GuestNavbar: FC<GuestNavbarProps> = ({ onGoHome }) => {
  const { settings } = usePlatformSettings();
  const { openAuth } = useAuthPrompt();
  const [mobileOpen, setMobileOpen] = useState(false);
  const platformName = settings?.platformName || "AlgoPath";

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const openProduct = (message: string) => {
    setMobileOpen(false);
    openAuth({
      tab: "signup",
      title: "Create your AlgoPath account",
      message,
    });
  };

  return (
    <header className="guest-navbar">
      <div className="guest-container guest-navbar-bar">
      <button
        type="button"
        className="guest-navbar-brand"
        onClick={() => {
          onGoHome();
          setMobileOpen(false);
        }}
        aria-label={`${platformName} home`}
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

      <nav className="guest-navbar-nav" aria-label="Product">
        {NAV.map((item) => (
          <button
            key={item.label}
            type="button"
            className="guest-navbar-link"
            onClick={() => openProduct(item.message)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="guest-navbar-actions">
        <Button
          variant="ghost"
          size="sm"
          className="guest-nav-login"
          onClick={() => openAuth({ tab: "login", title: "Welcome back" })}
        >
          Sign In
        </Button>
        <Button
          size="sm"
          className="guest-nav-cta"
          onClick={() =>
            openAuth({
              tab: "signup",
              title: "Create your AlgoPath account",
              message: "Start building stronger problem-solving skills.",
            })
          }
        >
          Get Started
        </Button>
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
      </div>

      {mobileOpen ? (
        <div
          className="guest-navbar-drawer guest-container"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          {NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              className="guest-drawer-link"
              onClick={() => openProduct(item.message)}
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
            Sign In
          </button>
          <button
            type="button"
            className="guest-drawer-link accent"
            onClick={() => {
              setMobileOpen(false);
              openAuth({ tab: "signup" });
            }}
          >
            Get Started
          </button>
        </div>
      ) : null}
    </header>
  );
};
