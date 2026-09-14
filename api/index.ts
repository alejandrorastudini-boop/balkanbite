import app from "../server.js";

const FIREBASE_API_KEY = "AIzaSyDv1M9ayqOn3X_UsMWNG_R4nxDrOH80C44";
const ADMIN_EMAIL = "alejandrorastudini@gmail.com";
const AGENT_STATE_URL = "https://api.github.com/repos/alejandrorastudini-boop/balkanbite-dev-agent/contents/runtime-state/agent-state.json?ref=agent-state";

async function handleAgentStatus(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const raw = Array.isArray(req.headers.authorization) ? req.headers.authorization[0] : req.headers.authorization;
  const idToken = raw?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!idToken) return res.status(401).json({ error: "authentication_required" });

  try {
    const authResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!authResponse.ok) return res.status(403).json({ error: "admin_only" });
    const authPayload = await authResponse.json() as any;
    const account = authPayload?.users?.[0];
    if (!account || account.disabled === true || account.emailVerified !== true || account.email?.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "admin_only" });
    }
  } catch (error) {
    console.error("Agent status auth verification failed", error);
    return res.status(503).json({ error: "auth_verification_unavailable" });
  }

  const githubToken = process.env.BALKANBITE_AGENT_GITHUB_TOKEN;
  if (!githubToken) return res.status(503).json({ error: "agent_status_not_configured" });

  try {
    const response = await fetch(AGENT_STATE_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "BalkanBite-Agent-Status",
      },
    });
    if (!response.ok) return res.status(502).json({ error: "agent_status_unavailable" });
    const payload = await response.json() as any;
    if (payload?.encoding !== "base64" || typeof payload?.content !== "string") {
      return res.status(502).json({ error: "agent_status_invalid_payload" });
    }

    const state = JSON.parse(Buffer.from(payload.content.replace(/\n/g, ""), "base64").toString("utf8"));
    const actions = Array.isArray(state?.recentActions) ? state.recentActions : [];
    let latestActionAt = null;
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const at = actions[index]?.at;
      if (typeof at === "string" && Number.isFinite(Date.parse(at))) {
        latestActionAt = at;
        break;
      }
    }
    const w = state?.autonomyWindow;

    return res.status(200).json({
      source: "balkanbite-dev-agent/agent-state",
      fetchedAt: new Date().toISOString(),
      agent: {
        status: typeof state?.status === "string" ? state.status : "UNKNOWN",
        reason: typeof state?.reason === "string" ? state.reason : null,
        currentMilestone: typeof state?.currentMilestone === "string" ? state.currentMilestone : null,
        lastCheckpointSha: typeof state?.lastCheckpointSha === "string" ? state.lastCheckpointSha : null,
        lastCompletedAt: typeof state?.lastCompletedAt === "string" ? state.lastCompletedAt : null,
        lastRunId: typeof state?.lastRunId === "string" ? state.lastRunId : null,
        nextAction: typeof state?.nextAction === "string" ? state.nextAction : null,
        successfulWriteCycles: Number(state?.successfulWriteCycles) || 0,
        lastPlanSummary: typeof state?.lastPlan?.summary === "string" ? state.lastPlan.summary : null,
        latestActionAt,
        lastCycleUsage: state?.lastCycleUsage && typeof state.lastCycleUsage === "object" ? {
          estimatedUsd: Number(state.lastCycleUsage.estimatedUsd) || 0,
          requests: Number(state.lastCycleUsage.requests) || 0,
          inputTokens: Number(state.lastCycleUsage.inputTokens) || 0,
          outputTokens: Number(state.lastCycleUsage.outputTokens) || 0,
        } : null,
        dailyUsage: state?.dailyUsage && typeof state.dailyUsage === "object" ? {
          date: typeof state.dailyUsage.date === "string" ? state.dailyUsage.date : null,
          estimatedUsd: Number(state.dailyUsage.estimatedUsd) || 0,
          requests: Number(state.dailyUsage.requests) || 0,
        } : null,
        autonomyWindow: w && typeof w === "object" ? {
          startedAt: w.startedAt ?? null,
          deadlineAt: w.deadlineAt ?? null,
          attemptedCycles: Number(w.attemptedCycles) || 0,
          completedCycles: Number(w.completedCycles) || 0,
          agentRuntimeMs: Number(w.agentRuntimeMs) || 0,
          estimatedUsd: Number(w.estimatedUsd) || 0,
          lastCycleStartedAt: w.lastCycleStartedAt ?? null,
          lastCycleCompletedAt: w.lastCycleCompletedAt ?? null,
          reviewRequired: w.reviewRequired === true,
          pausedAt: w.pausedAt ?? null,
        } : null,
      },
    });
  } catch (error) {
    console.error("Agent status read failed", error);
    return res.status(502).json({ error: "agent_status_unavailable" });
  }
}

export default function handler(req: any, res: any) {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (pathname === "/api/agent-status" || pathname === "/agent-status") return handleAgentStatus(req, res);
  return app(req, res);
}
