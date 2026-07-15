import type { AiChatMessage } from "@/lib/ai/deepseek";
import { deepSeekIsConfigured, deepSeekJson, deepSeekModel } from "@/lib/ai/deepseek";

export type ModelRoute = "classification" | "reasoning" | "writing" | "extraction" | "validation";

export type ModelGatewayResult<T> = {
  output: T;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  latencyMs: number;
};

export function modelGatewayIsConfigured(route: ModelRoute = "reasoning") {
  return route === "reasoning" || route === "writing" || route === "classification" || route === "validation"
    ? deepSeekIsConfigured()
    : Boolean(process.env.OPENAI_API_KEY);
}

export function modelRouteConfig(route: ModelRoute = "reasoning") {
  if (route === "extraction") {
    return {
      provider: "openai",
      model: process.env.CVSCHOLAR_DOCUMENT_EXTRACT_MODEL || process.env.CVSCHOLAR_CV_IMPORT_MODEL || "gpt-5.4-mini"
    };
  }

  return {
    provider: "deepseek",
    model: routeModelEnv(route) || deepSeekModel()
  };
}

export async function generateJsonWithGateway<T>({
  route = "reasoning",
  messages,
  timeoutMs
}: {
  route?: ModelRoute;
  messages: AiChatMessage[];
  timeoutMs?: number;
}): Promise<ModelGatewayResult<T>> {
  const started = Date.now();
  const routeConfig = modelRouteConfig(route);
  if (routeConfig.provider !== "deepseek") {
    throw new Error(`JSON model route ${route} is not configured for ${routeConfig.provider} yet.`);
  }

  // Planner/classification should be faster and cheaper than the executor.
  const isPlannerRoute = route === "classification";
  const output = await deepSeekJson<T>({
    messages,
    timeoutMs,
    model: routeConfig.model,
    enableThinking: !isPlannerRoute,
    reasoningEffort: isPlannerRoute ? "high" : undefined
  });
  const latencyMs = Date.now() - started;
  const inputTokens = estimateTokens(messages.map((message) => message.content).join("\n"));
  const outputTokens = estimateTokens(JSON.stringify(output));

  return {
    output,
    provider: routeConfig.provider,
    model: routeConfig.model,
    inputTokens,
    outputTokens,
    estimatedCostCents: estimateCostCents(inputTokens, outputTokens),
    latencyMs
  };
}

function routeModelEnv(route: ModelRoute) {
  if (route === "classification") {
    return (
      process.env.CVSCHOLAR_AGENT_PLANNER_MODEL ||
      process.env.CVSCHOLAR_AGENT_CLASSIFICATION_MODEL ||
      process.env.DEEPSEEK_MODEL
    );
  }
  if (route === "writing") return process.env.CVSCHOLAR_AGENT_WRITING_MODEL || process.env.CVSCHOLAR_CV_POLISH_MODEL;
  if (route === "validation") return process.env.CVSCHOLAR_AGENT_VALIDATION_MODEL;
  return process.env.CVSCHOLAR_AGENT_REASONING_MODEL || process.env.CVSCHOLAR_CV_AGENT_MODEL;
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function estimateCostCents(inputTokens: number, outputTokens: number) {
  const inputPerMillion = Number.parseFloat(process.env.CVSCHOLAR_AGENT_INPUT_COST_PER_MILLION_CENTS || "0");
  const outputPerMillion = Number.parseFloat(process.env.CVSCHOLAR_AGENT_OUTPUT_COST_PER_MILLION_CENTS || "0");
  return (inputTokens / 1_000_000) * inputPerMillion + (outputTokens / 1_000_000) * outputPerMillion;
}
