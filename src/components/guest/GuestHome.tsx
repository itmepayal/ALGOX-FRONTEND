import type { FC } from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  ChartNoAxesCombined,
  CheckCircle2,
  Code2,
  GraduationCap,
  MessagesSquare,
  Route,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAuthPrompt } from "../../context/AuthPromptContext";
import { GuestPricing } from "./GuestPricing";

interface GuestHomeProps {
  onGoPricing: () => void;
}

const VALUE = [
  {
    icon: BookOpen,
    title: "Structured DSA Sheets",
    body: "Practice by topic and difficulty with curated learning sheets.",
  },
  {
    icon: Code2,
    title: "Interview preparation",
    body: "Focus on problem sets that mirror technical interview practice.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Progress tracking",
    body: "See what you have solved, attempted, and still need to revise.",
  },
  {
    icon: MessagesSquare,
    title: "Community",
    body: "Discuss approaches and learn alongside other developers.",
  },
] as const;

const TOPICS = [
  "Arrays",
  "Strings",
  "Linked Lists",
  "Trees",
  "Graphs",
  "Dynamic Programming",
] as const;

const STEPS = [
  {
    n: "01",
    title: "Choose a structured sheet",
    body: "Pick a learning path that matches your goals and difficulty.",
  },
  {
    n: "02",
    title: "Solve and practice",
    body: "Write code in the editor, run tests, and submit when ready.",
  },
  {
    n: "03",
    title: "Track your progress",
    body: "Review history, favourites, and revision so improvement sticks.",
  },
] as const;

const FEATURES: Array<{
  icon: typeof BookOpen;
  title: string;
  body: string;
  premium?: boolean;
}> = [
  {
    icon: BookOpen,
    title: "DSA Sheets",
    body: "Topic-based practice with free learning-sheet access after signup.",
  },
  {
    icon: Code2,
    title: "Problem solving",
    body: "Full statements, sample cases, and an in-browser coding workspace.",
  },
  {
    icon: GraduationCap,
    title: "Learn",
    body: "Public study content and plans from the learning library.",
  },
  {
    icon: Trophy,
    title: "Contests",
    body: "Browse contest listings and leaderboard previews after you sign in.",
  },
  {
    icon: MessagesSquare,
    title: "Discuss",
    body: "Read and join discussions once you have an account.",
  },
  {
    icon: Route,
    title: "Roadmaps",
    body: "Plan practice with calendar and roadmap tools after sign-in.",
  },
  {
    icon: Sparkles,
    title: "AI Assist",
    body: "Guided help with daily Free credits; higher Premium allowance.",
    premium: true,
  },
  {
    icon: Brain,
    title: "Analytics",
    body: "Deeper personal performance insights for Premium members.",
    premium: true,
  },
];

export const GuestHome: FC<GuestHomeProps> = ({ onGoPricing }) => {
  const { openAuth } = useAuthPrompt();

  const startLearning = () =>
    openAuth({
      tab: "signup",
      title: "Create your AlgoPath account",
      message: "Start building stronger problem-solving skills.",
    });

  return (
    <div className="guest-home">
      <section className="guest-hero">
        <div className="guest-hero-copy">
          <p className="guest-hero-kicker">Developer practice platform</p>
          <h1 className="guest-hero-title">
            Master DSA.
            <span className="guest-hero-title-accent">
              {" "}
              Build better problem-solving skills.
            </span>
          </h1>
          <p className="guest-hero-lede">
            Practice structured DSA sheets, track your progress, and prepare for
            technical interviews with AlgoPath — a serious coding platform built
            for focused learning.
          </p>
          <div className="guest-hero-ctas">
            <Button size="lg" onClick={startLearning}>
              Start Learning
              <ArrowRight size={16} aria-hidden />
            </Button>
            <Button size="lg" variant="secondary" onClick={onGoPricing}>
              View Pricing
            </Button>
          </div>
        </div>

        <div className="guest-hero-visual" aria-hidden>
          <div className="guest-hero-code">
            <div className="guest-hero-code-bar">
              <span />
              <span />
              <span />
              <em>two_sum.py</em>
            </div>
            <pre className="guest-hero-code-body">
              <code>{`def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []`}</code>
            </pre>
            <div className="guest-hero-code-footer">
              <span className="guest-hero-pill ok">Accepted</span>
              <span className="guest-hero-pill">Runtime · sample</span>
            </div>
          </div>
        </div>
      </section>

      <section className="guest-value" aria-label="Product value">
        {VALUE.map(({ icon: Icon, title, body }) => (
          <article key={title} className="guest-value-card">
            <span className="guest-value-icon" aria-hidden>
              <Icon size={18} strokeWidth={1.75} />
            </span>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="guest-section">
        <div className="guest-section-head">
          <h2 className="guest-section-title">
            Master Data Structures &amp; Algorithms
          </h2>
          <p className="guest-section-lede">
            Work through structured topics that map to common interview and
            contest patterns.
          </p>
        </div>
        <div className="guest-topic-row">
          {TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              className="guest-topic-chip"
              onClick={startLearning}
            >
              {topic}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          className="guest-section-cta-btn"
          onClick={startLearning}
        >
          Start Learning
          <ArrowRight size={16} aria-hidden />
        </Button>
      </section>

      <section className="guest-section">
        <div className="guest-section-head">
          <h2 className="guest-section-title">How AlgoPath works</h2>
          <p className="guest-section-lede">
            A simple loop from structured practice to measurable progress.
          </p>
        </div>
        <div className="guest-steps">
          {STEPS.map((step) => (
            <article key={step.n} className="guest-step">
              <span className="guest-step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-head">
          <h2 className="guest-section-title">Built for serious practice</h2>
          <p className="guest-section-lede">
            Capabilities that exist in the product today — Free where noted,
            Premium where required.
          </p>
        </div>
        <div className="guest-feature-grid">
          {FEATURES.map(({ icon: Icon, title, body, premium }) => (
            <button
              key={title}
              type="button"
              className="guest-feature-card"
              onClick={() => {
                if (premium) onGoPricing();
                else startLearning();
              }}
            >
              <span className="guest-feature-card-top">
                <span className="guest-value-icon" aria-hidden>
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                {premium ? (
                  <Badge variant="warning" className="normal-case">
                    Premium
                  </Badge>
                ) : null}
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="guest-section guest-premium-band">
        <div>
          <h2 className="guest-section-title">
            Go further with AlgoPath Premium
          </h2>
          <p className="guest-section-lede">
            Unlock the full problem catalog, editorials, advanced analytics, AI
            Assist allowance, and interview tools after a verified checkout.
          </p>
        </div>
        <Button size="lg" onClick={onGoPricing}>
          Explore Premium
          <ArrowRight size={16} aria-hidden />
        </Button>
      </section>

      <section id="pricing" className="guest-section" aria-label="Pricing">
        <GuestPricing />
      </section>

      <section className="guest-section guest-final-cta">
        <CheckCircle2 size={28} className="guest-final-icon" aria-hidden />
        <h2 className="guest-section-title">
          Your next interview starts with better problem solving.
        </h2>
        <p className="guest-section-lede">
          Create an account to submit solutions, save favourites, and continue
          sheets across devices.
        </p>
        <div className="guest-hero-ctas">
          <Button size="lg" onClick={startLearning}>
            Start Learning
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => openAuth({ tab: "login", title: "Welcome back" })}
          >
            Sign In
          </Button>
        </div>
      </section>
    </div>
  );
};
