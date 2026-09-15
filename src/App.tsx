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
  INITIAL_PANTRY,
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
import {
  transferCheckedShoppingItems,
  reconcileConfirmedShoppingPurchases,
  type RawReconciliationExtraItem,
} from "./utils/purchasePantryMerge";
import { normalizeVoicePantryItems } from "./utils/safeVoicePantryCapture";

export default function App() {
  const [pantry, setPantry] = useState<PantryItem[]>(() => {
    try {
      const saved = localStorage.getItem("balkanbite_pantry");
      if (saved === null) return INITIAL_PANTRY;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_PANTRY;
    } catch {
      return INITIAL_PANTRY;
    }
  });

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

  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem("balkanbite_profile");
      return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  });

  const {
    currentUser,
    loading: firebaseLoading,
    inventoryHydrated,
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
      if (inventoryHydrated && pantryScope !== currentUser.uid) {
        setPantryScope(currentUser.uid);
      }
      return;
    }

    if (firebaseLoading || pantryScope === "guest") return;

    try {
      const savedGuestPantry = localStorage.getItem("balkanbite_pantry");
      if (savedGuestPantry === null) {
        setPantry(INITIAL_PANTRY);
      } else {
        const parsed = JSON.parse(savedGuestPantry);
        setPantry(Array.isArray(parsed) ? parsed : INITIAL_PANTRY);
      }
    } catch {
      setPantry(INITIAL_PANTRY);
    }
    setPantryScope("guest");
  }, [currentUser, firebaseLoading, inventoryHydrated, pantryScope, isResetting]);

  useEffect(() => {
    if (isResetting) return;

    try {
      if (currentUser) {
        if (!inventoryHydrated || pantryScope !== currentUser.uid) return;
        localStorage.setItem(
          `balkanbite_pantry_user_${currentUser.uid}`,
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
    if (isResetting) return;
    try {
      localStorage.setItem("balkanbite_recipes", JSON.stringify(recipes));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [recipes, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      localStorage.setItem("balkanbite_shopping", JSON.stringify(shoppingList));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [shoppingList, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      localStorage.setItem("balkanbite_profile", JSON.stringify(profile));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [profile, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      localStorage.setItem("balkanbite_mealplan", JSON.stringify(mealPlan));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [mealPlan, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      localStorage.setItem("balkanbite_meallogs", JSON.stringify(mealLogs));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [mealLogs, isResetting]);

  useEffect(() => {
    if (isResetting) return;
    try {
      localStorage.setItem("balkanbite_chat_messages", JSON.stringify(chatMessages));
    } catch (e) {
      console.warn("localStorage write error", e);
    }
  }, [chatMessages, isResetting]);

  const updatePantryAndReconcileMenu = (
    newPantryItemsToAdd: PantryItem[],
    showToast = true
  ) => {
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
  }, [shoppingDiagnostic, hasNotificationPermission, profile.language]);

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
    if (newQty <= 0) {
      handleDeletePantryItem(id);
      return;
    }
    setPantry((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
  };

  const handleDeletePantryItem = (id: string) => {
    setPantry((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearPantry = () => {
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
    if (!profile.isProSubscriber) {
      setShowProModal(true);
      return;
    }

    setIsGeneratingPlan(true);
    try {
      const res = await fetch("/api/ai/generate-weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantry,
          recipes,
          profile,
          language: profile.language,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.mealPlan) && data.mealPlan.length > 0) {
        setMealPlan(data.mealPlan);
      } else {
        const today = new Date();
        const newPlan: MealPlanDay[] = [];
        const pool = recipes.length > 0 ? recipes : [...INITIAL_RECIPES, ...SAMPLE_RECIPES];
        const bPool = pool.filter((r) => r.tags.includes("Desayuno") || r.tags.includes("breakfast") || r.tags.includes("quick") || r.tags.includes("Saludable"));
        const mPool = pool.filter((r) => !r.tags.includes("Desayuno") && !r.tags.includes("breakfast"));

        for (let d = 0; d < 7; d++) {
          const dObj = new Date(today);
          dObj.setDate(today.getDate() + d);
          const dateStr = dObj.toISOString().split("T")[0];

          const bRecipe = bPool.length > 0 ? bPool[d % bPool.length] : pool[d % pool.length];
          const lRecipe = mPool.length > 0 ? mPool[(d * 2) % mPool.length] : pool[(d + 1) % pool.length];
          const dRecipe = mPool.length > 0 ? mPool[(d * 2 + 1) % mPool.length] : pool[(d + 2) % pool.length];

          newPlan.push({
            date: dateStr,
            breakfast: bRecipe,
            lunch: lRecipe,
            dinner: dRecipe,
          });
        }
        setMealPlan(newPlan);
      }
    } catch (err) {
      console.error("Failed to generate AI weekly menu, applying local fallback:", err);
      const today = new Date();
      const newPlan: MealPlanDay[] = [];
      const pool = recipes.length > 0 ? recipes : [...INITIAL_RECIPES, ...SAMPLE_RECIPES];
      const bPool = pool.filter((r) => r.tags.includes("Desayuno") || r.tags.includes("breakfast") || r.tags.includes("quick") || r.tags.includes("Saludable"));
      const mPool = pool.filter((r) => !r.tags.includes("Desayuno") && !r.tags.includes("breakfast"));

      for (let d = 0; d < 7; d++) {
        const dObj = new Date(today);
        dObj.setDate(today.getDate() + d);
        const dateStr = dObj.toISOString().split("T")[0];

        const bRecipe = bPool.length > 0 ? bPool[d % bPool.length] : pool[d % pool.length];
        const lRecipe = mPool.length > 0 ? mPool[(d * 2) % mPool.length] : pool[(d + 1) % pool.length];
        const dRecipe = mPool.length > 0 ? mPool[(d * 2 + 1) % mPool.length] : pool[(d + 2) % pool.length];

        newPlan.push({
          date: dateStr,
          breakfast: bRecipe,
          lunch: lRecipe,
          dinner: dRecipe,
        });
      }
      setMealPlan(newPlan);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleResetApp = () => {
    setIsResetting(true);
    setTimeout(() => {
      const keys = [
        "balkanbite_pantry",
        "balkanbite_recipes",
        "balkanbite_shopping",
        "balkanbite_profile",
        "balkanbite_mealplan",
        "balkanbite_meallogs",
        "balkanbite_chat_messages"
      ];
      keys.forEach(k => localStorage.removeItem(k));
      localStorage.clear();
      window.location.href = window.location.origin + window.location.pathname;
    }, 100);
  };

  const handleCookRecipe = (recipe: Recipe) => {
    setPantry((currentPantry) => {
      const result = deductRecipeIngredientsFromPantry(
        currentPantry,
        recipe.ingredients || []
      );

      if (result.issues.length > 0) {
        console.warn(
          "Pantry consumption skipped for unresolved ingredients",
          result.issues
        );
      }

      return result.pantry;
    });
  };

  const handleAddMissingToShopping = (recipe: Recipe) => {
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
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/ai/generate-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantry,
          profile,
          query: queryText || voiceSearchQuery,
          language: profile.language,
        }),
      });

      const data = await res.json();
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
    const checkedItems = shoppingList.filter((i) => i.checked);
    if (checkedItems.length === 0) return;

    const result = transferCheckedShoppingItems(
      pantry, shoppingList, new Date().toISOString().split("T")[0]
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
    const result = reconcileConfirmedShoppingPurchases(
      pantry,
      shoppingList,
      purchasedItemIds || [],
      itemsToAddToPantry || [],
      new Date().toISOString().split("T")[0],
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
    const newLog = {
      id: `log-${Date.now()}`,
      date: new Date().toISOString().split("T")[0],
      mealType: logData.mealType || "snack",
      manualName: logData.manualName || "Unknown Meal",
      calories: logData.calories || 0,
      proteinG: logData.proteinG || 0,
      carbsG: logData.carbsG || 0,
      fatG: logData.fatG || 0,
      timestamp: new Date().toISOString(),
    };
    setMealLogs((prev) => [...prev, newLog]);
  };

  const handleGenerateAiShopping = async () => {
    setIsLoadingAi(true);
    try {
      const res = await fetch("/api/ai/suggest-shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pantry,
          profile,
          language: profile.language,
        }),
      });

      const data = await res.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        const newItems: ShoppingItem[] = data.items.map((i: any, idx: number) => ({
          id: `shop-ai-${Date.now()}-${idx}`,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category || "Produce",
          // Advisor output is not an authoritative purchase price. Keep it unknown
          // until the user records an actual price during purchase.
          estimatedPriceEUR: undefined,
          checked: false,
          reason: i.reason,
        }));
        setShoppingList((prev) => [...prev, ...newItems]);
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
        onOpenPro={() => {
          setShowLanding(false);
          setShowProModal(true);
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
          onOpenProModal={() => setShowProModal(true)}
          theme={theme}
          onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
          onGoToLanding={() => setShowLanding(true)}
          currentUser={currentUser}
          onOpenAuthModal={() => setShowAuthModal(true)}
          onOpenShoppingAdvisor={() => setShowShoppingAdvisorModal(true)}
          shoppingUrgencyLevel={shoppingDiagnostic.urgencyLevel}
          shoppingBadgeCount={
            shoppingDiagnostic.missingMealIngredients.length +
            shoppingDiagnostic.pendingShoppingItemsCount
          }
        />

        <main className="px-4 py-3">
          <SmartShoppingBanner
            diagnostic={shoppingDiagnostic}
            language={profile.language}
            currency={profile.currency}
            onOpenAdvisorModal={() => setShowShoppingAdvisorModal(true)}
            onAddMissingToShoppingList={handleAddMultipleShoppingItems}
            onGoToShoppingTab={() => setActiveTab("shopping")}
            theme={theme}
          />

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
              theme={theme}
            />
          )}

          {activeTab === "mealPlan" && (
            <MealPlanView
              mealPlan={mealPlan}
              mealLogs={mealLogs}
              recipes={recipes}
              pantry={pantry}
              language={profile.language}
              currency={profile.currency}
              shoppingList={shoppingList}
              userName={profile.name}
              onClearMealPlan={handleClearMealPlan}
              onNavigateToVoice={() => setShowChefIaModal(true)}
              isPro={profile.isProSubscriber}
              onOpenProModal={() => setShowProModal(true)}
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
              isPro={profile.isProSubscriber}
              onOpenProModal={() => setShowProModal(true)}
              onOpenShoppingAdvisor={() => setShowShoppingAdvisorModal(true)}
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

        {firebaseLoading && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 font-bold text-sm">
                {profile.language === "es"
                  ? "Sincronizando con la nube..."
                  : profile.language === "bg"
                  ? "Синхронизиране с облака..."
                  : "Syncing with cloud..."}
              </p>
            </div>
          </div>
        )}

        <ProModal
          isOpen={showProModal}
          onClose={() => setShowProModal(false)}
          language={profile.language}
          currency={profile.currency}
          isPro={profile.isProSubscriber}
          onTogglePro={() =>
            setProfile((prev) => ({
              ...prev,
              isProSubscriber: !prev.isProSubscriber,
            }))
          }
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
          isOpen={showShoppingAdvisorModal}
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