type MarkdownProseProps = {
  html: string;
  className?: string;
};

/** Trusted first-party markdown rendered to HTML. */
export function MarkdownProse({ html, className }: MarkdownProseProps) {
  return (
    <div
      className={["markdown-prose", className].filter(Boolean).join(" ")}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
