import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false
});

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/gi, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export type TocItem = { id: string; text: string; level: number };

/** Convert markdown to HTML and inject heading ids for TOC anchors. */
export function renderMarkdown(markdown: string): { html: string; toc: TocItem[] } {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  const toc: TocItem[] = [];
  const used = new Map<string, number>();

  const html = rawHtml.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/gi, (_full, levelStr: string, inner: string) => {
    const level = Number(levelStr);
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let id = slugifyHeading(text) || `section-${toc.length + 1}`;
    const count = used.get(id) ?? 0;
    used.set(id, count + 1);
    if (count > 0) id = `${id}-${count + 1}`;
    toc.push({ id, text, level });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });

  return { html, toc };
}

export function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
