import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  Clock,
  Utensils,
  Globe,
  Coins,
  CheckCircle2,
  Heart,
  RotateCcw,
  Smartphone,
  Download,
  Check,
  Cloud,
  LogIn,
  LogOut,
  ShieldCheck,
  HeartPulse,
  Trash2,
} from "lucide-react";
import {
  UserProfile,
  Language,
  Currency,
  type HealthDatum,
  type HealthDataStatus,
} from "../types";
import { t } from "../utils/translations";
import { ConfirmModal } from "./ConfirmModal";
import { AdminAgentStatusPanel } from "./AdminAgentStatusPortal";
import { signInWithGoogle, logout, auth } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { getLocalResetCopy } from "../utils/localResetCopy";
import {
  HEALTH_PROFILE_FIELD_KEYS,
  removeHealthProfileField,
  type HealthProfileFieldKey,
} from "../utils/healthProfile";
import { correctExistingHealthProfileField } from "../utils/healthProfileCorrection";
import type { ProgressionActivitySummaryV1 } from "../utils/progressionLedger";

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onOpenProModal: () => void;
  onResetApp: () => void;
  onGoToLanding?: () => void;
  onOpenAuthModal?: () => void;
  language: Language;
  currency: Currency;
  progressionSummary: ProgressionActivitySummaryV1;
}


const HEALTH_FIELD_LABELS: Record<
  HealthProfileFieldKey,
  Record<Language, string>
> = {
  ageYears: { en: "Age", es: "Edad", bg: "Възраст" },
  heightCm: { en: "Height", es: "Altura", bg: "Ръст" },
  weightKg: { en: "Weight", es: "Peso", bg: "Тегло" },
  physiologicalSex: {
    en: "Physiological sex for calculations",
    es: "Sexo fisiológico para cálculos",
    bg: "Физиологичен пол за изчисления",
  },
  activityCategory: {
    en: "Whole-day activity",
    es: "Actividad diaria",
    bg: "Дневна физическа активност",
  },
  pregnancyLactationStatus: {
    en: "Pregnancy / lactation status",
    es: "Estado de embarazo / lactancia",
    bg: "Бременност / кърмене",
  },
};

const HEALTH_FIELD_KNOWN_VALUES: Partial<
  Record<HealthProfileFieldKey, readonly string[]>
> = {
  physiologicalSex: ["female", "male"],
  activityCategory: [
    "low_active",
    "moderately_active",
    "active",
    "very_active",
  ],
  pregnancyLactationStatus: [
    "not_pregnant_or_lactating",
    "pregnant_or_lactating",
  ],
};

const HEALTH_STATUS_OPTIONS: readonly HealthDataStatus[] = [
  "known",
  "unknown",
  "not_applicable",
  "prefer_not_to_say",
];

const NUMERIC_HEALTH_FIELDS = new Set<HealthProfileFieldKey>([
  "ageYears",
  "heightCm",
  "weightKg",
]);

function healthStatusLabel(status: string, language: Language): string {
  const labels: Record<string, Record<Language, string>> = {
    known: { en: "Known", es: "Conocido", bg: "Известно" },
    unknown: { en: "Unknown", es: "Desconocido", bg: "Неизвестно" },
    not_applicable: {
      en: "Not applicable",
      es: "No aplica",
      bg: "Не е приложимо",
    },
    prefer_not_to_say: {
      en: "Prefer not to say",
      es: "Prefiero no decirlo",
      bg: "Предпочитам да не казвам",
    },
  };
  return labels[status]?.[language] ?? status;
}

function healthSourceLabel(source: string, language: Language): string {
  const labels: Record<string, Record<Language, string>> = {
    self_reported: {
      en: "Self-reported",
      es: "Declarado por ti",
      bg: "Посочено от вас",
    },
    measured: { en: "Measured", es: "Medido", bg: "Измерено" },
    imported: { en: "Imported", es: "Importado", bg: "Импортирано" },
    estimated: { en: "Estimated", es: "Estimado", bg: "Оценено" },
  };
  return labels[source]?.[language] ?? source;
}

function healthValueLabel(
  field: HealthProfileFieldKey,
  datum: HealthDatum<unknown>,
  language: Language,
): string | null {
  if (datum.status !== "known") return null;

  const value = datum.value;
  if (typeof value === "number") {
    const unit =
      field === "ageYears"
        ? language === "bg"
          ? "г."
          : language === "es"
          ? "años"
          : "years"
        : field === "heightCm"
        ? "cm"
        : field === "weightKg"
        ? "kg"
        : "";
    return `${value}${unit ? ` ${unit}` : ""}`;
  }

  if (typeof value !== "string") return null;

  const categorical: Record<string, Record<Language, string>> = {
    female: { en: "Female", es: "Femenino", bg: "Женски" },
    male: { en: "Male", es: "Masculino", bg: "Мъжки" },
    low_active: {
      en: "Low active",
      es: "Actividad baja",
      bg: "Ниска активност",
    },
    moderately_active: {
      en: "Moderately active",
      es: "Actividad moderada",
      bg: "Умерена активност",
    },
    active: { en: "Active", es: "Activo", bg: "Активно" },
    very_active: {
      en: "Very active",
      es: "Muy activo",
      bg: "Много активно",
    },
    not_pregnant_or_lactating: {
      en: "Not pregnant or lactating",
      es: "No embarazada ni en lactancia",
      bg: "Не е бременна или кърмеща",
    },
    pregnant_or_lactating: {
      en: "Pregnant or lactating",
      es: "Embarazada o en lactancia",
      bg: "Бременна или кърмеща",
    },
  };
  return categorical[value]?.[language] ?? value;
}

function healthRecordedAtLabel(
  recordedAt: string,
  language: Language,
): string {
  const date = new Date(recordedAt);
  if (!Number.isFinite(date.getTime())) return recordedAt;
  return date.toLocaleString(
    language === "bg" ? "bg-BG" : language === "es" ? "es-ES" : "en-GB",
  );
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onOpenProModal,
  onResetApp,
  onGoToLanding,
  onOpenAuthModal,
  language,
  currency,
  progressionSummary,
}) => {
  const currentText = t[language];
  const [newDislike, setNewDislike] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearHealthDataConfirm, setShowClearHealthDataConfirm] = useState(false);
  const [pendingHealthFieldRemoval, setPendingHealthFieldRemoval] =
    useState<HealthProfileFieldKey | null>(null);
  const [healthFieldEdit, setHealthFieldEdit] = useState<{
    field: HealthProfileFieldKey;
    status: HealthDataStatus;
    value: string;
  } | null>(null);
  const [healthFieldEditError, setHealthFieldEditError] = useState<string | null>(
    null,
  );
  const [showClearLegacyFoodSafetyConfirm, setShowClearLegacyFoodSafetyConfirm] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const localResetCopy = getLocalResetCopy(language, user !== null);

  const healthFieldRows = profile.healthProfile
    ? HEALTH_PROFILE_FIELD_KEYS.flatMap((field) => {
        const datum = profile.healthProfile?.[field];
        return datum ? [{ field, datum: datum as HealthDatum<unknown> }] : [];
      })
    : [];

  const legacyFoodRestrictionLabels = (profile.allergies ?? [])
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());
  const legacyDietRestriction =
    profile.dietStyle === "gluten_free" || profile.dietStyle === "keto"
      ? profile.dietStyle
      : null;
  const hasLegacyFoodSafetyData =
    legacyFoodRestrictionLabels.length > 0 || legacyDietRestriction !== null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallGuide(!showInstallGuide);
    }
  };

  const handleAddDislike = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDislike.trim()) return;
    const updated = [...profile.disliked, newDislike.trim()];
    onUpdateProfile({ disliked: updated });
    setNewDislike("");
  };

  const handleRemoveDislike = (itemToRemove: string) => {
    onUpdateProfile({
      disliked: profile.disliked.filter((i) => i !== itemToRemove),
    });
  };

  const beginHealthFieldCorrection = (
    field: HealthProfileFieldKey,
    datum: HealthDatum<unknown>,
  ) => {
    setHealthFieldEdit({
      field,
      status: datum.status,
      value:
        datum.status === "known" && datum.value !== undefined
          ? String(datum.value)
          : "",
    });
    setHealthFieldEditError(null);
  };

  const cancelHealthFieldCorrection = () => {
    setHealthFieldEdit(null);
    setHealthFieldEditError(null);
  };

  const saveHealthFieldCorrection = () => {
    if (!healthFieldEdit) return;

    const { field, status } = healthFieldEdit;
    let correctedValue: unknown;

    if (status === "known") {
      if (NUMERIC_HEALTH_FIELDS.has(field)) {
        const trimmed = healthFieldEdit.value.trim();
        const numericValue = Number(trimmed);
        if (
          !trimmed ||
          !Number.isFinite(numericValue) ||
          numericValue <= 0
        ) {
          setHealthFieldEditError(
            language === "bg"
              ? "Въведете положителна числова стойност."
              : language === "es"
              ? "Introduce un valor numérico positivo."
              : "Enter a positive numeric value.",
          );
          return;
        }
        correctedValue = numericValue;
      } else {
        if (!healthFieldEdit.value) {
          setHealthFieldEditError(
            language === "bg"
              ? "Изберете стойност."
              : language === "es"
              ? "Selecciona un valor."
              : "Select a value.",
          );
          return;
        }
        correctedValue = healthFieldEdit.value;
      }
    }

    const result = correctExistingHealthProfileField(
      profile.healthProfile,
      field,
      {
        status,
        ...(status === "known" ? { value: correctedValue } : {}),
        recordedAt: new Date().toISOString(),
      },
    );

    if (!result.ok) {
      setHealthFieldEditError(
        language === "bg"
          ? "Промяната не можа да бъде запазена. Съществуващите данни не са променени."
          : language === "es"
          ? "No se pudo guardar la corrección. Los datos existentes no se han modificado."
          : "The correction could not be saved. Existing data was not changed.",
      );
      return;
    }

    onUpdateProfile({ healthProfile: result.profile });
    setHealthFieldEdit(null);
    setHealthFieldEditError(null);
  };

  return (
    <div id="profile-view" className="space-y-4 pb-36 sm:pb-32">
      {/* Upgraded Auth & Cloud Sync Card */}
      <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all">
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    className="w-14 h-14 rounded-full border-2 border-emerald-500/30 object-cover shadow-[0_0_15px_rgba(16,185,129,0.2)] shrink-0"
                    alt="Avatar"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                    <Globe className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white truncate font-['Outfit'] tracking-wide">
                      {user.displayName || currentText.guestUser}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-white/[0.04] text-stone-300 border border-white/[0.08] shrink-0 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Google
                    </span>
                  </div>
                  <p className="text-sm text-stone-400 truncate mt-1 font-medium">
                    {user.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => logout()}
                className="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/10 hover:text-rose-400 border border-white/[0.08] hover:border-rose-500/40 text-stone-300 text-sm font-bold transition-all cursor-pointer shrink-0"
                title={currentText.signOut}
              >
                <LogOut className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">{currentText.signOut}</span>
              </button>
            </div>

            <div className="pt-3 flex items-center justify-between text-xs text-stone-400 border-t border-white/[0.04]">
              <span className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Cloud className="w-4 h-4" />
                {currentText.syncActive || "Respaldo activo"}
              </span>
              {onOpenAuthModal && (
                <button
                  onClick={onOpenAuthModal}
                  className="text-stone-400 hover:text-white transition-colors underline cursor-pointer font-medium"
                >
                  Ver cuenta
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] text-stone-300 border border-white/[0.08] flex items-center justify-center shadow-inner">
                    <Cloud className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-white font-['Outfit'] tracking-wide">
                    {currentText.authModalTitle || "Cuenta y Sincronización en la Nube"}
                  </h3>
                </div>
                <p className="text-sm text-stone-400 leading-relaxed max-w-sm font-medium">
                  {currentText.authModalSubtitle || "Mantén tu despensa, recetas y menú sincronizados entre tu móvil y PC."}
                </p>
              </div>
            </div>

            <button
              id="profile-google-signin-btn"
              onClick={() => (onOpenAuthModal ? onOpenAuthModal() : signInWithGoogle())}
              className="w-full py-3 px-5 rounded-xl bg-white hover:bg-stone-200 text-stone-950 font-extrabold text-sm transition-all flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(255,255,255,0.1)] cursor-pointer font-['Outfit'] tracking-wide"
            >
              <div className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[12px] bg-stone-900 text-white shrink-0">G</div>
              <span>{currentText.continueWithGoogle || "Continuar con Google"}</span>
            </button>
          </div>
        )}
      </div>

      <AdminAgentStatusPanel />

      <div
        id="profile-verified-activity-card"
        data-testid="profile-verified-activity-card"
        className="bg-[#131A1F]/60 backdrop-blur-md border border-emerald-500/20 rounded-3xl p-5 shadow-[0_8px_30px_rgba(16,185,129,0.06)] space-y-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white font-['Outfit'] tracking-wide">
              {language === "bg"
                ? "Потвърдена активност"
                : language === "es"
                ? "Actividad verificada"
                : "Verified activity"}
            </h3>
            <p className="text-sm text-stone-400 leading-relaxed">
              {language === "bg"
                ? "Показва само действия от основния хранителен цикъл, които BalkanBite е потвърдил чрез реална промяна в данните."
                : language === "es"
                ? "Muestra solo acciones del ciclo principal de alimentación que BalkanBite pudo confirmar mediante un cambio real en los datos."
                : "Shows only core food-loop actions BalkanBite could confirm through a real data change."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-black/25 border border-white/[0.06] p-4">
            <div
              id="profile-progress-total"
              className="text-2xl font-extrabold text-emerald-300 font-['Outfit']"
            >
              {progressionSummary.totalVerifiedEvents}
            </div>
            <div className="text-xs text-stone-400 mt-1">
              {language === "bg"
                ? "Потвърдени събития"
                : language === "es"
                ? "Eventos verificados"
                : "Verified events"}
            </div>
          </div>

          <div className="rounded-2xl bg-black/25 border border-white/[0.06] p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              <span
                id="profile-progress-purchases"
                className="text-xl font-extrabold text-white font-['Outfit']"
              >
                {progressionSummary.confirmedPurchaseEvents}
              </span>
            </div>
            <div className="text-xs text-stone-400 mt-2">
              {language === "bg"
                ? "Покупки, добавени в наличност"
                : language === "es"
                ? "Compras aplicadas a despensa"
                : "Purchases applied to pantry"}
            </div>
          </div>

          <div className="rounded-2xl bg-black/25 border border-white/[0.06] p-4">
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 text-amber-400" />
              <span
                id="profile-progress-cooks"
                className="text-xl font-extrabold text-white font-['Outfit']"
              >
                {progressionSummary.successfulCookEvents}
              </span>
            </div>
            <div className="text-xs text-stone-400 mt-2">
              {language === "bg"
                ? "Готвения с реално намаление на наличностите"
                : language === "es"
                ? "Cocinados con descuento real de despensa"
                : "Cooks with real pantry deductions"}
            </div>
          </div>
        </div>

        {progressionSummary.totalVerifiedEvents === 0 && (
          <p
            id="profile-progress-zero-copy"
            className="text-xs text-stone-500 leading-relaxed"
          >
            {language === "bg"
              ? "Все още няма потвърдена активност. Това не е отрицателен резултат — запис се създава само когато действие действително промени наличностите."
              : language === "es"
              ? "Aún no hay actividad verificada. No es un resultado negativo: solo se registra cuando una acción modifica realmente la despensa."
              : "There is no verified activity yet. This is not a negative result: an event is recorded only when an action actually changes pantry state."}
          </p>
        )}

        <p
          id="profile-progress-boundary-copy"
          className="text-xs text-stone-500 leading-relaxed border-t border-white/[0.04] pt-3"
        >
          {language === "bg"
            ? "Това не е здравен резултат и не е баланс с награди. Не оценява тегло, калории или медицински резултати."
            : language === "es"
            ? "Esto no es una puntuación de salud ni un saldo de recompensas. No evalúa peso, calorías ni resultados médicos."
            : "This is not a health score or a reward balance. It does not evaluate weight, calories, or medical outcomes."}
        </p>
      </div>

      {/* BalkanBite Logo Showcase & Download Card */}
      <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-3xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/images/logo.jpg" alt="BalkanBite Logo" className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-[0_4px_15px_rgba(16,185,129,0.2)]" />
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit'] tracking-wide">Logotipo Oficial BalkanBite</h3>
              <p className="text-sm text-stone-400 font-medium">Icono vectorial con isotipo</p>
            </div>
          </div>
          <a href="/images/logo.jpg" download="BalkanBite_Logo.jpg" target="_blank" rel="noopener noreferrer" className="p-3 sm:px-4 sm:py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 cursor-pointer shrink-0">
            <Download className="w-4 h-4" /><span className="hidden sm:inline">Descargar HD</span>
          </a>
        </div>
      </div>

      <div className="bg-[#131A1F]/80 backdrop-blur-md border border-amber-500/20 rounded-3xl p-6 shadow-[0_8px_30px_rgba(245,158,11,0.08)] relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none group-hover:bg-amber-500/15 transition-all duration-700" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold shadow-inner shrink-0"><Sparkles className="w-6 h-6" /></div>
            <div><h2 className="text-lg font-bold text-white font-['Outfit'] tracking-wide">BalkanBite Pro</h2><span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5 mt-0.5">Subscription status unavailable</span></div>
          </div>
          <button onClick={onOpenProModal} className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/[0.04] text-amber-400 text-sm font-bold border border-white/[0.08] hover:bg-white/[0.08] hover:border-amber-500/30 transition-all cursor-pointer text-center">{currentText.manageSub}</button>
        </div>
        <p className="text-sm text-stone-400 font-medium leading-relaxed mt-4 relative z-10">{currentText.proBenefits}</p>
      </div>

      <div className="bg-black/20 border border-white/[0.04] rounded-3xl p-6 space-y-4 shadow-inner">
        <div className="flex items-center gap-2.5 text-white font-bold text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 w-fit"><Clock className="w-4 h-4 text-emerald-400" /><span>{currentText.cookingSpeed}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[{ id: "fast", label: currentText.speedFast }, { id: "moderate", label: currentText.speedModerate }, { id: "elaborate", label: currentText.speedElaborate }].map((opt) => <button key={opt.id} onClick={() => onUpdateProfile({ cookingSpeed: opt.id as any })} className={`p-4 rounded-2xl border text-sm font-bold text-left transition-all cursor-pointer ${profile.cookingSpeed === opt.id ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:bg-white/[0.04] hover:text-stone-300"}`}><div className="flex items-center justify-between"><span>{opt.label}</span>{profile.cookingSpeed === opt.id && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-1" />}</div></button>)}</div>
      </div>

      <div className="bg-black/20 border border-white/[0.04] rounded-3xl p-6 space-y-4 shadow-inner">
        <div className="flex items-center gap-2.5 text-white font-bold text-xs uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 w-fit"><Utensils className="w-4 h-4 text-teal-400" /><span>{currentText.dietType}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[{ id: "all", label: currentText.dietAll }, { id: "mediterranean", label: currentText.dietMed }, { id: "vegetarian", label: currentText.dietVegetarian }, { id: "vegan", label: currentText.dietVegan }].map((opt) => <button key={opt.id} onClick={() => onUpdateProfile({ dietStyle: opt.id as any })} className={`p-4 rounded-2xl border text-sm font-bold text-left transition-all cursor-pointer ${profile.dietStyle === opt.id ? "bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.1)]" : "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:bg-white/[0.04] hover:text-stone-300"}`}><div className="flex items-center justify-between"><span>{opt.label}</span>{profile.dietStyle === opt.id && <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 ml-1" />}</div></button>)}</div>
      </div>


      {hasLegacyFoodSafetyData && (
        <div
          id="profile-legacy-food-safety-card"
          className="bg-[#131A1F]/60 backdrop-blur-md border border-amber-500/25 rounded-3xl p-6 shadow-[0_8px_30px_rgba(245,158,11,0.08)] space-y-4"
        >
          <div className="space-y-1">
            <h3 className="text-base font-bold text-amber-300 font-['Outfit'] tracking-wide">
              {language === "bg"
                ? "Стари данни за хранителни ограничения"
                : language === "es"
                ? "Datos legacy de restricciones alimentarias"
                : "Legacy food-restriction data"}
            </h3>
            <p className="text-sm text-stone-400 leading-relaxed font-medium">
              {language === "bg"
                ? "Тези стойности са запазени от стария поток и не се третират като проверена защита срещу алергени. Докато не бъдат прегледани в бъдещия специализиран поток или премахнати, BalkanBite няма да генерира AI рецепти, менюта или предложения за покупки."
                : language === "es"
                ? "Estos valores se conservaron del flujo antiguo y no se tratan como protección verificada frente a alérgenos. Hasta que puedan revisarse en el futuro flujo específico o los elimines, BalkanBite no generará recetas, menús ni sugerencias de compra con IA."
                : "These values were retained from the old flow and are not treated as verified allergen protection. Until they can be reviewed in the future dedicated flow or you remove them, BalkanBite will not generate AI recipes, meal plans, or shopping suggestions."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {legacyDietRestriction && (
              <span className="text-sm font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
                {legacyDietRestriction === "gluten_free"
                  ? language === "bg"
                    ? "Без глутен (legacy)"
                    : language === "es"
                    ? "Sin gluten (legacy)"
                    : "Gluten-free (legacy)"
                  : "Keto (legacy)"}
              </span>
            )}
            {legacyFoodRestrictionLabels.map((item) => (
              <span
                key={item}
                className="text-sm font-medium px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200"
              >
                {item}
              </span>
            ))}
          </div>

          <button
            id="profile-clear-legacy-food-safety-btn"
            type="button"
            onClick={() => setShowClearLegacyFoodSafetyConfirm(true)}
            className="w-full py-3 px-4 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/15 text-amber-200 text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {language === "bg"
                ? "Премахване на старите ограничения"
                : language === "es"
                ? "Eliminar restricciones legacy"
                : "Delete legacy restrictions"}
            </span>
          </button>
        </div>
      )}

      <div className="bg-black/20 border border-white/[0.04] rounded-3xl p-6 space-y-5 shadow-inner">
        <div className="flex items-center justify-between"><span className="text-white font-bold text-xs uppercase tracking-widest bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">{currentText.dislikedTitle}</span><span className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">{profile.disliked.length} {currentText.dislikedExcluded}</span></div>
        <form onSubmit={handleAddDislike} className="flex gap-3"><input type="text" value={newDislike} onChange={(e) => setNewDislike(e.target.value)} placeholder={currentText.dislikedPlaceholder} className="flex-1 px-4 py-3 bg-[#131A1F] border border-white/[0.08] rounded-xl text-sm font-medium text-white placeholder-stone-600 focus:outline-none focus:border-rose-500/50 transition-colors" /><button type="submit" className="px-5 py-3 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.04] hover:border-white/[0.1] text-stone-300 text-sm font-bold rounded-xl cursor-pointer transition-colors">{currentText.add}</button></form>
        <div className="flex flex-wrap gap-2 pt-1">{profile.disliked.length === 0 ? <span className="text-sm text-stone-500 font-medium italic">{currentText.dislikedNone}</span> : profile.disliked.map((item, idx) => <span key={idx} className="text-sm font-medium px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-stone-300 flex items-center gap-2 shadow-inner"><span>{item}</span><button onClick={() => handleRemoveDislike(item)} className="text-stone-400 hover:text-red-400 text-sm cursor-pointer ml-1">×</button></span>)}</div>
      </div>

      <div className="bg-[#131A1F]/60 backdrop-blur-md border border-white/[0.06] rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-inner"><Smartphone className="w-6 h-6" /></div><div><h3 className="text-base font-bold text-white font-['Outfit'] tracking-wide">{currentText.installAppBtn || "Instalar en el Móvil"}</h3><p className="text-xs text-stone-400 font-medium">{isInstalled ? (currentText.pwaInstalled || "App instalada con éxito") : (currentText.installAppDesc || "Acceso instantáneo a pantalla completa.")}</p></div></div><button id="pwa-install-action-btn" type="button" onClick={handleInstallApp} className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer shrink-0">{isInstalled ? <><Check className="w-4 h-4" /><span className="hidden sm:inline">{currentText.appInstalled}</span></> : <><Download className="w-4 h-4" /><span className="hidden sm:inline">{currentText.install}</span></>}</button></div>
        {showInstallGuide && !isInstalled && <div className="p-4 bg-black/40 rounded-2xl border border-white/[0.04] text-sm text-stone-300 space-y-2 animate-in fade-in duration-200 shadow-inner"><p className="font-bold text-emerald-400 flex items-center gap-2"><span>📲</span> {currentText.installGuideTitle}</p><ul className="list-disc pl-5 space-y-1.5 text-stone-400 font-medium"><li>{currentText.installGuideIos}</li><li>{currentText.installGuideAndroid}</li></ul></div>}
        {onGoToLanding && <div className="pt-3"><button id="profile-view-landing-btn" type="button" onClick={onGoToLanding} className="w-full py-3 px-4 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/30 text-stone-300 text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"><Globe className="w-5 h-5 text-emerald-400" /><span>{currentText.viewLandingPage}</span></button></div>}
      </div>

      {profile.healthProfile && (
        <div className="bg-[#131A1F]/60 backdrop-blur-md border border-rose-500/20 rounded-3xl p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/20 flex items-center justify-center shrink-0">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white font-['Outfit'] tracking-wide">
                {language === "es"
                  ? "Datos de salud guardados"
                  : language === "bg"
                  ? "Запазени здравни данни"
                  : "Saved health data"}
              </h3>
              <p className="text-sm text-stone-400 leading-relaxed font-medium">
                {language === "es"
                  ? "Tu perfil contiene datos de salud que proporcionaste anteriormente. Puedes eliminarlos sin borrar tu despensa, recetas ni el resto de tu cuenta."
                  : language === "bg"
                  ? "Профилът ви съдържа здравни данни, които сте предоставили по-рано. Можете да ги изтриете, без да изтривате килера, рецептите или останалата част от акаунта си."
                  : "Your profile contains health data you provided previously. You can remove it without deleting your pantry, recipes, or the rest of your account."}
              </p>
            </div>
          </div>

          <div id="profile-health-field-list" className="space-y-2">
            {healthFieldRows.map(({ field, datum }) => {
              const valueLabel = healthValueLabel(field, datum, language);
              const isEditing = healthFieldEdit?.field === field;
              const knownOptions = HEALTH_FIELD_KNOWN_VALUES[field];
              return (
                <div
                  key={field}
                  id={`profile-health-field-${field}`}
                  data-testid={`health-field-${field}`}
                  className="rounded-2xl border border-white/[0.07] bg-black/20 p-3.5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-stone-200">
                          {HEALTH_FIELD_LABELS[field][language]}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-white/[0.08] bg-white/[0.03] text-stone-400">
                          {healthStatusLabel(datum.status, language)}
                        </span>
                      </div>
                      {valueLabel && (
                        <p className="text-sm text-white font-semibold">
                          {valueLabel}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500">
                        {datum.source && (
                          <span>
                            {language === "bg"
                              ? "Източник"
                              : language === "es"
                              ? "Procedencia"
                              : "Source"}
                            : {healthSourceLabel(datum.source, language)}
                          </span>
                        )}
                        {datum.recordedAt && (
                          <span>
                            {language === "bg"
                              ? "Записано"
                              : language === "es"
                              ? "Registrado"
                              : "Recorded"}
                            :{" "}
                            <time dateTime={datum.recordedAt}>
                              {healthRecordedAtLabel(datum.recordedAt, language)}
                            </time>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-wrap gap-2">
                      <button
                        id={`profile-edit-health-field-${field}`}
                        type="button"
                        onClick={() => beginHealthFieldCorrection(field, datum)}
                        className="px-3 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-300 text-xs font-bold cursor-pointer transition-colors"
                      >
                        {language === "bg"
                          ? "Коригирай"
                          : language === "es"
                          ? "Corregir"
                          : "Correct"}
                      </button>
                      <button
                        id={`profile-remove-health-field-${field}`}
                        type="button"
                        onClick={() => setPendingHealthFieldRemoval(field)}
                        className="px-3 py-2 rounded-xl border border-rose-500/25 bg-rose-500/5 hover:bg-rose-500/10 text-rose-300 text-xs font-bold cursor-pointer transition-colors"
                      >
                        {language === "bg"
                          ? "Премахни"
                          : language === "es"
                          ? "Eliminar"
                          : "Remove"}
                      </button>
                    </div>
                  </div>

                  {isEditing && healthFieldEdit && (
                    <div
                      id={`profile-health-edit-panel-${field}`}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 space-y-3"
                    >
                      <div className="space-y-1">
                        <label
                          htmlFor={`profile-health-edit-status-${field}`}
                          className="block text-[11px] uppercase tracking-wider font-bold text-stone-400"
                        >
                          {language === "bg"
                            ? "Статус"
                            : language === "es"
                            ? "Estado"
                            : "Status"}
                        </label>
                        <select
                          id={`profile-health-edit-status-${field}`}
                          value={healthFieldEdit.status}
                          onChange={(event) => {
                            setHealthFieldEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    status: event.target.value as HealthDataStatus,
                                    value:
                                      event.target.value === "known"
                                        ? current.value
                                        : "",
                                  }
                                : current,
                            );
                            setHealthFieldEditError(null);
                          }}
                          className="w-full px-3 py-2.5 bg-[#0B0F12] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
                        >
                          {HEALTH_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {healthStatusLabel(status, language)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {healthFieldEdit.status === "known" && (
                        <div className="space-y-1">
                          <label
                            htmlFor={`profile-health-edit-value-${field}`}
                            className="block text-[11px] uppercase tracking-wider font-bold text-stone-400"
                          >
                            {language === "bg"
                              ? "Стойност"
                              : language === "es"
                              ? "Valor"
                              : "Value"}
                          </label>
                          {NUMERIC_HEALTH_FIELDS.has(field) ? (
                            <input
                              id={`profile-health-edit-value-${field}`}
                              type="number"
                              min="0"
                              step={field === "ageYears" ? "1" : "0.1"}
                              value={healthFieldEdit.value}
                              onChange={(event) => {
                                setHealthFieldEdit((current) =>
                                  current
                                    ? { ...current, value: event.target.value }
                                    : current,
                                );
                                setHealthFieldEditError(null);
                              }}
                              className="w-full px-3 py-2.5 bg-[#0B0F12] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            />
                          ) : (
                            <select
                              id={`profile-health-edit-value-${field}`}
                              value={healthFieldEdit.value}
                              onChange={(event) => {
                                setHealthFieldEdit((current) =>
                                  current
                                    ? { ...current, value: event.target.value }
                                    : current,
                                );
                                setHealthFieldEditError(null);
                              }}
                              className="w-full px-3 py-2.5 bg-[#0B0F12] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
                            >
                              <option value="">
                                {language === "bg"
                                  ? "Изберете стойност"
                                  : language === "es"
                                  ? "Selecciona un valor"
                                  : "Select a value"}
                              </option>
                              {(knownOptions ?? []).map((option) => (
                                <option key={option} value={option}>
                                  {healthValueLabel(
                                    field,
                                    { status: "known", value: option },
                                    language,
                                  ) ?? option}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {healthFieldEditError && (
                        <p
                          id={`profile-health-edit-error-${field}`}
                          className="text-xs font-medium text-rose-300"
                        >
                          {healthFieldEditError}
                        </p>
                      )}

                      <p className="text-[11px] text-stone-500 leading-relaxed">
                        {language === "bg"
                          ? "Запазването ще отбележи корекцията като посочена от вас с нова дата. Другите здравни данни няма да бъдат променени."
                          : language === "es"
                          ? "Al guardar, la corrección quedará registrada como declarada por ti con una fecha nueva. Los demás datos de salud no cambiarán."
                          : "Saving records this correction as self-reported with a new date. Other health data will not change."}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <button
                          id={`profile-save-health-field-${field}`}
                          type="button"
                          onClick={saveHealthFieldCorrection}
                          className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold cursor-pointer transition-colors"
                        >
                          {language === "bg"
                            ? "Запази корекцията"
                            : language === "es"
                            ? "Guardar corrección"
                            : "Save correction"}
                        </button>
                        <button
                          id={`profile-cancel-health-field-${field}`}
                          type="button"
                          onClick={cancelHealthFieldCorrection}
                          className="px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-stone-300 text-xs font-bold cursor-pointer transition-colors"
                        >
                          {currentText.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            id="profile-clear-health-data-btn"
            type="button"
            onClick={() => setShowClearHealthDataConfirm(true)}
            className="w-full py-3 px-4 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>
              {language === "es"
                ? "Eliminar datos de salud"
                : language === "bg"
                ? "Изтриване на здравните данни"
                : "Delete health data"}
            </span>
          </button>
        </div>
      )}

      <div className="pt-8 pb-10"><button onClick={() => setShowResetConfirm(true)} className="w-full py-4 px-4 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/40 text-rose-400 text-sm font-bold rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-inner"><RotateCcw className="w-5 h-5" /><span className="tracking-wide uppercase font-['Outfit']">{localResetCopy.buttonLabel}</span></button></div>

      <ConfirmModal
        isOpen={showClearLegacyFoodSafetyConfirm}
        onClose={() => setShowClearLegacyFoodSafetyConfirm(false)}
        onConfirm={() => {
          onUpdateProfile({
            allergies: undefined,
            ...(legacyDietRestriction ? { dietStyle: "all" as const } : {}),
          });
          setShowClearLegacyFoodSafetyConfirm(false);
        }}
        title={
          language === "bg"
            ? "Премахване на старите ограничения"
            : language === "es"
            ? "Eliminar restricciones legacy"
            : "Delete legacy restrictions"
        }
        description={
          language === "bg"
            ? "Това ще изтрие старите стойности за алергии/непоносимости и ще нулира стария режим без глутен или keto, ако е зададен. Това не потвърждава, че нямате хранителни ограничения."
            : language === "es"
            ? "Esto eliminará los valores antiguos de alergias/intolerancias y restablecerá la antigua opción sin gluten o keto si estaba seleccionada. No confirma que no tengas restricciones alimentarias."
            : "This will delete legacy allergy/intolerance values and reset the old gluten-free or keto option if selected. It does not confirm that you have no food restrictions."
        }
        confirmText={
          language === "bg"
            ? "Изтрий legacy данните"
            : language === "es"
            ? "Eliminar datos legacy"
            : "Delete legacy data"
        }
        cancelText={currentText.cancel}
        danger={true}
      />

      <ConfirmModal
        isOpen={pendingHealthFieldRemoval !== null}
        onClose={() => setPendingHealthFieldRemoval(null)}
        onConfirm={() => {
          if (!pendingHealthFieldRemoval) return;
          onUpdateProfile({
            healthProfile: removeHealthProfileField(
              profile.healthProfile,
              pendingHealthFieldRemoval,
            ),
          });
          setPendingHealthFieldRemoval(null);
        }}
        title={
          language === "bg"
            ? "Премахване на здравен показател"
            : language === "es"
            ? "Eliminar dato de salud"
            : "Remove health field"
        }
        description={
          pendingHealthFieldRemoval
            ? language === "bg"
              ? `Ще премахнете само „${HEALTH_FIELD_LABELS[pendingHealthFieldRemoval].bg}“. Другите запазени здравни данни и останалата част от акаунта няма да се променят.`
              : language === "es"
              ? `Eliminarás solo “${HEALTH_FIELD_LABELS[pendingHealthFieldRemoval].es}”. Los demás datos de salud guardados y el resto de tu cuenta no cambiarán.`
              : `Only “${HEALTH_FIELD_LABELS[pendingHealthFieldRemoval].en}” will be removed. Other saved health data and the rest of your account will remain unchanged.`
            : ""
        }
        confirmText={
          language === "bg"
            ? "Премахни показателя"
            : language === "es"
            ? "Eliminar dato"
            : "Remove field"
        }
        cancelText={currentText.cancel}
        danger={true}
      />

      <ConfirmModal
        isOpen={showClearHealthDataConfirm}
        onClose={() => setShowClearHealthDataConfirm(false)}
        onConfirm={() => {
          onUpdateProfile({ healthProfile: undefined });
          setShowClearHealthDataConfirm(false);
        }}
        title={
          language === "es"
            ? "Eliminar datos de salud"
            : language === "bg"
            ? "Изтриване на здравните данни"
            : "Delete health data"
        }
        description={
          language === "es"
            ? "Se eliminarán del perfil los datos guardados en HealthProfile. Tu despensa, recetas, menú y cuenta no se borrarán."
            : language === "bg"
            ? "Запазените в HealthProfile здравни данни ще бъдат изтрити. Килерът, рецептите, менюто и акаунтът ви няма да бъдат изтрити."
            : "Saved HealthProfile data will be removed. Your pantry, recipes, meal plan, and account will not be deleted."
        }
        confirmText={
          language === "es"
            ? "Eliminar datos de salud"
            : language === "bg"
            ? "Изтрий здравните данни"
            : "Delete health data"
        }
        cancelText={currentText.cancel}
        danger={true}
      />

      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={onResetApp}
        title={localResetCopy.title}
        description={localResetCopy.description}
        confirmText={localResetCopy.confirmText}
        cancelText={currentText.cancel}
        danger={true}
      />
    </div>
  );
};
