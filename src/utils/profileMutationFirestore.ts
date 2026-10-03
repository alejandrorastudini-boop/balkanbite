import { doc, Firestore, runTransaction, serverTimestamp } from "firebase/firestore";
import type { UserProfile } from "../types";
import { sanitizeRemoteUserProfile, serializeUserProfileForFirestore } from "./profileSyncBoundary";

export type ProfileMutationResult =
  | { outcome: "applied" | "already-applied"; revision: number }
  | { outcome: "needs-review"; reason: "invalid-request" | "stale-state" | "unverified-authority" };

const stable = (profile: UserProfile) => JSON.stringify(serializeUserProfileForFirestore(profile));


export async function ensureUserProfileExistsAtomically(
  db: Firestore,
  userId: string,
  initialProfile: UserProfile,
): Promise<ProfileMutationResult> {
  if (!userId || userId.includes("/")) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const serialized = serializeUserProfileForFirestore(initialProfile);
  const ref = doc(db, "users", userId);

  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data.userId !== undefined && data.userId !== userId) {
        return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
      }
      const revision = data.profileRevision ?? 0;
      if (!Number.isInteger(revision) || revision < 0) {
        return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
      }
      return { outcome: "already-applied" as const, revision };
    }

    tx.set(ref, {
      ...serialized,
      userId,
      profileRevision: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { outcome: "applied" as const, revision: 0 };
  });
}

export async function replaceUserProfileAtomically(
  db: Firestore,
  userId: string,
  expectedProfile: UserProfile,
  expectedRevision: number,
  nextProfile: UserProfile,
): Promise<ProfileMutationResult> {
  if (!userId || userId.includes("/") || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const expectedSignature = stable(expectedProfile);
  const nextSerialized = serializeUserProfileForFirestore(nextProfile);
  const nextSignature = JSON.stringify(nextSerialized);
  const ref = doc(db, "users", userId);

  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) {
      return { outcome: "needs-review" as const, reason: "stale-state" as const };
    }
    const data = snapshot.data();
    if (data.userId !== undefined && data.userId !== userId) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    const revision = data.profileRevision ?? 0;
    if (!Number.isInteger(revision) || revision < 0 || revision !== expectedRevision) {
      return { outcome: "needs-review" as const, reason: "stale-state" as const };
    }
    const remoteProfile = sanitizeRemoteUserProfile(data);
    const remoteSignature = stable(remoteProfile);
    if (remoteSignature === nextSignature) {
      return { outcome: "already-applied" as const, revision };
    }
    if (remoteSignature !== expectedSignature) {
      return { outcome: "needs-review" as const, reason: "stale-state" as const };
    }
    tx.set(ref, {
      ...nextSerialized,
      userId,
      profileRevision: revision + 1,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { outcome: "applied" as const, revision: revision + 1 };
  });
}
