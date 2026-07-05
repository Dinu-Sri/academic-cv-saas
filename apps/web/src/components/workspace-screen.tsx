import { ArrowRight, CircleDot, Sparkles } from "lucide-react";
import { screens, type ScreenKey } from "@/lib/screens";

export function WorkspaceScreen({ screen }: { screen: ScreenKey }) {
  const content = screens[screen];

  return (
    <section className="workspace-screen">
      <div className="screen-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} />
            {content.eyebrow}
          </span>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
        <div className="screen-actions" aria-label="Screen actions">
          {content.secondaryAction ? (
            <button className="secondary-action" type="button">
              {content.secondaryAction.label}
            </button>
          ) : null}
          <button className="primary-action" type="button">
            {content.primaryAction.label}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className="progress-strip">
        <ProgressStep label="Profile basics" active />
        <ProgressStep label="Research" />
        <ProgressStep label="CV" />
        <ProgressStep label="Website" />
        <ProgressStep label="Files" />
      </div>

      <div className="card-grid">
        {content.cards.map((card) => (
          <article className="workspace-card" key={card.title}>
            <div className="card-meta">
              <CircleDot size={14} />
              {card.meta}
            </div>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </div>

      <section className="empty-state">
        <div>
          <span className="section-label">Stage 1 placeholder</span>
          <h2>Backend work starts after the shell is approved.</h2>
          <p>
            This screen intentionally avoids database, auth, billing, PDF, or website publishing logic. The next phase
            adds workspace-scoped authentication and the structured academic profile model.
          </p>
        </div>
      </section>
    </section>
  );
}

function ProgressStep({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className={`progress-step ${active ? "active" : ""}`}>
      <span />
      {label}
    </div>
  );
}
