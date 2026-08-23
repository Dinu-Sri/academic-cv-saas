import { absoluteUrl, getSiteOrigin } from "@/lib/content/site-url";
import { COMPANY } from "@/lib/billing/company";

export type EmailLayoutInput = {
  /** Preheader text (inbox preview) */
  preheader?: string;
  /** Main heading inside the card */
  title: string;
  /** HTML body blocks (already escaped or trusted markup) */
  bodyHtml: string;
  /** Optional primary CTA */
  cta?: { label: string; url: string };
  /** Extra footer note */
  footerNote?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Minimal academic-corporate HTML email shell (table layout for clients).
 * Logo uses absolute product URL so it works in Gmail/Outlook.
 */
export function renderEmailLayout(input: EmailLayoutInput): string {
  const origin = getSiteOrigin();
  const logoUrl = absoluteUrl("/cvscholar-logo.svg");
  const preheader = escapeHtml(input.preheader || input.title);
  const title = escapeHtml(input.title);
  const cta = input.cta
    ? `<tr>
        <td style="padding:8px 0 4px;">
          <a href="${escapeHtml(input.cta.url)}"
             style="display:inline-block;background:#1b2a4a;color:#ffffff;text-decoration:none;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">
            ${escapeHtml(input.cta.label)}
          </a>
        </td>
      </tr>`
    : "";
  const footerNote = input.footerNote
    ? `<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#8a97ab;">${escapeHtml(input.footerNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef2f7;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #d9e2ec;">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#1b2a4a 0%,#2b6cb0 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="${logoUrl}" width="36" height="36" alt="CVScholar" style="display:block;border:0;width:36px;height:36px;"/>
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:16px;font-weight:700;color:#1b2a4a;letter-spacing:0.02em;">CVScholar</div>
                    <div style="font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:12px;color:#5a6a85;">Academic CVs &amp; websites</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 28px 8px;">
              <h1 style="margin:0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:20px;line-height:1.35;font-weight:700;color:#1b2a4a;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 28px 8px;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:14px;line-height:1.6;color:#334155;">
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                ${cta}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 22px;border-top:1px solid #e8eef5;background:#f8fafc;">
              <p style="margin:0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:12px;line-height:1.5;color:#5a6a85;">
                ${escapeHtml(COMPANY.legalName)} · Trading as CVScholar<br/>
                <a href="${origin}" style="color:#2b6cb0;text-decoration:none;">${origin.replace(/^https?:\/\//, "")}</a>
                · <a href="mailto:${COMPANY.email}" style="color:#2b6cb0;text-decoration:none;">${COMPANY.email}</a>
              </p>
              ${footerNote}
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;font-size:11px;color:#8a97ab;">
          This is a transactional message from CVScholar.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailParagraph(text: string) {
  return `<p style="margin:0 0 12px;">${escapeHtml(text)}</p>`;
}

export function emailParagraphs(lines: string[]) {
  return lines.filter(Boolean).map(emailParagraph).join("");
}

export function emailMuted(text: string) {
  return `<p style="margin:0 0 12px;color:#5a6a85;font-size:13px;">${escapeHtml(text)}</p>`;
}

export function emailDetailRows(rows: Array<[string, string]>) {
  const inner = rows
    .filter(([, v]) => v && String(v).trim())
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:6px 0;color:#5a6a85;font-size:13px;width:120px;vertical-align:top;">${escapeHtml(k)}</td>
          <td style="padding:6px 0;color:#1b2a4a;font-size:13px;font-weight:600;vertical-align:top;">${escapeHtml(v)}</td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:4px 0 14px;">${inner}</table>`;
}

export function emailQuote(text: string) {
  return `<div style="margin:0 0 14px;padding:12px 14px;border-left:3px solid #c5d6ea;background:#f5f8fc;border-radius:0 8px 8px 0;color:#334155;font-size:13px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(text)}</div>`;
}

export { escapeHtml };
