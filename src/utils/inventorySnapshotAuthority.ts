export interface InventorySnapshotMetadata {
  fromCache: boolean;
  hasPendingWrites: boolean;
}

/**
 * Signed-in inventory authority advances only after Firestore confirms that
 * the snapshot came from the server and contains no locally pending writes.
 * Cached or latency-compensated snapshots may be displayed elsewhere as
 * provisional context, but must never authorize persistence or replace the
 * last committed pantry state.
 */
export function isServerConfirmedInventorySnapshot(
  metadata: InventorySnapshotMetadata,
): boolean {
  return Boolean(
    metadata &&
    metadata.fromCache === false &&
    metadata.hasPendingWrites === false
  );
}
