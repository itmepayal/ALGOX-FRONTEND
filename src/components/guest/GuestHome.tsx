import type { FC } from "react";
import {
  ArrowRight,
  Bug,
  GitCompare,
  Lightbulb,
  Zap,
} from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useAuthPrompt } from "../../context/AuthPromptContext";

const VALUE = [
  {
    n: "01",
    title: "Structured Practice",
    body: "Follow curated sheets organized by topic and difficulty.",
  },
  {
    n: "02",
    title: "Real Coding Workspace",
    body: "Write, run, debug, and submit solutions without leaving AlgoPath.",
  },
  {
    n: "03",
    title: "Progress That Matters",
    body: "Track solved, attempted, favourite, and revision problems.",
  },
  {
    n: "04",
    title: "Interview Preparation",
    body: "Practice patterns and problem sets designed around technical interview preparation.",
  },
] as const;

const TOPICS = [
  "Arrays",
  "Strings",
  "Linked Lists",
  "Stacks & Queues",
  "Trees",
  "Graphs",
  "Binary Search",
  "Dynamic Programming",
  "Greedy",
  "Sliding Window",
] as const;

const STEPS = [
  {
    n: "01",
    title: "Choose your path",
    body: "Start with structured sheets based on your goals.",
  },
  {
    n: "02",
    title: "Solve consistently",
    body: "Code, run, submit, and learn from every attempt.",
  },
  {
    n: "03",
    title: "Track and improve",
    body: "Review progress, revisit weak areas, and build consistency.",
  },
] as const;

const AI_CAPS = [
  {
    icon: Lightbulb,
    title: "Give Hint",
    body: "Get the next useful step without revealing the solution.",
  },
  {
    icon: Bug,
    title: "Debug",
    body: "Understand why your code is failing.",
  },
  {
    icon: Zap,
    title: "Improve",
    body: "Optimize a working approach and understand the trade-offs.",
  },
  {
    icon: GitCompare,
    title: "Compare",
    body: "Compare approaches and learn when to use each one.",
  },
] as const;

const PREMIUM = [
  "Advanced AI assistance",
  "Advanced analytics",
  "Interview tools",
  "Extended learning capabilities",
] as const;

const PREVIEW = `def two_sum(nums, target):
    seen = {}
    for i, n in enumerate(nums):
        need = target - n
        if need in seen:
            return [seen[need], i]
        seen[n] = i
    return []`;

export const GuestHome: FC = () => {
  const { openAuth } = useAuthPrompt();

  const startLearning = () =>
    openAuth({
      tab: "signup",
      title: "Create your AlgoPath account",
      message: "Start building stronger problem-solving skills.",
    });

  const signIn = () => openAuth({ tab: "login", title: "Welcome back" });

  const exploreProblems = () =>
    openAuth({
      tab: "signup",
      title: "Create your AlgoPath account",
      message: "Sign in to explore problems.",
    });

  const exploreAi = () =>
    openAuth({
      tab: "signup",
      title: "Create your AlgoPath account",
      message:
        "AlgoPath AI offers daily Free credits. Premium raises the allowance.",
    });

  const explorePremium = () =>
    openAuth({
      tab: "signup",
      title: "Create your AlgoPath account",
      message: "Create an account to explore AlgoPath Premium.",
    });

  return (
    <div className="guest-home">
      <section className="guest-hero">
        <div className="guest-hero-copy">
          <p className="guest-hero-kicker">Developer practice platform</p>
          <h1 className="guest-hero-title">
            Master DSA.
            <br />
            <span className="guest-hero-title-accent">
              Build better
              <br />
              problem-solving skills.
            </span>
          </h1>
          <p className="guest-hero-lede">
            Practice structured DSA sheets, solve problems in a real coding
            workspace, track your progress, and prepare for technical interviews
            with AlgoPath.
          </p>
          <div className="guest-hero-ctas">
            <Button size="lg" onClick={startLearning}>
              Start Learning
              <ArrowRight size={16} aria-hidden />
            </Button>
            <Button size="lg" variant="secondary" onClick={exploreProblems}>
              Explore Problems
            </Button>
          </div>
          <p className="guest-hero-trust">
            Structured practice · Real coding workspace · Progress tracking
          </p>
        </div>

        <div className="guest-hero-visual" aria-hidden>
          <div className="guest-preview">
            <div className="guest-preview-top">
              <div>
                <p className="guest-preview-kicker">Problem</p>
                <p className="guest-preview-title">Two Sum</p>
              </div>
              <span className="guest-preview-diff">Easy</span>
            </div>
            <div className="guest-preview-editor">
              <div className="guest-hero-code-bar">
                <span />
                <span />
                <span />
                <em>two_sum.py</em>
              </div>
              <pre className="guest-hero-code-body">
                <code>{PREVIEW}</code>
              </pre>
            </div>
            <div className="guest-preview-actions">
              <span className="guest-preview-btn ghost">Run</span>
              <span className="guest-preview-btn">Submit</span>
            </div>
            <div className="guest-preview-result">
              <span className="guest-hero-pill ok">Accepted</span>
              <span className="guest-hero-pill">Runtime</span>
              <span className="guest-hero-pill">Memory</span>
            </div>
          </div>
        </div>
      </section>

      <section className="guest-section" aria-label="Product value">
        <div className="guest-section-head">
          <h2 className="guest-section-title">
            Everything you need to get better at DSA
          </h2>
        </div>
        <div className="guest-value">
          {VALUE.map((item) => (
            <article key={item.n} className="guest-value-card">
              <span className="guest-step-n">{item.n}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section-head">
          <h2 className="guest-section-title">Practice the patterns that matter</h2>
          <p className="guest-section-lede">
            Build confidence across the core data structures and algorithms used
            in technical interviews.
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
      </section>

      <section className="guest-section">
        <div className="guest-section-head">
          <h2 className="guest-section-title">From practice to interview readiness</h2>
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

      <section className="guest-section guest-ai">
        <div className="guest-ai-copy">
          <div className="guest-ai-head">
            <h2 className="guest-section-title">
              Stuck? Learn from the problem — don&apos;t just copy the solution.
            </h2>
            <Badge variant="warning">Premium expands</Badge>
          </div>
          <p className="guest-section-lede">
            AlgoPath AI provides contextual help while you solve, helping you
            understand the next step without taking away the learning process.
            Free includes a daily credit allowance. Premium raises that allowance
            and adds Interview Mode.
          </p>
          <Button onClick={exploreAi}>
            Explore AlgoPath AI
            <ArrowRight size={16} aria-hidden />
          </Button>
        </div>
        <div className="guest-ai-grid">
          {AI_CAPS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="guest-ai-card">
              <span className="guest-value-icon" aria-hidden>
                <Icon size={16} strokeWidth={1.75} />
              </span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guest-section guest-premium-band">
        <div>
          <h2 className="guest-section-title">Go further with AlgoPath Premium</h2>
          <p className="guest-section-lede">
            Unlock advanced learning, AI assistance, analytics, and
            interview-focused tools after a verified checkout.
          </p>
          <ul className="guest-premium-list">
            {PREMIUM.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <Button size="lg" onClick={explorePremium}>
          Explore Premium
          <ArrowRight size={16} aria-hidden />
        </Button>
      </section>

      <section className="guest-section guest-final-cta">
        <h2 className="guest-section-title">
          Build consistency. Solve better problems.
        </h2>
        <p className="guest-section-lede">
          Start with a structured path and turn daily practice into measurable
          progress.
        </p>
        <div className="guest-hero-ctas">
          <Button size="lg" onClick={startLearning}>
            Start Learning
            <ArrowRight size={16} aria-hidden />
          </Button>
          <Button size="lg" variant="secondary" onClick={signIn}>
            Sign In
          </Button>
        </div>
      </section>
    </div>
  );
};
