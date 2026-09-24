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
      <div className="guest-footer-inner guest-container">
        <button type="button" className="guest-footer-brand" onClick={onGoHome}>
          <BrandMark size={28} />
          <div>
            <strong>{platformName}</strong>
            <p>Structured DSA practice for technical interviews.</p>
          </div>
        </button>

        <div className="guest-footer-cols">
          <div>
            <h3>Product</h3>
            <ul>
              {(
                [
                  ["Problems", "Sign in to explore problems."],
                  ["Sheets", "Sign in to open structured DSA sheets."],
                  ["Learn", "Sign in to open the learning library."],
                  ["Contests", "Sign in to browse contests."],
                ] as const
              ).map(([label, message]) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() =>
                      openAuth({
                        tab: "signup",
                        title: "Create your AlgoPath account",
                        message,
                      })
                    }
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Platform</h3>
            <ul>
              {(
                [
                  ["Discuss", "Sign in to read and join discussions."],
                  ["Roadmaps", "Sign in to open roadmaps."],
                  [
                    "AI Assist",
                    "AlgoPath AI offers daily Free credits. Premium raises the allowance.",
                  ],
                  ["Analytics", "Sign in to view analytics. Deeper insights are Premium."],
                ] as const
              ).map(([label, message]) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() =>
                      openAuth({
                        tab: "signup",
                        title: "Create your AlgoPath account",
                        message,
                      })
                    }
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Account</h3>
            <ul>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    openAuth({ tab: "login", title: "Welcome back" })
                  }
                >
                  Sign In
                </button>
              </li>
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
            </ul>
          </div>
        </div>
      </div>
      <div className="guest-footer-bottom guest-container">
        <span>
          © {new Date().getFullYear()} {platformName}
        </span>
        <span>Designed &amp; Developed by Payal Yadav</span>
      </div>
    </footer>
  );
};
