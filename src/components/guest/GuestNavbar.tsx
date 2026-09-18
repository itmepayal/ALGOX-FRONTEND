import { useState, type FC } from "react";
import { BrandMark } from "../BrandLogo";
import { usePlatformSettings } from "../../context/PlatformSettingsContext";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { Menu, X } from "lucide-react";
import { Button } from "../ui/button";

interface GuestNavbarProps {
  onGoHome: () => void;
  onGoPricing: () => void;
}

/** Landing navbar — brand, Pricing (in-page), Login / Get Started. No feature tabs. */
export const GuestNavbar: FC<GuestNavbarProps> = ({
  onGoHome,
  onGoPricing,
}) => {
  const { settings } = usePlatformSettings();
  const { openAuth } = useAuthPrompt();
  const [mobileOpen, setMobileOpen] = useState(false);
  const platformName = settings?.platformName || "AlgoPath";

  return (
    <header className="guest-navbar">
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

      <nav className="guest-navbar-nav" aria-label="Primary">
        <button
          type="button"
          className="guest-navbar-link"
          onClick={onGoPricing}
        >
          Pricing
        </button>
      </nav>

      <div className="guest-navbar-actions">
        <Button
          variant="ghost"
          size="sm"
          className="guest-nav-login"
          onClick={() => openAuth({ tab: "login", title: "Welcome back" })}
        >
          Login
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

      {mobileOpen ? (
        <div className="guest-navbar-drawer" role="navigation">
          <button
            type="button"
            className="guest-drawer-link"
            onClick={() => {
              onGoPricing();
              setMobileOpen(false);
            }}
          >
            Pricing
          </button>
          <button
            type="button"
            className="guest-drawer-link"
            onClick={() => {
              setMobileOpen(false);
              openAuth({ tab: "login" });
            }}
          >
            Login
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
