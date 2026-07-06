import Hero3D from "./Hero3D";
import "./landing.css";

/**
 * LandingPage
 * -----------
 * Marketing/landing page for BIG BULL AI. The hero uses the animated 3D
 * candlestick scene as a background layer; everything else (features,
 * CTA) is flat, fast, and readable — no 3D once you're past the hero.
 *
 * Render this at your site's root route, and route "Get started" /
 * "Open dashboard" to <TaxDashboard /> (see TaxDashboard.jsx).
 */
export default function LandingPage({ onGetStarted }) {
  return (
    <div className="landing">
      <section className="landing__hero">
        <Hero3D />
        <div className="landing__hero-content">
          <span className="landing__eyebrow">BIG BULL AI</span>
          <h1 className="landing__headline">
            See your portfolio the moment it moves.
          </h1>
          <p className="landing__subhead">
            Import trades, calculate tax instantly, and let AI flag what
            actually needs your attention — all in one place.
          </p>
          <div className="landing__cta-row">
            <button className="landing__cta landing__cta--primary" onClick={onGetStarted}>
              Get started
            </button>
            <a className="landing__cta landing__cta--ghost" href="#features">
              See how it works
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="landing__features">
        <div className="landing__feature-card">
          <span className="landing__feature-label">01</span>
          <h3>Import in seconds</h3>
          <p>
            Drop in a CSV of your trades and see every transaction laid out
            immediately — no templates to fight with.
          </p>
        </div>
        <div className="landing__feature-card">
          <span className="landing__feature-label">02</span>
          <h3>Know your tax bill</h3>
          <p>
            FIFO cost-basis matching calculates profit, loss, and an
            estimated tax owed on every sale, automatically.
          </p>
        </div>
        <div className="landing__feature-card">
          <span className="landing__feature-label">03</span>
          <h3>AI keeps watch</h3>
          <p>
            Coming next: automatic flagging of mismatched transfers and
            unusual activity before it becomes a tax-season surprise.
          </p>
          <span className="landing__badge">Coming soon</span>
        </div>
      </section>
    </div>
  );
}
