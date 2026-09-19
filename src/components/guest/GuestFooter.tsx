import type { FC } from "react";
import { BrandMark } from "../BrandLogo";
import { usePlatformSettings } from "../../context/PlatformSettingsContext";
import { useAuthPrompt } from "../../context/AuthPromptContext";

interface GuestFooterProps {
  onGoHome: () => void;
}

export const GuestFooter: FC<GuestFooterProps> = ({ onGoHome }) => {
  const { settings } = usePlatformSettings();
  const { openAuth } = useAuthPrompt();
  const platformName = settings?.platformName || "AlgoPath";

  return (
    <footer className="guest-footer">
      <div className="guest-footer-inner">
        <div className="guest-footer-brand">
          <BrandMark size={28} />
          <div>
            <strong>{platformName}</strong>
            <p>Structured DSA practice for technical interviews.</p>
          </div>
        </div>

        <div className="guest-footer-cols">
          <div>
            <h3>Product</h3>
            <ul>
              <li>
                <button type="button" onClick={onGoHome}>
                  Home
                </button>
              </li>
            </ul>
          </div>
          <div>
            <h3>Account</h3>
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    openAuth({
                      tab: "signup",
                      title: "Create your AlgoPath account",
                    })
                  }
                >
                  Get Started
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    openAuth({ tab: "login", title: "Welcome back" })
                  }
                >
                  Login
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="guest-footer-bottom">
        <span>
          © {new Date().getFullYear()} {platformName}
        </span>
      </div>
    </footer>
  );
};
