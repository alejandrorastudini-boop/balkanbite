import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Clock3, Coins, RefreshCw, ShieldCheck, TimerReset } from "lucide-react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "../lib/firebase";

const ADMIN_EMAIL = "alejandrorastudini@gmail.com";

type AgentStatusPayload = {
  fetchedAt: string;
  agent: {
    status: string;
    reason: string | null;
    currentMilestone: string | null;
    lastCheckpointSha: string | null;
    lastCompletedAt: string | null;
    lastRunId: string | null;
    nextAction: string | null;
    successfulWriteCycles: number;
    lastPlanSummary: string | null;
    latestActionAt: string | null;
    lastCycleUsage: {
      estimatedUsd: number;
      requests: number;
      inputTokens: number;
      outputTokens: number;
    } | null;
    dailyUsage: {
      date: string | null;
      estimatedUsd: number;
      requests: number;
    } | null;
    autonomyWindow: {
      startedAt: string | null;
      deadlineAt: string | null;
      attemptedCycles: number;
      completedCycles: number;
      agentRuntimeMs: number;
      estimatedUsd: number;
      lastCycleStartedAt: string | null;
      lastCycleCompletedAt: string | null;
      reviewRequired: boolean;
      pausedAt: string | null;
    } | null;
  };
};

function formatDuration(ms: number | null | undefined) {
  if (!Number.isFinite(ms) || !ms || ms < 0) return "0 min";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function formatDate(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusPresentation(status: string, reviewRequired: boolean) {
  if (status === "RUNNING") {
    return reviewRequired
      ? { label: "Necesita revisión", dot: "bg-amber-400", badge: "text-amber-300 border-amber-500/30 bg-amber-500/10" }
      : { label: "Trabajando", dot: "bg-emerald-400", badge: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" };
  }
  if (status === "PAUSED") {
    return { label: "Pausado", dot: "bg-amber-400", badge: "text-amber-300 border-amber-500/30 bg-amber-500/10" };
  }
  if (status === "BLOCKED") {
    return { label: "Bloqueado", dot: "bg-rose-400", badge: "text-rose-300 border-rose-500/30 bg-rose-500/10" };
  }
  if (status === "BUDGET_EXHAUSTED") {
    return { label: "Presupuesto agotado", dot: "bg-rose-400", badge: "text-rose-300 border-rose-500/30 bg-rose-500/10" };
  }
  return { label: status || "Desconocido", dot: "bg-stone-400", badge: "text-stone-300 border-white/10 bg-white/[0.04]" };
}

function AgentStatusCard({ user }: { user: User }) {
  const [payload, setPayload] = useState<AgentStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/agent-status", {
        method: "GET",
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof data?.error === "string" ? data.error : "agent_status_unavailable";
        throw new Error(code);
      }
      setPayload(data as AgentStatusPayload);
    } catch (err) {
      const code = err instanceof Error ? err.message : "agent_status_unavailable";
      setError(code);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const refreshId = window.setInterval(() => void refresh(), 60_000);
    const clockId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      window.clearInterval(refreshId);
      window.clearInterval(clockId);
    };
  }, [refresh]);

  const agent = payload?.agent;
  const windowInfo = agent?.autonomyWindow;
  const presentation = statusPresentation(agent?.status || "UNKNOWN", windowInfo?.reviewRequired === true);
  const elapsedMs = useMemo(() => {
    if (!windowInfo?.startedAt) return null;
    const started = Date.parse(windowInfo.startedAt);
    if (!Number.isFinite(started)) return null;
    return Math.max(0, now - started);
  }, [windowInfo?.startedAt, now]);

  const errorMessage = error === "agent_status_not_configured"
    ? "El panel está instalado, pero falta configurar la credencial de lectura del repositorio privado del agente."
    : error === "admin_only"
    ? "Esta cuenta no tiene permiso para ver el estado del agente."
    : error
    ? "No se pudo leer el estado del agente en este momento."
    : null;

  return (
    <section className="bg-[#131A1F]/80 backdrop-blur-md border border-cyan-500/20 rounded-3xl p-5 shadow-[0_8px_30px_rgba(6,182,212,0.08)] space-y-4" aria-label="Estado del agente de desarrollo">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white font-['Outfit']">Agente de desarrollo</h3>
              {agent && (
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest ${presentation.badge}`}>
                  <span className={`w-2 h-2 rounded-full ${presentation.dot}`} />
                  {presentation.label}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-1">Panel privado de administración · solo tu cuenta</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-stone-300 hover:text-white disabled:opacity-50 transition-colors"
          aria-label="Actualizar estado del agente"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200 leading-relaxed">
          {errorMessage}
        </div>
      ) : !agent ? (
        <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4 text-sm text-stone-400">Leyendo estado…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500 font-bold"><TimerReset className="w-3.5 h-3.5" />Tiempo efectivo</div>
              <div className="text-lg font-extrabold text-white mt-1">{windowInfo ? formatDuration(windowInfo.agentRuntimeMs) : "—"}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{windowInfo ? "Trabajo medido del agente" : "No medido en esta fase"}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500 font-bold"><Clock3 className="w-3.5 h-3.5" />Ventana transcurrida</div>
              <div className="text-lg font-extrabold text-white mt-1">{elapsedMs === null ? "—" : formatDuration(elapsedMs)}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">Límite: {formatDate(windowInfo?.deadlineAt)}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500 font-bold"><Activity className="w-3.5 h-3.5" />Ciclos</div>
              <div className="text-lg font-extrabold text-white mt-1">{windowInfo ? `${windowInfo.completedCycles}/${windowInfo.attemptedCycles}` : agent.successfulWriteCycles}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{windowInfo ? "Completados / intentados" : "Write cycles validados"}</div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-stone-500 font-bold"><Coins className="w-3.5 h-3.5" />Coste estimado</div>
              <div className="text-lg font-extrabold text-white mt-1">${(windowInfo?.estimatedUsd ?? agent.dailyUsage?.estimatedUsd ?? 0).toFixed(2)}</div>
              <div className="text-[11px] text-stone-500 mt-0.5">{windowInfo ? "Ventana actual" : "Uso diario estimado"}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-stone-500">Microhito</span><span className="text-stone-200 font-semibold text-right break-all">{agent.currentMilestone || "—"}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-stone-500">Última actividad</span><span className="text-stone-200">{formatDate(agent.latestActionAt || agent.lastCompletedAt)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-stone-500">Checkpoint</span><span className="text-stone-200 font-mono text-xs">{agent.lastCheckpointSha?.slice(0, 8) || "—"}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-stone-500">Motivo</span><span className="text-stone-200 text-right break-all">{agent.reason || "—"}</span></div>
          </div>

          {agent.nextAction && (
            <div className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.06] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-300 mb-2"><ShieldCheck className="w-4 h-4" />Siguiente acción registrada</div>
              <p className="text-sm text-stone-300 leading-relaxed">{agent.nextAction}</p>
            </div>
          )}

          <div className="text-[11px] text-stone-600 text-right">Actualizado {formatDate(payload?.fetchedAt)}</div>
        </>
      )}
    </section>
  );
}

export function AdminAgentStatusPortal() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    const updateTarget = () => setTarget(document.getElementById("profile-view"));
    updateTarget();
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL || !target) return null;
  return createPortal(<AgentStatusCard user={user} />, target);
}
