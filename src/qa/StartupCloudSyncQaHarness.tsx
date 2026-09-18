import React, { useEffect, useMemo, useRef, useState } from "react";
import { PantryView } from "../components/PantryView";
import { PantryItem } from "../types";
import { getStartupCloudSyncState } from "../utils/startupCloudSync";
import { runtimeQaDeploymentSha } from "./runtimeQaGate";

const QA_USER_ID = "qa-runtime-user";

const CACHED_PANTRY: PantryItem[] = [
  {
    id: "qa-cached-yogurt",
    name: "QA Cached Yogurt",
    quantity: 1,
    unit: "pcs",
    category: "Dairy",
    addedAt: "2026-09-18",
  },
];

const REMOTE_PANTRY: PantryItem[] = [
  {
    id: "qa-remote-lentils",
    name: "QA Remote Lentils",
    quantity: 2,
    unit: "pcs",
    category: "Pantry/Grains",
    addedAt: "2026-09-18",
  },
];

function boundedDelay(raw: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function StartupCloudSyncQaHarness() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const delayMs = boundedDelay(params.get("delayMs"), 30_000, 30_000, 45_000);
  const authDelayMs = boundedDelay(params.get("authDelayMs"), 100, 0, 1_000);
  const cacheMode = params.get("cache") === "none" ? "none" : "present";

  const bootAt = useRef(performance.now());
  const [authReady, setAuthReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inventoryHydratedUser, setInventoryHydratedUser] = useState<string | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [shellInteractions, setShellInteractions] = useState(0);
  const [writeAttempts, setWriteAttempts] = useState(0);
  const [committedWrites, setCommittedWrites] = useState(0);
  const [authResolvedAtMs, setAuthResolvedAtMs] = useState<number | null>(null);
  const [hydratedAtMs, setHydratedAtMs] = useState<number | null>(null);

  const syncState = getStartupCloudSyncState(
    authReady,
    currentUserId,
    inventoryHydratedUser
  );
  const writeAllowedRef = useRef(syncState.cloudInventoryWritesAllowed);
  writeAllowedRef.current = syncState.cloudInventoryWritesAllowed;

  const recordWriteAttempt = () => {
    setWriteAttempts((value) => value + 1);
    if (writeAllowedRef.current) {
      setCommittedWrites((value) => value + 1);
    }
  };

  useEffect(() => {
    const authTimer = window.setTimeout(() => {
      setCurrentUserId(QA_USER_ID);
      setPantry(cacheMode === "present" ? CACHED_PANTRY : []);
      setAuthReady(true);
      setAuthResolvedAtMs(Math.round(performance.now() - bootAt.current));
    }, authDelayMs);

    return () => window.clearTimeout(authTimer);
  }, [authDelayMs, cacheMode]);

  useEffect(() => {
    if (currentUserId !== QA_USER_ID) return;

    const preHydrationWriteTimer = window.setTimeout(() => {
      recordWriteAttempt();
    }, 400);

    const remoteSnapshotTimer = window.setTimeout(() => {
      setPantry(REMOTE_PANTRY);
      setInventoryHydratedUser(QA_USER_ID);
      setHydratedAtMs(Math.round(performance.now() - bootAt.current));
    }, delayMs);

    return () => {
      window.clearTimeout(preHydrationWriteTimer);
      window.clearTimeout(remoteSnapshotTimer);
    };
  }, [currentUserId, delayMs]);

  useEffect(() => {
    if (inventoryHydratedUser !== QA_USER_ID) return;
    const postHydrationWriteTimer = window.setTimeout(() => {
      recordWriteAttempt();
    }, 100);
    return () => window.clearTimeout(postHydrationWriteTimer);
  }, [inventoryHydratedUser]);

  const updateQuantity = (id: string, quantity: number) => {
    if (syncState.inventoryIsProvisional) return;
    setPantry((items) =>
      items.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const deleteItem = (id: string) => {
    if (syncState.inventoryIsProvisional) return;
    setPantry((items) => items.filter((item) => item.id !== id));
  };

  const clearPantry = () => {
    if (syncState.inventoryIsProvisional) return;
    setPantry([]);
  };

  if (!syncState.canRenderApp) {
    return (
      <div
        data-testid="qa-fullscreen-overlay"
        className="min-h-screen bg-[#0B0F12] text-stone-100 flex items-center justify-center"
      >
        Loading QA account…
      </div>
    );
  }

  return (
    <div
      data-testid="qa-runtime-root"
      data-delay-ms={delayMs}
      data-cache-mode={cacheMode}
      data-deployment-sha={runtimeQaDeploymentSha()}
      className="min-h-screen bg-[#0B0F12] text-stone-100 p-4"
    >
      <div data-testid="qa-app-shell" className="max-w-4xl mx-auto space-y-4">
        <header className="rounded-2xl border border-white/10 bg-[#131A1F] p-4">
          <h1 className="text-lg font-bold">Startup cloud sync runtime QA</h1>
          <p className="text-sm text-stone-400">
            Preview-only deterministic harness. No hosted Firebase reads or writes are used.
          </p>
          <button
            data-testid="qa-shell-action"
            type="button"
            onClick={() => setShellInteractions((value) => value + 1)}
            className="mt-3 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-stone-950"
          >
            Usable shell action
          </button>
          <span data-testid="qa-shell-interactions" className="ml-3">
            {shellInteractions}
          </span>
        </header>

        {syncState.inventoryIsProvisional ? (
          <div
            data-testid="qa-provisional-status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
          >
            Inventory authority: provisional / unknown
          </div>
        ) : (
          <div
            data-testid="qa-authoritative-status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"
          >
            Inventory authority: authoritative
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 p-3">
            Pantry count
            <strong data-testid="qa-pantry-count" className="block text-xl">
              {syncState.inventoryIsProvisional ? "—" : pantry.length}
            </strong>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            Write attempts
            <strong data-testid="qa-write-attempts" className="block text-xl">
              {writeAttempts}
            </strong>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            Cloud commits
            <strong data-testid="qa-committed-writes" className="block text-xl">
              {committedWrites}
            </strong>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            Hydration ms
            <strong data-testid="qa-hydrated-ms" className="block text-xl">
              {hydratedAtMs ?? "pending"}
            </strong>
          </div>
        </div>

        <div className="hidden" aria-hidden="true">
          <span data-testid="qa-auth-resolved-ms">{authResolvedAtMs ?? "pending"}</span>
          <span data-testid="qa-cloud-writes-allowed">
            {String(syncState.cloudInventoryWritesAllowed)}
          </span>
          <span data-testid="qa-cache-mode">{cacheMode}</span>
          <span data-testid="qa-deployment-sha">{runtimeQaDeploymentSha()}</span>
        </div>

        <PantryView
          pantry={pantry}
          onAddItem={() => {}}
          onAddMultipleItems={() => {}}
          onUpdateQuantity={updateQuantity}
          onDeleteItem={deleteItem}
          onClearAll={clearPantry}
          onOpenVoiceTab={() => {}}
          language="en"
          currency="EUR"
          inventoryIsProvisional={syncState.inventoryIsProvisional}
        />
      </div>
    </div>
  );
}
