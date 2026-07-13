type ExtractionContent =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string }
  | { type: "input_file"; filename: string; file_data: string; detail?: "low" | "high" };

export type ExtractedDocumentContent = {
  extractedText: string;
  facts: Record<string, unknown>;
};

export function openAiExtractionIsConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function extractDocumentContent({
  bytes,
  filename,
  mimeType,
  prompt,
  timeoutMs = 90000
}: {
  bytes: Buffer;
  filename: string;
  mimeType: string;
  prompt?: string;
  timeoutMs?: number;
}): Promise<ExtractedDocumentContent> {
  return extractWithContent({
    content: [
      {
        type: "input_text",
        text: prompt || defaultExtractionPrompt(filename)
      },
      fileContent(bytes, filename, mimeType)
    ],
    timeoutMs
  });
}

export async function extractImagePagesContent({
  pageImages,
  prompt,
  timeoutMs = 90000
}: {
  pageImages: Buffer[];
  prompt?: string;
  timeoutMs?: number;
}): Promise<ExtractedDocumentContent> {
  return extractWithContent({
    content: [
      {
        type: "input_text",
        text: prompt || defaultExtractionPrompt("rendered CV pages")
      },
      ...pageImages.map((image) => ({
        type: "input_image" as const,
        image_url: `data:image/jpeg;base64,${image.toString("base64")}`
      }))
    ],
    timeoutMs
  });
}

async function extractWithContent({
  content,
  timeoutMs
}: {
  content: ExtractionContent[];
  timeoutMs: number;
}): Promise<ExtractedDocumentContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI extraction is not configured. Set OPENAI_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(15000, timeoutMs));

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.CVSCHOLAR_DOCUMENT_EXTRACT_MODEL || process.env.CVSCHOLAR_CV_IMPORT_MODEL || "gpt-5.4-mini",
        temperature: 0,
        input: [
          {
            role: "user",
            content
          }
        ]
      })
    });

    const payload = (await response.json()) as {
      error?: { message?: string };
      output_text?: string;
      output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || "OpenAI could not extract the document.");
    }

    const text = payload.output_text || responseOutputText(payload.output);
    if (!text) {
      throw new Error("OpenAI returned an empty extraction.");
    }

    return parseExtraction(text);
  } finally {
    clearTimeout(timeout);
  }
}

function fileContent(bytes: Buffer, filename: string, mimeType: string): ExtractionContent {
  const dataUrl = `data:${mimeType || "application/octet-stream"};base64,${bytes.toString("base64")}`;
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    return {
      type: "input_file",
      filename,
      file_data: dataUrl,
      detail: "high"
    };
  }

  return {
    type: "input_image",
    image_url: dataUrl
  };
}

function defaultExtractionPrompt(filename: string) {
  return [
    `Extract only the visible information from ${filename}.`,
    "Return JSON only with keys: extractedText, facts, warnings.",
    "extractedText must preserve the raw CV wording, names, dates, publications, institutions, links, and section headings.",
    "facts may group obvious personal, education, experience, publication, award, grant, teaching, service, reference, and declaration facts.",
    "Do not infer, rewrite, evaluate, summarize, or invent information."
  ].join(" ");
}

function responseOutputText(output: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> | undefined) {
  return (output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((item) => item.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseExtraction(text: string): ExtractedDocumentContent {
  const parsed = JSON.parse(text) as { extractedText?: unknown; facts?: unknown; warnings?: unknown };
  const extractedText = typeof parsed.extractedText === "string" ? parsed.extractedText.trim() : "";
  const facts = parsed.facts && typeof parsed.facts === "object" && !Array.isArray(parsed.facts) ? parsed.facts as Record<string, unknown> : {};
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];

  return {
    extractedText,
    facts: {
      ...facts,
      warnings
    }
  };
}
