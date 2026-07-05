import { ArrowRight, CheckCircle2 } from "lucide-react";
import { screens, type ScreenKey } from "@/lib/screens";

export function WorkspaceScreen({ screen }: { screen: ScreenKey }) {
  const content = screens[screen];

  return (
    <section className="workspace-screen">
      <div className="screen-header">
        <div>
          <h1>{content.title}</h1>
          <p>{content.description}</p>
        </div>
        <button className="primary-action" type="button">
          {content.primaryAction.label}
          <ArrowRight size={16} />
        </button>
      </div>

      <article className="simple-panel">
        <div>
          <span className="section-label">Main Task</span>
          <h2>{content.focusTitle}</h2>
          <p>{content.focusText}</p>
        </div>
        <ul className="simple-steps" aria-label="Simple steps">
          {content.simpleSteps.map((step) => (
            <li key={step}>
              <CheckCircle2 size={18} />
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
