import firebaseConfig from "../firebase-applet-config.json";

const ADMIN_EMAIL = "alejandrorastudini@gmail.com";
const AGENT_REPOSITORY = "alejandrorastudini-boop/balkanbite-dev-agent";
const AGENT_STATE_REF = "agent-state";
const AGENT_STATE_PATH = "runtime-state/agent-state.json";

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function getBearerToken(req: ApiRequest): string | null {
  const raw = req.headers.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function verifyAdmin(idToken: string): Promise<boolean> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!response.ok) return false;
  const payload = await response.json() as {
    users?: Array<{ email?: string; emailVerified?: boolean; disabled?: boolean }>;
  };
  const account = payload.users?.[0];
  return Boolean(
    account &&
      account.disabled !== true &&
      account.emailVerified === true &&
      account.email?.toLowerCase() === ADMIN_EMAIL
  );
}

function latestActionAt(state: any): string | null {
  const actions = Array.isArray(state?.recentActions) ? state.recentActions : [];
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const at = actions[index]?.at;
    if (typeof at === "string" && Number.isFinite(Date.parse(at))) return at;
  }
  return null;
}

function sanitizeState(state: any) {
  const autonomyWindow = state?.autonomyWindow && typeof state.autonomyWindow === "object"
    ? {
        startedAt: state.autonomyWindow.startedAt ?? null,
        deadlineAt: state.autonomyWindow.deadlineAt ?? null,
        attemptedCycles: Number(state.autonomyWindow.attemptedCycles) || 0,
        completedCycles: Number(state.autonomyWindow.completedCycles) || 0,
        agentRuntimeMs: Number(state.autonomyWindow.agentRuntimeMs) || 0,
        estimatedUsd: Number(state.autonomyWindow.estimatedUsd) || 0,
        lastCycleStartedAt: state.autonomyWindow.lastCycleStartedAt ?? null,
        lastCycleCompletedAt: state.autonomyWindow.lastCycleCompletedAt ?? null,
        reviewRequired: state.autonomyWindow.reviewRequired === true,
        pausedAt: state.autonomyWindow.pausedAt ?? null,
      }
    : null;

  return {
    status: typeof state?.status === "string" ? state.status : "UNKNOWN",
    reason: typeof state?.reason === "string" ? state.reason : null,
    currentMilestone: typeof state?.currentMilestone === "string" ? state.currentMilestone : null,
    lastCheckpointSha: typeof state?.lastCheckpointSha === "string" ? state.lastCheckpointSha : null,
    lastCompletedAt: typeof state?.lastCompletedAt === "string" ? state.lastCompletedAt : null,
    lastRunId: typeof state?.lastRunId === "string" ? state.lastRunId : null,
    nextAction: typeof state?.nextAction === "string" ? state.nextAction : null,
    successfulWriteCycles: Number(state?.successfulWriteCycles) || 0,
    lastPlanSummary: typeof state?.lastPlan?.summary === "string" ? state.lastPlan.summary : null,
    lastCycleUsage: state?.lastCycleUsage && typeof state.lastCycleUsage === "object"
      ? {
          estimatedUsd: Number(state.lastCycleUsage.estimatedUsd) || 0,
          requests: Number(state.lastCycleUsage.requests) || 0,
          inputTokens: Number(state.lastCycleUsage.inputTokens) || 0,
          outputTokens: Number(state.lastCycleUsage.outputTokens) || 0,
        }
      : null,
    dailyUsage: state?.dailyUsage && typeof state.dailyUsage === "object"
      ? {
          date: typeof state.dailyUsage.date === "string" ? state.dailyUsage.date : null,
          estimatedUsd: Number(state.dailyUsage.estimatedUsd) || 0,
          requests: Number(state.dailyUsage.requests) || 0,
        }
      : null,
    autonomyWindow,
    latestActionAt: latestActionAt(state),
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ error: "authentication_required" });
  }

  try {
    if (!(await verifyAdmin(idToken))) {
      return res.status(403).json({ error: "admin_only" });
    }
  } catch (error) {
    console.error("Agent status auth verification failed", error);
    return res.status(503).json({ error: "auth_verification_unavailable" });
  }

  const githubToken = process.env.BALKANBITE_AGENT_GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(503).json({ error: "agent_status_not_configured" });
  }

  try {
    const url = `https://api.github.com/repos/${AGENT_REPOSITORY}/contents/${AGENT_STATE_PATH}?ref=${AGENT_STATE_REF}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "BalkanBite-Agent-Status",
      },
    });

    if (!response.ok) {
      console.error("Agent status GitHub read failed", response.status);
      return res.status(502).json({ error: "agent_status_unavailable" });
    }

    const payload = await response.json() as { content?: string; encoding?: string };
    if (payload.encoding !== "base64" || typeof payload.content !== "string") {
      return res.status(502).json({ error: "agent_status_invalid_payload" });
    }

    const decoded = Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8");
    const state = JSON.parse(decoded);
    return res.status(200).json({
      source: "balkanbite-dev-agent/agent-state",
      fetchedAt: new Date().toISOString(),
      agent: sanitizeState(state),
    });
  } catch (error) {
    console.error("Agent status read failed", error);
    return res.status(502).json({ error: "agent_status_unavailable" });
  }
}
