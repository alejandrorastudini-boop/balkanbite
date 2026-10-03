import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { PantryItem, Recipe, MealPlanDay, ShoppingItem, UserProfile } from "../types";
import { isLegacyDemoPantryItemId } from "../utils/legacyDemoPantryIds";
import { getStartupCloudSyncState } from "../utils/startupCloudSync";
import { findRemovedDocumentIds, getScopedDocumentId, getSyncedItemKey, selectCanonicalRemoteEntries } from "../utils/cloudCollectionSync";
import { createSignedInProfileDefaults, sanitizeRemoteUserProfile, serializeUserProfileForFirestore } from "../utils/profileSyncBoundary";
import { isStoredRecipeStructurallyValid } from "../utils/storedRecipeValidation";
import { isStoredMealPlanDayStructurallyValid } from "../utils/storedMealPlanValidation";
import { isStoredShoppingItemStructurallyValid } from "../utils/storedShoppingValidation";
import { capturePantryEditIntent, verifyServerInventoryForEdits, type InventoryEditAuthority } from "../utils/pantryEditIntentCapture";
import { submitVerifiedPantryEdit, type VerifiedPantryEditCommandResult } from "../utils/verifiedPantryEditCommand";
import { persistVerifiedInventoryAdjustment, type InventoryAdjustment } from "../utils/inventoryAdjustmentFirestore";
import { persistNewInventoryItems, type InventoryCreationOutcome } from "../utils/inventoryCreationFirestore";
import { isServerConfirmedInventorySnapshot } from "../utils/inventorySnapshotAuthority";
import { persistVerifiedVoiceConsumption, type VerifiedVoiceConsumptionResult, type VerifiedVoiceDeduction } from "../utils/verifiedVoiceConsumptionFirestore";
import { buildPurchaseMutationId, persistPurchasesIntoPantryAtomically, type PurchasePantryTransactionResult } from "../utils/purchasePantryFirestore";
import type { PantryPurchase } from "../utils/purchasePantryMerge";
import { persistConfirmedCookAtomically, type AtomicCookExpectedStock } from "../utils/confirmedCookFirestore";
import type { CookConfirmation } from "../utils/confirmedCookTransaction";
import { persistInventoryClearAtomically } from "../utils/inventoryClearFirestore";
import { clearShoppingItems, createShoppingItem, createShoppingItems, replaceShoppingItem, removeShoppingItem } from "../utils/shoppingMutationFirestore";
import { replaceDerivedCollectionAtomically } from "../utils/derivedCollectionFirestore";
import { replaceUserProfileAtomically } from "../utils/profileMutationFirestore";

export function useFirebaseSync(
  profile: UserProfile,
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>,
  pantry: PantryItem[],
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>,
  recipes: Recipe[],
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>,
  mealPlan: MealPlanDay[],
  setMealPlan: React.Dispatch<React.SetStateAction<MealPlanDay[]>>,
  shoppingList: ShoppingItem[],
  setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>
) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // `loading` remains the internal write gate: profile/collection writes stay
  // blocked until the signed-in user's profile listener has hydrated.
  const [loading, setLoading] = useState(true);
  // UI startup only needs Auth to resolve plus inventory hydration. Profile sync
  // can finish in the background instead of holding a full-screen overlay.
  const [authReady, setAuthReady] = useState(false);
  const [inventoryHydratedUser, setInventoryHydratedUser] = useState<string | null>(null);
  const [inventorySyncErrorUser, setInventorySyncErrorUser] = useState<string | null>(null);
  const [inventoryServerConfirmedUser, setInventoryServerConfirmedUser] = useState<string | null>(null);
  const [profileHydratedUser, setProfileHydratedUser] = useState<string | null>(null);
  const authSessionUserId = useRef<string | null | undefined>(undefined);
  const profileRevision = useRef<number | null>(null);
  const hydratedCollectionUser = useRef<Record<string, string>>({});
  const lastHydratedCollectionJson = useRef<Record<string, string>>({});
  const hydratedCollectionDocumentIds = useRef<Record<string, Set<string>>>({});
  // Read-only verified owner snapshot used by dedicated revision-aware inventory commands.
  // Generic inventory persistence is intentionally retired below.
  const inventoryEditAuthority = useRef<InventoryEditAuthority>({
    status: "unavailable", reason: "unverified-snapshot",
  });
  const inFlightInventoryEdits = useRef<Set<string>>(new Set());
  const inventoryCreationInFlight = useRef(false);
  const inFlightVoiceConsumptions = useRef<Set<string>>(new Set());
  const preparedVoiceConsumptions = useRef<Map<string, {
    expectedStock: Array<{ pantryItemId: string; quantity: number; unit: string; cookRevision: number }>;
    deductions: VerifiedVoiceDeduction[];
  }>>(new Map());
  const inFlightPurchaseApplications = useRef<Set<string>>(new Set());
  const inFlightCookConfirmations = useRef<Set<string>>(new Set());
  const inFlightInventoryClears = useRef<Set<string>>(new Set());
  const preparedInventoryClears = useRef<Map<string, {
    userId: string;
    baseline: Array<{ pantryItemId: string; quantity: number; unit: string; cookRevision: number }>;
  }>>(new Map());
  const preparedCookConfirmations = useRef<Map<string, {
    userId: string;
    confirmation: CookConfirmation;
    expectedStock: AtomicCookExpectedStock[];
    expectedRemaining: Map<string, number>;
  }>>(new Map());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const nextUserId = user?.uid ?? null;
      const previousUserId = authSessionUserId.current;
      const shouldClearCloudBackedLocalState =
        nextUserId !== null ||
        (previousUserId !== undefined && previousUserId !== nextUserId);

      // A new auth session must hydrate remote state before any cloud writes.
      // Clear cloud-backed UI state in the same auth transition so guest or
      // previous-account rows cannot flash as the new account's data.
      hydratedCollectionUser.current = {};
      profileRevision.current = null;
      lastHydratedCollectionJson.current = {};
      hydratedCollectionDocumentIds.current = {};
      inventoryEditAuthority.current = {
        status: "unavailable", reason: "unverified-snapshot",
      };
      inFlightInventoryEdits.current = new Set();
      inventoryCreationInFlight.current = false;
      inFlightVoiceConsumptions.current = new Set();
      preparedVoiceConsumptions.current = new Map();
      inFlightPurchaseApplications.current = new Set();
      inFlightCookConfirmations.current = new Set();
      inFlightInventoryClears.current = new Set();
      preparedInventoryClears.current = new Map();
      preparedCookConfirmations.current = new Map();
      setInventoryHydratedUser(null);
      setInventorySyncErrorUser(null);
      setInventoryServerConfirmedUser(null);
      setProfileHydratedUser(null);

      if (shouldClearCloudBackedLocalState) {
        setRecipes([]);
        setMealPlan([]);
        setShoppingList([]);
      }

      authSessionUserId.current = nextUserId;
      setLoading(user !== null);
      setCurrentUser(user);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Sync Profile. Remote account data replaces the signed-in profile boundary;
  // it is never merged over guest or previous-account state.
  useEffect(() => {
    if (!currentUser) return;
    const userDoc = doc(db, "users", currentUser.uid);

    const unsub = onSnapshot(userDoc, (docSnap) => {
      if (docSnap.exists()) {
        const rawProfile = docSnap.data();
        const observedRevision = rawProfile.profileRevision ?? 0;
        profileRevision.current =
          Number.isInteger(observedRevision) && observedRevision >= 0
            ? observedRevision
            : null;
        const data = sanitizeRemoteUserProfile(rawProfile);
        if (JSON.stringify(data) !== JSON.stringify(profile)) {
          setProfile(data);
        }
      } else {
        const newProfile = createSignedInProfileDefaults(
          currentUser.displayName
        );
        setProfile(newProfile);
        void setDoc(userDoc, {
          ...serializeUserProfileForFirestore(newProfile),
          userId: currentUser.uid,
          profileRevision: 0,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }).catch((error) => {
          console.error("Failed to create user profile:", error);
        });
      }
      setProfileHydratedUser(currentUser.uid);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  // Signed-in profile state is listener-owned. Explicit user edits use the
  // revision-aware command below; never bulk-write arbitrary local profile state.

  const submitProfileReplace = async (expected: UserProfile, next: UserProfile) => {
    const uid = currentUser?.uid;
    const revision = profileRevision.current;
    if (!uid || profileHydratedUser !== uid || revision === null) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return replaceUserProfileAtomically(db, uid, expected, revision, next);
  };

  const { canRenderApp, inventoryIsProvisional } =
    getStartupCloudSyncState(
      authReady,
      currentUser?.uid ?? null,
      inventoryHydratedUser
    );

  // Sync Collection Helper
  const syncCollection = (
    collectionName: string,
    localState: any[],
    setLocalState: React.Dispatch<React.SetStateAction<any[]>>,
    shouldPersistItem: (item: any) => boolean = () => true,
    acceptEmptySnapshot = false,
    shouldAcceptRemoteItem: (item: any) => boolean = () => true
  ) => {
    useEffect(() => {
      if (!currentUser) return;
      const q = query(collection(db, collectionName), where("userId", "==", currentUser.uid));
      let inventoryHydrationTimeout: ReturnType<typeof setTimeout> | null = null;

      if (collectionName === "inventory") {
        inventoryHydrationTimeout = setTimeout(() => {
          if (
            authSessionUserId.current === currentUser.uid &&
            hydratedCollectionUser.current[collectionName] !== currentUser.uid
          ) {
            setInventorySyncErrorUser(currentUser.uid);
          }
        }, 12_000);
      }

      const clearInventoryHydrationTimeout = () => {
        if (inventoryHydrationTimeout !== null) {
          clearTimeout(inventoryHydrationTimeout);
          inventoryHydrationTimeout = null;
        }
      };

      const unsub = onSnapshot(q, { includeMetadataChanges: collectionName === "inventory" }, (snapshot) => {
        if (collectionName === "inventory") {
          const serverConfirmed =
            isServerConfirmedInventorySnapshot(snapshot.metadata) &&
            snapshot.docs.every(snapshotDoc => snapshotDoc.metadata.hasPendingWrites === false);
          setInventoryServerConfirmedUser(serverConfirmed ? currentUser.uid : null);
          inventoryEditAuthority.current = verifyServerInventoryForEdits({
            userId: currentUser.uid,
            fromCache: snapshot.metadata.fromCache,
            hasPendingWrites: snapshot.metadata.hasPendingWrites,
            documents: snapshot.docs.map(snapshotDoc => ({
              documentId: snapshotDoc.id,
              hasPendingWrites: snapshotDoc.metadata.hasPendingWrites,
              data: snapshotDoc.data(),
            })),
          });

          // A latency-compensated or cache-only snapshot may describe a
          // proposed local write. Keep the last committed pantry visible and
          // do not advance hydration/echo guards until the server confirms it.
          if (!serverConfirmed) {
            return;
          }
        }
        const remoteEntries = snapshot.docs
          .map(snapshotDoc => {
            const { userId, ...item } = snapshotDoc.data() as any;
            return { documentId: snapshotDoc.id, item };
          })
          .filter(({ item }) => shouldAcceptRemoteItem(item));

        // Mark hydration before allowing any subsequent local mutation to write to this collection.
        hydratedCollectionUser.current[collectionName] = currentUser.uid;
        if (collectionName === "inventory") {
          clearInventoryHydrationTimeout();
          setInventorySyncErrorUser(null);
          setInventoryHydratedUser(currentUser.uid);
        }

        let itemsWithoutUserId = remoteEntries.map(({ item }) => item);

        if (collectionName !== "inventory") {
          const selected = selectCanonicalRemoteEntries(
            collectionName,
            remoteEntries,
            (logicalId) => getScopedDocumentId(currentUser.uid, logicalId)
          );
          hydratedCollectionDocumentIds.current[collectionName] = new Set(
            selected.trackedDocumentIds
          );

          // Invalid remote rows stay unresolved instead of being assigned an
          // invented identity or being silently deleted by a later local save.
          // If both a legacy and canonical row exist, the canonical row wins.
          itemsWithoutUserId = selected.entries.map(({ item }) => item);
        }

        if (collectionName === "inventory") {
          // Read both legacy global IDs and new user-scoped IDs during the transition.
          // When both exist for the same logical item, the user-scoped document is authoritative.
          const byLogicalId = new Map<string, { documentId: string; item: any }>();
          remoteEntries.forEach(entry => {
            const logicalId = String(entry.item.id || entry.documentId);
            const expectedScopedId = getScopedDocumentId(currentUser.uid, logicalId);
            const existing = byLogicalId.get(logicalId);
            const entryIsScoped = entry.documentId === expectedScopedId;
            const existingIsScoped = existing?.documentId === expectedScopedId;

            if (!existing || (entryIsScoped && !existingIsScoped)) {
              byLogicalId.set(logicalId, entry);
            }
          });

          const activeEntries = Array.from(byLogicalId.values()).filter(
            ({ item }) => item._deleted !== true
          );
          itemsWithoutUserId = activeEntries.map(({ item }) => {
            const { _deleted, deletedAt, ...visibleItem } = item;
            return visibleItem;
          });
        }

        const remoteJson = JSON.stringify(itemsWithoutUserId);
        lastHydratedCollectionJson.current[collectionName] = remoteJson;

        const shouldApplySnapshot = itemsWithoutUserId.length > 0 || acceptEmptySnapshot;
        if (shouldApplySnapshot && remoteJson !== JSON.stringify(localState)) {
          setLocalState(itemsWithoutUserId);
        }
      }, (error) => {
        if (
          collectionName === "inventory" &&
          authSessionUserId.current === currentUser.uid
        ) {
          clearInventoryHydrationTimeout();
          setInventorySyncErrorUser(currentUser.uid);
          setInventoryServerConfirmedUser(null);
          inventoryEditAuthority.current = {
            status: "unavailable", reason: "unverified-snapshot",
          };
        }
        console.error(`Failed to hydrate ${collectionName}:`, error);
      });

      return () => {
        clearInventoryHydrationTimeout();
        unsub();
      };
    }, [currentUser]);

    useEffect(() => {
      // Inventory is intentionally read-only in this generic synchronizer.
      // Every signed-in inventory mutation now has a dedicated authoritative
      // command/transaction path with exact baseline verification. Keeping the
      // legacy local-state bulk writer here would reintroduce a second authority.
      if (
        collectionName === "inventory" ||
        collectionName === "shoppingList" ||
        collectionName === "recipes" ||
        collectionName === "mealPlans" ||
        !currentUser ||
        loading ||
        hydratedCollectionUser.current[collectionName] !== currentUser.uid
      ) {
        return;
      }

      const save = async () => {
        const itemsToPersist = localState.filter(shouldPersistItem);
        const persistableItems = itemsToPersist.filter((item) =>
          Boolean(getSyncedItemKey(collectionName, item))
        );
        const currentCollectionDocumentIds = new Set(
          persistableItems.map((item) =>
            getScopedDocumentId(
              currentUser.uid,
              getSyncedItemKey(collectionName, item)!
            )
          )
        );
        const deletedCollectionDocumentIds = findRemovedDocumentIds(
          hydratedCollectionDocumentIds.current[collectionName] || [],
          currentCollectionDocumentIds
        );

        if (
          persistableItems.length === 0 &&
          deletedCollectionDocumentIds.length === 0
        ) {
          return;
        }

        if (
          deletedCollectionDocumentIds.length === 0 &&
          lastHydratedCollectionJson.current[collectionName] ===
            JSON.stringify(itemsToPersist)
        ) {
          return;
        }

        const batch = writeBatch(db);
        persistableItems.forEach(item => {
          const logicalId = getSyncedItemKey(collectionName, item)!;
          const documentId = getScopedDocumentId(currentUser.uid, logicalId);
          batch.set(
            doc(db, collectionName, documentId),
            { ...item, userId: currentUser.uid },
            { merge: true }
          );
        });
        deletedCollectionDocumentIds.forEach((documentId) => {
          batch.delete(doc(db, collectionName, documentId));
        });
        await batch.commit();
      };
      save();
    }, [localState, currentUser, loading]);
  };

  const isRealPantryItem = (item: PantryItem) => !isLegacyDemoPantryItemId(item.id);

  syncCollection(
    "inventory",
    pantry,
    setPantry,
    isRealPantryItem,
    true,
    isRealPantryItem
  );
  // For authenticated sessions an empty remote collection is authoritative.
  // This prevents guest/previous-account data from leaking into a new account
  // and lets remote deletions propagate back to this device.
  syncCollection(
    "recipes",
    recipes,
    setRecipes,
    () => true,
    true,
    isStoredRecipeStructurallyValid
  );
  syncCollection(
    "mealPlans",
    mealPlan,
    setMealPlan,
    () => true,
    true,
    isStoredMealPlanDayStructurallyValid
  );
  syncCollection(
    "shoppingList",
    shoppingList,
    setShoppingList,
    () => true,
    true,
    isStoredShoppingItemStructurallyValid
  );

  // A capture returns the ORIGINAL server-confirmed lot the user saw,
  // never a newly substituted remote quantity. This is read-only; actual
  // writes must later use the verified transactional inventory writer.
  const captureInventoryEditBaseline = (item: PantryItem) => {
    if (!currentUser || inventoryHydratedUser !== currentUser.uid ||
        authSessionUserId.current !== currentUser.uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return capturePantryEditIntent(inventoryEditAuthority.current, currentUser.uid, item);
  };

  // Signed-in manual +/- and delete use the exact rendered item as the
  // click-time baseline. Do not optimistically set pantry on success: the
  // owner-filtered Firestore listener will supply committed remote state.
  // This narrow path is not a release gate for the remaining bulk writer.
  const submitInventoryEdit = async (
    viewed: PantryItem,
    adjustment: InventoryAdjustment,
  ): Promise<VerifiedPantryEditCommandResult | {
    outcome: "needs-review"; reason: "in-flight" | "unverified-authority";
  }> => {
    const uid = currentUser?.uid;
    if (!uid || inventoryHydratedUser !== uid ||
        authSessionUserId.current !== uid) {
      return { outcome: "needs-review", reason: "unverified-authority" };
    }
    if (inFlightInventoryEdits.current.has(viewed.id)) {
      return { outcome: "needs-review", reason: "in-flight" };
    }
    inFlightInventoryEdits.current.add(viewed.id);
    try {
      return await submitVerifiedPantryEdit({
        authority: inventoryEditAuthority.current,
        viewed,
        adjustment,
        getCurrentUserId: () =>
          typeof authSessionUserId.current === "string"
            ? authSessionUserId.current : null,
        persist: (userId, expected, edit) =>
          persistVerifiedInventoryAdjustment(db, userId, expected, edit),
      });
    } finally {
      inFlightInventoryEdits.current.delete(viewed.id);
    }
  };

  const submitInventoryCreations = async (
    items: readonly PantryItem[],
  ): Promise<InventoryCreationOutcome | {
    outcome: "needs-review"; reason: "unverified-authority" | "in-flight";
  }> => {
    const uid = currentUser?.uid;
    if (!uid || inventoryHydratedUser !== uid ||
        authSessionUserId.current !== uid) {
      return { outcome: "needs-review", reason: "unverified-authority" };
    }
    if (inventoryCreationInFlight.current) {
      return { outcome: "needs-review", reason: "in-flight" };
    }
    inventoryCreationInFlight.current = true;
    try {
      return await persistNewInventoryItems(db, uid, items);
    } finally {
      inventoryCreationInFlight.current = false;
    }
  };

  const submitVoiceInventoryConsumption = async (
    mutationId: string,
    deductions: readonly VerifiedVoiceDeduction[],
  ): Promise<VerifiedVoiceConsumptionResult | {
    outcome: "needs-review";
    reason: "unverified-authority" | "in-flight" | "stale-local-view";
  }> => {
    const uid = currentUser?.uid;
    const authority = inventoryEditAuthority.current;
    if (!uid ||
        inventoryHydratedUser !== uid ||
        inventoryServerConfirmedUser !== uid ||
        authSessionUserId.current !== uid ||
        authority.status !== "verified" ||
        authority.userId !== uid) {
      return { outcome: "needs-review", reason: "unverified-authority" };
    }
    if (inFlightVoiceConsumptions.current.has(mutationId)) {
      return { outcome: "needs-review", reason: "in-flight" };
    }

    let prepared = preparedVoiceConsumptions.current.get(mutationId);
    if (!prepared) {
      const affectedIds = Array.from(new Set(
        (deductions || []).map(item => item.pantryItemId),
      ));
      const expectedStock = [];
      for (const pantryItemId of affectedIds) {
        const observed = authority.observed.find(
          item => item.pantryItemId === pantryItemId,
        );
        const visible = pantry.find(item => item.id === pantryItemId) as
          | (PantryItem & { cookRevision?: number })
          | undefined;
        if (!observed || !visible ||
            visible.quantity !== observed.quantity ||
            visible.unit !== observed.unit ||
            (visible.cookRevision ?? 0) !== observed.cookRevision) {
          return { outcome: "needs-review", reason: "stale-local-view" };
        }
        expectedStock.push({ ...observed });
      }
      prepared = {
        expectedStock,
        deductions: (deductions || []).map(item => ({ ...item })),
      };
      preparedVoiceConsumptions.current.set(mutationId, prepared);
    }

    inFlightVoiceConsumptions.current.add(mutationId);
    try {
      const result = await persistVerifiedVoiceConsumption(db, {
        userId: uid,
        mutationId,
        expectedStock: prepared.expectedStock,
        deductions: prepared.deductions,
      });
      // A definitive result has reached the caller. Success will clear the UI
      // mutation ID; a needs-review retry may safely re-resolve current stock.
      preparedVoiceConsumptions.current.delete(mutationId);
      return result;
    } catch (error) {
      // Keep the exact original baseline/allocation. A transport error may
      // happen after commit; retrying the same mutation must replay, not
      // calculate a second deduction against newly reduced stock.
      throw error;
    } finally {
      inFlightVoiceConsumptions.current.delete(mutationId);
    }
  };

  const submitPurchasePantryApplication = async (
    purchases: readonly PantryPurchase[],
    acquiredAt: string,
    shoppingBaseline: readonly ShoppingItem[] = [],
  ): Promise<PurchasePantryTransactionResult | {
    outcome: "needs-review";
    reason: "unverified-authority" | "in-flight" | "stale-local-view" | "invalid-request";
  }> => {
    const uid = currentUser?.uid;
    const authority = inventoryEditAuthority.current;
    const mutationId = buildPurchaseMutationId(purchases);

    if (!mutationId) {
      return { outcome: "needs-review", reason: "invalid-request" };
    }
    if (!uid ||
        inventoryHydratedUser !== uid ||
        inventoryServerConfirmedUser !== uid ||
        authSessionUserId.current !== uid ||
        authority.status !== "verified" ||
        authority.userId !== uid) {
      return { outcome: "needs-review", reason: "unverified-authority" };
    }
    if (inFlightPurchaseApplications.current.has(mutationId)) {
      return { outcome: "needs-review", reason: "in-flight" };
    }

    if (authority.observed.length !== pantry.length) {
      return { outcome: "needs-review", reason: "stale-local-view" };
    }

    const baselinePantry: Array<PantryItem & { cookRevision?: number }> = [];
    for (const item of pantry) {
      const observed = authority.observed.find(
        candidate => candidate.pantryItemId === item.id,
      );
      const visible = item as PantryItem & { cookRevision?: number };
      if (!observed ||
          visible.quantity !== observed.quantity ||
          visible.unit !== observed.unit ||
          (visible.cookRevision ?? 0) !== observed.cookRevision) {
        return { outcome: "needs-review", reason: "stale-local-view" };
      }
      baselinePantry.push({
        ...item,
        cookRevision: observed.cookRevision,
      });
    }

    inFlightPurchaseApplications.current.add(mutationId);
    try {
      return await persistPurchasesIntoPantryAtomically(db, {
        userId: uid,
        mutationId,
        baselinePantry,
        purchases,
        acquiredAt,
        shoppingBaseline,
      });
    } finally {
      inFlightPurchaseApplications.current.delete(mutationId);
    }
  };

  const submitInventoryClear = async (
    mutationId: string,
    visiblePantry: PantryItem[],
  ): Promise<{ accepted: boolean; reason?: string }> => {
    const uid = currentUser?.uid;
    if (!uid || !mutationId) return { accepted: false, reason: "invalid-request" };

    let prepared = preparedInventoryClears.current.get(mutationId);
    if (prepared && prepared.userId !== uid) {
      preparedInventoryClears.current.delete(mutationId);
      prepared = undefined;
    }

    if (!prepared) {
      const authority = inventoryEditAuthority.current;
      if (inventoryHydratedUser !== uid ||
          inventoryServerConfirmedUser !== uid ||
          authSessionUserId.current !== uid ||
          authority.status !== "verified" ||
          authority.userId !== uid) {
        return { accepted: false, reason: "unverified-authority" };
      }
      if (authority.observed.length === 0 || authority.observed.length !== visiblePantry.length) {
        return { accepted: false, reason: "stale-local-view" };
      }
      for (const visible of visiblePantry) {
        const observed = authority.observed.find(row => row.pantryItemId === visible.id);
        const revision = (visible as PantryItem & { cookRevision?: number }).cookRevision ?? 0;
        if (!observed || observed.quantity !== visible.quantity ||
            observed.unit !== visible.unit || observed.cookRevision !== revision) {
          return { accepted: false, reason: "stale-local-view" };
        }
      }
      prepared = {
        userId: uid,
        baseline: authority.observed.map(row => ({ ...row })),
      };
      preparedInventoryClears.current.set(mutationId, prepared);
    }

    if (inFlightInventoryClears.current.has(mutationId)) {
      return { accepted: false, reason: "in-flight" };
    }
    inFlightInventoryClears.current.add(mutationId);
    try {
      const result = await persistInventoryClearAtomically(db, {
        userId: uid,
        mutationId,
        baseline: prepared.baseline,
      });
      if (result.outcome === "needs-review") {
        preparedInventoryClears.current.delete(mutationId);
        return { accepted: false, reason: result.reason };
      }

      // As with cooking, a transaction response is not enough. Preserve the
      // reviewed request until the owner listener confirms no active stock.
      const authority = inventoryEditAuthority.current;
      if (inventoryServerConfirmedUser !== uid ||
          authority.status !== "verified" ||
          authority.userId !== uid ||
          authority.observed.length !== 0) {
        return { accepted: false, reason: "awaiting-server-confirmation" };
      }

      preparedInventoryClears.current.delete(mutationId);
      return { accepted: true };
    } catch (error) {
      console.error("Atomic pantry clear failed:", error);
      // Commit status can be ambiguous after a transport failure. Keep the
      // exact baseline and immutable mutation id for an idempotent replay.
      return { accepted: false, reason: "transport-uncertain" };
    } finally {
      inFlightInventoryClears.current.delete(mutationId);
    }
  };

  const submitConfirmedCook = async (
    visiblePantry: PantryItem[],
    confirmation: CookConfirmation,
  ): Promise<{ accepted: boolean; issueCount: number }> => {
    const uid = currentUser?.uid;
    const cookId =
      typeof confirmation.cookConfirmationId === "string"
        ? confirmation.cookConfirmationId
        : "";
    if (!uid || !cookId) return { accepted: false, issueCount: 1 };

    let prepared = preparedCookConfirmations.current.get(cookId);
    if (prepared && prepared.userId !== uid) {
      preparedCookConfirmations.current.delete(cookId);
      prepared = undefined;
    }

    if (!prepared) {
      const authority = inventoryEditAuthority.current;
      if (
        inventoryHydratedUser !== uid ||
        inventoryServerConfirmedUser !== uid ||
        authSessionUserId.current !== uid ||
        authority.status !== "verified" ||
        authority.userId !== uid
      ) {
        return { accepted: false, issueCount: 1 };
      }

      const referencedIds = new Set<string>();
      const totals = new Map<string, number>();
      for (const ingredient of confirmation.ingredients) {
        if (
          typeof ingredient.pantryItemId !== "string" ||
          typeof ingredient.quantity !== "number" ||
          !Number.isFinite(ingredient.quantity) ||
          ingredient.quantity <= 0
        ) {
          return { accepted: false, issueCount: 1 };
        }
        referencedIds.add(ingredient.pantryItemId);
        totals.set(
          ingredient.pantryItemId,
          (totals.get(ingredient.pantryItemId) ?? 0) + ingredient.quantity,
        );
      }

      const expectedStock: AtomicCookExpectedStock[] = [];
      const expectedRemaining = new Map<string, number>();
      for (const pantryItemId of referencedIds) {
        const local = visiblePantry.find(item => item.id === pantryItemId);
        const observed = authority.observed.find(
          item => item.pantryItemId === pantryItemId,
        );
        if (
          !local ||
          !observed ||
          local.quantity !== observed.quantity ||
          local.unit !== observed.unit
        ) {
          return { accepted: false, issueCount: 1 };
        }
        const consumed = totals.get(pantryItemId) ?? 0;
        const remaining = Math.round(
          (observed.quantity - consumed + Number.EPSILON) * 1_000_000,
        ) / 1_000_000;
        if (remaining < 0) return { accepted: false, issueCount: 1 };
        expectedStock.push({
          pantryItemId,
          quantity: observed.quantity,
          unit: observed.unit,
          cookRevision: observed.cookRevision,
        });
        expectedRemaining.set(pantryItemId, remaining);
      }

      prepared = { userId: uid, confirmation, expectedStock, expectedRemaining };
      preparedCookConfirmations.current.set(cookId, prepared);
    }

    if (inFlightCookConfirmations.current.has(cookId)) {
      return { accepted: false, issueCount: 1 };
    }

    inFlightCookConfirmations.current.add(cookId);
    try {
      const result = await persistConfirmedCookAtomically(db, {
        userId: uid,
        confirmation: prepared.confirmation,
        expectedStock: prepared.expectedStock,
      });
      if (result.outcome === "needs-review") {
        preparedCookConfirmations.current.delete(cookId);
        return {
          accepted: false,
          issueCount: Math.max(1, result.pendingIngredients.length),
        };
      }

      // A transaction response is not sufficient UI authority. Keep the exact
      // reviewed request for retry until a server-confirmed inventory snapshot
      // exposes every expected remaining lot (or confirms a zero lot absent).
      const authority = inventoryEditAuthority.current;
      if (
        inventoryServerConfirmedUser !== uid ||
        authority.status !== "verified" ||
        authority.userId !== uid
      ) {
        return { accepted: false, issueCount: 1 };
      }
      for (const expected of prepared.expectedStock) {
        const remaining = prepared.expectedRemaining.get(expected.pantryItemId);
        const observed = authority.observed.find(
          item => item.pantryItemId === expected.pantryItemId,
        );
        if (remaining === 0) {
          if (observed) return { accepted: false, issueCount: 1 };
          continue;
        }
        if (
          !observed ||
          observed.quantity !== remaining ||
          observed.unit !== expected.unit ||
          observed.cookRevision !== expected.cookRevision + 1
        ) {
          return { accepted: false, issueCount: 1 };
        }
      }

      preparedCookConfirmations.current.delete(cookId);
      return { accepted: true, issueCount: 0 };
    } catch (error) {
      console.error("Confirmed cook transaction failed:", error);
      // Preserve the exact request: the commit may have succeeded even if the
      // client lost the response. A retry reuses the immutable journal id.
      return { accepted: false, issueCount: 1 };
    } finally {
      inFlightCookConfirmations.current.delete(cookId);
    }
  };

  const submitRecipesReplace = async (expected: Recipe[], next: Recipe[]) => {
    const uid = currentUser?.uid;
    if (!uid || hydratedCollectionUser.current.recipes !== uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return replaceDerivedCollectionAtomically(db, uid, "recipes", expected, next);
  };

  const submitMealPlanReplace = async (expected: MealPlanDay[], next: MealPlanDay[]) => {
    const uid = currentUser?.uid;
    if (!uid || hydratedCollectionUser.current.mealPlans !== uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return replaceDerivedCollectionAtomically(db, uid, "mealPlans", expected, next);
  };

  const submitShoppingItemCreate = async (item: ShoppingItem) => {
    const uid = currentUser?.uid;
    if (!uid || hydratedCollectionUser.current.shoppingList !== uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return createShoppingItem(db, uid, item);
  };

  const submitShoppingItemsCreate = async (items: ShoppingItem[]) => {
    const uid = currentUser?.uid;
    if (!uid || hydratedCollectionUser.current.shoppingList !== uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return createShoppingItems(db, uid, items);
  };

  const submitShoppingItemsClear = async (expectedItems: ShoppingItem[]) => {
    const uid = currentUser?.uid;
    if (!uid || hydratedCollectionUser.current.shoppingList !== uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return clearShoppingItems(db, uid, expectedItems);
  };

  const submitShoppingItemReplace = async (expected: ShoppingItem, next: ShoppingItem) => {
    const uid = currentUser?.uid;
    if (!uid || hydratedCollectionUser.current.shoppingList !== uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return replaceShoppingItem(db, uid, expected, next);
  };

  const submitShoppingItemRemove = async (expected: ShoppingItem) => {
    const uid = currentUser?.uid;
    if (!uid || hydratedCollectionUser.current.shoppingList !== uid) {
      return { outcome: "needs-review" as const, reason: "unverified-authority" as const };
    }
    return removeShoppingItem(db, uid, expected);
  };

  const inventoryHydrated = !inventoryIsProvisional;
  const inventorySyncError =
    Boolean(currentUser) &&
    inventoryIsProvisional &&
    inventorySyncErrorUser === currentUser?.uid;
  const profileHydrated =
    !currentUser || profileHydratedUser === currentUser.uid;
  const inventoryServerConfirmed =
    Boolean(currentUser) && inventoryServerConfirmedUser === currentUser?.uid;

  // Only unresolved Auth blocks the application shell. Inventory authority is
  // surfaced separately so a delayed first snapshot cannot freeze the UI.
  return {
    currentUser,
    // Keep the explicit shell-readiness signal available to App so the startup
    // overlay cannot accidentally be coupled back to inventory hydration.
    canRenderApp,
    loading: !canRenderApp,
    inventoryHydrated,
    inventoryIsProvisional,
    inventorySyncError,
    inventoryServerConfirmed,
    profileHydrated,
    captureInventoryEditBaseline,
    submitInventoryEdit,
    submitInventoryCreations,
    submitVoiceInventoryConsumption,
    submitPurchasePantryApplication,
    submitInventoryClear,
    submitConfirmedCook,
    submitProfileReplace,
    submitRecipesReplace,
    submitMealPlanReplace,
    submitShoppingItemCreate,
    submitShoppingItemsCreate,
    submitShoppingItemsClear,
    submitShoppingItemReplace,
    submitShoppingItemRemove,
  };
}
