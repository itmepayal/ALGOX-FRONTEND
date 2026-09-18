import type { FC } from "react";
import { Check, Crown } from "lucide-react";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { Button } from "../ui/button";

const FREE = [
  "Learning Sheet problems (configured FREE sheets)",
  "Account & progress tracking",
  "Public discussions",
  "View contest listings & leaderboard previews",
  "Submit solutions on FREE Sheet problems after signup",
];

const PREMIUM = [
  "Everything in Free",
  "All problems outside Learning Sheets",
  "Premium editorials & guided solutions",
  "Extra hints and solution walkthroughs",
  "AI Assist, analytics & mock interviews",
  "Company interview sets & study plans",
];

/** Marketing pricing — no fake subscriber counts. */
export const GuestPricing: FC = () => {
  const { openAuth } = useAuthPrompt();

  return (
    <div className="guest-pricing">
      <header className="guest-pricing-header">
        <p className="guest-hero-kicker">
          <Crown size={14} aria-hidden /> Pricing
        </p>
        <h1 className="guest-section-title">Choose how you practice</h1>
        <p className="guest-section-lede">
          Free users practice official Learning Sheet problems. Everything else
          requires AlgoPath Premium. Billing activates only after a verified
          payment — never from a client-side toggle.
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
                <Check size={14} aria-hidden /> {item}
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() =>
              openAuth({
                tab: "signup",
                title: "Start free",
                message: "Create an account to track your progress.",
              })
            }
          >
            Create free account
          </Button>
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
                <Check size={14} aria-hidden /> {item}
              </li>
            ))}
          </ul>
          <Button
            className="w-full"
            onClick={() =>
              openAuth({
                tab: "signup",
                title: "Upgrade to Premium",
                message:
                  "Upgrade to Premium to unlock the full problem catalog. Create an account first, then checkout from your profile.",
              })
            }
          >
            Sign up to upgrade
          </Button>
        </article>
      </div>
    </div>
  );
};
