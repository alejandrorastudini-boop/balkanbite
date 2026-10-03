import { collection, doc, Firestore, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import {
  isValidProgressionEvent,
  type ProgressionEventV1,
} from "./progressionLedger";

export type ProgressionAppendResult =
  | { outcome: "applied" | "already-applied"; event: ProgressionEventV1 }
  | { outcome: "needs-review"; reason: "invalid-request" | "conflict" };

function canonicalEvent(event: ProgressionEventV1): ProgressionEventV1 {
  return {
    version: 1,
    eventId: event.eventId,
    type: event.type,
    occurredAt: event.occurredAt,
    evidence: "deterministic_state_transition",
    evidenceCount: event.evidenceCount,
  };
}

function signature(event: ProgressionEventV1): string {
  return JSON.stringify(canonicalEvent(event));
}

export function subscribeProgressionEvents(
  db: Firestore,
  userId: string,
  onEvents: (events: ProgressionEventV1[]) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    collection(db, "users", userId, "progressionEvents"),
    snapshot => {
      const events = snapshot.docs
        .flatMap(row => {
          const { userId: _userId, requestSignature: _requestSignature, createdAt: _createdAt, ...eventData } = row.data();
          const event = { ...eventData, eventId: row.id };
          return isValidProgressionEvent(event) ? [canonicalEvent(event)] : [];
        })
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      onEvents(events);
    },
    onError,
  );
}

export async function appendProgressionEventAtomically(
  db: Firestore,
  userId: string,
  candidate: ProgressionEventV1,
): Promise<ProgressionAppendResult> {
  if (!userId || userId.includes("/") || !isValidProgressionEvent(candidate) || candidate.eventId.includes("/")) {
    return { outcome: "needs-review", reason: "invalid-request" };
  }
  const event = canonicalEvent(candidate);
  const ref = doc(db, "users", userId, "progressionEvents", event.eventId);
  const requestSignature = signature(event);

  return runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists()) {
      const { userId: _userId, requestSignature: _requestSignature, createdAt: _createdAt, ...eventData } = snapshot.data();
      const existing = { ...eventData, eventId: snapshot.id };
      if (isValidProgressionEvent(existing) && signature(existing) === requestSignature) {
        return { outcome: "already-applied" as const, event };
      }
      return { outcome: "needs-review" as const, reason: "conflict" as const };
    }

    tx.set(ref, {
      ...event,
      userId,
      requestSignature,
      createdAt: serverTimestamp(),
    });
    return { outcome: "applied" as const, event };
  });
}

export async function appendProgressionEventsAtomically(
  db: Firestore,
  userId: string,
  candidates: readonly ProgressionEventV1[],
): Promise<boolean> {
  if (!userId || userId.includes("/") || candidates.length === 0 || candidates.length > 100) return false;

  const events = candidates.map(canonicalEvent);
  if (
    events.some(event => !isValidProgressionEvent(event) || event.eventId.includes("/")) ||
    new Set(events.map(event => event.eventId)).size !== events.length
  ) {
    return false;
  }

  const refs = events.map(event => doc(db, "users", userId, "progressionEvents", event.eventId));
  return runTransaction(db, async tx => {
    const snapshots = [];
    for (const ref of refs) snapshots.push(await tx.get(ref));

    for (let index = 0; index < events.length; index += 1) {
      const snapshot = snapshots[index];
      if (!snapshot.exists()) continue;
      const { userId: _userId, requestSignature: _requestSignature, createdAt: _createdAt, ...eventData } = snapshot.data();
      const existing = { ...eventData, eventId: snapshot.id };
      if (!isValidProgressionEvent(existing) || signature(existing) !== signature(events[index])) {
        return false;
      }
    }

    for (let index = 0; index < events.length; index += 1) {
      if (snapshots[index].exists()) continue;
      const event = events[index];
      tx.set(refs[index], {
        ...event,
        userId,
        requestSignature: signature(event),
        createdAt: serverTimestamp(),
      });
    }
    return true;
  });
}
