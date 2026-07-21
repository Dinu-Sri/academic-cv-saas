import fs from "node:fs";
import path from "node:path";

/**
 * Resolve the monorepo/content root for blog + legal markdown.
 * Works in local XAMPP/dev (cwd = apps/web), Docker builder, and standalone.
 */
export function resolveContentRoot(): string {
  const candidates = [
    path.join(process.cwd(), "content"),
    path.join(process.cwd(), "apps", "web", "content"),
    path.join(process.cwd(), "..", "..", "content"),
    path.join(process.cwd(), "..", "..", "..", "content"),
    // Dockerfile copies content into apps/web/content
    path.join(process.cwd(), "..", "content"),
    path.join(__dirname, "..", "..", "..", "content"),
    path.join(__dirname, "..", "..", "..", "..", "content")
  ];

  for (const candidate of candidates) {
    try {
      const resolved = path.resolve(candidate);
      if (fs.existsSync(path.join(resolved, "blog")) || fs.existsSync(path.join(resolved, "legal"))) {
        return resolved;
      }
    } catch {
      /* try next */
    }
  }

  return path.resolve(process.cwd(), "content");
}

export function contentPath(...segments: string[]): string {
  return path.join(resolveContentRoot(), ...segments);
}
