import type { FC } from "react";
import { ArrowRight, BookOpen, Code2, Trophy, Sparkles } from "lucide-react";
import { BrandMark } from "../BrandLogo";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import type { GuestTab } from "./GuestNavbar";

interface GuestHomeProps {
  onNavigate: (tab: GuestTab) => void;
}

export const GuestHome: FC<GuestHomeProps> = ({ onNavigate }) => {
  const { openAuth } = useAuthPrompt();

  return (
    <div className="guest-home">
      <section className="guest-hero">
        <div className="guest-hero-copy">
          <p className="guest-hero-kicker">
            <BrandMark size={18} />
            AlgoPath
          </p>
          <h1 className="guest-hero-title">
            Practice algorithms.
            <span className="guest-hero-title-accent"> Ship confidence.</span>
          </h1>
          <p className="guest-hero-lede">
            Browse the problem catalog, read public study content, and explore
            contests before you create an account. Sign up when you are ready to
            submit, track progress, and unlock Premium editorials.
          </p>
          <div className="guest-hero-ctas">
            <button
              type="button"
              className="guest-btn primary lg"
              onClick={() => onNavigate("problems")}
            >
              Browse problems
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              className="guest-btn ghost lg"
              onClick={() =>
                openAuth({
                  tab: "signup",
                  title: "Create your account",
                  message: "Create an account to track your progress.",
                })
              }
            >
              Sign up free
            </button>
          </div>
        </div>
        <div className="guest-hero-panel" aria-hidden>
          <div className="guest-hero-panel-grid">
            <div className="guest-hero-stat">
              <Code2 size={18} />
              <span>Curated DSA sheets</span>
            </div>
            <div className="guest-hero-stat">
              <BookOpen size={18} />
              <span>Public learning library</span>
            </div>
            <div className="guest-hero-stat">
              <Trophy size={18} />
              <span>Live contest previews</span>
            </div>
            <div className="guest-hero-stat">
              <Sparkles size={18} />
              <span>Premium editorials</span>
            </div>
          </div>
        </div>
      </section>

      <section className="guest-section">
        <h2 className="guest-section-title">Explore without an account</h2>
        <p className="guest-section-lede">
          Guests can browse freely. Actions that need identity ask you to sign
          in — we never invent progress or leaderboard numbers for logged-out
          users.
        </p>
        <div className="guest-feature-row">
          <button
            type="button"
            className="guest-feature-card"
            onClick={() => onNavigate("problems")}
          >
            <h3>Problems</h3>
            <p>Difficulty, topics, and full problem statements.</p>
          </button>
          <button
            type="button"
            className="guest-feature-card"
            onClick={() => onNavigate("learn")}
          >
            <h3>Study content</h3>
            <p>Public articles and plans from the learning library.</p>
          </button>
          <button
            type="button"
            className="guest-feature-card"
            onClick={() => onNavigate("pricing")}
          >
            <h3>Premium</h3>
            <p>See what editorials, hints, and AI tools unlock.</p>
          </button>
        </div>
      </section>

      <section className="guest-section guest-section-cta">
        <h2 className="guest-section-title">Why register?</h2>
        <ul className="guest-why-list">
          <li>Submit solutions and keep an acceptance history</li>
          <li>Save favourites and continue sheets across devices</li>
          <li>Join contests and post in discussions</li>
          <li>Unlock Premium editorials when you upgrade</li>
        </ul>
        <div className="guest-hero-ctas">
          <button
            type="button"
            className="guest-btn primary"
            onClick={() =>
              openAuth({
                tab: "signup",
                message: "Create an account to track your progress.",
              })
            }
          >
            Create account
          </button>
          <button
            type="button"
            className="guest-btn ghost"
            onClick={() => openAuth({ tab: "login" })}
          >
            Log in
          </button>
        </div>
      </section>
    </div>
  );
};
