import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  namespace: string;
  title: string;
  content: string;
  sourceUri: string;
  score: number;
};

export async function retrieveKnowledge({
  workspaceId,
  query,
  namespaces = ["academic_cv_guidance", "cvscholar_product"],
  limit = 5
}: {
  workspaceId: string;
  query: string;
  namespaces?: string[];
  limit?: number;
}): Promise<KnowledgeSearchResult[]> {
  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      namespace: { in: namespaces },
      OR: [{ workspaceId: null }, { workspaceId }]
    },
    include: {
      document: true
    },
    take: 200,
    orderBy: [{ namespace: "asc" }, { chunkOrder: "asc" }]
  });
  const queryTerms = terms(query);

  return chunks
    .map((chunk) => {
      const haystack = normalizeForSearch(`${chunk.title} ${chunk.content} ${chunk.document.title}`);
      const score = queryTerms.length
        ? queryTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0)
        : 1;
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.chunkOrder - b.chunk.chunkOrder)
    .slice(0, limit)
    .map(({ chunk, score }) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      namespace: chunk.namespace,
      title: chunk.title || chunk.document.title,
      content: chunk.content,
      sourceUri: chunk.document.sourceUri,
      score
    }));
}

export async function upsertWorkspaceKnowledgeDocument({
  workspaceId,
  namespace,
  title,
  sourceUri = "",
  chunks,
  metadata = {}
}: {
  workspaceId: string;
  namespace: string;
  title: string;
  sourceUri?: string;
  chunks: { title: string; content: string }[];
  metadata?: Record<string, unknown>;
}) {
  const checksum = hashJson({ namespace, title, chunks });
  const document = await prisma.knowledgeDocument.upsert({
    where: { id: `knowledge_${checksum.slice(0, 24)}` },
    update: {
      title,
      sourceUri,
      checksum,
      metadataJson: metadata as Prisma.InputJsonValue,
      status: "active"
    },
    create: {
      id: `knowledge_${checksum.slice(0, 24)}`,
      workspaceId,
      namespace,
      visibility: "workspace",
      sourceType: "user",
      title,
      sourceUri,
      checksum,
      metadataJson: metadata as Prisma.InputJsonValue
    }
  });

  await prisma.knowledgeChunk.deleteMany({ where: { documentId: document.id } });
  await prisma.knowledgeChunk.createMany({
    data: chunks.map((chunk, index) => ({
      id: `${document.id}_chunk_${index + 1}`,
      documentId: document.id,
      workspaceId,
      namespace,
      chunkOrder: index + 1,
      title: chunk.title,
      content: chunk.content,
      tokenEstimate: estimateTokens(chunk.content),
      metadataJson: metadata as Prisma.InputJsonValue
    }))
  });

  return document;
}

function terms(query: string) {
  return normalizeForSearch(query)
    .split(" ")
    .filter((term) => term.length > 2)
    .slice(0, 24);
}

function normalizeForSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function hashJson(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
