import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  Timestamp
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
import { persistVerifiedPantryClear, type ClearPantryResult, type ClearPantryStockExpectation } from "../utils/inventoryClearFirestore";

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
  const hydratedCollectionUser = useRef<Record<string, string>>({});
  const lastHydratedCollectionJson = useRef<Record<string, string>>({});
  const hydratedCollectionDocumentIds = useRef<Record<string, Set<string>>>({});
  const hydratedInventoryActiveIds = useRef<Set<string>>(new Set());
  // Read-only verified owner snapshot for future revision-aware UI intents.
  // The current legacy bulk inventory writer is deliberately not changed here.
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
  const inFlightPantryClears = useRef<Set<string>>(new Set());
  const preparedPantryClears = useRef<Map<string, ClearPantryStockExpectation[]>>(new Map());

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
      lastHydratedCollectionJson.current = {};
      hydratedCollectionDocumentIds.current = {};
      hydratedInventoryActiveIds.current = new Set();
      inventoryEditAuthority.current = {
        status: "unavailable", reason: "unverified-snapshot",
      };
      inFlightInventoryEdits.current = new Set();
      inventoryCreationInFlight.current = false;
      inFlightVoiceConsumptions.current = new Set();
      preparedVoiceConsumptions.current = new Map();
      inFlightPurchaseApplications.current = new Set();
      inFlightPantryClears.current = new Set();
      preparedPantryClears.current = new Map();
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
        const data = sanitizeRemoteUserProfile(docSnap.data());
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

  // Save profile changes only after this exact account hydrated its own profile.
  useEffect(() => {
    if (
      !currentUser ||
      loading ||
      profileHydratedUser !== currentUser.uid
    ) {
      return;
    }
    const userDoc = doc(db, "users", currentUser.uid);
    void setDoc(userDoc, {
      ...serializeUserProfileForFirestore(profile),
      updatedAt: Timestamp.now()
    }, { merge: true }).catch((error) => {
      console.error("Failed to save user profile:", error);
    });
  }, [profile, currentUser, loading, profileHydratedUser]);

  const { canRenderApp, inventoryIsProvisional, cloudInventoryWritesAllowed } =
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
          hydratedInventoryActiveIds.current = new Set(
            activeEntries.map(({ documentId, item }) => String(item.id || documentId))
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
      if (
        !currentUser ||
        loading ||
        hydratedCollectionUser.current[collectionName] !== currentUser.uid
      ) {
        return;
      }
      const isInventory = collectionName === "inventory";
      if (isInventory && !cloudInventoryWritesAllowed) return;

      const save = async () => {
        const itemsToPersist = localState.filter(shouldPersistItem);
        const persistableItems = itemsToPersist.filter((item) =>
          Boolean(getSyncedItemKey(collectionName, item))
        );
        const currentInventoryIds: Set<string> = isInventory
          ? new Set<string>(
              persistableItems.map((item) => getSyncedItemKey(collectionName, item)!)
            )
          : new Set<string>();
        const hydratedActiveInventoryIds = Array.from(
          hydratedInventoryActiveIds.current.values()
        ) as string[];
        const deletedInventoryIds: string[] = isInventory
          ? hydratedActiveInventoryIds.filter(id => !currentInventoryIds.has(id))
          : [];

        const currentCollectionDocumentIds = !isInventory
          ? new Set(
              persistableItems.map((item) =>
                getScopedDocumentId(
                  currentUser.uid,
                  getSyncedItemKey(collectionName, item)!
                )
              )
            )
          : new Set<string>();
        const deletedCollectionDocumentIds = !isInventory
          ? findRemovedDocumentIds(
              hydratedCollectionDocumentIds.current[collectionName] || [],
              currentCollectionDocumentIds
            )
          : [];

        if (
          !isInventory &&
          persistableItems.length === 0 &&
          deletedCollectionDocumentIds.length === 0
        ) {
          return;
        }
        if (
          isInventory &&
          persistableItems.length === 0 &&
          deletedInventoryIds.length === 0
        ) {
          return;
        }

        // A fresh remote snapshot is already the source of truth. Do not write
        // it back until a real local mutation changes the hydrated state.
        if (
          deletedInventoryIds.length === 0 &&
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
          const docRef = doc(db, collectionName, documentId);
          batch.set(
            docRef,
            isInventory
              ? {
                  ...item,
                  userId: currentUser.uid,
                  _deleted: false,
                  deletedAt: null,
                }
              : { ...item, userId: currentUser.uid },
            { merge: true }
          );
        });

        deletedInventoryIds.forEach((itemId: string) => {
          const docRef = doc(
            db,
            collectionName,
            getScopedDocumentId(currentUser.uid, itemId)
          );
          batch.set(
            docRef,
            {
              id: itemId,
              userId: currentUser.uid,
              _deleted: true,
              deletedAt: Timestamp.now(),
            },
            { merge: true }
          );
        });

        deletedCollectionDocumentIds.forEach((documentId) => {
          batch.delete(doc(db, collectionName, documentId));
        });

        await batch.commit();
      };
      save();
    }, [localState, currentUser, loading, cloudInventoryWritesAllowed]);
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
      });
    } finally {
      inFlightPurchaseApplications.current.delete(mutationId);
    }
  };

  const submitPantryClear = async (
    mutationId: string,
  ): Promise<ClearPantryResult | {
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
    if (inFlightPantryClears.current.has(mutationId)) {
      return { outcome: "needs-review", reason: "in-flight" };
    }

    let expectedStock = preparedPantryClears.current.get(mutationId);
    if (!expectedStock) {
      if (authority.observed.length !== pantry.length) {
        return { outcome: "needs-review", reason: "stale-local-view" };
      }
      expectedStock = [];
      for (const visibleItem of pantry) {
        const observed = authority.observed.find(
          item => item.pantryItemId === visibleItem.id,
        );
        const visible = visibleItem as PantryItem & { cookRevision?: number };
        if (!observed ||
            visible.quantity !== observed.quantity ||
            visible.unit !== observed.unit ||
            (visible.cookRevision ?? 0) !== observed.cookRevision) {
          return { outcome: "needs-review", reason: "stale-local-view" };
        }
        expectedStock.push({ ...observed });
      }
      preparedPantryClears.current.set(
        mutationId,
        expectedStock.map(item => ({ ...item })),
      );
    }

    inFlightPantryClears.current.add(mutationId);
    try {
      const result = await persistVerifiedPantryClear(db, {
        userId: uid,
        mutationId,
        expectedStock,
      });
      if (result.outcome !== "needs-review") {
        preparedPantryClears.current.delete(mutationId);
      } else if (
        result.reason !== "stale-stock" &&
        result.reason !== "missing-stock" &&
        result.reason !== "invalid-stock" &&
        result.reason !== "conflicting-replay"
      ) {
        preparedPantryClears.current.delete(mutationId);
      }
      return result;
    } catch (error) {
      // Preserve the exact reviewed baseline. The transaction may have
      // committed before the client observed a transport error; retrying the
      // same mutation ID must hit the journal instead of clearing a new pantry.
      throw error;
    } finally {
      inFlightPantryClears.current.delete(mutationId);
    }
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
    submitPantryClear,
  };
}
