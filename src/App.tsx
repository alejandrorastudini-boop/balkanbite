import React, { Suspense, lazy, useState, useEffect, useMemo, useRef } from "react";
import { Header } from "./components/Header";
const PantryView = lazy(() => import("./components/PantryView").then((module) => ({ default: module.PantryView })));
const RecipeView = lazy(() => import("./components/RecipeView").then((module) => ({ default: module.RecipeView })));
const VoiceChefView = lazy(() => import("./components/VoiceChefView").then((module) => ({ default: module.VoiceChefView })));
const ShoppingView = lazy(() => import("./components/ShoppingView").then((module) => ({ default: module.ShoppingView })));
const MealPlanView = lazy(() => import("./components/MealPlanView").then((module) => ({ default: module.MealPlanView })));
const ProfileView = lazy(() => import("./components/ProfileView").then((module) => ({ default: module.ProfileView })));
const ChefIaModal = lazy(() => import("./components/ChefIaModal").then((module) => ({ default: module.ChefIaModal })));
const ProModal = lazy(() => import("./components/ProModal").then((module) => ({ default: module.ProModal })));
const SmartShoppingModal = lazy(() => import("./components/SmartShoppingModal").then((module) => ({ default: module.SmartShoppingModal })));
const OnboardingModal = lazy(() => import("./components/OnboardingModal").then((module) => ({ default: module.OnboardingModal })));
const AuthModal = lazy(() => import("./components/AuthModal").then((module) => ({ default: module.AuthModal })));
const LandingPage = lazy(() => import("./components/LandingPage").then((module) => ({ default: module.LandingPage })));

import { BottomNav, TabType } from "./components/BottomNav";
import { HomeView } from "./components/HomeView";
import { ChefIaFloatingButton } from "./components/ChefIaFloatingButton";
import { AutoMenuToast } from "./components/AutoMenuToast";
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
import { reconcileDerivedShortageShoppingItems, isManagedDerivedShortageRow } from "./utils/derivedShortageShopping";
import { buildConfirmedVoiceShoppingItems } from "./utils/safeVoiceShoppingCapture";
import {
  getUserPantryCacheKey,
  parseUserPantryCache,
} from "./utils/startupPantryCache";
import {
  GUEST_PANTRY_KEY,
  GUEST_PANTRY_QUARANTINE_KEY,
  inspectGuestPantry,
  loadGuestPantry,
  writeGuestPantrySafely,
} from "./utils/guestPantry";
import {
  createSignedInProfileDefaults,
  parseGuestProfileCache,
} from "./utils/profileSyncBoundary";
import { clearBalkanBiteLocalStorage } from "./utils/localDataReset";
import { buildAiCulinaryProfileContext } from "./utils/aiCulinaryProfileContext";
import { parseStoredRecipeCache } from "./utils/storedRecipeValidation";
import { parseStoredMealPlanCache } from "./utils/storedMealPlanValidation";
import { parseStoredShoppingCache } from "./utils/storedShoppingValidation";
import {
  repairGuestDerivedShoppingOnHydration,
  guestShoppingCacheIsComplete,
} from "./utils/guestDerivedShoppingRecovery";
import {
  GUEST_PANTRY_SHOPPING_JOURNAL_KEY,
  recoverGuestPantryShoppingJournal,
  writeGuestPantryWithDerivedShoppingJournal,
} from "./utils/guestPantryShoppingJournal";
import {
  GUEST_PURCHASE_INTENT_KEY,
  recoverConfirmedGuestPurchaseIntent,
  commitConfirmedGuestPurchaseIntent,
} from "./utils/guestConfirmedPurchaseIntent";
import {
  GUEST_COOK_INTENT_KEY,
  commitConfirmedGuestCookIntent,
  recoverConfirmedGuestCookIntent,
} from "./utils/guestConfirmedCookIntent";
import {
  GUEST_COOK_DERIVED_INTENT_KEY,
  commitDerivedGuestCookIntent,
  recoverDerivedGuestCookIntent,
} from "./utils/guestCookDerivedIntent";
import {
  GUEST_VOICE_INTENT_KEY,
  GUEST_VOICE_RECEIPTS_KEY,
  commitGuestVoiceRemoval,
  recoverGuestVoiceRemoval,
  parseGuestVoiceReceipts,
} from "./utils/guestVoiceRemovalIntent";
import { hasPendingGuestMutationJournal } from "./utils/guestJournalExclusivity";
import type { ChefWorkspaceSnapshot } from "./utils/chefWorkspaceFacts";
import { parseChatMessageCache } from "./utils/chatMessageValidation";
import {
  buildMealLogPreservingNutritionUncertainty,
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
    loadGuestPantry(localStorage.getItem(GUEST_PANTRY_KEY))
  );
  // Keep the latest successfully persisted guest snapshot for rapid successive
  // commands; React state updates need not flush between two user actions.
  const guestPantryCommittedRef = useRef<PantryItem[]>(pantry);
  const [guestPantryRecoveryAcknowledged, setGuestPantryRecoveryAcknowledged] = useState(false);
  const [guestDerivedShoppingRecoveryProblem, setGuestDerivedShoppingRecoveryProblem] = useState(false);
  const [guestJournalRecoveryStatus, setGuestJournalRecoveryStatus] = useState<"clear" | "pending" | "blocked">(() => {
    try {
      return localStorage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) === null &&
        localStorage.getItem(GUEST_PURCHASE_INTENT_KEY) === null &&
        localStorage.getItem(GUEST_COOK_INTENT_KEY) === null &&
        localStorage.getItem(GUEST_COOK_DERIVED_INTENT_KEY) === null &&
        localStorage.getItem(GUEST_VOICE_INTENT_KEY) === null
        ? "clear" : "pending";
    } catch {
      return "blocked";
    }
  });
  const [guestPantryRecovery, setGuestPantryRecovery] = useState<"none" | "available" | "blocked">(() => {
    // Block guest writes on the very first render until recovery storage
    // has been verified. A late effect must not temporarily allow mutations.
    try {
      const raw = localStorage.getItem(GUEST_PANTRY_KEY);
      const originalBackup = localStorage.getItem(GUEST_PANTRY_QUARANTINE_KEY);
      if (inspectGuestPantry(raw).requiresRecovery) return "blocked";
      return originalBackup === null ? "none" : "available";
    } catch {
      return "blocked";
    }
  });

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
    getServerConfirmedChefPantry,
    getServerConfirmedChefMealPlan,
    getServerConfirmedChefShopping,
    getServerConfirmedChefWorkspace,
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
        // Consent to work with incomplete guest stock is session-scoped.
        // Never carry it across a signed-in account transition.
        setGuestPantryRecoveryAcknowledged(false);
        setPantryScope(currentUser.uid);
        return;
      }

      if (inventoryHydrated && pantryScope !== currentUser.uid) {
        setPantryScope(currentUser.uid);
      }
      return;
    }

    if (firebaseLoading || pantryScope === "guest") return;

    // Recheck for a journal created during a previous authenticated session.
    try {
      if (localStorage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) !== null ||
          localStorage.getItem(GUEST_PURCHASE_INTENT_KEY) !== null ||
          localStorage.getItem(GUEST_COOK_INTENT_KEY) !== null ||
          localStorage.getItem(GUEST_COOK_DERIVED_INTENT_KEY) !== null ||
          localStorage.getItem(GUEST_VOICE_INTENT_KEY) !== null) {
        setGuestJournalRecoveryStatus("pending");
      }
    } catch {
      setGuestJournalRecoveryStatus("blocked");
    }
    const loadedGuestPantry = loadGuestPantry(localStorage.getItem(GUEST_PANTRY_KEY));
    guestPantryCommittedRef.current = loadedGuestPantry;
    setPantry(loadedGuestPantry);
    setGuestPantryRecoveryAcknowledged(false);
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
    if (isResetting || firebaseLoading || currentUser ||
        pantryScope !== "guest" || workspaceScope !== "guest" ||
        guestJournalRecoveryStatus === "clear") return;

    // Order matters: purchase recovery must finish or block BEFORE React
    // hydration writers may publish shopping/progression. Recovery NEVER
    // reapplies an acquisition: it verifies the pantry after-snapshot and
    // restores only shopping/progression bytes when their baselines match.
    const voiceRecovery = recoverGuestVoiceRemoval(localStorage);
    if (voiceRecovery.status === "blocked") {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      return;
    }
    const derivedCookRecovery = recoverDerivedGuestCookIntent(localStorage);
    if (derivedCookRecovery.status === "blocked") {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      return;
    }
    const cookRecovery = recoverConfirmedGuestCookIntent(localStorage);
    if (cookRecovery.status === "blocked") {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      return;
    }
    const purchaseRecovery = recoverConfirmedGuestPurchaseIntent(localStorage);
    if (purchaseRecovery.status === "blocked") {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      return;
    }
    const recovery = recoverGuestPantryShoppingJournal(localStorage);
    if (recovery.status === "blocked") {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      return;
    }
    const shoppingRaw = localStorage.getItem("balkanbite_shopping");
    const savedShopping = parseStoredShoppingCache(shoppingRaw);
    if (shoppingRaw !== null && (!savedShopping || !guestShoppingCacheIsComplete(shoppingRaw))) {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      return;
    }
    if (purchaseRecovery.status !== "none" || cookRecovery.status !== "none" ||
        derivedCookRecovery.status !== "none") {
      const rawProgression = localStorage.getItem("balkanbite_progression");
      // No journal can justify replacing unknown historical progression with
      // an empty ledger; reject a malformed/filtered cache for review.
      let completeProgression = false;
      try {
        const decoded: unknown = rawProgression === null ? null : JSON.parse(rawProgression);
        completeProgression = Array.isArray(decoded) &&
          parseProgressionLedgerCache(rawProgression).length === decoded.length;
      } catch { /* keep original bytes for assisted review */ }
      if (!completeProgression) {
        setGuestJournalRecoveryStatus("blocked");
        setGuestDerivedShoppingRecoveryProblem(true);
        return;
      }
      setProgressionLedger(parseProgressionLedgerCache(rawProgression));
    }
    if (derivedCookRecovery.status !== "none" || voiceRecovery.status !== "none") {
      // Before unfreezing independent React cache writers, publish the exact
      // recovered five-key state (no recomputation and no filtered legacy rows).
      const pantryRaw = localStorage.getItem(GUEST_PANTRY_KEY);
      const recipeRaw = localStorage.getItem("balkanbite_recipes");
      const planRaw = localStorage.getItem("balkanbite_mealplan");
      const storedPantry = inspectGuestPantry(pantryRaw);
      const storedRecipes = parseStoredRecipeCache(recipeRaw);
      const storedPlan = parseStoredMealPlanCache(planRaw);
      let complete = !storedPantry.requiresRecovery && pantryRaw !== null &&
        storedRecipes !== null && storedPlan !== null && savedShopping !== null;
      try {
        complete = complete &&
          storedRecipes!.length === JSON.parse(recipeRaw!).length &&
          storedPlan!.length === JSON.parse(planRaw!).length;
      } catch { complete = false; }
      if (!complete) {
        setGuestJournalRecoveryStatus("blocked");
        setGuestDerivedShoppingRecoveryProblem(true);
        return;
      }
      guestPantryCommittedRef.current = storedPantry.items;
      setPantry(storedPantry.items);
      setRecipes(storedRecipes!.map(recipe => ({
        ...recipe, imageUrl: getRecipeImageUrl(recipe),
      })));
      setMealPlan(storedPlan!);
    }
    if (savedShopping !== null) setShoppingList(savedShopping);
    setGuestJournalRecoveryStatus("clear");
  }, [isResetting, firebaseLoading, currentUser, pantryScope, workspaceScope, guestJournalRecoveryStatus]);

  useEffect(() => {
    if (isResetting || !currentUser) return;
    // Authenticated storage remains a provisional UI cache, never authority.
    try {
      if (!inventoryHydrated || pantryScope !== currentUser.uid) return;
      localStorage.setItem(
        getUserPantryCacheKey(currentUser.uid),
        JSON.stringify(pantry),
      );
    } catch (error) {
      console.warn("Signed-in provisional pantry cache write failed", error);
    }
  }, [pantry, currentUser, inventoryHydrated, pantryScope, isResetting]);

  useEffect(() => {
    if (isResetting || currentUser || firebaseLoading || pantryScope !== "guest" ||
        guestJournalRecoveryStatus !== "clear") return;
    // One-time guest scope hydration/migration, not a post-render writer.
    // All subsequent guest inventory mutations are committed synchronously
    // in commitGuestPantry BEFORE React and derived states change.
    try {
      const raw = localStorage.getItem(GUEST_PANTRY_KEY);
      const inspected = inspectGuestPantry(raw);
      if (inspected.requiresRecovery) {
        const result = writeGuestPantrySafely(localStorage, inspected.items);
        if (!result.saved) {
          setGuestPantryRecovery("blocked");
          if ("reason" in result) console.warn("Guest original data could not be backed up:", result.reason);
          return;
        }
        setGuestPantryRecovery(result.recoveryAvailable ? "available" : "none");
        return;
      }
      const savedBackup = localStorage.getItem(GUEST_PANTRY_QUARANTINE_KEY);
      setGuestPantryRecovery(savedBackup === null ? "none" : "available");
    } catch (error) {
      setGuestPantryRecovery("blocked");
      console.warn("Guest pantry hydration/recovery failed", error);
    }
  }, [currentUser, firebaseLoading, pantryScope, isResetting, guestJournalRecoveryStatus]);

  /**
   * A journal can appear in another guest tab after this tab finished
   * hydration. React's own guest persistence effects must re-read all WAL
   * markers immediately before writing, not trust their initial clear state.
   * This is best-effort conflict detection (localStorage has no atomic CAS).
   */
  const blockLegacyGuestWriteForPendingJournal = (): boolean => {
    try {
      if (!hasPendingGuestMutationJournal(localStorage)) return false;
    } catch (error) {
      console.warn("Unable to verify guest transaction markers", error);
    }
    setGuestJournalRecoveryStatus("blocked");
    setGuestDerivedShoppingRecoveryProblem(true);
    return true;
  };

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest" ||
        guestJournalRecoveryStatus !== "clear") return;
    if (blockLegacyGuestWriteForPendingJournal()) return;
    try {
      localStorage.setItem("balkanbite_recipes", JSON.stringify(recipes));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [recipes, currentUser, workspaceScope, isResetting, guestJournalRecoveryStatus]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest" ||
        guestJournalRecoveryStatus !== "clear") return;
    if (blockLegacyGuestWriteForPendingJournal()) return;
    try {
      const existingRaw = localStorage.getItem("balkanbite_shopping");
      if (!guestShoppingCacheIsComplete(existingRaw)) {
        // A historical malformed row must not be silently filtered away by
        // the React hydration writer. Preserve untouched raw bytes for review.
        setGuestDerivedShoppingRecoveryProblem(true);
        console.warn("Guest shopping cache needs non-destructive review");
        return;
      }
      const serialized = JSON.stringify(shoppingList);
      localStorage.setItem("balkanbite_shopping", serialized);
      if (localStorage.getItem("balkanbite_shopping") !== serialized) {
        setGuestDerivedShoppingRecoveryProblem(true);
        console.warn("Guest shopping persistence could not be confirmed");
        return;
      }
      setGuestDerivedShoppingRecoveryProblem(false);
    } catch (e) {
      setGuestDerivedShoppingRecoveryProblem(true);
      console.warn("Guest shopping persistence failed", e);
    }
  }, [shoppingList, currentUser, workspaceScope, isResetting, guestJournalRecoveryStatus]);

  useEffect(() => {
    if (isResetting || firebaseLoading || currentUser ||
        pantryScope !== "guest" || workspaceScope !== "guest" ||
        guestJournalRecoveryStatus !== "clear" || guestPantryRecovery !== "none") return;

    // Reconcile only app-managed shortages from completely valid stored
    // sources. This repairs an interrupted derived write after a reload,
    // without deleting user-entered shopping items or assuming absent caches
    // are known empty. It does not provide multi-key atomicity.
    const recovery = repairGuestDerivedShoppingOnHydration(localStorage, profile.language);
    if (recovery.status === "blocked") {
      setGuestDerivedShoppingRecoveryProblem(true);
    } else if (recovery.status === "repaired") {
      setShoppingList(recovery.shopping);
      setGuestDerivedShoppingRecoveryProblem(false);
    }
  }, [
    isResetting, firebaseLoading, currentUser, pantryScope, workspaceScope,
    guestPantryRecovery, guestJournalRecoveryStatus, profile.language,
  ]);

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
    if (isResetting || currentUser || workspaceScope !== "guest" ||
        guestJournalRecoveryStatus !== "clear") return;
    if (blockLegacyGuestWriteForPendingJournal()) return;
    try {
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(mealPlan));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [mealPlan, currentUser, workspaceScope, isResetting, guestJournalRecoveryStatus]);

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
    if (isResetting || currentUser || workspaceScope !== "guest" ||
        guestJournalRecoveryStatus !== "clear") return;
    if (blockLegacyGuestWriteForPendingJournal()) return;
    try {
      localStorage.setItem(
        "balkanbite_progression",
        JSON.stringify(progressionLedger)
      );
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [progressionLedger, currentUser, workspaceScope, isResetting, guestJournalRecoveryStatus]);

  const appendLocalProgressionEvents = (events: readonly unknown[]) => {
    if (events.length === 0) return;
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
        blockLegacyGuestWriteForPendingJournal())) return;
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

  const guestPantryReviewPending = !currentUser &&
    (guestJournalRecoveryStatus !== "clear" || guestPantryRecovery === "blocked" ||
      (guestPantryRecovery === "available" && !guestPantryRecoveryAcknowledged));
  const pantryDerivedDataProvisional =
    inventoryIsProvisional || guestPantryReviewPending || guestDerivedShoppingRecoveryProblem;

  const requireAuthoritativeInventory = () => {
    // Another guest tab may have staged a WAL after this tab hydrated.
    // Never launch pantry-derived commands from a stale "clear" React flag.
    if (!currentUser && blockLegacyGuestWriteForPendingJournal()) {
      alert(profile.language === "bg"
        ? "Има незавършена локална операция. Презаредете и проверете данните."
        : profile.language === "es"
        ? "Hay una operación local pendiente. Recarga y revisa los datos."
        : "A local operation is pending. Reload and review the data.");
      return false;
    }
    if (!currentUser && guestJournalRecoveryStatus !== "clear") {
      alert(profile.language === "bg"
        ? "Гост-операцията не е възстановена безопасно. Презаредете и прегледайте локалните данни."
        : profile.language === "es"
        ? "La operación de invitado está pendiente de recuperación o revisión. Recarga y revisa los datos locales."
        : "A guest operation needs recovery or review. Reload and inspect local data.");
      return false;
    }
    if (!currentUser && guestDerivedShoppingRecoveryProblem) {
      alert(
        profile.language === "bg"
          ? "Списъкът за пазаруване не е синхронизиран безопасно с наличностите. Проверете мястото за съхранение и презаредете."
          : profile.language === "es"
          ? "La lista de compra no está sincronizada de forma segura con la despensa. Revisa el almacenamiento y recarga."
          : "The shopping list is not safely synchronized with the pantry. Check storage and reload."
      );
      return false;
    }
    if (!currentUser && guestPantryRecovery === "blocked") {
      alert(
        profile.language === "bg"
          ? "Записът на гост-панела е спрян, за да не се загубят стари данни. Изтеглете оригиналното копие и прегледайте данните."
          : profile.language === "es"
          ? "La despensa de invitados está bloqueada para no perder datos antiguos. Descarga la copia original y revisa los datos."
          : "Guest pantry changes are blocked to protect older data. Download the original copy and review the entries."
      );
      return false;
    }
    if (!currentUser && guestPantryRecovery === "available" && !guestPantryRecoveryAcknowledged) {
      alert(
        profile.language === "bg"
          ? "Някои стари записи са непроверени. Преди да използвате непълните наличности, потвърдете изрично, че искате да продължите само с проверените записи."
          : profile.language === "es"
          ? "Hay entradas antiguas sin verificar. Antes de usar una despensa incompleta, confirma expresamente que deseas trabajar solo con las entradas validadas."
          : "Some older entries are unverified. Before using an incomplete pantry, explicitly confirm that you want to work only with verified entries."
      );
      return false;
    }
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

  const commitGuestPantry = (
    nextPantry: PantryItem[],
    { reconcile = true, showToast = true }: { reconcile?: boolean; showToast?: boolean } = {},
  ): boolean => {
    if (currentUser || pantryScope !== "guest") return false;
    if (blockLegacyGuestWriteForPendingJournal()) {
      alert(profile.language === "bg"
        ? "Има незавършена локална операция. Презаредете и прегледайте данните, преди да промените наличностите."
        : profile.language === "es"
        ? "Hay una operación local pendiente. Recarga y revisa los datos antes de modificar la despensa."
        : "A local operation is unfinished. Reload and review the data before editing pantry stock.");
      return false;
    }
    // Commit local storage BEFORE publishing a changed stock or propagating
    // recipes, menus, shopping shortages, or progression events.
    const result = writeGuestPantrySafely(localStorage, nextPantry, guestPantryCommittedRef.current);
    if (!result.saved) {
      setGuestPantryRecovery("blocked");
      setGuestPantryRecoveryAcknowledged(false);
      if ("reason" in result) console.warn("Guest pantry change rejected; authoritative local write failed:", result.reason);
      alert("reason" in result && result.reason === "stale-snapshot"
        ? profile.language === "bg"
          ? "Деспенсата е променена в друг раздел. Тази промяна не е запазена. Презаредете, за да видите актуалните данни."
          : profile.language === "es"
          ? "La despensa ha cambiado en otra pestaña. No se ha guardado esta edición. Recarga para ver los datos actuales."
          : "The pantry changed in another tab. This edit was not saved. Reload to review the current stock."
        : profile.language === "bg"
          ? "Промяната не е запазена. Проверете или изтеглете оригиналните данни, преди да опитате отново."
          : profile.language === "es"
          ? "El cambio no se ha guardado. Revisa o descarga los datos originales antes de intentarlo de nuevo."
          : "The change was not saved. Review or download the original data before retrying.");
      return false;
    }
    guestPantryCommittedRef.current = nextPantry;
    setPantry(nextPantry);
    setGuestPantryRecovery(result.recoveryAvailable ? "available" : "none");
    if (reconcile) reconcileGuestPantryDerivedState(nextPantry, showToast);
    return true;
  };

  const updatePantryAndReconcileMenu = (
    newPantryItemsToAdd: PantryItem[],
    showToast = true
  ): boolean => {
    if (!requireAuthoritativeInventory()) return false;
    const next = [...newPantryItemsToAdd, ...guestPantryCommittedRef.current];
    return commitGuestPantry(next, { showToast });
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

  const managedShortageRowsFingerprint = useMemo(
    () => JSON.stringify(
      shoppingList.filter(isManagedDerivedShortageRow)
        .map(item => [item.id, item.quantity, item.unit, item.checked])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ),
    [shoppingList],
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
    managedShortageRowsFingerprint,
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
    // Do not claim ingredients are missing when guest inventory is only
    // a validated *subset* of unreviewed historical local storage.
    if (pantryDerivedDataProvisional) return;

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
  }, [shoppingDiagnostic, hasNotificationPermission, profile.language, pantryDerivedDataProvisional]);

  const handleAddMultipleShoppingItems = async (
    items: Array<Omit<ShoppingItem, "id" | "checked">>
  ): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;
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
    return updatePantryAndReconcileMenu([newItem], true);
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
    return updatePantryAndReconcileMenu(newItems, true);
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

  /**
   * Narrow first live WAL writer: a manual quantity edit when recipe and meal
   * plan projections are EXACTLY unchanged. Other edits continue through the
   * pre-existing pantry-first path; do not claim a general transaction.
   */
  const tryJournalGuestQuantityEdit = (updatedPantry: PantryItem[]): "ineligible" | "saved" | "blocked" => {
    if (guestPantryRecovery !== "none" || guestJournalRecoveryStatus !== "clear" ||
        guestDerivedShoppingRecoveryProblem || workspaceScope !== "guest") return "ineligible";
    try {
      const rawRecipes = localStorage.getItem("balkanbite_recipes");
      const rawPlan = localStorage.getItem("balkanbite_mealplan");
      const rawShopping = localStorage.getItem("balkanbite_shopping");
      if (rawRecipes === null || rawPlan === null || rawShopping === null) return "ineligible";
      const storedRecipes = parseStoredRecipeCache(rawRecipes);
      const storedPlan = parseStoredMealPlanCache(rawPlan);
      const storedShopping = parseStoredShoppingCache(rawShopping);
      if (!storedRecipes || !storedPlan || !storedShopping ||
          !guestShoppingCacheIsComplete(rawShopping) ||
          JSON.stringify(storedRecipes) !== JSON.stringify(recipes) ||
          JSON.stringify(storedPlan) !== JSON.stringify(mealPlan) ||
          JSON.stringify(storedShopping) !== JSON.stringify(shoppingList)) return "ineligible";

      const syncedRecipes = syncRecipesWithPantry(recipes, updatedPantry);
      const { newPlan } = adaptMealPlanSafelyToPantry(
        updatedPantry, syncedRecipes, mealPlan, profile,
      );
      if (JSON.stringify(syncedRecipes) !== JSON.stringify(recipes) ||
          JSON.stringify(newPlan) !== JSON.stringify(mealPlan)) return "ineligible";

      const operationId = typeof globalThis.crypto?.randomUUID === "function"
        ? `guest-quantity-${globalThis.crypto.randomUUID()}`
        : `guest-quantity-${Date.now()}`;
      const written = writeGuestPantryWithDerivedShoppingJournal(localStorage, {
        operationId,
        expectedPantry: guestPantryCommittedRef.current,
        nextPantry: updatedPantry,
        language: profile.language,
      });
      if (written.status === "saved" || written.status === "saved-pending-cleanup") {
        const persistedShopping = parseStoredShoppingCache(localStorage.getItem("balkanbite_shopping"));
        if (!persistedShopping) {
          setGuestJournalRecoveryStatus("blocked");
          setGuestDerivedShoppingRecoveryProblem(true);
          return "blocked";
        }
        guestPantryCommittedRef.current = updatedPantry;
        setPantry(updatedPantry);
        setShoppingList(persistedShopping);
        if (written.status === "saved-pending-cleanup") {
          setGuestJournalRecoveryStatus("pending");
        }
        return "saved";
      }

      // A failure can be after the stock write. Never fall back to writing it
      // twice. A retained journal keeps the next session recoverable.
      const hasJournal = localStorage.getItem(GUEST_PANTRY_SHOPPING_JOURNAL_KEY) !== null;
      setGuestJournalRecoveryStatus(hasJournal ? "blocked" : "clear");
      setGuestDerivedShoppingRecoveryProblem(true);
      alert(profile.language === "bg"
        ? "Промяната не е потвърдена напълно. Проверете данните след презареждане."
        : profile.language === "es"
        ? "No se ha podido confirmar toda la operación. Recarga y revisa los datos antes de continuar."
        : "The entire operation could not be confirmed. Reload and review the data before continuing.");
      return "blocked";
    } catch (error) {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      console.warn("Guest journaled quantity change could not be verified", error);
      return "blocked";
    }
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
    const updatedPantry = guestPantryCommittedRef.current.map((item) =>
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
    const journaled = tryJournalGuestQuantityEdit(updatedPantry);
    if (journaled === "ineligible") commitGuestPantry(updatedPantry);
  };

  const handleDeletePantryItem = (id: string, viewed: PantryItem) => {
    if (!requireAuthoritativeInventory()) return;
    if (viewed.id !== id) return;
    if (currentUser) {
      dispatchVerifiedPantryChange(viewed, "remove");
      return;
    }
    const updatedPantry = guestPantryCommittedRef.current.filter((item) => item.id !== id);
    commitGuestPantry(updatedPantry);
  };

  const handleClearPantry = async (mutationId: string): Promise<boolean> => {
    if (!requireAuthoritativeInventory()) return false;
    if (!currentUser) {
      return commitGuestPantry([], { reconcile: false });
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
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
    if (!currentUser) {
      setRecipes([]);
      return true;
    }
    const result = await submitRecipesReplace(recipes, []);
    return result.outcome !== "needs-review";
  };

  const handleClearMealPlan = async () => {
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
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

  /**
   * Guest cook v1 handles stable projections. Its separate, five-key
   * derived journal handles changes to recipes/menu/shortages when every
   * input is complete and deterministic. Neither is cross-tab atomic.
   */
  const tryJournalGuestRecipeCook = (
    recipe: Recipe,
    cookConfirmationId: string,
    occurredAt: string,
    nextPantry: PantryItem[],
  ): "saved" | "already-applied" | "blocked" | "ineligible" => {
    if (guestPantryRecovery !== "none" || guestJournalRecoveryStatus !== "clear" ||
        guestDerivedShoppingRecoveryProblem || workspaceScope !== "guest") return "ineligible";

    try {
      const rawRecipes = localStorage.getItem("balkanbite_recipes");
      const rawPlan = localStorage.getItem("balkanbite_mealplan");
      const rawShopping = localStorage.getItem("balkanbite_shopping");
      const rawProgression = localStorage.getItem("balkanbite_progression");
      if ([rawRecipes, rawPlan, rawShopping, rawProgression].some(x => x === null)) return "ineligible";
      const storedRecipes = parseStoredRecipeCache(rawRecipes);
      const storedPlan = parseStoredMealPlanCache(rawPlan);
      const storedShopping = parseStoredShoppingCache(rawShopping);
      const storedProgression = parseProgressionLedgerCache(rawProgression);
      if (!storedRecipes || !storedPlan || !storedShopping ||
          !guestShoppingCacheIsComplete(rawShopping) ||
          storedRecipes.length !== recipes.length ||
          JSON.stringify(storedPlan) !== JSON.stringify(mealPlan) ||
          JSON.stringify(storedShopping) !== JSON.stringify(shoppingList) ||
          JSON.stringify(storedProgression) !== JSON.stringify(progressionLedger) ||
          storedRecipes.some(r => {
            const current = recipes.find(x => x.id === r.id);
            return !current ||
              JSON.stringify(current.ingredients) !== JSON.stringify(r.ingredients);
          })) return "ineligible";
      if (!storedRecipes.some(r => r.id === recipe.id &&
          JSON.stringify(r.ingredients) === JSON.stringify(recipe.ingredients))) return "ineligible";

      // Existing saved cook evidence makes a retry a no-op, never a second
      // inventory deduction. The UI supplied stable cookConfirmationId.
      if (storedProgression.some(e => e.eventId === `cook:${cookConfirmationId}`)) {
        return "already-applied";
      }

      const syncedRecipes = syncRecipesWithPantry(recipes, nextPantry, new Date(occurredAt));
      const { newPlan } = adaptMealPlanSafelyToPantry(
        nextPantry, syncedRecipes, mealPlan, profile,
      );
      const nextMissing = reconcileDerivedShortageShoppingItems(
        shoppingList,
        evaluateShoppingNeeds(
          nextPantry, newPlan, shoppingList, profile.language,
          new Date(occurredAt),
        ).itemsToAddToShoppingList,
      ).next;
      const derivedChanged =
        JSON.stringify(syncedRecipes) !== JSON.stringify(recipes) ||
        JSON.stringify(newPlan) !== JSON.stringify(mealPlan) ||
        JSON.stringify(nextMissing) !== JSON.stringify(shoppingList);
      if (derivedChanged) {
        // Historical recipes with image-only hydration differences are not
        // exact source snapshots. Keep them on the existing path rather than
        // write a WAL that cannot be deterministically verified.
        if (JSON.stringify(storedRecipes) !== JSON.stringify(recipes)) return "ineligible";
        const derived = commitDerivedGuestCookIntent(localStorage, {
          cookConfirmationId, recipeId: recipe.id, occurredAt,
          language: profile.language,
          expectedPantry: guestPantryCommittedRef.current,
          expectedRecipes: storedRecipes,
          expectedPlan: storedPlan,
          expectedShopping: storedShopping,
          expectedProgression: storedProgression,
          nextRecipes: syncedRecipes,
          nextPlan: newPlan,
          nextShopping: nextMissing,
        });
        if (derived.status === "saved" || derived.status === "saved-pending-cleanup") {
          const committed = inspectGuestPantry(localStorage.getItem(GUEST_PANTRY_KEY));
          const committedRecipes = localStorage.getItem("balkanbite_recipes");
          const committedPlan = localStorage.getItem("balkanbite_mealplan");
          const committedShopping = localStorage.getItem("balkanbite_shopping");
          const committedProgression = localStorage.getItem("balkanbite_progression");
          if (committed.requiresRecovery ||
              JSON.stringify(committed.items) !== JSON.stringify(nextPantry) ||
              committedRecipes !== JSON.stringify(syncedRecipes) ||
              committedPlan !== JSON.stringify(newPlan) ||
              committedShopping !== JSON.stringify(nextMissing) ||
              committedProgression === null ||
              !parseStoredShoppingCache(committedShopping)) {
            setGuestJournalRecoveryStatus("blocked");
            setGuestDerivedShoppingRecoveryProblem(true);
            return "blocked";
          }
          guestPantryCommittedRef.current = committed.items;
          setPantry(committed.items);
          setRecipes(syncedRecipes);
          setMealPlan(newPlan);
          setShoppingList(nextMissing);
          setProgressionLedger(parseProgressionLedgerCache(committedProgression));
          if (derived.status === "saved-pending-cleanup") setGuestJournalRecoveryStatus("pending");
          return "saved";
        }
        if (derived.status === "already-applied") return "already-applied";
        setGuestJournalRecoveryStatus("blocked");
        setGuestDerivedShoppingRecoveryProblem(true);
        alert(profile.language === "bg"
          ? "Готвенето и свързаните данни не можаха да бъдат потвърдени. Презаредете и проверете данните."
          : profile.language === "es"
          ? "No se ha podido confirmar el cocinado y sus cambios asociados. Recarga y revisa los datos."
          : "Cooking and related changes could not be confirmed. Reload and review the data.");
        return "blocked";
      }

      const result = commitConfirmedGuestCookIntent(localStorage, {
        cookConfirmationId, recipeId: recipe.id, occurredAt,
        expectedPantry: guestPantryCommittedRef.current,
        expectedProgression: progressionLedger,
        expectedIngredients: recipe.ingredients,
      });
      if (result.status === "saved" || result.status === "saved-pending-cleanup") {
        const rawPantry = localStorage.getItem(GUEST_PANTRY_KEY);
        const savedStock = inspectGuestPantry(rawPantry);
        const savedProgress = localStorage.getItem("balkanbite_progression");
        if (savedStock.requiresRecovery || savedProgress === null ||
            JSON.stringify(savedStock.items) !== JSON.stringify(nextPantry)) {
          setGuestJournalRecoveryStatus("blocked");
          setGuestDerivedShoppingRecoveryProblem(true);
          return "blocked";
        }
        guestPantryCommittedRef.current = savedStock.items;
        setPantry(savedStock.items);
        setProgressionLedger(parseProgressionLedgerCache(savedProgress));
        if (result.status === "saved-pending-cleanup") setGuestJournalRecoveryStatus("pending");
        return "saved";
      }
      if (result.status === "already-applied") return "already-applied";
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      alert(profile.language === "bg"
        ? "Не успяхме да потвърдим съхранението на готвенето. Презаредете и проверете данните."
        : profile.language === "es"
        ? "No se ha podido confirmar el registro completo de cocina. Recarga y revisa los datos."
        : "The complete cooking record could not be confirmed. Reload and review the data.");
      return "blocked";
    } catch (error) {
      console.warn("Guest cook journal preflight or persistence failed", error);
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      return "blocked";
    }
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
      const journal = tryJournalGuestRecipeCook(
        recipe, cookConfirmationId, occurredAt, result.pantry,
      );
      if (journal === "blocked") return { success: false, issueCount: 1 };
      if (journal === "saved" || journal === "already-applied") {
        return { success: true };
      }
      if (!commitGuestPantry(result.pantry)) return { success: false, issueCount: 1 };
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
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
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
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
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
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
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
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
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

  /**
   * First real guest purchase writer, narrowly gated: only when the recipe
   * and meal-plan projections do not change after the confirmed acquisition.
   * Complex changes still use the legacy path; this is NOT an app-wide
   * transaction and does not cover cooking, voice or meal logs.
   */
  const tryJournalGuestCheckedTransfer = (
    preview: ReturnType<typeof transferCheckedShoppingItems>,
    occurredAt: string,
    acquiredAt: string,
  ): "saved" | "blocked" | "ineligible" => {
    if (guestPantryRecovery !== "none" || guestJournalRecoveryStatus !== "clear" ||
        guestDerivedShoppingRecoveryProblem || workspaceScope !== "guest" ||
        preview.rejected.length > 0 || preview.newlyAppliedSourceIds.length === 0 ||
        preview.newlyAppliedSourceIds.length !== preview.acceptedSourceIds.length) return "ineligible";

    try {
      const rawRecipes = localStorage.getItem("balkanbite_recipes");
      const rawPlan = localStorage.getItem("balkanbite_mealplan");
      const rawShopping = localStorage.getItem("balkanbite_shopping");
      const rawProgression = localStorage.getItem("balkanbite_progression");
      if (rawRecipes === null || rawPlan === null || rawShopping === null ||
          rawProgression === null) return "ineligible";
      const storedRecipes = parseStoredRecipeCache(rawRecipes);
      const storedPlan = parseStoredMealPlanCache(rawPlan);
      const storedShopping = parseStoredShoppingCache(rawShopping);
      if (!storedRecipes || !storedPlan || !storedShopping ||
          !guestShoppingCacheIsComplete(rawShopping) ||
          JSON.stringify(storedRecipes) !== JSON.stringify(recipes) ||
          JSON.stringify(storedPlan) !== JSON.stringify(mealPlan) ||
          JSON.stringify(storedShopping) !== JSON.stringify(shoppingList) ||
          JSON.stringify(parseProgressionLedgerCache(rawProgression)) !==
            JSON.stringify(progressionLedger)) return "ineligible";

      const syncedRecipes = syncRecipesWithPantry(recipes, preview.pantry);
      const { newPlan } = adaptMealPlanSafelyToPantry(
        preview.pantry, syncedRecipes, mealPlan, profile,
      );
      if (JSON.stringify(syncedRecipes) !== JSON.stringify(recipes) ||
          JSON.stringify(newPlan) !== JSON.stringify(mealPlan)) return "ineligible";

      const operationId = typeof globalThis.crypto?.randomUUID === "function"
        ? `guest-purchase-${globalThis.crypto.randomUUID()}`
        : `guest-purchase-${Date.now()}`;
      const written = commitConfirmedGuestPurchaseIntent(localStorage, {
        operationId, occurredAt, acquiredAt,
        expectedPantry: guestPantryCommittedRef.current,
        expectedShopping: shoppingList,
        expectedProgression: progressionLedger,
      });
      if (written.status === "saved" || written.status === "saved-pending-cleanup") {
        const stockRaw = localStorage.getItem(GUEST_PANTRY_KEY);
        const stock = inspectGuestPantry(stockRaw);
        const committedShopping = parseStoredShoppingCache(localStorage.getItem("balkanbite_shopping"));
        const ledgerRaw = localStorage.getItem("balkanbite_progression");
        if (stock.requiresRecovery || !committedShopping || ledgerRaw === null) {
          setGuestJournalRecoveryStatus("blocked");
          setGuestDerivedShoppingRecoveryProblem(true);
          return "blocked";
        }
        guestPantryCommittedRef.current = stock.items;
        setPantry(stock.items);
        setShoppingList(committedShopping);
        setProgressionLedger(parseProgressionLedgerCache(ledgerRaw));
        if (written.status === "saved-pending-cleanup") {
          setGuestJournalRecoveryStatus("pending");
        }
        return "saved";
      }

      // No fallback after a WAL attempt: it may have saved the pantry but not
      // the remaining keys. The exact original intent is retained for reload.
      const retained = localStorage.getItem(GUEST_PURCHASE_INTENT_KEY) !== null;
      setGuestJournalRecoveryStatus(retained ? "blocked" : "clear");
      setGuestDerivedShoppingRecoveryProblem(true);
      alert(profile.language === "bg"
        ? "Покупката не е потвърдена напълно. Проверете данните след презареждане."
        : profile.language === "es"
        ? "No se ha podido confirmar toda la compra. Recarga y revisa los datos antes de continuar."
        : "The entire purchase could not be confirmed. Reload and review the data before continuing.");
      return "blocked";
    } catch (error) {
      setGuestJournalRecoveryStatus("blocked");
      setGuestDerivedShoppingRecoveryProblem(true);
      console.warn("Guest purchase intent failed", error);
      return "blocked";
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
        const purchaseIntent = tryJournalGuestCheckedTransfer(preview, occurredAt, acquiredAt);
        if (purchaseIntent === "blocked") return;
        if (purchaseIntent === "ineligible") {
          if (!commitGuestPantry(preview.pantry)) return;
          setShoppingList(preview.shoppingList);
          appendLocalProgressionEvents(
            buildPurchaseProgressEvents({
              occurredAt,
              newlyAppliedSourceIds: preview.newlyAppliedSourceIds,
            }),
          );
        }
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
      if (!commitGuestPantry(preview.pantry)) return false;
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
    const newLog = buildMealLogPreservingNutritionUncertainty({
      ...logData,
      id: `log-${Date.now()}`,
      date,
      timestamp,
    });

    if (!newLog) {
      console.warn("Meal log rejected because meal identity or explicitly verified nutrition was invalid.");
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
    if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
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
      if (!mutationId || (purpose !== "food-use" && purpose !== "discard") ||
          workspaceScope !== "guest" || guestPantryRecovery !== "none") return false;
      try {
        // An acknowledged mutationId is a no-op EVEN if current stock is now
        // insufficient for a second deduction. Never recalculate first.
        const receipts = parseGuestVoiceReceipts(
          localStorage.getItem(GUEST_VOICE_RECEIPTS_KEY),
        );
        if (receipts?.some(receipt => receipt.mutationId === mutationId)) {
          const already = receipts.find(receipt => receipt.mutationId === mutationId)!;
          const canonical = (items || []).map(item => ({
            name: typeof item?.name === "string" ? item.name.trim() : "",
            quantity: typeof item?.quantity === "number"
              ? item.quantity : Number(item?.quantity),
            unit: typeof item?.unit === "string" ? item.unit.trim() : "",
          }));
          return already.purpose === purpose &&
            JSON.stringify(already.items) === JSON.stringify(canonical);
        }

        const rawRecipes = localStorage.getItem("balkanbite_recipes");
        const rawPlan = localStorage.getItem("balkanbite_mealplan");
        const rawShopping = localStorage.getItem("balkanbite_shopping");
        const storedRecipes = parseStoredRecipeCache(rawRecipes);
        const storedPlan = parseStoredMealPlanCache(rawPlan);
        const storedShopping = parseStoredShoppingCache(rawShopping);
        const pantryBaseline = guestPantryCommittedRef.current;
        if (!storedRecipes || !storedPlan || !storedShopping ||
            !guestShoppingCacheIsComplete(rawShopping) ||
            JSON.stringify(storedPlan) !== JSON.stringify(mealPlan) ||
            JSON.stringify(storedShopping) !== JSON.stringify(shoppingList) ||
            JSON.stringify(pantryBaseline) !== JSON.stringify(pantry) ||
            storedRecipes.length !== recipes.length ||
            storedRecipes.some(row => {
              const displayed = recipes.find(r => r.id === row.id);
              return !displayed ||
                JSON.stringify(row.ingredients) !== JSON.stringify(displayed.ingredients);
            })) {
          console.warn("Voice guest mutation requires complete unchanged source caches");
          return false;
        }
        const occurredAt = new Date().toISOString();
        const result = deductVoiceItemsFromPantry(
          pantryBaseline, items || [], new Date(occurredAt),
        );
        if (result.issues.length > 0 || result.deductions.length === 0) {
          console.warn("Voice guest removal rejected; unresolved stock/units", result.issues);
          return false;
        }
        const syncedRecipes = syncRecipesWithPantry(
          storedRecipes, result.pantry, new Date(occurredAt),
        );
        const { newPlan } = adaptMealPlanSafelyToPantry(
          result.pantry, syncedRecipes, storedPlan, profile,
        );
        const nextShopping = reconcileDerivedShortageShoppingItems(
          storedShopping, evaluateShoppingNeeds(
            result.pantry, newPlan, storedShopping, profile.language,
            new Date(occurredAt),
          ).itemsToAddToShoppingList,
        ).next;
        const saved = commitGuestVoiceRemoval(localStorage, {
          mutationId, purpose, occurredAt, language: profile.language,
          items: items || [], expectedPantry: pantryBaseline,
          expectedRecipes: storedRecipes, expectedPlan: storedPlan,
          expectedShopping: storedShopping,
          nextRecipes: syncedRecipes, nextPlan: newPlan, nextShopping,
        });
        if (saved.status === "already-applied") return true;
        if (saved.status !== "saved" && saved.status !== "saved-pending-cleanup") {
          setGuestJournalRecoveryStatus("blocked");
          setGuestDerivedShoppingRecoveryProblem(true);
          console.warn("Guest voice WAL could not complete safely", saved);
          return false;
        }
        const committedPantry = inspectGuestPantry(localStorage.getItem(GUEST_PANTRY_KEY));
        const actualReceipts = parseGuestVoiceReceipts(
          localStorage.getItem(GUEST_VOICE_RECEIPTS_KEY),
        );
        if (committedPantry.requiresRecovery ||
            JSON.stringify(committedPantry.items) !== JSON.stringify(result.pantry) ||
            localStorage.getItem("balkanbite_recipes") !== JSON.stringify(syncedRecipes) ||
            localStorage.getItem("balkanbite_mealplan") !== JSON.stringify(newPlan) ||
            localStorage.getItem("balkanbite_shopping") !== JSON.stringify(nextShopping) ||
            !actualReceipts?.some(receipt => receipt.mutationId === mutationId)) {
          setGuestJournalRecoveryStatus("blocked");
          setGuestDerivedShoppingRecoveryProblem(true);
          return false;
        }
        guestPantryCommittedRef.current = committedPantry.items;
        setPantry(committedPantry.items);
        setRecipes(syncedRecipes.map(recipe => ({
          ...recipe, imageUrl: getRecipeImageUrl(recipe),
        })));
        setMealPlan(newPlan);
        setShoppingList(nextShopping);
        if (saved.status === "saved-pending-cleanup") setGuestJournalRecoveryStatus("pending");
        return true;
      } catch (error) {
        console.warn("Guest voice removal journal could not be verified", error);
        setGuestJournalRecoveryStatus("blocked");
        setGuestDerivedShoppingRecoveryProblem(true);
        return false;
      }
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

  // Chef read-only answers cannot rely on stale React state or a second
  // guest tab's unfinished WAL; signed-in stock needs server confirmation.
  const getAuthoritativePantryForChef = (): readonly PantryItem[] | null => {
    if (isResetting || firebaseLoading || !canRenderApp) return null;
    if (currentUser) {
      return inventoryHydrated && inventoryServerConfirmed &&
        !inventoryIsProvisional && !inventorySyncError &&
        pantryScope === currentUser.uid && workspaceScope === currentUser.uid
        ? getServerConfirmedChefPantry() : null;
    }
    if (pantryScope !== "guest" || workspaceScope !== "guest" ||
        guestPantryRecovery !== "none" || guestJournalRecoveryStatus !== "clear" ||
        guestDerivedShoppingRecoveryProblem) return null;
    try {
      if (hasPendingGuestMutationJournal(localStorage)) return null;
      const inspected = inspectGuestPantry(localStorage.getItem(GUEST_PANTRY_KEY));
      if (inspected.requiresRecovery ||
          JSON.stringify(inspected.items) !== JSON.stringify(pantry) ||
          JSON.stringify(inspected.items) !== JSON.stringify(guestPantryCommittedRef.current)) {
        return null;
      }
      return inspected.items;
    } catch {
      // Storage exceptions are UNKNOWN, never an empty inventory assertion.
      return null;
    }
  };

  // Reading a recorded shopping checklist does not require a healthy
  // progression ledger or meal plan. The shopping source itself must still be
  // complete, account-scoped, unchanged, and free of pending guest journals.
  const getAuthoritativeChefShopping = (): readonly ShoppingItem[] | null => {
    if (isResetting || firebaseLoading || !canRenderApp) return null;
    if (currentUser) {
      return workspaceScope === currentUser.uid
        ? getServerConfirmedChefShopping() : null;
    }
    if (workspaceScope !== "guest" || guestJournalRecoveryStatus !== "clear" ||
        guestDerivedShoppingRecoveryProblem || guestPantryRecovery !== "none") return null;
    try {
      if (hasPendingGuestMutationJournal(localStorage)) return null;
      const raw = localStorage.getItem("balkanbite_shopping");
      if (raw === null || !guestShoppingCacheIsComplete(raw)) return null;
      const parsed = parseStoredShoppingCache(raw);
      if (!parsed || !Array.isArray(JSON.parse(raw)) ||
          JSON.parse(raw).length !== parsed.length ||
          JSON.stringify(parsed) !== JSON.stringify(shoppingList) ||
          hasPendingGuestMutationJournal(localStorage) ||
          localStorage.getItem("balkanbite_shopping") !== raw) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  // Menu-only questions must not fail because of invalid unrelated shopping
  // or progression. Verify the complete menu source, current UI and session.
  const getAuthoritativeChefMealPlan = (): readonly MealPlanDay[] | null => {
    if (isResetting || firebaseLoading || !canRenderApp) return null;
    if (currentUser) {
      return workspaceScope === currentUser.uid
        ? getServerConfirmedChefMealPlan() : null;
    }
    if (workspaceScope !== "guest" || guestJournalRecoveryStatus !== "clear" ||
        guestPantryRecovery !== "none") return null;
    try {
      if (hasPendingGuestMutationJournal(localStorage)) return null;
      const raw = localStorage.getItem("balkanbite_mealplan");
      if (raw === null) return null;
      const parsed = parseStoredMealPlanCache(raw);
      if (!parsed || !Array.isArray(JSON.parse(raw)) ||
          JSON.parse(raw).length !== parsed.length ||
          JSON.stringify(parsed) !== JSON.stringify(mealPlan) ||
          hasPendingGuestMutationJournal(localStorage) ||
          localStorage.getItem("balkanbite_mealplan") !== raw) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  // A composite answer is not trustworthy just because pantry is confirmed.
  // For now use only complete, unchanged guest caches; authenticated menu,
  // shopping and progression lack a common server-confirmed read gate.
  const getAuthoritativeChefWorkspace = (): ChefWorkspaceSnapshot | null => {
    const verifiedPantry = getAuthoritativePantryForChef();
    if (verifiedPantry === null) return null;
    if (currentUser) {
      // Only Firestore's server-confirmed, unfiltered, owner-scoped listener
      // echoes matching current UI for all three modules can supply facts.
      const confirmed = getServerConfirmedChefWorkspace(progressionLedger);
      return confirmed ? { pantry: verifiedPantry, ...confirmed } : null;
    }
    try {
      const planRaw = localStorage.getItem("balkanbite_mealplan");
      const shoppingRaw = localStorage.getItem("balkanbite_shopping");
      const progressionRaw = localStorage.getItem("balkanbite_progression");
      if (planRaw === null || shoppingRaw === null || progressionRaw === null ||
          !guestShoppingCacheIsComplete(shoppingRaw)) return null;
      const parsedPlan = parseStoredMealPlanCache(planRaw);
      const parsedShopping = parseStoredShoppingCache(shoppingRaw);
      const parsedProgression = parseProgressionLedgerCache(progressionRaw);
      const unfiltered = (raw: string, length: number): boolean => {
        const decoded: unknown = JSON.parse(raw);
        return Array.isArray(decoded) && decoded.length === length;
      };
      if (!parsedPlan || !parsedShopping ||
          !unfiltered(planRaw, parsedPlan.length) ||
          !unfiltered(shoppingRaw, parsedShopping.length) ||
          !unfiltered(progressionRaw, parsedProgression.length) ||
          JSON.stringify(parsedPlan) !== JSON.stringify(mealPlan) ||
          JSON.stringify(parsedShopping) !== JSON.stringify(shoppingList) ||
          JSON.stringify(parsedProgression) !== JSON.stringify(progressionLedger)) return null;
      // Reject mid-read localStorage changes and a WAL appearing in another tab.
      if (hasPendingGuestMutationJournal(localStorage) ||
          localStorage.getItem("balkanbite_mealplan") !== planRaw ||
          localStorage.getItem("balkanbite_shopping") !== shoppingRaw ||
          localStorage.getItem("balkanbite_progression") !== progressionRaw) return null;
      return {
        pantry: verifiedPantry, mealPlan: parsedPlan,
        shopping: parsedShopping, progression: parsedProgression,
      };
    } catch {
      return null;
    }
  };

  const checkedShoppingCount = shoppingList.filter((i) => !i.checked).length;

  if (showLanding) {
    return (
      <Suspense fallback={<div data-testid="landing-loading" className="min-h-screen bg-[#0B0F12]" />}>
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
      </Suspense>
    );
  }

  const hasDistinctGuestPantryBackup = (() => {
    if (currentUser || guestPantryRecovery !== "blocked") return false;
    try {
      const original = localStorage.getItem(GUEST_PANTRY_KEY);
      const backup = localStorage.getItem(GUEST_PANTRY_QUARANTINE_KEY);
      return original !== null && backup !== null && original !== backup;
    } catch {
      return false;
    }
  })();

  const downloadGuestPantryRecovery = (source: "current" | "backup") => {
    // Export only on explicit user action; never upload or log pantry details.
    try {
      const original = localStorage.getItem(GUEST_PANTRY_KEY);
      const savedBackup = localStorage.getItem(GUEST_PANTRY_QUARANTINE_KEY);
      // When backup conflicts with a different original, both must remain
      // accessible separately. No recovery button mutates localStorage.
      const raw = source === "backup" ? savedBackup
        : guestPantryRecovery === "blocked" ? (original ?? savedBackup)
        : savedBackup;
      if (raw === null) return;
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      // The untouched original could itself contain malformed JSON.
      // Preserve its exact bytes and do not mislabel invalid text as JSON.
      let extension = "json";
      try { JSON.parse(raw); } catch { extension = "txt"; }
      link.download = `balkanbite-guest-pantry-${source === "backup" ? "previous-backup" : "original"}.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      alert(profile.language === "es"
        ? "No fue posible exportar los datos desde este navegador."
        : profile.language === "bg"
        ? "Не успяхме да експортираме данните от този браузър."
        : "Could not export the data from this browser.");
    }
  };

  return (
    <div
      id="app-root"
      data-theme={theme}
      className={`min-h-screen w-full overflow-x-hidden flex flex-col items-center justify-start antialiased selection:bg-emerald-500 selection:text-white transition-colors duration-200 ${
        theme === "dark" ? "bg-[#0B0F12] text-stone-100" : "bg-[#F8FAFC] text-slate-900"
      }`}
    >
      <div className="w-full max-w-6xl mx-auto min-h-screen relative pb-28 px-2.5 sm:px-6 lg:px-8">
        {!currentUser && guestJournalRecoveryStatus !== "clear" && (
          <section role="alert" data-testid="guest-journal-recovery-warning"
            className="my-3 rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {profile.language === "bg"
              ? "Незавършена локална операция. Промените в наличностите и покупките са спрени, докато възстановяването не приключи безопасно."
              : profile.language === "es"
              ? "Hay una operación local sin finalizar. Los cambios de despensa y compras están bloqueados hasta recuperar o revisar los datos."
              : "An unfinished local operation needs recovery. Pantry and shopping edits are blocked until it is safely resolved."}
          </section>
        )}
        {!currentUser && guestDerivedShoppingRecoveryProblem && (
          <section role="alert" data-testid="guest-shopping-consistency-warning"
            className="my-3 rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {profile.language === "bg"
              ? "Не успяхме да потвърдим, че наличностите и списъкът за пазаруване са синхронизирани. Промените и автоматичните предложения са спрени. Прегледайте данните и презаредете."
              : profile.language === "es"
              ? "No se ha podido confirmar que la despensa y la lista de compra estén sincronizadas. Se suspenden los cambios y faltantes automáticos. Revisa los datos y recarga."
              : "Pantry and shopping consistency could not be confirmed. Edits and generated shortages are paused. Review the data and reload."}
          </section>
        )}
        {!currentUser && guestPantryRecovery !== "none" && (
          <section role="alert" data-testid="guest-pantry-recovery" className="my-3 rounded-xl border border-amber-500/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            <p className="font-semibold">
              {profile.language === "bg"
                ? "Възстановяване на данни от гост-панела"
                : profile.language === "es"
                ? "Recuperación de datos de la despensa invitada"
                : "Guest pantry data recovery"}
            </p>
            <p className="mt-1">
              {guestPantryRecovery === "blocked"
                ? profile.language === "bg"
                  ? "Не можахме да запазим безопасно оригиналните записи. Новите промени няма да се съхраняват, докато проблемът не бъде решен."
                  : profile.language === "es"
                  ? "No se pudo proteger la copia original. Las modificaciones no se guardarán hasta resolverlo."
                  : "The original data could not be protected. Edits will not be saved until this is resolved."
                : profile.language === "bg"
                ? "Някои стари записи не могат да бъдат потвърдени. Запазихме оригиналното съдържание отделно; не се превръща автоматично в наличност."
                : profile.language === "es"
                ? "Algunos registros antiguos no se han podido validar. Se ha conservado el contenido original por separado; no se convierte automáticamente en existencias."
                : "Some older records could not be verified. Their original content was preserved separately, not counted as confirmed stock."}
            </p>
            {guestPantryRecovery === "available" && !guestPantryRecoveryAcknowledged && (
              <button
                type="button"
                data-testid="guest-pantry-continue-verified"
                onClick={() => setGuestPantryRecoveryAcknowledged(true)}
                className="mt-2 mr-2 rounded-lg border border-emerald-400/60 px-3 py-2 text-xs font-semibold hover:bg-emerald-500/10"
              >
                {profile.language === "bg"
                  ? "Продължи само с проверените продукти"
                  : profile.language === "es"
                  ? "Continuar solo con entradas validadas"
                  : "Continue with verified entries only"}
              </button>
            )}
            {guestPantryRecovery === "available" && guestPantryRecoveryAcknowledged && (
              <p className="mt-2 text-xs font-semibold">
                {profile.language === "bg"
                  ? "Работите само с проверените записи; непроверените остават в резервното копие."
                  : profile.language === "es"
                  ? "Estás trabajando solo con las entradas validadas; las demás permanecen en la copia de recuperación."
                  : "You are using verified entries only; unverified records remain in the recovery copy."}
              </p>
            )}
            <button type="button" onClick={() => downloadGuestPantryRecovery("current")} className="mt-2 rounded-lg border border-amber-400/60 px-3 py-2 text-xs font-semibold hover:bg-amber-500/10">
              {profile.language === "bg" ? "Изтеглете оригиналните данни" : profile.language === "es" ? "Descargar datos originales" : "Download original data"}
            </button>
            {hasDistinctGuestPantryBackup && (
              <button type="button" data-testid="guest-pantry-download-previous-backup" onClick={() => downloadGuestPantryRecovery("backup")} className="mt-2 ml-2 rounded-lg border border-amber-400/60 px-3 py-2 text-xs font-semibold hover:bg-amber-500/10">
                {profile.language === "bg" ? "Изтеглете предишното резервно копие" : profile.language === "es" ? "Descargar copia anterior" : "Download previous backup"}
              </button>
            )}
          </section>
        )}
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
            pantryDerivedDataProvisional ? undefined : shoppingDiagnostic.urgencyLevel
          }
          shoppingBadgeCount={
            pantryDerivedDataProvisional
              ? 0
              : shoppingDiagnostic.missingMealIngredients.length +
                shoppingDiagnostic.pendingShoppingItemsCount
          }
        />

        <main className="px-4 py-3">
          <Suspense fallback={<div data-testid="route-view-loading" className="py-8 text-center text-sm text-stone-400">Loading…</div>}>
          {!pantryDerivedDataProvisional && (
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
              mealLogs={mealLogs}
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
              onLogMeal={handleLogMeal}
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
                if (!currentUser && (guestJournalRecoveryStatus !== "clear" ||
      blockLegacyGuestWriteForPendingJournal())) return false;
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
              onGetAuthoritativePantry={getAuthoritativePantryForChef}
              onGetAuthoritativeWorkspace={getAuthoritativeChefWorkspace}
               onGetAuthoritativeShopping={getAuthoritativeChefShopping}
              onGetAuthoritativeMealPlan={getAuthoritativeChefMealPlan}
              onNavigateToTab={setActiveTab}
              onLogMeal={handleLogMeal}
              foodSafety={foodSafetyQuarantine}
              profileAuthorityReady={!currentUser || profileHydrated}
              language={profile.language}
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
          </Suspense>
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

        {showChefIaModal && (
          <Suspense fallback={null}>
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
              onGetAuthoritativePantry={getAuthoritativePantryForChef}
              onGetAuthoritativeWorkspace={getAuthoritativeChefWorkspace}
               onGetAuthoritativeShopping={getAuthoritativeChefShopping}
              onGetAuthoritativeMealPlan={getAuthoritativeChefMealPlan}
              onNavigateToTab={setActiveTab}
          onLogMeal={handleLogMeal}
          foodSafety={foodSafetyQuarantine}
          profileAuthorityReady={!currentUser || profileHydrated}
          language={profile.language}
            />
          </Suspense>
        )}

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

        {showProModal && (
          <Suspense fallback={null}>
            <ProModal
              isOpen={showProModal}
              onClose={() => setShowProModal(false)}
              language={profile.language}
            />
          </Suspense>
        )}

        <Suspense fallback={null}>
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
        </Suspense>

        {showAuthModal && (
          <Suspense fallback={null}>
            <AuthModal
              isOpen={true}
              onClose={() => setShowAuthModal(false)}
              currentUser={currentUser}
              language={profile.language}
              onGuestAccess={() => setShowAuthModal(false)}
            />
          </Suspense>
        )}

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

        {showShoppingAdvisorModal && !inventoryIsProvisional && (
          <Suspense fallback={null}>
            <SmartShoppingModal
          isOpen={true}
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
          </Suspense>
        )}
      </div>
    </div>
  );
}