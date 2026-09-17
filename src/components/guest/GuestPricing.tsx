import type { FC } from "react";
import { Check, Crown } from "lucide-react";
import { useAuthPrompt } from "../../context/AuthPromptContext";

const FREE = [
  "Browse all public problems",
  "Read public study content",
  "View contest listings & leaderboard previews",
  "Submit solutions after signup",
  "Save favourites & track progress after signup",
];

const PREMIUM = [
  "Everything in Free",
  "Premium editorials & guided solutions",
  "Extra hints and solution walkthroughs",
  "AI-assisted practice tools (when enabled)",
  "Priority learning surfaces",
];

/** Marketing pricing — no fake subscriber counts. */
export const GuestPricing: FC = () => {
  const { openAuth } = useAuthPrompt();

  return (
    <div className="guest-pricing">
      <header className="guest-pricing-header">
        <p className="guest-hero-kicker">
          <Crown size={14} />
          Pricing
        </p>
        <h1 className="guest-section-title">Choose how you practice</h1>
        <p className="guest-section-lede">
          Start free. Upgrade when you want Premium editorials and advanced
          practice tools. Billing activates only after a verified payment —
          never from a client-side toggle.
        </p>
      </header>

      <div className="guest-pricing-grid">
        <article className="guest-price-card">
          <h2>Free</h2>
          <p className="guest-price-amount">
            $0<span>/forever</span>
          </p>
          <ul>
            {FREE.map((item) => (
              <li key={item}>
                <Check size={14} /> {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="guest-btn ghost"
            onClick={() =>
              openAuth({
                tab: "signup",
                title: "Start free",
                message: "Create an account to track your progress.",
              })
            }
          >
            Create free account
          </button>
        </article>

        <article className="guest-price-card featured">
          <span className="guest-price-badge">Premium</span>
          <h2>Premium</h2>
          <p className="guest-price-amount">
            Recurring<span> · billed securely</span>
          </p>
          <ul>
            {PREMIUM.map((item) => (
              <li key={item}>
                <Check size={14} /> {item}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="guest-btn primary"
            onClick={() =>
              openAuth({
                tab: "signup",
                title: "Upgrade to Premium",
                message:
                  "Upgrade to Premium to access this editorial. Create an account first, then checkout from your profile.",
              })
            }
          >
            Sign up to upgrade
          </button>
        </article>
      </div>
    </div>
  );
};
