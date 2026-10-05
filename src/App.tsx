import React, { useState, useEffect, useMemo, useRef } from "react";
import { Header } from "./components/Header";
import { BottomNav, TabType } from "./components/BottomNav";
import { HomeView } from "./components/HomeView";
import { PantryView } from "./components/PantryView";
import { RecipeView } from "./components/RecipeView";
import { VoiceChefView } from "./components/VoiceChefView";
import { ShoppingView } from "./components/ShoppingView";
import { MealPlanView } from "./components/MealPlanView";
import { ProfileView } from "./components/ProfileView";
import { ProModal } from "./components/ProModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { ChefIaFloatingButton } from "./components/ChefIaFloatingButton";
import { ChefIaModal } from "./components/ChefIaModal";
import { LandingPage } from "./components/LandingPage";
import { AuthModal } from "./components/AuthModal";
import { AutoMenuToast } from "./components/AutoMenuToast";
import { SmartShoppingModal } from "./components/SmartShoppingModal";
import { SmartShoppingBanner } from "./components/SmartShoppingBanner";
import { useFirebaseSync } from "./hooks/useFirebaseSync";
import { signInWithGoogle, logout } from "./lib/firebase";
import {
  PantryItem,
  Recipe,
  ShoppingItem,
  UserProfile,
  Language,
  Currency,
  MealPlanDay,
  MealLog,
  ChatMessage,
} from "./types";
import {
  INITIAL_RECIPES,
  SAMPLE_RECIPES,
  DEFAULT_PROFILE,
  DEFAULT_MEAL_PLAN,
} from "./data/initialData";
import { getRecipeImageUrl } from "./utils/recipeImages";
import { adaptMealPlanToPantry, syncMealPlanWithPantry, syncRecipesWithPantry } from "./utils/menuAutoPlanner";
import { evaluateShoppingNeeds } from "./utils/shoppingAdvisor";
import { buildAdvisorBatchFingerprint } from "./utils/advisorShoppingBatch";
import {
  deductRecipeIngredientsFromPantry,
  deductVoiceItemsFromPantry,
  type PantryConsumptionDeduction,
} from "./utils/pantryConsumption";
import { buildRecipeShoppingNeeds } from "./utils/recipeShoppingNeeds";
import type { RecipeCookOutcome } from "./utils/recipeCookFeedback";
import { normalizeCookLotEvidence, type ConfirmedCookLotEvidence } from "./utils/confirmedCookFirestore";
import {
  transferCheckedShoppingItems,
  reconcileConfirmedShoppingPurchases,
  buildConfirmedShoppingReconciliationInput,
  shoppingItemToPurchase,
  type PantryPurchase,
  type PurchaseMergeResult,
  type ShoppingReconciliationResult,
  type RawReconciliationExtraItem,
} from "./utils/purchasePantryMerge";
import { buildPurchaseMutationId } from "./utils/purchasePantryFirestore";
import { arePurchaseSourcesVisible, buildPendingPurchaseCommitEvidence, isPurchaseCommitVisible, type PendingPurchaseCommitEvidence } from "./utils/purchaseCommitEvidence";
import { normalizeVoicePantryItems } from "./utils/safeVoicePantryCapture";
import type { DeterministicRemovalPurpose } from "./utils/deterministicRemovalIntent";
import type { ConfirmedVoiceLotEvidence } from "./utils/voiceLotEvidenceAdapter";
import { reconcileDerivedShortageShoppingItems } from "./utils/derivedShortageShopping";
import { buildConfirmedVoiceShoppingItems } from "./utils/safeVoiceShoppingCapture";
import {
  getUserPantryCacheKey,
  parseUserPantryCache,
} from "./utils/startupPantryCache";
import { loadGuestPantry } from "./utils/guestPantry";
import {
  createSignedInProfileDefaults,
  parseGuestProfileCache,
} from "./utils/profileSyncBoundary";
import { clearBalkanBiteLocalStorage } from "./utils/localDataReset";
import { buildAiCulinaryProfileContext } from "./utils/aiCulinaryProfileContext";
import { parseStoredRecipeCache } from "./utils/storedRecipeValidation";
import { parseStoredMealPlanCache } from "./utils/storedMealPlanValidation";
import { parseStoredShoppingCache } from "./utils/storedShoppingValidation";
import { parseChatMessageCache } from "./utils/chatMessageValidation";
import {
  buildVerifiedMealLog,
  parseMealLogCache,
} from "./utils/verifiedMealLog";
import { hasValidPantryAcquisitionRequiredFields, isValidPantryAcquisitionBatch } from "./utils/pantryAcquisitionValidation";
import { hasValidManualShoppingRequiredFields } from "./utils/manualShoppingValidation";
import { localCalendarDate, shouldMarkExpiryPartialAfterQuantityIncrease } from "./utils/effectiveExpiry";
import { isExpectedInventoryResultVisible } from "./utils/expectedInventoryResult";
import {
  getFoodSafetyQuarantine,
  getFoodSafetyQuarantineMessage,
} from "./utils/foodSafetyQuarantine";
import {
  appendProgressionEvents,
  buildPurchaseProgressEvents,
  buildRecipeCookProgressEvent,
  createProgressionActionId,
  parseProgressionLedgerCache,
  summarizeProgressionActivity,
  type ProgressionLedgerV1,
} from "./utils/progressionLedger";

export default function App() {
  const [pantry, setPantry] = useState<PantryItem[]>(() =>
    loadGuestPantry(localStorage.getItem("balkanbite_pantry"))
  );

  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const list =
      parseStoredRecipeCache(localStorage.getItem("balkanbite_recipes")) ??
      INITIAL_RECIPES;

    return list.map((recipe) => ({
      ...recipe,
      imageUrl: getRecipeImageUrl(recipe),
    }));
  });

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() =>
    parseStoredShoppingCache(localStorage.getItem("balkanbite_shopping")) ?? []
  );
  const committedAdvisorBatchFingerprint = useRef<string | null>(null);

  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>(() =>
    parseStoredMealPlanCache(localStorage.getItem("balkanbite_mealplan")) ??
    DEFAULT_MEAL_PLAN
  );

  const [mealLogs, setMealLogs] = useState<MealLog[]>(() =>
    parseMealLogCache(localStorage.getItem("balkanbite_meallogs"))
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    parseChatMessageCache(localStorage.getItem("balkanbite_chat_messages"))
  );

  const [progressionLedger, setProgressionLedger] = useState<ProgressionLedgerV1>(
    () => parseProgressionLedgerCache(localStorage.getItem("balkanbite_progression"))
  );

  const progressionSummary = useMemo(
    () => summarizeProgressionActivity(progressionLedger),
    [progressionLedger]
  );

  const [profile, setProfile] = useState<UserProfile>(() =>
    parseGuestProfileCache(localStorage.getItem("balkanbite_profile")) ??
    DEFAULT_PROFILE
  );

  const {
    currentUser,
    loading: firebaseLoading,
    inventoryHydrated,
    inventoryIsProvisional,
    inventorySyncError,
    canRenderApp,
    inventoryServerConfirmed,
    profileHydrated,
    submitInventoryEdit,
    submitInventoryCreations,
    submitVoiceInventoryConsumption,
    submitPurchasePantryApplication,
    submitInventoryClear,
    submitConfirmedCook,
    submitMealLog,
    submitProgressionEvents,
    submitProfileReplace,
    submitRecipesReplace,
    submitMealPlanReplace,
    submitDerivedShortageReconciliation,
    submitShoppingItemCreate,
    submitShoppingItemsCreate,
    submitShoppingItemsClear,
    submitShoppingItemReplace,
    submitShoppingItemRemove,
  } = useFirebaseSync(
    profile,
    setProfile,
    pantry,
    setPantry,
    recipes,
    setRecipes,
    mealPlan,
    setMealPlan,
    shoppingList,
    setShoppingList,
    setMealLogs,
    setProgressionLedger
  );

  const [pantryScope, setPantryScope] = useState<string>("guest");
  const [profileScope, setProfileScope] = useState<string>("guest");
  const [workspaceScope, setWorkspaceScope] = useState<string>("guest");
  const pendingSignedInCreations = useRef<{ userId: string; ids: Set<string> } | null>(null);
  const pendingSignedInVoiceConsumptions = useRef<Map<string, {
    userId: string;
    expectedRemaining: Record<string, number | null>;
  }>>(new Map());
  const preparedSignedInVoiceDeductions = useRef<Map<string, {
    userId: string;
    deductions: PantryConsumptionDeduction[];
    purpose: DeterministicRemovalPurpose;
    lotEvidence?: readonly ConfirmedVoiceLotEvidence[];
    expectedRemaining: Record<string, number | null>;
  }>>(new Map());
  const pendingSignedInPurchaseApplication = useRef<PendingPurchaseCommitEvidence | null>(null);
  const preparedSignedInCooks = useRef<Map<string, {
    userId: string;
    recipeId: string;
    occurredAt: string;
    result: ReturnType<typeof deductRecipeIngredientsFromPantry>;
    lotEvidence?: readonly ConfirmedCookLotEvidence[];
    confirmation: {
      cookConfirmationId: string;
      mealId: string;
      confirmed: true;
      ingredients: Array<{
        ingredientId: string;
        pantryItemId: string;
        quantity: number;
        unit: string;
      }>;
    };
  }>>(new Map());
  const pendingSignedInDerivedReconciliations = useRef<Map<string, {
    userId: string;
    expectedRemaining: Record<string, number | null>;
  }>>(new Map());
  const preparedSignedInReconciliations = useRef<Map<string, {
    userId: string;
    reviewFingerprint: string;
    purchases: PantryPurchase[];
    preview: ShoppingReconciliationResult;
    occurredAt: string;
    acquiredAt: string;
    shoppingBaseline: ShoppingItem[];
  }>>(new Map());
  useEffect(() => {
    preparedSignedInCooks.current.clear();
    pendingSignedInDerivedReconciliations.current.clear();
  }, [currentUser?.uid]);

  const handleProfileUpdate = async (update: Partial<UserProfile>) => {
    const next = { ...profile, ...update };
    if (!currentUser) {
      setProfile(next);
      return true;
    }
    if (!profileHydrated) return false;
    const result = await submitProfileReplace(profile, next);
    return result.outcome !== "needs-review";
  };

  const handleProfilePreferenceUpdate = async (update: Partial<UserProfile>) => {
    try {
      const saved = await handleProfileUpdate(update);
      if (!saved) {
        alert(
          profile.language === "bg"
            ? "Промяната не беше запазена. Опитайте отново след синхронизация."
            : profile.language === "es"
            ? "El cambio no se ha guardado. Inténtalo de nuevo cuando termine la sincronización."
            : "The change was not saved. Try again after synchronization finishes."
        );
      }
    } catch (error) {
      console.error("Profile preference update failed:", error);
      alert(
        profile.language === "bg"
          ? "Не успяхме да потвърдим промяната. Проверете синхронизирания профил и опитайте отново."
          : profile.language === "es"
          ? "No se pudo confirmar el cambio. Revisa el perfil sincronizado e inténtalo de nuevo."
          : "The change could not be confirmed. Review the synchronized profile and try again."
      );
    }
  };

  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [showProModal, setShowProModal] = useState<boolean>(false);
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(false);
  const [voiceSearchQuery, setVoiceSearchQuery] = useState<string>("");
  const [isResetting, setIsResetting] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("balkanbite_theme");
      return (saved as "dark" | "light") || "dark";
    } catch {
      return "dark";
    }
  });
  const [showChefIaModal, setShowChefIaModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [showShoppingAdvisorModal, setShowShoppingAdvisorModal] = useState<boolean>(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState<boolean>(() => {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    );
  });
  const [autoMenuToast, setAutoMenuToast] = useState<{
    isVisible: boolean;
    readyMealsCount: number;
  }>({
    isVisible: false,
    readyMealsCount: 0,
  });

  const foodSafetyQuarantine = getFoodSafetyQuarantine(profile);

  const adaptMealPlanSafelyToPantry = (
    updatedPantry: PantryItem[],
    syncedRecipes: Recipe[],
    existingPlan: MealPlanDay[],
    profileForAdaptation: UserProfile = profile,
  ) => {
    if (
      (currentUser && !profileHydrated) ||
      foodSafetyQuarantine.status !== "clear"
    ) {
      // An unhydrated signed-in profile or unresolved legacy allergy/restriction
      // data must never trigger automatic meal replacement. Availability flags
      // may still be refreshed safely.
      return syncMealPlanWithPantry(existingPlan, updatedPantry);
    }
    return adaptMealPlanToPantry(
      updatedPantry,
      syncedRecipes,
      existingPlan,
      profileForAdaptation,
    );
  };

  const requireFoodRecommendationSafetyReview = (): boolean => {
    if (currentUser && !profileHydrated) {
      alert(
        profile.language === "bg"
          ? "Изчакайте профилът ви да се синхронизира, преди да генерирате или пренареждате храна."
          : profile.language === "es"
          ? "Espera a que tu perfil se sincronice antes de generar o reorganizar comida."
          : "Wait for your profile to sync before generating or rearranging food.",
      );
      return false;
    }
    if (foodSafetyQuarantine.status === "clear") return true;

    alert(getFoodSafetyQuarantineMessage(profile.language));
    setActiveTab("profile");
    return false;
  };
  const [showLanding, setShowLanding] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("balkanbite_show_landing");
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("balkanbite_show_landing", String(showLanding));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [showLanding]);

  useEffect(() => {
    try {
      localStorage.setItem("balkanbite_theme", theme);
      document.documentElement.setAttribute("data-theme", theme);
      document.body.setAttribute("data-theme", theme);
      if (theme === "light") {
        document.body.classList.remove("bg-[#0B0F12]", "bg-stone-900", "text-stone-100");
        document.body.classList.add("bg-[#F4F6F8]", "text-slate-900");
      } else {
        document.body.classList.remove("bg-[#F4F6F8]", "text-slate-900");
        document.body.classList.add("bg-[#0B0F12]", "text-stone-100");
      }
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [theme]);

  useEffect(() => {
    if (isResetting) return;

    if (currentUser) {
      if (!inventoryHydrated && pantryScope !== currentUser.uid) {
        // Never carry the guest or a previous user's pantry into a signed-in
        // session. A user-scoped local cache is provisional only: Firestore
        // remains authoritative and cloud writes stay closed until hydration.
        try {
          const cachedUserPantry = parseUserPantryCache(
            localStorage.getItem(getUserPantryCacheKey(currentUser.uid))
          );
          setPantry(cachedUserPantry ?? []);
        } catch {
          setPantry([]);
        }
        setPantryScope(currentUser.uid);
        return;
      }

      if (inventoryHydrated && pantryScope !== currentUser.uid) {
        setPantryScope(currentUser.uid);
      }
      return;
    }

    if (firebaseLoading || pantryScope === "guest") return;

    setPantry(loadGuestPantry(localStorage.getItem("balkanbite_pantry")));
    setPantryScope("guest");
  }, [currentUser, firebaseLoading, inventoryHydrated, pantryScope, isResetting]);

  useEffect(() => {
    if (isResetting) return;

    if (currentUser) {
      if (workspaceScope === currentUser.uid) return;

      // Signed-in meal history is hydrated from the owner-scoped Firestore listener.
      // Never promote a device-local meal cache into authenticated authority.
      setMealLogs([]);
      // Authenticated Chef IA chat can contain health, allergy and food-history
      // context. Keep it session-only until a deliberate encrypted/server-backed
      // chat-history product is designed; never promote legacy local cache.
      try {
        localStorage.removeItem(`balkanbite_chat_messages_user_${currentUser.uid}`);
      } catch (error) {
        console.warn("Legacy signed-in chat cache cleanup failed", error);
      }
      setChatMessages([]);
      // Signed-in progression evidence is hydrated from Firestore only.
      setProgressionLedger([]);
      setWorkspaceScope(currentUser.uid);
      return;
    }

    if (firebaseLoading || workspaceScope === "guest") return;

    const guestRecipes =
      parseStoredRecipeCache(localStorage.getItem("balkanbite_recipes")) ??
      INITIAL_RECIPES;
    setRecipes(
      guestRecipes.map((recipe) => ({
        ...recipe,
        imageUrl: getRecipeImageUrl(recipe),
      }))
    );
    setShoppingList(
      parseStoredShoppingCache(localStorage.getItem("balkanbite_shopping")) ?? []
    );
    setMealPlan(
      parseStoredMealPlanCache(localStorage.getItem("balkanbite_mealplan")) ??
        DEFAULT_MEAL_PLAN
    );
    setMealLogs(
      parseMealLogCache(localStorage.getItem("balkanbite_meallogs"))
    );
    setChatMessages(
      parseChatMessageCache(localStorage.getItem("balkanbite_chat_messages"))
    );
    setProgressionLedger(
      parseProgressionLedgerCache(localStorage.getItem("balkanbite_progression"))
    );
    setWorkspaceScope("guest");
  }, [
    currentUser,
    firebaseLoading,
    workspaceScope,
    isResetting,
  ]);

  useEffect(() => {
    if (isResetting) return;

    try {
      if (currentUser) {
        if (!inventoryHydrated || pantryScope !== currentUser.uid) return;
        localStorage.setItem(
          getUserPantryCacheKey(currentUser.uid),
          JSON.stringify(pantry)
        );
        return;
      }

      if (pantryScope !== "guest") return;
      localStorage.setItem("balkanbite_pantry", JSON.stringify(pantry));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [pantry, currentUser, inventoryHydrated, pantryScope, isResetting]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest") return;
    try {
      localStorage.setItem("balkanbite_recipes", JSON.stringify(recipes));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [recipes, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest") return;
    try {
      localStorage.setItem("balkanbite_shopping", JSON.stringify(shoppingList));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [shoppingList, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting) return;

    if (currentUser) {
      if (!profileHydrated && profileScope !== currentUser.uid) {
        // Never cache authenticated profile/health data in localStorage.
        // Remove the legacy per-user cache left by older builds, then use
        // neutral non-sensitive defaults until the owner listener hydrates.
        try {
          localStorage.removeItem(`balkanbite_profile_user_${currentUser.uid}`);
        } catch (error) {
          console.warn("Legacy signed-in profile cache cleanup failed", error);
        }
        setProfile(createSignedInProfileDefaults(currentUser.displayName));
        setProfileScope(currentUser.uid);
        return;
      }

      if (profileHydrated && profileScope !== currentUser.uid) {
        setProfileScope(currentUser.uid);
      }
      return;
    }

    if (firebaseLoading || profileScope === "guest") return;

    setProfile(
      parseGuestProfileCache(localStorage.getItem("balkanbite_profile")) ??
        DEFAULT_PROFILE
    );
    setProfileScope("guest");
  }, [
    currentUser,
    firebaseLoading,
    profileHydrated,
    profileScope,
    isResetting,
  ]);

  useEffect(() => {
    if (isResetting || currentUser || profileScope !== "guest") return;
    try {
      localStorage.setItem("balkanbite_profile", JSON.stringify(profile));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [profile, currentUser, profileScope, isResetting]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest") return;
    try {
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(mealPlan));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [mealPlan, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest") return;
    try {
      localStorage.setItem("balkanbite_meallogs", JSON.stringify(mealLogs));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [mealLogs, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest") return;
    try {
      localStorage.setItem(
        "balkanbite_chat_messages",
        JSON.stringify(chatMessages)
      );
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [chatMessages, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest") return;
    try {
      localStorage.setItem(
        "balkanbite_progression",
        JSON.stringify(progressionLedger)
      );
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [progressionLedger, currentUser, workspaceScope, isResetting]);

  const appendLocalProgressionEvents = (events: readonly unknown[]) => {
    if (events.length === 0) return;
    const expectedScope = currentUser?.uid ?? "guest";
    if (workspaceScope !== expectedScope) return;

    if (currentUser) {
      const validEvents = appendProgressionEvents([], events).ledger;
      if (validEvents.length === 0) return;
      void submitProgressionEvents(validEvents);
      return;
    }

    setProgressionLedger((current) =>
      appendProgressionEvents(current, events).ledger
    );
  };

  const requireAuthoritativeInventory = () => {
    if (!inventoryIsProvisional) return true;

    alert(
      profile.language === "bg"
        ? "Изчакайте първото синхронизиране на наличностите, преди да ги променяте или да създавате препоръки от тях."
        : profile.language === "es"
        ? "Espera a la primera sincronización de la despensa antes de modificarla o generar recomendaciones basadas en ella."
        : "Wait for the first pantry sync before editing it or generating pantry-based recommendations."
    );
    return false;
  };

  const handleOpenShoppingAdvisor = () => {
    if (!requireAuthoritativeInventory()) return;
    setShowShoppingAdvisorModal(true);
  };

  const reconcileGuestPantryDerivedState = (
    updatedPantry: PantryItem[],
    showToast = true,
  ) => {
    const syncedRecipes = syncRecipesWithPantry(recipes, updatedPantry);
    setRecipes(syncedRecipes);

    const { newPlan, readyToCookMealsCount } = adaptMealPlanSafelyToPantry(
      updatedPantry,
      syncedRecipes,
      mealPlan,
      profile
    );
    setMealPlan(newPlan);

    setShoppingList(current => {
      const nextShoppingDiagnostic = evaluateShoppingNeeds(
        updatedPantry, newPlan, current, profile.language,
      );
      return reconcileDerivedShortageShoppingItems(
        current,
        nextShoppingDiagnostic.itemsToAddToShoppingList,
      ).next;
    });

    if (showToast) {
      setAutoMenuToast({
        isVisible: true,
        readyMealsCount: readyToCookMealsCount,
      });
    }
  };

  // Signed-in stock commands may commit before their initiating promise
  // settles. Register exact expected stock before dispatch, then propagate
  // recipe/meal-plan availability only when the owner listener exposes that
  // result in a server-confirmed snapshot.
  useEffect(() => {
    if (pendingSignedInDerivedReconciliations.current.size === 0) return;
    if (!currentUser) {
      pendingSignedInDerivedReconciliations.current.clear();
      return;
    }
    if (!inventoryHydrated || !inventoryServerConfirmed) return;

    let matched = false;
    for (const [key, pending] of pendingSignedInDerivedReconciliations.current) {
      if (pending.userId !== currentUser.uid) {
        pendingSignedInDerivedReconciliations.current.delete(key);
        continue;
      }
      if (!isExpectedInventoryResultVisible(pending.expectedRemaining, pantry)) continue;
      pendingSignedInDerivedReconciliations.current.delete(key);
      matched = true;
    }
    if (matched) {
      const syncedRecipes = syncRecipesWithPantry(recipes, pantry);
      const { newPlan, readyToCookMealsCount } = syncMealPlanWithPantry(
        mealPlan,
        pantry,
      );
      void (async () => {
        const recipeResult = await submitRecipesReplace(recipes, syncedRecipes);
        if (recipeResult.outcome === "needs-review") return;
        const mealResult = await submitMealPlanReplace(mealPlan, newPlan);
        if (mealResult.outcome === "needs-review") return;
        setAutoMenuToast({
          isVisible: true,
          readyMealsCount: readyToCookMealsCount,
        });
      })();
    }
  }, [pantry, currentUser, inventoryHydrated, inventoryServerConfirmed]);

  const updatePantryAndReconcileMenu = (
    newPantryItemsToAdd: PantryItem[],
    showToast = true
  ): boolean => {
    if (!requireAuthoritativeInventory()) return false;

    setPantry((prevPantry) => {
      const updatedPantry = [...newPantryItemsToAdd, ...prevPantry];
      reconcileGuestPantryDerivedState(updatedPantry, showToast);
      return updatedPantry;
    });
    return true;
  };

  const finalizeSignedInPurchaseIfVisible = (
    committedPantry: PantryItem[],
  ): boolean => {
    const pending = pendingSignedInPurchaseApplication.current;
    if (!pending) return false;
    if (!currentUser || pending.userId !== currentUser.uid) {
      pendingSignedInPurchaseApplication.current = null;
      return false;
    }
    if (!inventoryHydrated || !inventoryServerConfirmed) return false;
    if (!isPurchaseCommitVisible(pending, currentUser.uid, committedPantry)) {
      return false;
    }

    pendingSignedInPurchaseApplication.current = null;
    // Shopping rows were retired in the same authoritative purchase transaction.
    // The owner listener is the only signed-in source allowed to remove them locally.
    if (pending.newlyAppliedSourceIds.length > 0) {
      appendLocalProgressionEvents(
        buildPurchaseProgressEvents({
          occurredAt: pending.occurredAt,
          newlyAppliedSourceIds: pending.newlyAppliedSourceIds,
        }),
      );
      // Preserve the existing purchase UX, but only after stock + provenance
      // are visible in a server-confirmed pantry snapshot.
      const syncedRecipes = syncRecipesWithPantry(recipes, committedPantry);
      const { newPlan, readyToCookMealsCount } = adaptMealPlanSafelyToPantry(
        committedPantry,
        syncedRecipes,
        mealPlan,
        profile,
      );
      void (async () => {
        const recipeResult = await submitRecipesReplace(recipes, syncedRecipes);
        if (recipeResult.outcome === "needs-review") return;
        const mealResult = await submitMealPlanReplace(mealPlan, newPlan);
        if (mealResult.outcome === "needs-review") return;
        setAutoMenuToast({ isVisible: true, readyMealsCount: readyToCookMealsCount });
      })();
    }
    return true;
  };

  useEffect(() => {
    finalizeSignedInPurchaseIfVisible(pantry);
  }, [pantry, currentUser, inventoryHydrated, inventoryServerConfirmed]);

  const dispatchSignedInPurchaseApplication = async (
    purchases: PantryPurchase[],
    preview: PurchaseMergeResult,
    occurredAt: string,
    acquiredAt: string,
    shoppingBaseline: ShoppingItem[] = [],
  ): Promise<"accepted" | "retry-pending" | "rejected"> => {
    const uid = currentUser?.uid;
    const mutationId = buildPurchaseMutationId(purchases);
    const evidence =
      uid && mutationId
        ? buildPendingPurchaseCommitEvidence(
            uid,
            mutationId,
            occurredAt,
            preview,
          )
        : null;

    if (!uid || !mutationId || !evidence) {
      console.warn(
        "Signed-in purchase rejected before persistence: invalid reviewed evidence",
      );
      return "rejected";
    }

    const pending = pendingSignedInPurchaseApplication.current;
    if (pending && pending.mutationId !== mutationId) {
      alert(
        profile.language === "bg"
          ? "Изчакайте текущото прехвърляне на покупката да приключи."
          : profile.language === "es"
          ? "Espera a que termine la transferencia de compra actual."
          : "Wait for the current purchase transfer to finish.",
      );
      return "rejected";
    }
    pendingSignedInPurchaseApplication.current = evidence;

    try {
      const persisted = await submitPurchasePantryApplication(
        purchases,
        acquiredAt,
        shoppingBaseline,
      );

      if (persisted.outcome === "needs-review") {
        const preservePending =
          persisted.reason === "in-flight" ||
          persisted.reason === "unverified-authority";
        if (!preservePending) {
          pendingSignedInPurchaseApplication.current = null;
        }
        console.warn(
          "Signed-in purchase application needs review:",
          persisted.reason,
        );
        if (!preservePending) {
          alert(
            profile.language === "bg"
              ? "Покупката не беше приложена. Синхронизирайте наличностите и прегледайте покупката преди нов опит."
              : profile.language === "es"
              ? "La compra no se aplicó. Sincroniza la despensa y revisa la compra antes de intentarlo de nuevo."
              : "The purchase was not applied. Sync your pantry and review the purchase before retrying.",
          );
        }
        return preservePending ? "retry-pending" : "rejected";
      }

      const sameAccepted =
        JSON.stringify([...persisted.acceptedSourceIds].sort()) ===
        JSON.stringify([...evidence.acceptedSourceIds].sort());
      if (!sameAccepted) {
        pendingSignedInPurchaseApplication.current = null;
        console.error(
          "Purchase transaction accepted sources did not match reviewed evidence",
        );
        return "rejected";
      }

      if (persisted.outcome === "already-applied") {
        if (!arePurchaseSourcesVisible(evidence.acceptedSourceIds, pantry)) {
          pendingSignedInPurchaseApplication.current = null;
          console.error(
            "Purchase replay claimed already-applied without unique source history",
          );
          return "rejected";
        }
        pendingSignedInPurchaseApplication.current = null;
        // Historical source proof is enough to close a replay. The shopping
        // listener already owns visibility of rows deleted by the transaction. Do not create a
        // new progression event because this call did not newly apply stock.
        const syncedRecipes = syncRecipesWithPantry(recipes, pantry);
        const { newPlan, readyToCookMealsCount } = adaptMealPlanSafelyToPantry(
          pantry, syncedRecipes, mealPlan, profile,
        );
        const recipeResult = await submitRecipesReplace(recipes, syncedRecipes);
        if (recipeResult.outcome === "needs-review") return "retry-pending";
        const mealResult = await submitMealPlanReplace(mealPlan, newPlan);
        if (mealResult.outcome === "needs-review") return "retry-pending";
        setAutoMenuToast({ isVisible: true, readyMealsCount: readyToCookMealsCount });
        return "accepted";
      }

      const sameNew =
        JSON.stringify([...persisted.newlyAppliedSourceIds].sort()) ===
        JSON.stringify([...evidence.newlyAppliedSourceIds].sort());
      if (!sameNew) {
        pendingSignedInPurchaseApplication.current = null;
        console.error(
          "Purchase transaction newly-applied sources did not match reviewed evidence",
        );
        return "rejected";
      }

      // The listener may already have delivered the committed pantry before
      // this promise resolves; otherwise the server-confirmed effect finishes.
      finalizeSignedInPurchaseIfVisible(pantry);
      return "accepted";
    } catch (error) {
      // Keep exact reviewed evidence. Firestore may have committed before the
      // transport error reached the client; replay uses the same source IDs.
      console.error("Signed-in purchase confirmation failed:", error);
      alert(
        profile.language === "bg"
          ? "Не успяхме да потвърдим покупката. Прегледът е запазен за безопасен повторен опит."
          : profile.language === "es"
          ? "No pudimos confirmar la compra. La revisión se conserva para reintentar de forma segura."
          : "We could not confirm the purchase. Your review is preserved for a safe retry.",
      );
      return "retry-pending";
    }
  };

  // Signed-in creation never mutates pantry optimistically. Remember the exact
  // IDs before dispatch so the owner Firestore snapshot can prove the batch is
  // visible before recipes/menu are reconciled against the committed pantry.
  useEffect(() => {
    const pending = pendingSignedInCreations.current;
    if (!pending) return;
    if (!currentUser || pending.userId !== currentUser.uid) {
      pendingSignedInCreations.current = null;
      return;
    }
    if (!inventoryHydrated || !inventoryServerConfirmed) return;
    const visibleIds = new Set(pantry.map(item => item.id));
    if (![...pending.ids].every(id => visibleIds.has(id))) return;

    pendingSignedInCreations.current = null;
    const syncedRecipes = syncRecipesWithPantry(recipes, pantry);
    const { newPlan, readyToCookMealsCount } = adaptMealPlanSafelyToPantry(
      pantry, syncedRecipes, mealPlan, profile,
    );
    void (async () => {
      const recipeResult = await submitRecipesReplace(recipes, syncedRecipes);
      if (recipeResult.outcome === "needs-review") return;
      const mealResult = await submitMealPlanReplace(mealPlan, newPlan);
      if (mealResult.outcome === "needs-review") return;
      setAutoMenuToast({ isVisible: true, readyMealsCount: readyToCookMealsCount });
    })();
  }, [pantry, currentUser, inventoryHydrated, inventoryServerConfirmed]);

  // A voice deduction is reconciled only after the exact resulting quantities
  // are visible in a server-confirmed pantry snapshot. Pending/cache snapshots
  // cannot trigger derived recipe or meal-plan claims.
  useEffect(() => {
    if (pendingSignedInVoiceConsumptions.current.size === 0) return;
    if (!currentUser) {
      pendingSignedInVoiceConsumptions.current.clear();
      return;
    }
    if (!inventoryHydrated || !inventoryServerConfirmed) return;

    const visible = new Map(pantry.map(item => [item.id, item.quantity]));
    let matchedCommittedConsumption = false;
    for (const [mutationId, pending] of pendingSignedInVoiceConsumptions.current) {
      if (pending.userId !== currentUser.uid) {
        pendingSignedInVoiceConsumptions.current.delete(mutationId);
        continue;
      }
      const matches = Object.entries(pending.expectedRemaining).every(
        ([itemId, expectedQuantity]) =>
          expectedQuantity === null
            ? !visible.has(itemId)
            : visible.get(itemId) === expectedQuantity,
      );
      if (!matches) continue;
      pendingSignedInVoiceConsumptions.current.delete(mutationId);
      matchedCommittedConsumption = true;
    }

    if (matchedCommittedConsumption) {
      const syncedRecipes = syncRecipesWithPantry(recipes, pantry);
      const { newPlan, readyToCookMealsCount } = syncMealPlanWithPantry(
        mealPlan, pantry,
      );
      void (async () => {
        const recipeResult = await submitRecipesReplace(recipes, syncedRecipes);
        if (recipeResult.outcome === "needs-review") return;
        const mealResult = await submitMealPlanReplace(mealPlan, newPlan);
        if (mealResult.outcome === "needs-review") return;
        setAutoMenuToast({ isVisible: true, readyMealsCount: readyToCookMealsCount });
      })();
    }
  }, [pantry, currentUser, inventoryHydrated, inventoryServerConfirmed]);

  const dispatchSignedInPantryCreations = async (
    items: PantryItem[],
  ): Promise<boolean> => {
    const uid = currentUser?.uid;
    if (!uid || items.length === 0) return false;
    if (pendingSignedInCreations.current) {
      alert(
        profile.language === "bg"
          ? "Изчакайте текущото добавяне да приключи."
          : profile.language === "es"
          ? "Espera a que termine el alta actual."
          : "Wait for the current pantry addition to finish."
      );
      return false;
    }

    const ids = new Set(items.map(item => item.id));
    pendingSignedInCreations.current = { userId: uid, ids };

    try {
      const result = await submitInventoryCreations(items);
      if (result.outcome === "created") return true;
      pendingSignedInCreations.current = null;
      if (result.reason !== "in-flight") {
        console.warn("Signed-in pantry creation needs review:", result.reason);
        alert(
          profile.language === "bg"
            ? "Продуктите не бяха добавени. Проверете текущите наличности и опитайте отново."
            : profile.language === "es"
            ? "No se añadieron los alimentos. Revisa la despensa actual e inténtalo de nuevo."
            : "The pantry items were not added. Review current stock and try again."
        );
      }
      return false;
    } catch (error) {
      pendingSignedInCreations.current = null;
      console.error("Signed-in pantry creation failed:", error);
      alert(
        profile.language === "bg"
          ? "Не успяхме да добавим продуктите. Наличностите не са променени."
          : profile.language === "es"
          ? "No se pudieron añadir los alimentos. No hemos modificado las existencias."
          : "The pantry items could not be added. Your stock has not been changed."
      );
      return false;
    }
  };

  const shoppingDiagnostic = useMemo(() => {
    return evaluateShoppingNeeds(pantry, mealPlan, shoppingList, profile.language);
  }, [pantry, mealPlan, shoppingList, profile.language]);

  const derivedShortageReconcileFingerprint = useMemo(
    () => buildAdvisorBatchFingerprint(shoppingDiagnostic.itemsToAddToShoppingList),
    [shoppingDiagnostic.itemsToAddToShoppingList],
  );

  useEffect(() => {
    if (!currentUser || inventoryIsProvisional || !inventoryServerConfirmed) return;
    // The hook rejects this command until the shopping listener has hydrated,
    // so startup cannot reconcile against an assumed-empty remote list.
    void submitDerivedShortageReconciliation(
      shoppingDiagnostic.itemsToAddToShoppingList,
    ).then(result => {
      if (result.outcome === "needs-review" &&
          result.reason !== "unverified-authority" &&
          result.reason !== "stale-derived-baseline") {
        console.warn("Derived shortage reconciliation needs review:", result.reason);
      }
    }).catch(error => {
      // Derived shopping is advisory state. Never claim success or mutate local
      // rows after an ambiguous transport failure; the owner listener remains
      // the only signed-in source of visible shopping state.
      console.error("Derived shortage reconciliation failed:", error);
    });
  }, [
    currentUser?.uid,
    inventoryIsProvisional,
    inventoryServerConfirmed,
    derivedShortageReconcileFingerprint,
  ]);

  useEffect(() => {
    const currentFingerprint = buildAdvisorBatchFingerprint(
      shoppingDiagnostic.itemsToAddToShoppingList,
    );
    if (
      committedAdvisorBatchFingerprint.current &&
      currentFingerprint !== committedAdvisorBatchFingerprint.current
    ) {
      committedAdvisorBatchFingerprint.current = null;
    }
  }, [shoppingDiagnostic.itemsToAddToShoppingList]);

  const handleRequestBrowserNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          setHasNotificationPermission(true);
          new Notification(
            "BalkanBite - " +
              (profile.language === "es"
                ? "Avisos de Compra Activados"
                : profile.language === "bg"
                ? "Известията за пазар са активни"
                : "Shopping Alerts Active"),
            {
              body:
                profile.language === "es"
                  ? "Te avisaremos automáticamente cuando falten ingredientes para tus menús o despensa."
                  : profile.language === "bg"
                  ? "Ще ви уведомяваме, когато липсват съставки за менюто или килера."
                  : "We will notify you when ingredients are low or needed for planned meals.",
              icon: "/images/logo.jpg",
            }
          );
        }
      } catch (e) {
        console.warn("Notification permission request error", e);
      }
    }
  };

  useEffect(() => {
    if (inventoryIsProvisional) return;

    if (
      hasNotificationPermission &&
      shoppingDiagnostic.urgencyLevel === "urgent" &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      const lastNotifyKey = "balkanbite_last_shopping_notif";
      const lastTime = localStorage.getItem(lastNotifyKey);
      const now = Date.now();
      if (!lastTime || now - Number(lastTime) > 4 * 60 * 60 * 1000) {
        try {
          new Notification(
            profile.language === "es"
              ? "🛒 BalkanBite - ¡Aviso de Compra Hoy!"
              : profile.language === "bg"
              ? "🛒 BalkanBite - Време за пазар днес!"
              : "🛒 BalkanBite - Shopping Needed Today!",
            {
              body:
                shoppingDiagnostic.headline[profile.language] ||
                (profile.language === "es"
                  ? "Faltan ingredientes para tus próximas comidas planificadas."
                  : "Missing ingredients for scheduled meals."),
              icon: "/images/logo.jpg",
            }
          );
          localStorage.setItem(lastNotifyKey, String(now));
        } catch (e) {
          console.warn("Notification trigger error", e);
        }
      }
    }
  }, [shoppingDiagnostic, hasNotificationPermission, profile.language, inventoryIsProvisional]);

  const handleAddMultipleShoppingItems = async (
    items: Array<Omit<ShoppingItem, "id" | "checked">>
  ): Promise<boolean> => {
    if (items.length === 0) return false;
    const fingerprint = buildAdvisorBatchFingerprint(items);
    if (committedAdvisorBatchFingerprint.current === fingerprint) {
      return true;
    }
    const newItems: ShoppingItem[] = items.map((item, idx) => ({
      ...item,
      id: `s-advisor-${Date.now()}-${idx}`,
      checked: false,
      amountOrigin: "deterministic_shortfall",
      purchaseAmountConfirmed: false,
    }));
    if (!currentUser) {
      setShoppingList(prev => [...newItems, ...prev]);
      committedAdvisorBatchFingerprint.current = fingerprint;
      return true;
    }
    try {
      const result = await submitShoppingItemsCreate(newItems);
      if (result.outcome === "needs-review") {
        console.warn("Advisor shopping batch needs review:", result.reason);
        return false;
      }
      committedAdvisorBatchFingerprint.current = fingerprint;
      return true;
    } catch (error) {
      console.error("Advisor shopping batch failed:", error);
      return false;
    }
  };

  const handleAdaptMenuToPantry = async () => {
    if (!requireAuthoritativeInventory()) return false;
    if (!requireFoodRecommendationSafetyReview()) return false;
    const syncedRecipes = syncRecipesWithPantry(recipes, pantry);
    const { newPlan, readyToCookMealsCount } = adaptMealPlanSafelyToPantry(
      pantry,
      syncedRecipes,
      mealPlan,
      profile
    );
    if (!currentUser) {
      setRecipes(syncedRecipes);
      setMealPlan(newPlan);
    } else {
      const recipeResult = await submitRecipesReplace(recipes, syncedRecipes);
      if (recipeResult.outcome === "needs-review") return false;
      const mealResult = await submitMealPlanReplace(mealPlan, newPlan);
      if (mealResult.outcome === "needs-review") return false;
    }
    setAutoMenuToast({
      isVisible: true,
      readyMealsCount: readyToCookMealsCount,
    });
    return true;
  };

  const handleAddPantryItem = async (item: Omit<PantryItem, "id" | "addedAt">): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;

    // Manual pantry persistence requires explicit identity + amount.
    // Optional category, cost, and expiry remain unknown when blank.
    if (!hasValidPantryAcquisitionRequiredFields(item)) return false;

    const addedAt = localCalendarDate();
    if (!addedAt) return false;
    const newItem: PantryItem = {
      ...item,
      id: `p-${Date.now()}`,
      addedAt,
    };
    if (currentUser) {
      return dispatchSignedInPantryCreations([newItem]);
    }
    updatePantryAndReconcileMenu([newItem], true);
    return true;
  };

  const handleAddMultiplePantryItems = async (items: Array<Omit<PantryItem, "id" | "addedAt">>): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;
    if (!isValidPantryAcquisitionBatch(items)) return false;

    const acquiredAt = localCalendarDate();
    if (!acquiredAt) return false;
    const newItems: PantryItem[] = items.map((item, idx) => ({
      ...item,
      id: `p-${Date.now()}-${idx}`,
      addedAt: acquiredAt,
    }));
    if (currentUser) {
      return dispatchSignedInPantryCreations(newItems);
    }
    updatePantryAndReconcileMenu(newItems, true);
    return true;
  };

  // The signed-in manual +/- and delete path NEVER optimistically changes
  // local pantry. Firestore onSnapshot alone supplies the committed result;
  // a conflict or offline failure must not masquerade as a successful edit.
  // Other legacy inventory writers are NOT yet coordinated: no release.
  const dispatchVerifiedPantryChange = (viewed: PantryItem, next: number | "remove") => {
    const uid = currentUser?.uid;
    if (!uid) return;
    const reconciliationKey = `manual:${viewed.id}`;
    pendingSignedInDerivedReconciliations.current.set(reconciliationKey, {
      userId: uid,
      expectedRemaining: { [viewed.id]: next === "remove" ? null : next },
    });
    void submitInventoryEdit(
      viewed,
      next === "remove"
        ? { kind: "remove" }
        : { kind: "set-quantity", quantity: next },
    ).then(result => {
      if (result.outcome !== "needs-review") return;
      if (result.reason !== "in-flight") {
        pendingSignedInDerivedReconciliations.current.delete(reconciliationKey);
      }
      if (result.reason === "no-change" || result.reason === "in-flight") return;
      console.warn("Manual pantry edit needs review:", result.reason);
      alert(
        profile.language === "bg"
          ? "Промяната не е запазена. Проверете текущите наличности и опитайте отново."
          : profile.language === "es"
          ? "El cambio no se ha guardado. Revisa las existencias actuales e inténtalo de nuevo."
          : "The change was not saved. Review your current stock and try again."
      );
    }).catch(error => {
      // A transport failure can be ambiguous after commit. Keep reconciliation
      // evidence so a later server-confirmed snapshot can still propagate it.
      console.error("Verified manual pantry edit failed:", error);
      alert(
        profile.language === "bg"
          ? "Не успяхме да потвърдим резултата от промяната. Проверете синхронизираните наличности, преди да опитате отново."
          : profile.language === "es"
          ? "No se pudo confirmar el resultado del cambio. Revisa las existencias sincronizadas antes de intentarlo de nuevo."
          : "The result of the change could not be confirmed. Review the synchronized stock before trying again."
      );
    });
  };

  const handleUpdatePantryQuantity = (
    id: string, newQty: number, viewed: PantryItem,
  ) => {
    if (!requireAuthoritativeInventory()) return;
    if (viewed.id !== id || !Number.isFinite(newQty)) return;
    if (newQty <= 0) {
      handleDeletePantryItem(id, viewed);
      return;
    }
    if (currentUser) {
      dispatchVerifiedPantryChange(viewed, newQty);
      return;
    }
    setPantry((prev) => {
      const updatedPantry = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: newQty,
              lotState: { version: 1, unallocatedQuantity: newQty, activeLots: [] },
              estimatedCostEUR: null,
              ...(shouldMarkExpiryPartialAfterQuantityIncrease(
                item.quantity,
                newQty,
                item.expiryDaysLeft,
              )
                ? { expiryIsPartial: true }
                : {}),
            }
          : item,
      );
      reconcileGuestPantryDerivedState(updatedPantry);
      return updatedPantry;
    });
  };

  const handleDeletePantryItem = (id: string, viewed: PantryItem) => {
    if (!requireAuthoritativeInventory()) return;
    if (viewed.id !== id) return;
    if (currentUser) {
      dispatchVerifiedPantryChange(viewed, "remove");
      return;
    }
    setPantry((prev) => {
      const updatedPantry = prev.filter((item) => item.id !== id);
      reconcileGuestPantryDerivedState(updatedPantry);
      return updatedPantry;
    });
  };

  const handleClearPantry = async (mutationId: string): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;
    if (!currentUser) {
      setPantry([]);
      return true;
    }
    pendingSignedInDerivedReconciliations.current.set(`clear:${mutationId}`, {
      userId: currentUser.uid,
      expectedRemaining: Object.fromEntries(pantry.map(item => [item.id, null])),
    });
    const result = await submitInventoryClear(mutationId, pantry);
    if (result.accepted) return true;
    if (result.reason !== "awaiting-server-confirmation" &&
        result.reason !== "in-flight" &&
        result.reason !== "transport-uncertain") {
      pendingSignedInDerivedReconciliations.current.delete(`clear:${mutationId}`);
    }
    if (result.reason !== "awaiting-server-confirmation" &&
        result.reason !== "in-flight" &&
        result.reason !== "transport-uncertain") {
      console.warn("Signed-in pantry Clear-All needs review:", result.reason);
    }
    return false;
  };

  const handleClearRecipes = async () => {
    if (!currentUser) {
      setRecipes([]);
      return true;
    }
    const result = await submitRecipesReplace(recipes, []);
    return result.outcome !== "needs-review";
  };

  const handleClearMealPlan = async () => {
    if (!currentUser) {
      setMealPlan([]);
      return true;
    }
    const result = await submitMealPlanReplace(mealPlan, []);
    return result.outcome !== "needs-review";
  };

  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const handleGenerateAiWeekPlan = async () => {
    if (!requireAuthoritativeInventory()) return;
    if (!requireFoodRecommendationSafetyReview()) return;
    setIsGeneratingPlan(true);
    try {
      const res = await fetch("/api/ai/generate-weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantry,
          recipes,
          profile: buildAiCulinaryProfileContext(profile),
          foodSafety: foodSafetyQuarantine,
          language: profile.language,
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.mealPlan) || data.mealPlan.length === 0) {
        throw new Error(data?.error || "Weekly meal-plan generation returned no usable plan");
      }
      const { newPlan } = syncMealPlanWithPantry(data.mealPlan, pantry);
      if (!currentUser) {
        setMealPlan(newPlan);
      } else {
        const persisted = await submitMealPlanReplace(mealPlan, newPlan);
        if (persisted.outcome === "needs-review") {
          throw new Error("Weekly meal-plan persistence needs review");
        }
      }
    } catch (err) {
      console.error("Failed to generate AI weekly menu; existing plan left unchanged:", err);
      alert(
        profile.language === "bg"
          ? "Не успях да генерирам нов седмичен план. Текущият план не е променен."
          : profile.language === "es"
          ? "No se pudo generar un nuevo plan semanal. El plan actual no se ha modificado."
          : "A new weekly plan could not be generated. Your current plan was left unchanged."
      );
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleResetApp = () => {
    setIsResetting(true);
    setTimeout(() => {
      clearBalkanBiteLocalStorage(localStorage);
      window.location.href = window.location.origin + window.location.pathname;
    }, 100);
  };

  const handleCookRecipe = async (
    recipe: Recipe,
    cookConfirmationId: string,
    lotEvidence?: readonly ConfirmedCookLotEvidence[],
  ): Promise<RecipeCookOutcome> => {
    if (!requireAuthoritativeInventory()) {
      return { success: false, issueCount: 1 };
    }

    // Guest cooking remains local. Signed-in cooking is prepared once per
    // reviewed confirmation id so retries never recalculate against stock that
    // may already have been committed remotely.
    if (!currentUser) {
      const occurredAt = new Date().toISOString();
      const result = deductRecipeIngredientsFromPantry(
        pantry,
        recipe.ingredients || [],
      );
      if (result.issues.length > 0) {
        return { success: false, issueCount: result.issues.length };
      }
      setPantry(result.pantry);
      reconcileGuestPantryDerivedState(result.pantry);
      const actionId = createProgressionActionId(
        typeof globalThis.crypto?.randomUUID === "function"
          ? () => globalThis.crypto.randomUUID()
          : undefined,
      );
      if (actionId) {
        const event = buildRecipeCookProgressEvent({ actionId, occurredAt, result });
        if (event) appendLocalProgressionEvents([event]);
      }
      return { success: true };
    }

    let prepared = preparedSignedInCooks.current.get(cookConfirmationId);
    if (
      prepared &&
      (prepared.userId !== currentUser.uid || prepared.recipeId !== recipe.id)
    ) {
      return { success: false, issueCount: 1 };
    }
    if (prepared) {
      const expectedIds = new Set<string>(
        prepared.confirmation.ingredients.map(item => item.pantryItemId),
      );
      const frozenEvidence = normalizeCookLotEvidence(prepared.lotEvidence, expectedIds);
      const replayEvidence = normalizeCookLotEvidence(lotEvidence, expectedIds);
      if (
        frozenEvidence === null ||
        replayEvidence === null ||
        JSON.stringify(frozenEvidence) !== JSON.stringify(replayEvidence)
      ) {
        return { success: false, issueCount: 1 };
      }
    }

    if (!prepared) {
      const result = deductRecipeIngredientsFromPantry(
        pantry,
        recipe.ingredients || [],
      );
      if (result.issues.length > 0 || result.deductions.length === 0) {
        return {
          success: false,
          issueCount: Math.max(1, result.issues.length),
        };
      }
      const expectedIds = new Set<string>(
        result.deductions.map(item => item.pantryItemId),
      );
      if (normalizeCookLotEvidence(lotEvidence, expectedIds) === null) {
        return { success: false, issueCount: 1 };
      }
      prepared = {
        userId: currentUser.uid,
        recipeId: recipe.id,
        occurredAt: new Date().toISOString(),
        result,
        lotEvidence,
        confirmation: {
          cookConfirmationId,
          mealId: recipe.id,
          confirmed: true,
          ingredients: result.deductions.map((deduction, index) => ({
            ingredientId: `allocation-${index + 1}`,
            pantryItemId: deduction.pantryItemId,
            quantity: deduction.consumedQuantity,
            unit: deduction.unit,
          })),
        },
      };
      preparedSignedInCooks.current.set(cookConfirmationId, prepared);
    }

    const remainingById = new Map(prepared.result.pantry.map(item => [item.id, item.quantity]));
    const affectedIds = new Set(prepared.result.deductions.map(item => item.pantryItemId));
    pendingSignedInDerivedReconciliations.current.set(`cook:${cookConfirmationId}`, {
      userId: currentUser.uid,
      expectedRemaining: Object.fromEntries(
        [...affectedIds].map(itemId => [
          itemId,
          remainingById.has(itemId) ? remainingById.get(itemId)! : null,
        ]),
      ),
    });

    const committed = await submitConfirmedCook(pantry, prepared.confirmation, prepared.lotEvidence);
    if (!committed.accepted) {
      return { success: false, issueCount: committed.issueCount };
    }

    // No signed-in setPantry here. The inventory listener has already exposed
    // the exact server-confirmed result before submitConfirmedCook accepts.
    preparedSignedInCooks.current.delete(cookConfirmationId);
    // The reviewed confirmation ID is stable across transport retries, so the
    // progression event must derive from it rather than a fresh random UUID.
    const event = buildRecipeCookProgressEvent({
      actionId: cookConfirmationId,
      occurredAt: prepared.occurredAt,
      result: prepared.result,
    });
    if (event) appendLocalProgressionEvents([event]);
    return { success: true };
  };

  const handleAddMissingToShopping = async (recipe: Recipe): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;
    const { items, unverified } = buildRecipeShoppingNeeds(
      recipe,
      pantry,
      shoppingList
    );

    const recipeTitle =
      profile.language === "bg"
        ? recipe.title.bg || recipe.title.en
        : profile.language === "es"
        ? recipe.title.es || recipe.title.en
        : recipe.title.en;

    const newShoppingItems: ShoppingItem[] = items.map((item, idx) => ({
      ...item,
      id: `shop-${Date.now()}-${idx}`,
      checked: false,
      amountOrigin: "deterministic_shortfall",
      purchaseAmountConfirmed: false,
      reason:
        profile.language === "bg"
          ? `Необходимо за ${recipeTitle}`
          : profile.language === "es"
          ? `Necesario para ${recipeTitle}`
          : `Needed for ${recipeTitle}`,
    }));

    if (newShoppingItems.length > 0) {
      if (!currentUser) {
        setShoppingList(prev => [...prev, ...newShoppingItems]);
      } else {
        try {
          const result = await submitShoppingItemsCreate(newShoppingItems);
          if (result.outcome === "needs-review") {
            console.warn("Recipe shopping batch needs review:", result.reason);
            alert(
              profile.language === "bg"
                ? "Не успях да потвърдя добавянето към списъка. Опитайте отново."
                : profile.language === "es"
                ? "No he podido confirmar que se añadiera a la lista. Inténtalo de nuevo."
                : "I could not confirm the shopping-list update. Try again."
            );
            return false;
          }
        } catch (error) {
          console.error("Recipe shopping batch failed:", error);
          alert(
            profile.language === "bg"
              ? "Не успях да запазя липсващите продукти. Опитайте отново."
              : profile.language === "es"
              ? "No he podido guardar los faltantes. Inténtalo de nuevo."
              : "I could not save the missing items. Try again."
          );
          return false;
        }
      }
    }

    if (unverified.length > 0) {
      alert(
        profile.language === "bg"
          ? `Не добавих автоматично ${unverified.length} съставка(и), защото наличните мерни единици не могат да се сравнят надеждно.`
          : profile.language === "es"
          ? `No he añadido automáticamente ${unverified.length} ingrediente(s) porque las unidades disponibles no se pueden comparar de forma segura.`
          : `I did not automatically add ${unverified.length} ingredient(s) because the available units cannot be safely compared.`
      );
      return true;
    }

    if (newShoppingItems.length === 0) {
      alert(
        profile.language === "bg"
          ? "Вече имате достатъчно количество в килера или в списъка за пазаруване."
          : profile.language === "es"
          ? "Ya tienes cantidad suficiente en la despensa o pendiente en la lista de compra."
          : "You already have enough quantity in the pantry or pending on the shopping list."
      );
      return true;
    }

    alert(
      profile.language === "bg"
        ? `Добавихте ${newShoppingItems.length} проверени липсващи съставки към списъка за пазаруване!`
        : profile.language === "es"
        ? `¡Añadiste ${newShoppingItems.length} faltante(s) cuantitativo(s) verificado(s) a tu lista de compra!`
        : `Added ${newShoppingItems.length} verified quantitative shortfall(s) to your shopping list!`
    );
    return true;
  };

  const handleGenerateAiRecipes = async (queryText?: string) => {
    if (!requireAuthoritativeInventory()) return;
    if (!requireFoodRecommendationSafetyReview()) return;
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/ai/generate-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantry,
          profile: buildAiCulinaryProfileContext(profile),
          foodSafety: foodSafetyQuarantine,
          query: queryText || voiceSearchQuery,
          language: profile.language,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Recipe generation failed");
      }
      if (Array.isArray(data.recipes) && data.recipes.length > 0) {
        const synced = syncRecipesWithPantry(data.recipes, pantry);
        const enriched = synced.map((r: Recipe) => ({
          ...r,
          imageUrl: getRecipeImageUrl(r),
        }));
        if (!currentUser) {
          setRecipes(enriched);
        } else {
          const persisted = await submitRecipesReplace(recipes, enriched);
          if (persisted.outcome === "needs-review") {
            throw new Error("Recipe persistence needs review");
          }
        }
      }
    } catch (err) {
      console.error("Failed to generate recipes:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleToggleShoppingItem = async (id: string): Promise<boolean> => {
    const expected = shoppingList.find(item => item.id === id);
    if (!expected) return false;
    const checked = !expected.checked;
    const next = {
      ...expected,
      checked,
      // Checking is the explicit human confirmation that the exact
      // quantity/unit displayed on the row was actually purchased.
      purchaseAmountConfirmed: checked,
    };
    if (!currentUser) {
      setShoppingList(prev => prev.map(item => item.id === id ? next : item));
      return true;
    }
    try {
      const result = await submitShoppingItemReplace(expected, next);
      if (result.outcome === "needs-review") {
        console.warn("Shopping toggle needs review:", result.reason);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Shopping toggle failed:", error);
      return false;
    }
  };

  const handleDeleteShoppingItem = async (id: string): Promise<boolean> => {
    const expected = shoppingList.find(item => item.id === id);
    if (!expected) return false;
    if (!currentUser) {
      setShoppingList(prev => prev.filter(item => item.id !== id));
      return true;
    }
    try {
      const result = await submitShoppingItemRemove(expected);
      if (result.outcome === "needs-review") {
        console.warn("Shopping delete needs review:", result.reason);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Shopping delete failed:", error);
      return false;
    }
  };

  const handleAddShoppingItem = async (
    item: Omit<ShoppingItem, "id" | "checked">
  ): Promise<boolean> => {
    if (!hasValidManualShoppingRequiredFields(item)) {
      console.warn(
        "Manual shopping item rejected because name, quantity or unit was not explicitly valid."
      );
      return false;
    }

    const newItem: ShoppingItem = {
      ...item,
      name: item.name.trim(),
      unit: item.unit.trim(),
      // Blank category means unclassified; do not infer a food category.
      category:
        typeof item.category === "string" ? item.category.trim() : "",
      id: `shop-${Date.now()}`,
      checked: false,
      amountOrigin: "user_entered",
      purchaseAmountConfirmed: false,
    };
    if (!currentUser) {
      setShoppingList(prev => [...prev, newItem]);
      return true;
    }
    try {
      const result = await submitShoppingItemCreate(newItem);
      if (result.outcome === "needs-review") {
        console.warn("Shopping item creation needs review:", result.reason);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Shopping item creation failed:", error);
      return false;
    }
  };

  const handleClearShoppingList = async (): Promise<boolean> => {
    if (shoppingList.length === 0) return true;
    if (!currentUser) {
      setShoppingList([]);
      return true;
    }
    try {
      const result = await submitShoppingItemsClear(shoppingList);
      if (result.outcome === "needs-review") {
        console.warn("Shopping clear needs review:", result.reason);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Shopping clear failed:", error);
      return false;
    }
  };

  const handleTransferToPantry = async () => {
    if (!requireAuthoritativeInventory()) return;
    const checkedItems = shoppingList.filter(item => item.checked);
    if (checkedItems.length === 0) return;

    const occurredAt = new Date().toISOString();
    const acquiredAt = localCalendarDate(new Date(occurredAt));
    if (!acquiredAt) return;
    const preview = transferCheckedShoppingItems(
      pantry,
      shoppingList,
      acquiredAt,
    );

    if (preview.acceptedSourceIds.length > 0) {
      if (!currentUser) {
        setPantry(preview.pantry);
        reconcileGuestPantryDerivedState(preview.pantry, true);
        setShoppingList(preview.shoppingList);
        appendLocalProgressionEvents(
          buildPurchaseProgressEvents({
            occurredAt,
            newlyAppliedSourceIds: preview.newlyAppliedSourceIds,
          }),
        );
      } else {
        const acceptedPreviewSources = new Set(preview.acceptedSourceIds);
        const purchases = checkedItems
          .filter(item => item.purchaseAmountConfirmed === true)
          .map(shoppingItemToPurchase)
          .filter(purchase => acceptedPreviewSources.has(purchase.sourceId));
        await dispatchSignedInPurchaseApplication(
          purchases,
          preview,
          occurredAt,
          acquiredAt,
          checkedItems.filter(item =>
            acceptedPreviewSources.has(`shopping:${item.id}`)
          ),
        );
      }
    }

    if (preview.rejected.length > 0) {
      const hasUnconfirmedAmount = preview.rejected.some(
        item => item.reason === "unconfirmed_amount",
      );
      alert(
        hasUnconfirmedAmount
          ? profile.language === "bg"
            ? "Някои вече отбелязани продукти са от по-стара версия или нямат потвърдено купено количество. Махнете отметката и я поставете отново само ако показаното количество и мерна единица съвпадат с реално купеното."
            : profile.language === "es"
            ? "Algunos artículos ya marcados son antiguos o no tienen la cantidad comprada confirmada. Desmárcalos y vuelve a marcarlos solo si la cantidad y unidad mostradas coinciden con lo que compraste."
            : "Some already-checked items are historical or do not have a confirmed purchased amount. Uncheck and check them again only if the shown quantity and unit match what you actually bought."
          : profile.language === "bg"
          ? "Някои продукти остават в списъка: проверете името, количеството и мерната единица."
          : profile.language === "es"
          ? "Algunos artículos siguen en la lista: revisa su nombre, cantidad y unidad antes de transferirlos."
          : "Some items remain on the list: check their name, quantity and unit before transferring.",
      );
    }
  };

  const handleReconcileShopping = async ({
    purchasedItemIds,
    itemsToAddToPantry,
    reconciliationId,
  }: {
    purchasedItemIds: string[];
    itemsToAddToPantry: RawReconciliationExtraItem[];
    reconciliationId?: string;
  }): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;

    const safeReconciliationId =
      typeof reconciliationId === "string" ? reconciliationId.trim() : "";
    const reviewFingerprint = JSON.stringify({
      purchasedItemIds: Array.from(
        new Set(
          (purchasedItemIds || []).filter(
            (id): id is string =>
              typeof id === "string" && Boolean(id.trim()),
          ),
        ),
      ).sort(),
      extras: (itemsToAddToPantry || []).map(item => ({
        name: typeof item?.name === "string" ? item.name.trim() : null,
        nameBg: typeof item?.nameBg === "string" ? item.nameBg.trim() : null,
        nameEs: typeof item?.nameEs === "string" ? item.nameEs.trim() : null,
        quantity:
          typeof item?.quantity === "number" && Number.isFinite(item.quantity)
            ? item.quantity
            : null,
        unit: typeof item?.unit === "string" ? item.unit.trim() : null,
        category:
          typeof item?.category === "string" ? item.category.trim() : null,
      })),
    });

    let prepared =
      currentUser && safeReconciliationId
        ? preparedSignedInReconciliations.current.get(safeReconciliationId)
        : undefined;

    if (prepared && prepared.userId !== currentUser?.uid) {
      preparedSignedInReconciliations.current.delete(safeReconciliationId);
      prepared = undefined;
    }

    if (prepared && prepared.reviewFingerprint !== reviewFingerprint) {
      alert(
        profile.language === "bg"
          ? "Предишният опит все още се потвърждава. Не променяйте прегледа, докато синхронизацията не приключи."
          : profile.language === "es"
          ? "El intento anterior sigue pendiente de confirmación. No cambies la revisión hasta que termine la sincronización."
          : "The previous attempt is still awaiting confirmation. Do not change the review until sync finishes.",
      );
      return false;
    }

    if (!prepared) {
      const occurredAt = new Date().toISOString();
      const acquiredAt = localCalendarDate(new Date(occurredAt));
      if (!acquiredAt) return false;
      const input = buildConfirmedShoppingReconciliationInput(
        shoppingList,
        purchasedItemIds || [],
        itemsToAddToPantry || [],
        safeReconciliationId,
      );
      const preview = reconcileConfirmedShoppingPurchases(
        pantry,
        shoppingList,
        purchasedItemIds || [],
        itemsToAddToPantry || [],
        acquiredAt,
        safeReconciliationId,
      );
      const accepted = new Set(preview.acceptedSourceIds);
      const purchases = input.purchases.filter(
        purchase => accepted.has(purchase.sourceId),
      );

      const shoppingBaseline = shoppingList.filter(item =>
        accepted.has(`shopping:${item.id}`)
      );
      prepared = {
        userId: currentUser?.uid ?? "guest",
        reviewFingerprint,
        purchases,
        preview,
        occurredAt,
        acquiredAt,
        shoppingBaseline,
      };

      if (currentUser && safeReconciliationId && purchases.length > 0) {
        preparedSignedInReconciliations.current.set(
          safeReconciliationId,
          prepared,
        );
      }
    }

    const { preview } = prepared;
    const hasReviewIssues =
      preview.unresolvedPurchasedItemIds.length > 0 ||
      preview.rejectedExtraItems.length > 0 ||
      preview.rejected.length > 0;

    const showReviewIssues = () => {
      if (!hasReviewIssues) return;
      alert(
        profile.language === "es"
          ? "Algunos datos no se guardaron porque no tenían una cantidad/unidad verificable o ya no coincidían con tu lista. Revisa la compra antes de intentarlo de nuevo."
          : profile.language === "bg"
          ? "Някои данни не бяха запазени, защото количеството/мерната единица не могат да се потвърдят или вече не съвпадат със списъка."
          : "Some data was not saved because quantity/unit could not be verified or the item no longer matched your shopping list.",
      );
    };

    if (preview.acceptedSourceIds.length === 0 || prepared.purchases.length === 0) {
      if (safeReconciliationId) {
        preparedSignedInReconciliations.current.delete(safeReconciliationId);
      }
      showReviewIssues();
      return false;
    }

    if (!currentUser) {
      setPantry(preview.pantry);
      reconcileGuestPantryDerivedState(preview.pantry, true);
      setShoppingList(preview.shoppingList);
      appendLocalProgressionEvents(
        buildPurchaseProgressEvents({
          occurredAt: prepared.occurredAt,
          newlyAppliedSourceIds: preview.newlyAppliedSourceIds,
        }),
      );
      showReviewIssues();
      return true;
    }

    if (!safeReconciliationId) {
      console.warn(
        "Signed-in reviewed shopping reconciliation missing stable reconciliation ID",
      );
      return false;
    }

    const outcome = await dispatchSignedInPurchaseApplication(
      prepared.purchases,
      preview,
      prepared.occurredAt,
      prepared.acquiredAt,
      prepared.shoppingBaseline,
    );

    if (outcome === "accepted") {
      preparedSignedInReconciliations.current.delete(safeReconciliationId);
      showReviewIssues();
      return true;
    }
    if (outcome === "rejected") {
      preparedSignedInReconciliations.current.delete(safeReconciliationId);
      showReviewIssues();
      return false;
    }

    // Uncertain/in-flight: preserve exact review + source IDs for the modal's
    // next click. The modal stays open and uses the same reconciliationId.
    return false;
  };

  const handleLogMeal = async (logData: any) => {
    const instant = new Date();
    const timestamp = instant.toISOString();
    const date = localCalendarDate(instant);
    if (!date) return false;
    const newLog = buildVerifiedMealLog({
      ...logData,
      id: `log-${Date.now()}`,
      date,
      timestamp,
    });

    if (!newLog) {
      console.warn("Meal log rejected because verified nutrition was incomplete or invalid.");
      return false;
    }
    if (!currentUser) {
      setMealLogs((prev) => [...prev, newLog]);
      return true;
    }
    const result = await submitMealLog(newLog);
    return result.outcome !== "needs-review";
  };

  const handleGenerateAiShopping = async () => {
    if (!requireAuthoritativeInventory()) return;
    if (!requireFoodRecommendationSafetyReview()) return;
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/ai/suggest-shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantry,
          profile: buildAiCulinaryProfileContext(profile),
          foodSafety: foodSafetyQuarantine,
          language: profile.language,
        }),
      });

      if (!res.ok) {
        throw new Error(`Shopping suggestions unavailable (${res.status})`);
      }

      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        const now = Date.now();
        const newItems: ShoppingItem[] = data.items.flatMap((item: unknown, idx: number) => {
          if (!item || typeof item !== "object") return [];

          const candidate = item as Record<string, unknown>;
          const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
          const quantity =
            typeof candidate.quantity === "number" &&
            Number.isFinite(candidate.quantity) &&
            candidate.quantity > 0
              ? candidate.quantity
              : null;
          const unit = typeof candidate.unit === "string" ? candidate.unit.trim() : "";

          // An unavailable, empty, or malformed advisor response is not a basket.
          // Only complete suggestions can enter the reviewable shopping list.
          if (!name || quantity === null || !unit) return [];

          return [{
            id: `shop-ai-${now}-${idx}`,
            name,
            quantity,
            unit,
            // Do not invent a category when the advisor does not provide one.
            category:
              typeof candidate.category === "string" ? candidate.category.trim() : "",
            // Advisor output is not an authoritative purchase price. Keep it unknown
            // until the user records an actual price during purchase.
            estimatedPriceEUR: undefined,
            checked: false,
            amountOrigin: "ai_estimated",
            purchaseAmountConfirmed: false,
            reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
          }];
        });

        if (newItems.length > 0) {
          if (!currentUser) {
            setShoppingList(prev => [...prev, ...newItems]);
          } else {
            const persisted = await submitShoppingItemsCreate(newItems);
            if (persisted.outcome === "needs-review") {
              console.warn("AI shopping batch needs review:", persisted.reason);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to suggest shopping list:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleVoiceAddItems = async (items: any[]): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;
    const { accepted, rejectedCount } = normalizeVoicePantryItems(items || []);
    const now = Date.now();
    const addedAt = localCalendarDate();
    if (!addedAt) return false;
    const parsed: PantryItem[] = accepted.map((item, idx) => ({
      ...item,
      id: `p-${now}-${idx}`,
      addedAt,
    }));

    if (rejectedCount > 0) {
      alert(
        profile.language === "bg"
          ? `Не запазих партидата, защото ${rejectedCount} продукт(а) нямат потвърдено количество или мерна единица.`
          : profile.language === "es"
          ? `No guardé el lote porque ${rejectedCount} producto(s) no tenían una cantidad o unidad confirmada.`
          : `I did not save the batch because ${rejectedCount} item(s) were missing a confirmed quantity or unit.`
      );
      return false;
    }

    if (parsed.length === 0) return false;
    if (currentUser) {
      return dispatchSignedInPantryCreations(parsed);
    }
    return updatePantryAndReconcileMenu(parsed, true);
  };

  const handleVoiceAddShoppingItems = async (items: any[]): Promise<boolean> => {
    const now = Date.now();
    const result = buildConfirmedVoiceShoppingItems(
      items || [],
      (index) => `shop-voice-${now}-${index}`
    );

    if (result.rejectedCount > 0) {
      alert(
        profile.language === "bg"
          ? `Не добавих списъка, защото ${result.rejectedCount} продукт(а) нямат валидно име, количество или мерна единица.`
          : profile.language === "es"
          ? `No añadí el lote porque ${result.rejectedCount} producto(s) no tenían un nombre, cantidad o unidad válidos.`
          : `I did not add the batch because ${result.rejectedCount} item(s) were missing a valid name, quantity, or unit.`
      );
      return false;
    }

    if (result.items.length === 0) return false;
    if (!currentUser) {
      setShoppingList(prev => [...prev, ...result.items]);
      return true;
    }
    const persisted = await submitShoppingItemsCreate(result.items);
    if (persisted.outcome === "needs-review") {
      console.warn("Voice shopping batch needs review:", persisted.reason);
      return false;
    }
    return true;
  };

  const handleVoiceDeductItems = async (
    items: any[],
    mutationId: string,
    purpose: DeterministicRemovalPurpose,
    lotEvidence?: readonly ConfirmedVoiceLotEvidence[],
  ): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;

    if (!currentUser) {
      const guestResult = deductVoiceItemsFromPantry(pantry, items || []);
      if (guestResult.issues.length > 0 || guestResult.deductions.length === 0) {
        console.warn(
          "Voice pantry consumption skipped for unresolved items",
          guestResult.issues,
        );
        return false;
      }
      setPantry(guestResult.pantry);
      reconcileGuestPantryDerivedState(guestResult.pantry);
      return true;
    }

    if (!mutationId || (purpose !== "food-use" && purpose !== "discard")) {
      console.warn("Signed-in voice deduction missing stable mutation ID or purpose");
      return false;
    }

    let plan = preparedSignedInVoiceDeductions.current.get(mutationId);
    const lotEvidenceSignature = JSON.stringify(lotEvidence ?? []);
    if (plan && (
      plan.userId !== currentUser.uid ||
      plan.purpose !== purpose ||
      JSON.stringify(plan.lotEvidence ?? []) !== lotEvidenceSignature
    )) {
      preparedSignedInVoiceDeductions.current.delete(mutationId);
      pendingSignedInVoiceConsumptions.current.delete(mutationId);
      return false;
    }

    if (!plan) {
      const resolved = deductVoiceItemsFromPantry(pantry, items || []);
      if (resolved.issues.length > 0 || resolved.deductions.length === 0) {
        console.warn(
          "Voice pantry consumption skipped for unresolved items",
          resolved.issues,
        );
        return false;
      }

      const affectedIds = new Set(
        resolved.deductions.map(item => item.pantryItemId),
      );
      const remaining = new Map(
        resolved.pantry.map(item => [item.id, item.quantity]),
      );
      const expectedRemaining: Record<string, number | null> = {};
      for (const pantryItemId of affectedIds) {
        expectedRemaining[pantryItemId] = remaining.has(pantryItemId)
          ? remaining.get(pantryItemId) ?? null
          : null;
      }

      plan = {
        userId: currentUser.uid,
        deductions: resolved.deductions.map(item => ({ ...item })),
        purpose,
        ...(lotEvidence ? { lotEvidence: lotEvidence.map(item => ({ ...item, deductions: item.deductions.map(deduction => ({ ...deduction })) })) } : {}),
        expectedRemaining,
      };
      preparedSignedInVoiceDeductions.current.set(mutationId, plan);
    }

    pendingSignedInVoiceConsumptions.current.set(mutationId, {
      userId: plan.userId,
      expectedRemaining: { ...plan.expectedRemaining },
    });

    try {
      const persisted = await submitVoiceInventoryConsumption(
        mutationId,
        plan.deductions,
        plan.purpose,
        plan.lotEvidence,
      );
      if (persisted.outcome === "needs-review") {
        const preserveOriginalPlan =
          persisted.reason === "in-flight" ||
          persisted.reason === "unverified-authority";
        if (!preserveOriginalPlan) {
          preparedSignedInVoiceDeductions.current.delete(mutationId);
          pendingSignedInVoiceConsumptions.current.delete(mutationId);
        }
        console.warn(
          "Signed-in voice pantry deduction needs review:",
          persisted.reason,
        );
        return false;
      }

      preparedSignedInVoiceDeductions.current.delete(mutationId);
      return true;
    } catch (error) {
      // Keep the exact reviewed plan + expected remainder. The transaction may
      // have committed before a transport error reached the client; retrying
      // with the same mutationId must replay the original allocation.
      console.error("Verified voice pantry deduction failed:", error);
      return false;
    }
  };

  const handleVoiceNavigateToRecipes = (query?: string) => {
    setActiveTab("recipes");
    if (query) {
      setVoiceSearchQuery(query);
      handleGenerateAiRecipes(query);
    }
  };

  const checkedShoppingCount = shoppingList.filter((i) => !i.checked).length;

  if (showLanding) {
    return (
      <LandingPage
        language={profile.language}
        onLanguageChange={(lang: Language) => { void handleProfilePreferenceUpdate({ language: lang }); }}
        currency={profile.currency}
        onCurrencyChange={(curr: Currency) => { void handleProfilePreferenceUpdate({ currency: curr }); }}
        onOpenApp={() => {
          setShowLanding(false);
          if (!currentUser) {
            setShowAuthModal(true);
          }
        }}
        onOpenAuth={() => {
          setShowLanding(false);
          setShowAuthModal(true);
        }}
      />
    );
  }

  return (
    <div
      id="app-root"
      data-theme={theme}
      className={`min-h-screen w-full overflow-x-hidden flex flex-col items-center justify-start antialiased selection:bg-emerald-500 selection:text-white transition-colors duration-200 ${
        theme === "dark" ? "bg-[#0B0F12] text-stone-100" : "bg-[#F8FAFC] text-slate-900"
      }`}
    >
      <div className="w-full max-w-6xl mx-auto min-h-screen relative pb-28 px-2.5 sm:px-6 lg:px-8">
        <Header
          language={profile.language}
          onLanguageChange={(lang: Language) => { void handleProfilePreferenceUpdate({ language: lang }); }}
          currency={profile.currency}
          onCurrencyChange={(curr: Currency) => { void handleProfilePreferenceUpdate({ currency: curr }); }}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onGoToLanding={() => setShowLanding(true)}
          currentUser={currentUser}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onOpenProfile={() => setActiveTab("profile")}
          activeTab={activeTab}
          onOpenShoppingAdvisor={handleOpenShoppingAdvisor}
          shoppingUrgencyLevel={
            inventoryIsProvisional ? undefined : shoppingDiagnostic.urgencyLevel
          }
          shoppingBadgeCount={
            inventoryIsProvisional
              ? 0
              : shoppingDiagnostic.missingMealIngredients.length +
                shoppingDiagnostic.pendingShoppingItemsCount
          }
        />

        <main className="px-4 py-3">
          {!inventoryIsProvisional && (
            <SmartShoppingBanner
            diagnostic={shoppingDiagnostic}
            language={profile.language}
            currency={profile.currency}
            onOpenAdvisorModal={handleOpenShoppingAdvisor}
            onAddMissingToShoppingList={handleAddMultipleShoppingItems}
            onGoToShoppingTab={() => setActiveTab("shopping")}
            theme={theme}
            />
          )}

          {activeTab === "home" && (
            <HomeView
              pantry={pantry}
              recipes={recipes}
              shoppingList={shoppingList}
              mealPlan={mealPlan}
              profile={profile}
              progressionSummary={progressionSummary}
              onNavigateToTab={setActiveTab}
              onOpenChefIa={() => setShowChefIaModal(true)}
              onCookRecipe={handleCookRecipe}
              onOpenShoppingAdvisor={handleOpenShoppingAdvisor}
              language={profile.language}
              currency={profile.currency}
              theme={theme}
            />
          )}

          {activeTab === "pantry" && inventoryIsProvisional && profile.onboardingCompleted && (
            <div
              role={inventorySyncError ? "alert" : "status"}
              className={
                inventorySyncError
                  ? "mb-3 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-center text-[11px] font-semibold text-red-200/90"
                  : "mb-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-center text-[11px] font-semibold text-amber-200/90"
              }
            >
              {inventorySyncError
                ? profile.language === "es"
                  ? "No se pudo sincronizar el inventario. Tus datos locales siguen en modo solo lectura para evitar sobrescribir la nube. Recarga la app para reintentar."
                  : profile.language === "bg"
                  ? "Инвентарът не можа да се синхронизира. Локалните данни остават само за четене, за да не се презапише облакът. Презаредете приложението, за да опитате отново."
                  : "Inventory sync failed. Your local data remains read-only to avoid overwriting cloud data. Reload the app to try again."
                : profile.language === "es"
                ? "Sincronizando inventario…"
                : profile.language === "bg"
                ? "Синхронизиране на наличностите…"
                : "Syncing inventory…"}
            </div>
          )}

          {activeTab === "pantry" && (
            <PantryView
              pantry={pantry}
              onAddItem={handleAddPantryItem}
              onAddMultipleItems={handleAddMultiplePantryItems}
              onUpdateQuantity={handleUpdatePantryQuantity}
              onDeleteItem={handleDeletePantryItem}
              onClearAll={handleClearPantry}
              onOpenVoiceTab={() => setShowChefIaModal(true)}
              language={profile.language}
              currency={profile.currency}
              inventoryIsProvisional={inventoryIsProvisional}
              theme={theme}
            />
          )}

          {activeTab === "mealPlan" && (
            <MealPlanView
              mealPlan={mealPlan}
              mealLogs={mealLogs}
              pantry={pantry}
              language={profile.language}
              currency={profile.currency}
              shoppingList={shoppingList}
              userName={profile.name}
              onClearMealPlan={handleClearMealPlan}
              onNavigateToVoice={() => setShowChefIaModal(true)}
              onGenerateAiWeekPlan={handleGenerateAiWeekPlan}
              onAdaptToPantry={handleAdaptMenuToPantry}
              isGeneratingPlan={isGeneratingPlan}
              onAddItemsToShoppingList={handleAddMultipleShoppingItems}
              theme={theme}
            />
          )}

          {activeTab === "shopping" && (
            <ShoppingView
              shoppingList={shoppingList}
              onToggleItem={handleToggleShoppingItem}
              onDeleteItem={handleDeleteShoppingItem}
              onAddItem={handleAddShoppingItem}
              onTransferToPantry={handleTransferToPantry}
              onGenerateAiShopping={handleGenerateAiShopping}
              onClearList={handleClearShoppingList}
              onReconcileShopping={handleReconcileShopping}
              isLoadingAi={isLoadingAi}
              language={profile.language}
              currency={profile.currency}
              onOpenShoppingAdvisor={handleOpenShoppingAdvisor}
              theme={theme}
            />
          )}

          {activeTab === "recipes" && (
            <RecipeView
              recipes={recipes}
              pantry={pantry}
              onCookRecipe={handleCookRecipe}
              onAddMissingToShopping={handleAddMissingToShopping}
              onGenerateAiRecipes={() => handleGenerateAiRecipes()}
              onClearRecipes={handleClearRecipes}
              onLoadSampleRecipes={async () => {
                if (!currentUser) {
                  setRecipes(SAMPLE_RECIPES);
                  return true;
                }
                try {
                  const result = await submitRecipesReplace(recipes, SAMPLE_RECIPES);
                  if (result.outcome === "needs-review") {
                    console.warn("Sample recipe load needs review:", result.reason);
                    return false;
                  }
                  return true;
                } catch (error) {
                  console.error("Sample recipe load failed:", error);
                  return false;
                }
              }}
              isLoadingAi={isLoadingAi}
              language={profile.language}
              currency={profile.currency}
            />
          )}

          {activeTab === "voice" && (
            <VoiceChefView
              pantry={pantry}
              mealLogs={mealLogs}
              chatMessages={chatMessages}
              onUpdateChatMessages={setChatMessages}
              onClearChat={() => setChatMessages([])}
              onAddItemsToPantry={handleVoiceAddItems}
              onAddItemsToShoppingList={handleVoiceAddShoppingItems}
              onDeductItemsFromPantry={handleVoiceDeductItems}
              exactLotReviewEnabled={Boolean(currentUser)}
              onNavigateToRecipes={handleVoiceNavigateToRecipes}
              onLogMeal={handleLogMeal}
              foodSafety={foodSafetyQuarantine}
              profileAuthorityReady={!currentUser || profileHydrated}
              language={profile.language}
              theme={theme}
            />
          )}

          {activeTab === "profile" && (
            <ProfileView
              profile={profile}
              onUpdateProfile={(upd) => handleProfileUpdate(upd)}
              onOpenProModal={() => setShowProModal(true)}
              onResetApp={handleResetApp}
              onGoToLanding={() => setShowLanding(true)}
              onOpenAuthModal={() => setShowAuthModal(true)}
              language={profile.language}
              currency={profile.currency}
              progressionSummary={progressionSummary}
              theme={theme}
            />
          )}
        </main>

        {!showChefIaModal && activeTab !== "voice" && (
          <ChefIaFloatingButton
            onClick={() => setShowChefIaModal(true)}
            language={profile.language}
            isOpen={false}
          />
        )}

        <BottomNav
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          language={profile.language}
          pantryCount={pantry.length}
          shoppingCount={checkedShoppingCount}
          theme={theme}
        />

        <ChefIaModal
          isOpen={showChefIaModal}
          onClose={() => setShowChefIaModal(false)}
          onExpandToTab={() => setActiveTab("voice")}
          pantry={pantry}
          mealLogs={mealLogs}
          chatMessages={chatMessages}
          onUpdateChatMessages={setChatMessages}
          onClearChat={() => setChatMessages([])}
          onAddItemsToPantry={handleVoiceAddItems}
          onAddItemsToShoppingList={handleVoiceAddShoppingItems}
          onDeductItemsFromPantry={handleVoiceDeductItems}
              exactLotReviewEnabled={Boolean(currentUser)}
          onNavigateToRecipes={handleVoiceNavigateToRecipes}
          onLogMeal={handleLogMeal}
          foodSafety={foodSafetyQuarantine}
          profileAuthorityReady={!currentUser || profileHydrated}
          language={profile.language}
        />

        {!canRenderApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 font-bold text-sm">
                {profile.language === "es"
                  ? "Cargando cuenta..."
                  : profile.language === "bg"
                  ? "Зареждане на профила..."
                  : "Loading account..."}
              </p>
            </div>
          </div>
        )}

        <ProModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
          language={profile.language}
        />

        <OnboardingModal
          isOpen={
            !showLanding &&
            !showAuthModal &&
            (!currentUser || profileHydrated) &&
            !profile.onboardingCompleted
          }
          onComplete={(upd) => handleProfileUpdate(upd)}
          language={profile.language}
        />

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          currentUser={currentUser}
          language={profile.language}
          onGuestAccess={() => setShowAuthModal(false)}
        />

        <AutoMenuToast
          isVisible={autoMenuToast.isVisible}
          readyMealsCount={autoMenuToast.readyMealsCount}
          language={profile.language}
          onClose={() => setAutoMenuToast((prev) => ({ ...prev, isVisible: false }))}
          onViewMealPlan={() => {
            setAutoMenuToast((prev) => ({ ...prev, isVisible: false }));
            setActiveTab("mealPlan");
          }}
        />

        <SmartShoppingModal
          isOpen={showShoppingAdvisorModal && !inventoryIsProvisional}
          onClose={() => setShowShoppingAdvisorModal(false)}
          diagnostic={shoppingDiagnostic}
          language={profile.language}
          currency={profile.currency}
          onAddMissingToShoppingList={handleAddMultipleShoppingItems}
          onGoToShoppingTab={() => {
            setActiveTab("shopping");
            setShowShoppingAdvisorModal(false);
          }}
          onRequestBrowserNotifications={handleRequestBrowserNotifications}
          hasNotificationPermission={hasNotificationPermission}
        />
      </div>
    </div>
  );
}