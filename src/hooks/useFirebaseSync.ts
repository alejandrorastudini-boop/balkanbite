import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        setLoading(false);
      }
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
    setLocalState: React.Dispatch<React.SetStateAction<any[]>>
  ) => {
    useEffect(() => {
      if (!currentUser) return;
      const q = query(collection(db, collectionName), where("userId", "==", currentUser.uid));
      const unsub = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => doc.data() as any);
        // Remove userId before setting local state
        const itemsWithoutUserId = items.map(({ userId, ...rest }) => rest);
        if (itemsWithoutUserId.length > 0 && JSON.stringify(itemsWithoutUserId) !== JSON.stringify(localState)) {
          setLocalState(itemsWithoutUserId);
        }
      });
      return unsub;
    }, [currentUser]);

    useEffect(() => {
      if (!currentUser || loading) return;
      const save = async () => {
        const batch = writeBatch(db);
        localState.forEach(item => {
          const docRef = doc(db, collectionName, item.id);
          batch.set(docRef, { ...item, userId: currentUser.uid }, { merge: true });
        });
        await batch.commit();
      };
      save();
    }, [localState, currentUser]);
  };

  syncCollection("inventory", pantry, setPantry);
  syncCollection("recipes", recipes, setRecipes);
  syncCollection("mealPlans", mealPlan, setMealPlan);
  syncCollection("shoppingList", shoppingList, setShoppingList);
  
  return { currentUser, loading };
}
