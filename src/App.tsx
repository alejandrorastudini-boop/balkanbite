import React, { useState, useEffect, useMemo } from "react";
import { Header } from "./components/Header";
import { BottomNav, TabType } from "./components/BottomNav";
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
import { adaptMealPlanToPantry, syncRecipesWithPantry } from "./utils/menuAutoPlanner";
import { evaluateShoppingNeeds } from "./utils/shoppingAdvisor";
import {
  deductRecipeIngredientsFromPantry,
  deductVoiceItemsFromPantry,
} from "./utils/pantryConsumption";
import { buildRecipeShoppingNeeds } from "./utils/recipeShoppingNeeds";
import type { RecipeCookOutcome } from "./utils/recipeCookFeedback";
import {
  transferCheckedShoppingItems,
  reconcileConfirmedShoppingPurchases,
  type RawReconciliationExtraItem,
} from "./utils/purchasePantryMerge";
import { normalizeVoicePantryItems } from "./utils/safeVoicePantryCapture";
import {
  getUserPantryCacheKey,
  parseUserPantryCache,
} from "./utils/startupPantryCache";
import { loadGuestPantry } from "./utils/guestPantry";
import {
  createSignedInProfileDefaults,
  getUserProfileCacheKey,
  parseGuestProfileCache,
  parseUserProfileCache,
} from "./utils/profileSyncBoundary";
import { getUserLocalWorkspaceKey, parseArrayCache } from "./utils/localWorkspaceScope";
import { clearBalkanBiteLocalStorage } from "./utils/localDataReset";
import { buildAiCulinaryProfileContext } from "./utils/aiCulinaryProfileContext";
import { buildVerifiedMealLog } from "./utils/verifiedMealLog";
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
    try {
      const saved = localStorage.getItem("balkanbite_recipes");
      const list: Recipe[] = saved ? JSON.parse(saved) : INITIAL_RECIPES;
      return list.map((r: Recipe) => ({
        ...r,
        imageUrl: getRecipeImageUrl(r),
      }));
    } catch {
      return INITIAL_RECIPES.map((r: Recipe) => ({
        ...r,
        imageUrl: getRecipeImageUrl(r),
      }));
    }
  });

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    try {
      const saved = localStorage.getItem("balkanbite_shopping");
      // A missing saved list is unknown/empty, not permission to seed fabricated
      // basket items or prices. Users add or confirm every shopping item.
      return saved ? JSON.parse(saved) : [];
    } catch {
      // Invalid saved data must not be replaced with an authoritative-looking
      // sample basket or prices.
      return [];
    }
  });

  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>(() => {
    try {
      const saved = localStorage.getItem("balkanbite_mealplan");
      return saved ? JSON.parse(saved) : DEFAULT_MEAL_PLAN;
    } catch {
      return DEFAULT_MEAL_PLAN;
    }
  });

  const [mealLogs, setMealLogs] = useState<MealLog[]>(() => {
    try {
      const saved = localStorage.getItem("balkanbite_meallogs");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("balkanbite_chat_messages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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
    canRenderApp,
    profileHydrated,
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
    setShoppingList
  );

  const [pantryScope, setPantryScope] = useState<string>("guest");
  const [profileScope, setProfileScope] = useState<string>("guest");
  const [workspaceScope, setWorkspaceScope] = useState<string>("guest");
  const [activeTab, setActiveTab] = useState<TabType>("pantry");
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

  const requireFoodRecommendationSafetyReview = (): boolean => {
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

      setMealLogs(
        parseArrayCache<MealLog>(
          localStorage.getItem(
            getUserLocalWorkspaceKey(
              "balkanbite_meallogs",
              currentUser.uid
            )
          )
        ) ?? []
      );
      setChatMessages(
        parseArrayCache<ChatMessage>(
          localStorage.getItem(
            getUserLocalWorkspaceKey(
              "balkanbite_chat_messages",
              currentUser.uid
            )
          )
        ) ?? []
      );
      setProgressionLedger(
        parseProgressionLedgerCache(
          localStorage.getItem(
            getUserLocalWorkspaceKey(
              "balkanbite_progression",
              currentUser.uid
            )
          )
        )
      );
      setWorkspaceScope(currentUser.uid);
      return;
    }

    if (firebaseLoading || workspaceScope === "guest") return;

    const guestRecipes =
      parseArrayCache<Recipe>(
        localStorage.getItem("balkanbite_recipes")
      ) ?? INITIAL_RECIPES;
    setRecipes(
      guestRecipes.map((recipe) => ({
        ...recipe,
        imageUrl: getRecipeImageUrl(recipe),
      }))
    );
    setShoppingList(
      parseArrayCache<ShoppingItem>(
        localStorage.getItem("balkanbite_shopping")
      ) ?? []
    );
    setMealPlan(
      parseArrayCache<MealPlanDay>(
        localStorage.getItem("balkanbite_mealplan")
      ) ?? DEFAULT_MEAL_PLAN
    );
    setMealLogs(
      parseArrayCache<MealLog>(
        localStorage.getItem("balkanbite_meallogs")
      ) ?? []
    );
    setChatMessages(
      parseArrayCache<ChatMessage>(
        localStorage.getItem("balkanbite_chat_messages")
      ) ?? []
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
        const cachedProfile = parseUserProfileCache(
          localStorage.getItem(getUserProfileCacheKey(currentUser.uid)),
          currentUser.displayName
        );
        setProfile(
          cachedProfile ??
            createSignedInProfileDefaults(currentUser.displayName)
        );
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
    if (isResetting) return;
    try {
      if (currentUser) {
        if (!profileHydrated || profileScope !== currentUser.uid) return;
        localStorage.setItem(
          getUserProfileCacheKey(currentUser.uid),
          JSON.stringify(profile)
        );
        return;
      }

      if (profileScope !== "guest") return;
      localStorage.setItem("balkanbite_profile", JSON.stringify(profile));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [
    profile,
    currentUser,
    profileHydrated,
    profileScope,
    isResetting,
  ]);

  useEffect(() => {
    if (isResetting || currentUser || workspaceScope !== "guest") return;
    try {
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(mealPlan));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [mealPlan, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      if (currentUser) {
        if (workspaceScope !== currentUser.uid) return;
        localStorage.setItem(
          getUserLocalWorkspaceKey(
            "balkanbite_meallogs",
            currentUser.uid
          ),
          JSON.stringify(mealLogs)
        );
        return;
      }
      if (workspaceScope !== "guest") return;
      localStorage.setItem("balkanbite_meallogs", JSON.stringify(mealLogs));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [mealLogs, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      if (currentUser) {
        if (workspaceScope !== currentUser.uid) return;
        localStorage.setItem(
          getUserLocalWorkspaceKey(
            "balkanbite_chat_messages",
            currentUser.uid
          ),
          JSON.stringify(chatMessages)
        );
        return;
      }
      if (workspaceScope !== "guest") return;
      localStorage.setItem(
        "balkanbite_chat_messages",
        JSON.stringify(chatMessages)
      );
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [chatMessages, currentUser, workspaceScope, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      if (currentUser) {
        if (workspaceScope !== currentUser.uid) return;
        localStorage.setItem(
          getUserLocalWorkspaceKey(
            "balkanbite_progression",
            currentUser.uid
          ),
          JSON.stringify(progressionLedger)
        );
        return;
      }
      if (workspaceScope !== "guest") return;
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

  const updatePantryAndReconcileMenu = (
    newPantryItemsToAdd: PantryItem[],
    showToast = true
  ) => {
    if (!requireAuthoritativeInventory()) return;

    setPantry((prevPantry) => {
      const updatedPantry = [...newPantryItemsToAdd, ...prevPantry];
      const syncedRecipes = syncRecipesWithPantry(recipes, updatedPantry);
      setRecipes(syncedRecipes);

      const { newPlan, readyToCookMealsCount } = adaptMealPlanToPantry(
        updatedPantry,
        syncedRecipes,
        mealPlan,
        profile
      );
      setMealPlan(newPlan);

      if (showToast) {
        setAutoMenuToast({
          isVisible: true,
          readyMealsCount: readyToCookMealsCount,
        });
      }
      return updatedPantry;
    });
  };

  const shoppingDiagnostic = useMemo(() => {
    return evaluateShoppingNeeds(pantry, mealPlan, shoppingList, profile.language);
  }, [pantry, mealPlan, shoppingList, profile.language]);

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

  const handleAddMultipleShoppingItems = (
    items: Array<Omit<ShoppingItem, "id" | "checked">>
  ) => {
    const newItems: ShoppingItem[] = items.map((item, idx) => ({
      ...item,
      id: `s-advisor-${Date.now()}-${idx}`,
      checked: false,
    }));
    setShoppingList((prev) => [...newItems, ...prev]);
  };

  const handleAdaptMenuToPantry = () => {
    if (!requireAuthoritativeInventory()) return;
    const syncedRecipes = syncRecipesWithPantry(recipes, pantry);
    setRecipes(syncedRecipes);
    const { newPlan, readyToCookMealsCount } = adaptMealPlanToPantry(
      pantry,
      syncedRecipes,
      mealPlan,
      profile
    );
    setMealPlan(newPlan);
    setAutoMenuToast({
      isVisible: true,
      readyMealsCount: readyToCookMealsCount,
    });
  };

  const handleAddPantryItem = (item: Omit<PantryItem, "id" | "addedAt">) => {
    // Manual pantry persistence requires an explicit name, positive quantity, and unit.
    // Optional category, cost, and expiry remain unknown when blank.
    if (
      !item.name.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      !item.unit.trim()
    ) return;
    const newItem: PantryItem = {
      ...item,
      id: `p-${Date.now()}`,
      addedAt: new Date().toISOString().split("T")[0],
    };
    updatePantryAndReconcileMenu([newItem], true);
  };

  const handleAddMultiplePantryItems = (items: Array<Omit<PantryItem, "id" | "addedAt">>) => {
    const newItems: PantryItem[] = items.map((item, idx) => ({
      ...item,
      id: `p-${Date.now()}-${idx}`,
      addedAt: new Date().toISOString().split("T")[0],
    }));
    updatePantryAndReconcileMenu(newItems, true);
  };

  const handleUpdatePantryQuantity = (id: string, newQty: number) => {
    if (!requireAuthoritativeInventory()) return;
    if (newQty <= 0) {
      handleDeletePantryItem(id);
      return;
    }
    setPantry((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
  };

  const handleDeletePantryItem = (id: string) => {
    if (!requireAuthoritativeInventory()) return;
    setPantry((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearPantry = () => {
    if (!requireAuthoritativeInventory()) return;
    setPantry([]);
  };

  const handleClearRecipes = () => {
    setRecipes([]);
  };

  const handleClearMealPlan = () => {
    setMealPlan([]);
    setMealLogs([]);
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
      setMealPlan(data.mealPlan);
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

  const handleCookRecipe = (recipe: Recipe): RecipeCookOutcome => {
    if (!requireAuthoritativeInventory()) {
      return { success: false, issueCount: 1 };
    }

    const occurredAt = new Date().toISOString();
    const actionId = createProgressionActionId(
      typeof globalThis.crypto?.randomUUID === "function"
        ? () => globalThis.crypto.randomUUID()
        : undefined
    );

    const result = deductRecipeIngredientsFromPantry(
      pantry,
      recipe.ingredients || []
    );

    if (result.issues.length > 0) {
      console.warn(
        "Pantry consumption skipped for unresolved ingredients",
        result.issues
      );
      return { success: false, issueCount: result.issues.length };
    }

    setPantry(result.pantry);

    if (actionId) {
      const event = buildRecipeCookProgressEvent({
        actionId,
        occurredAt,
        result,
      });
      if (event) appendLocalProgressionEvents([event]);
    }

    return { success: true };
  };

  const handleAddMissingToShopping = (recipe: Recipe) => {
    if (!requireAuthoritativeInventory()) return;
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
      reason:
        profile.language === "bg"
          ? `Необходимо за ${recipeTitle}`
          : profile.language === "es"
          ? `Necesario para ${recipeTitle}`
          : `Needed for ${recipeTitle}`,
    }));

    if (newShoppingItems.length > 0) {
      setShoppingList((prev) => [...prev, ...newShoppingItems]);
    }

    if (unverified.length > 0) {
      alert(
        profile.language === "bg"
          ? `Не добавих автоматично ${unverified.length} съставка(и), защото наличните мерни единици не могат да се сравнят надеждно.`
          : profile.language === "es"
          ? `No he añadido automáticamente ${unverified.length} ingrediente(s) porque las unidades disponibles no se pueden comparar de forma segura.`
          : `I did not automatically add ${unverified.length} ingredient(s) because the available units cannot be safely compared.`
      );
      return;
    }

    if (newShoppingItems.length === 0) {
      alert(
        profile.language === "bg"
          ? "Вече имате достатъчно количество в килера или в списъка за пазаруване."
          : profile.language === "es"
          ? "Ya tienes cantidad suficiente en la despensa o pendiente en la lista de compra."
          : "You already have enough quantity in the pantry or pending on the shopping list."
      );
      return;
    }

    alert(
      profile.language === "bg"
        ? `Добавихте ${newShoppingItems.length} проверени липсващи съставки към списъка за пазаруване!`
        : profile.language === "es"
        ? `¡Añadiste ${newShoppingItems.length} faltante(s) cuantitativo(s) verificado(s) a tu lista de compra!`
        : `Added ${newShoppingItems.length} verified quantitative shortfall(s) to your shopping list!`
    );
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
        setRecipes(enriched);
      }
    } catch (err) {
      console.error("Failed to generate recipes:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleToggleShoppingItem = (id: string) => {
    setShoppingList((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i))
    );
  };

  const handleDeleteShoppingItem = (id: string) => {
    setShoppingList((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddShoppingItem = (item: Omit<ShoppingItem, "id" | "checked">) => {
    const newItem: ShoppingItem = {
      ...item,
      id: `shop-${Date.now()}`,
      checked: false,
    };
    setShoppingList((prev) => [...prev, newItem]);
  };

  const handleTransferToPantry = () => {
    if (!requireAuthoritativeInventory()) return;
    const checkedItems = shoppingList.filter((i) => i.checked);
    if (checkedItems.length === 0) return;

    const occurredAt = new Date().toISOString();
    const result = transferCheckedShoppingItems(
      pantry, shoppingList, occurredAt.split("T")[0]
    );
    if (result.acceptedSourceIds.length > 0) {
      setPantry(result.pantry);
      const syncedRecipes = syncRecipesWithPantry(recipes, result.pantry);
      setRecipes(syncedRecipes);
      const { newPlan, readyToCookMealsCount } = adaptMealPlanToPantry(
        result.pantry, syncedRecipes, mealPlan, profile
      );
      setMealPlan(newPlan);
      setAutoMenuToast({ isVisible: true, readyMealsCount: readyToCookMealsCount });
      setShoppingList(result.shoppingList);
    }

    appendLocalProgressionEvents(
      buildPurchaseProgressEvents({
        occurredAt,
        newlyAppliedSourceIds: result.newlyAppliedSourceIds,
      })
    );

    if (result.rejected.length > 0) {
      alert(profile.language === "es"
        ? "Algunos artículos siguen en la lista: revisa su nombre, cantidad y unidad antes de transferirlos."
        : profile.language === "bg"
        ? "Някои продукти остават в списъка: проверете името, количеството и мерната единица."
        : "Some items remain on the list: check their name, quantity and unit before transferring.");
    }
  };

  const handleReconcileShopping = ({
    purchasedItemIds,
    itemsToAddToPantry,
    reconciliationId,
  }: {
    purchasedItemIds: string[];
    itemsToAddToPantry: RawReconciliationExtraItem[];
    reconciliationId?: string;
  }) => {
    if (!requireAuthoritativeInventory()) return;

    const occurredAt = new Date().toISOString();
    const result = reconcileConfirmedShoppingPurchases(
      pantry,
      shoppingList,
      purchasedItemIds || [],
      itemsToAddToPantry || [],
      occurredAt.split("T")[0],
      reconciliationId || ""
    );

    if (result.acceptedSourceIds.length > 0) {
      setPantry(result.pantry);
      const syncedRecipes = syncRecipesWithPantry(recipes, result.pantry);
      setRecipes(syncedRecipes);
      const { newPlan, readyToCookMealsCount } = adaptMealPlanToPantry(
        result.pantry, syncedRecipes, mealPlan, profile
      );
      setMealPlan(newPlan);
      setAutoMenuToast({ isVisible: true, readyMealsCount: readyToCookMealsCount });
      setShoppingList(result.shoppingList);
    }

    appendLocalProgressionEvents(
      buildPurchaseProgressEvents({
        occurredAt,
        newlyAppliedSourceIds: result.newlyAppliedSourceIds,
      })
    );

    if (
      result.unresolvedPurchasedItemIds.length > 0 ||
      result.rejectedExtraItems.length > 0 ||
      result.rejected.length > 0
    ) {
      alert(
        profile.language === "es"
          ? "Algunos datos no se guardaron porque no tenían una cantidad/unidad verificable o ya no coincidían con tu lista. Revisa la compra antes de intentarlo de nuevo."
          : profile.language === "bg"
          ? "Някои данни не бяха запазени, защото количеството/мерната единица не могат да се потвърдят или вече не съвпадат със списъка."
          : "Some data was not saved because quantity/unit could not be verified or the item no longer matched your shopping list."
      );
    }
  };

  const handleLogMeal = (logData: any) => {
    const now = new Date().toISOString();
    const newLog = buildVerifiedMealLog({
      ...logData,
      id: `log-${Date.now()}`,
      date: now.split("T")[0],
      timestamp: now,
    });

    if (!newLog) {
      console.warn("Meal log rejected because verified nutrition was incomplete or invalid.");
      return;
    }

    setMealLogs((prev) => [...prev, newLog]);
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
            reason: typeof candidate.reason === "string" ? candidate.reason : undefined,
          }];
        });

        if (newItems.length > 0) {
          setShoppingList((prev) => [...prev, ...newItems]);
        }
      }
    } catch (err) {
      console.error("Failed to suggest shopping list:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleVoiceAddItems = (items: any[]) => {
    const { accepted, rejectedCount } = normalizeVoicePantryItems(items || []);
    const now = Date.now();
    const addedAt = new Date().toISOString().split("T")[0];
    const parsed: PantryItem[] = accepted.map((item, idx) => ({
      ...item,
      id: `p-${now}-${idx}`,
      addedAt,
    }));

    if (parsed.length > 0) {
      updatePantryAndReconcileMenu(parsed, true);
    }

    if (rejectedCount > 0) {
      alert(
        profile.language === "bg"
          ? `Не запазих ${rejectedCount} продукт(а), защото липсва потвърдено количество или мерна единица. Кажете количеството и мерната единица и опитайте отново.`
          : profile.language === "es"
          ? `No guardé ${rejectedCount} producto(s) porque faltaba una cantidad o unidad confirmada. Indica la cantidad y la unidad e inténtalo de nuevo.`
          : `I did not save ${rejectedCount} item(s) because a confirmed quantity or unit was missing. Provide the quantity and unit and try again.`
      );
    }
  };

  const handleVoiceDeductItems = (items: any[]) => {
    if (!requireAuthoritativeInventory()) return;
    setPantry((currentPantry) => {
      const result = deductVoiceItemsFromPantry(currentPantry, items || []);

      if (result.issues.length > 0) {
        console.warn(
          "Voice pantry consumption skipped for unresolved items",
          result.issues
        );
      }

      return result.pantry;
    });
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
        onLanguageChange={(lang: Language) => setProfile((p) => ({ ...p, language: lang }))}
        currency={profile.currency}
        onCurrencyChange={(curr: Currency) => setProfile((p) => ({ ...p, currency: curr }))}
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
          onLanguageChange={(lang: Language) => setProfile((p) => ({ ...p, language: lang }))}
          currency={profile.currency}
          onCurrencyChange={(curr: Currency) => setProfile((p) => ({ ...p, currency: curr }))}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onGoToLanding={() => setShowLanding(true)}
          currentUser={currentUser}
          onOpenAuthModal={() => setShowAuthModal(true)}
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

          {activeTab === "pantry" && inventoryIsProvisional && profile.onboardingCompleted && (
            <div
              role="status"
              className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-center text-[11px] font-semibold text-amber-200/90"
            >
              {profile.language === "es"
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
              onClearList={() => setShoppingList([])}
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
              onLoadSampleRecipes={() => setRecipes(SAMPLE_RECIPES)}
              isLoadingAi={isLoadingAi}
              language={profile.language}
              currency={profile.currency}
              progressionSummary={progressionSummary}
              theme={theme}
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
              onDeductItemsFromPantry={handleVoiceDeductItems}
              onNavigateToRecipes={handleVoiceNavigateToRecipes}
              onLogMeal={handleLogMeal}
              foodSafety={foodSafetyQuarantine}
              language={profile.language}
              theme={theme}
            />
          )}

          {activeTab === "profile" && (
            <ProfileView
              profile={profile}
              onUpdateProfile={(upd) => setProfile((prev) => ({ ...prev, ...upd }))}
              onOpenProModal={() => setShowProModal(true)}
              onResetApp={handleResetApp}
              onGoToLanding={() => setShowLanding(true)}
              onOpenAuthModal={() => setShowAuthModal(true)}
              language={profile.language}
              currency={profile.currency}
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
          onDeductItemsFromPantry={handleVoiceDeductItems}
          onNavigateToRecipes={handleVoiceNavigateToRecipes}
          onLogMeal={handleLogMeal}
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
          isOpen={!showLanding && !profile.onboardingCompleted}
          onComplete={(upd) => setProfile((prev) => ({ ...prev, ...upd }))}
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