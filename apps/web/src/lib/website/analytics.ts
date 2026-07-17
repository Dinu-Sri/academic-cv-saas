import { prisma } from "@/lib/prisma";

/** Privacy-safe page view counters (no visitor identity stored). */
export async function recordWebsitePageView(websiteId: string, pagePath: string) {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const path = normalizePath(pagePath);

  await prisma.websiteDailyMetric.upsert({
    where: {
      websiteId_metricDate_pagePath: {
        websiteId,
        metricDate: day,
        pagePath: path
      }
    },
    create: {
      websiteId,
      metricDate: day,
      pagePath: path,
      views: 1
    },
    update: {
      views: { increment: 1 }
    }
  });
}

export async function getWebsiteAnalyticsSummary(websiteId: string, days = 14) {
  const normalizedDays = Math.max(1, days);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (normalizedDays - 1));
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.websiteDailyMetric.findMany({
    where: {
      websiteId,
      metricDate: { gte: since }
    },
    orderBy: [{ metricDate: "desc" }, { pagePath: "asc" }]
  });

  const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
  const byPath = new Map<string, number>();
  for (const row of rows) {
    byPath.set(row.pagePath, (byPath.get(row.pagePath) || 0) + row.views);
  }

  return {
    totalViews,
    days: normalizedDays,
    pages: Array.from(byPath.entries())
      .map(([pagePath, views]) => ({ pagePath, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 20),
    series: rows.map((row) => ({
      date: row.metricDate.toISOString().slice(0, 10),
      pagePath: row.pagePath,
      views: row.views
    }))
  };
}

function normalizePath(path: string) {
  const cleaned = (path || "/").split("?")[0].split("#")[0];
  if (!cleaned.startsWith("/")) return `/${cleaned}`;
  return cleaned.slice(0, 120) || "/";
}
