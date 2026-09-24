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
      setInventoryHydratedUser(null);
      setInventorySyncErrorUser(null);
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

  const inventoryHydrated = !inventoryIsProvisional;
  const inventorySyncError =
    Boolean(currentUser) &&
    inventoryIsProvisional &&
    inventorySyncErrorUser === currentUser?.uid;
  const profileHydrated =
    !currentUser || profileHydratedUser === currentUser.uid;

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
    profileHydrated,
    captureInventoryEditBaseline,
  };
}
