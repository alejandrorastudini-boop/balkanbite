export interface StartupCloudSyncState {
  /** Auth has resolved, so the application shell can render. */
  canRenderApp: boolean;
  /** Signed-in inventory is still local/provisional until its first snapshot. */
  inventoryIsProvisional: boolean;
  /** Cloud inventory writes must remain closed until remote inventory hydrates. */
  cloudInventoryWritesAllowed: boolean;
}

/**
 * Keep UI readiness separate from authoritative inventory readiness.
 * A delayed inventory listener must not block the whole application, while its
 * pre-hydration contents remain explicitly provisional and cannot be written.
 */
export function getStartupCloudSyncState(
  authReady: boolean,
  currentUserId: string | null,
  inventoryHydratedUser: string | null
): StartupCloudSyncState {
  const inventoryIsProvisional =
    authReady && currentUserId !== null && inventoryHydratedUser !== currentUserId;

  return {
    canRenderApp: authReady,
    inventoryIsProvisional,
    cloudInventoryWritesAllowed:
      authReady && currentUserId !== null && inventoryHydratedUser === currentUserId,
  };
}
