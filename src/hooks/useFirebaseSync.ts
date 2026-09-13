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
import { INITIAL_PANTRY } from "../data/initialData";

const DEMO_PANTRY_ITEM_IDS = new Set(INITIAL_PANTRY.map(item => item.id));

const getInventoryDocumentId = (userId: string, itemId: string) =>
  `u_${encodeURIComponent(userId)}__${encodeURIComponent(itemId)}`;

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
  const [loading, setLoading] = useState(true);
  const [inventoryHydratedUser, setInventoryHydratedUser] = useState<string | null>(null);
  const hydratedCollectionUser = useRef<Record<string, string>>({});
  const lastHydratedCollectionJson = useRef<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // A new auth session must hydrate the remote state before any cloud writes are allowed.
      hydratedCollectionUser.current = {};
      lastHydratedCollectionJson.current = {};
      setInventoryHydratedUser(null);
      setLoading(user !== null);
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Sync Profile
  useEffect(() => {
    if (!currentUser) return;
    const userDoc = doc(db, "users", currentUser.uid);

    const unsub = onSnapshot(userDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        if (JSON.stringify(data) !== JSON.stringify(profile)) {
          setProfile(prev => ({ ...prev, ...data }));
        }
      } else {
        // Initial profile save
        setDoc(userDoc, {
          ...profile,
          userId: currentUser.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  // Save profile changes
  useEffect(() => {
    if (!currentUser || loading) return;
    const userDoc = doc(db, "users", currentUser.uid);
    setDoc(userDoc, {
      ...profile,
      updatedAt: Timestamp.now()
    }, { merge: true });
  }, [profile, currentUser]);

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
      const unsub = onSnapshot(q, (snapshot) => {
        const remoteEntries = snapshot.docs
          .map(snapshotDoc => {
            const { userId, ...item } = snapshotDoc.data() as any;
            return { documentId: snapshotDoc.id, item };
          })
          .filter(({ item }) => shouldAcceptRemoteItem(item));

        // Mark hydration before allowing any subsequent local mutation to write to this collection.
        hydratedCollectionUser.current[collectionName] = currentUser.uid;
        if (collectionName === "inventory") {
          setInventoryHydratedUser(currentUser.uid);
        }

        let itemsWithoutUserId = remoteEntries.map(({ item }) => item);

        if (collectionName === "inventory") {
          // Read both legacy global IDs and new user-scoped IDs during the transition.
          // When both exist for the same logical item, the user-scoped document is authoritative.
          const byLogicalId = new Map<string, { documentId: string; item: any }>();
          remoteEntries.forEach(entry => {
            const logicalId = String(entry.item.id || entry.documentId);
            const expectedScopedId = getInventoryDocumentId(currentUser.uid, logicalId);
            const existing = byLogicalId.get(logicalId);
            const entryIsScoped = entry.documentId === expectedScopedId;
            const existingIsScoped = existing?.documentId === expectedScopedId;

            if (!existing || (entryIsScoped && !existingIsScoped)) {
              byLogicalId.set(logicalId, entry);
            }
          });
          itemsWithoutUserId = Array.from(byLogicalId.values()).map(({ item }) => item);
        }

        const remoteJson = JSON.stringify(itemsWithoutUserId);
        lastHydratedCollectionJson.current[collectionName] = remoteJson;

        const shouldApplySnapshot = itemsWithoutUserId.length > 0 || acceptEmptySnapshot;
        if (shouldApplySnapshot && remoteJson !== JSON.stringify(localState)) {
          setLocalState(itemsWithoutUserId);
        }
      });
      return unsub;
    }, [currentUser]);

    useEffect(() => {
      if (
        !currentUser ||
        loading ||
        hydratedCollectionUser.current[collectionName] !== currentUser.uid
      ) {
        return;
      }
      const save = async () => {
        const itemsToPersist = localState.filter(shouldPersistItem);
        if (itemsToPersist.length === 0) return;

        // Do not turn a freshly hydrated legacy snapshot into duplicate user-scoped documents.
        // Migration only begins after a real local inventory mutation changes the hydrated state.
        if (
          collectionName === "inventory" &&
          lastHydratedCollectionJson.current[collectionName] === JSON.stringify(itemsToPersist)
        ) {
          return;
        }

        const batch = writeBatch(db);
        itemsToPersist.forEach(item => {
          const documentId =
            collectionName === "inventory"
              ? getInventoryDocumentId(currentUser.uid, String(item.id))
              : String(item.id);
          const docRef = doc(db, collectionName, documentId);
          batch.set(docRef, { ...item, userId: currentUser.uid }, { merge: true });
        });
        await batch.commit();
      };
      save();
    }, [localState, currentUser]);
  };

  const isRealPantryItem = (item: PantryItem) => !DEMO_PANTRY_ITEM_IDS.has(item.id);

  syncCollection(
    "inventory",
    pantry,
    setPantry,
    isRealPantryItem,
    true,
    isRealPantryItem
  );
  syncCollection("recipes", recipes, setRecipes);
  syncCollection("mealPlans", mealPlan, setMealPlan);
  syncCollection("shoppingList", shoppingList, setShoppingList);

  const inventoryHydrated = !currentUser || inventoryHydratedUser === currentUser.uid;

  return {
    currentUser,
    loading: loading || !inventoryHydrated,
    inventoryHydrated,
  };
}
