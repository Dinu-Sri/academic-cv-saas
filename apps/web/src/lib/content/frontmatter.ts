/**
 * Minimal YAML frontmatter parser for blog/legal markdown
 * (key: value, quoted strings, inline arrays, multi-line lists).
 */

export type FrontmatterValue = string | string[] | number | boolean | null;
export type Frontmatter = Record<string, FrontmatterValue>;

export function splitFrontmatter(raw: string): { data: Frontmatter; body: string } {
  // Strip UTF-8 BOM if present (common from Windows editors / PowerShell).
  const text = raw.replace(/^\uFEFF/, "");
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: text.trim() };
  }
  return {
    data: parseSimpleYaml(match[1]),
    body: match[2].trim()
  };
}

function parseSimpleYaml(yaml: string): Frontmatter {
  const data: Frontmatter = {};
  const lines = yaml.split(/\r?\n/);
  let currentKey: string | null = null;
  let currentList: string[] | null = null;

  const flushList = () => {
    if (currentKey !== null && currentList !== null) {
      data[currentKey] = currentList;
    }
    currentKey = null;
    currentList = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (currentKey !== null && listItem) {
      if (currentList === null) currentList = [];
      currentList.push(unquote(listItem[1].trim()));
      continue;
    }

    flushList();

    const kv = trimmed.match(/^([\w][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1];
    const value = kv[2].trim();

    if (value === "") {
      currentKey = key;
      currentList = null;
      continue;
    }

    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      data[key] = inner
        ? inner.split(/\s*,\s*/).map((item) => unquote(item.trim()))
        : [];
      continue;
    }

    data[key] = coerceScalar(unquote(value));
  }

  flushList();
  return data;
}

function unquote(value: string): string {
  const m = value.match(/^["'](.*)["']\s*$/);
  return m ? m[1] : value;
}

function coerceScalar(value: string): FrontmatterValue {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null" || value === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

export function asString(value: FrontmatterValue | undefined, fallback = ""): string {
  if (value == null) return fallback;
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function asStringArray(value: FrontmatterValue | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
