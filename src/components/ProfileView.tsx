import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  Target,
  Clock,
  Utensils,
  Globe,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Heart,
  RotateCcw,
  Smartphone,
  Download,
  Check,
} from "lucide-react";
import { UserProfile, Language, Currency } from "../types";
import { t } from "../utils/translations";
import { ConfirmModal } from "./ConfirmModal";
import { signInWithGoogle, logout, auth } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onOpenProModal: () => void;
  onResetApp: () => void;
  onGoToLanding?: () => void;
  language: Language;
  currency: Currency;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onOpenProModal,
  onResetApp,
  onGoToLanding,
  language,
  currency,
}) => {
  const currentText = t[language];
  const [newDislike, setNewDislike] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [user, setUser] = useState<User | null>(null);

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

  return (
    <div id="profile-view" className="space-y-4 pb-20">
      {/* Auth Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {user ? (
            <img src={user.photoURL || ""} className="w-10 h-10 rounded-full border border-emerald-500/30" alt="Avatar" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center text-stone-500">
              <Globe className="w-6 h-6" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-white">
              {user ? user.displayName : "Invitado"}
            </h3>
            <p className="text-[11px] text-stone-500">
              {user ? user.email : "Sincroniza tus datos en la nube"}
            </p>
          </div>
        </div>
        {user ? (
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-rose-900/30 hover:text-rose-400 text-stone-400 text-xs font-bold transition-all cursor-pointer"
          >
            Salir
          </button>
        ) : (
          <button
            onClick={() => signInWithGoogle()}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/20 cursor-pointer"
          >
            Conectar
          </button>
        )}
      </div>

      {/* BalkanBite Pro Subscription Showcase Card */}
      <div className="bg-gradient-to-br from-amber-950/60 via-stone-900 to-emerald-950/60 border border-amber-500/40 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white font-['Outfit']">
                {currentText.activePro}
              </h2>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {currentText.activeSubscription}
              </span>
            </div>
          </div>

          <button
            onClick={onOpenProModal}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30 hover:bg-amber-500/30 font-semibold transition-colors cursor-pointer"
          >
            {currentText.manageSub}
          </button>
        </div>

        <p className="text-xs text-stone-300 leading-relaxed">
          {currentText.proBenefits}
        </p>
      </div>

      {/* Cooking Style / Speed */}
      <div className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
          <Clock className="w-4 h-4 text-emerald-400" />
          <span>{currentText.cookingSpeed}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { id: "fast", label: currentText.speedFast },
            { id: "moderate", label: currentText.speedModerate },
            { id: "elaborate", label: currentText.speedElaborate },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onUpdateProfile({ cookingSpeed: opt.id as any })}
              className={`p-3 rounded-xl border text-xs text-left font-medium transition-all cursor-pointer ${
                profile.cookingSpeed === opt.id
                  ? "bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-sm"
                  : "bg-stone-900/50 border-stone-700 text-stone-400 hover:text-stone-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{opt.label}</span>
                {profile.cookingSpeed === opt.id && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Health Goal */}
      <div className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
          <Target className="w-4 h-4 text-amber-400" />
          <span>{currentText.healthGoals}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { id: "balanced", label: currentText.goalBalanced },
            { id: "muscle", label: currentText.goalMuscle },
            { id: "fat_loss", label: currentText.goalFatLoss },
            { id: "heart", label: currentText.goalHeart },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onUpdateProfile({ healthGoal: opt.id as any })}
              className={`p-3 rounded-xl border text-xs text-left font-medium transition-all cursor-pointer ${
                profile.healthGoal === opt.id
                  ? "bg-amber-950/30 border-amber-500/80 text-amber-200 shadow-sm"
                  : "bg-stone-900/50 border-stone-700 text-stone-400 hover:text-stone-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{opt.label}</span>
                {profile.healthGoal === opt.id && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Dietary Preference */}
      <div className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
          <Utensils className="w-4 h-4 text-teal-400" />
          <span>{currentText.dietType}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { id: "all", label: currentText.dietAll },
            { id: "mediterranean", label: currentText.dietMed },
            { id: "vegetarian", label: currentText.dietVegetarian },
            { id: "vegan", label: currentText.dietVegan },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => onUpdateProfile({ dietStyle: opt.id as any })}
              className={`p-3 rounded-xl border text-xs text-left font-medium transition-all cursor-pointer ${
                profile.dietStyle === opt.id
                  ? "bg-teal-950/40 border-teal-500 text-teal-200 shadow-sm"
                  : "bg-stone-900/50 border-stone-700 text-stone-400 hover:text-stone-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{opt.label}</span>
                {profile.dietStyle === opt.id && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0 ml-1" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Disliked Foods / Allergies */}
      <div className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-white font-bold text-xs uppercase tracking-wider">
            {currentText.dislikedTitle}
          </span>
          <span className="text-[11px] text-stone-400">
            {profile.disliked.length} {currentText.dislikedExcluded}
          </span>
        </div>

        <form onSubmit={handleAddDislike} className="flex gap-2">
          <input
            type="text"
            value={newDislike}
            onChange={(e) => setNewDislike(e.target.value)}
            placeholder={currentText.dislikedPlaceholder}
            className="flex-1 px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-400 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-stone-700 hover:bg-stone-600 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
          >
            {currentText.add}
          </button>
        </form>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {profile.disliked.length === 0 ? (
            <span className="text-xs text-stone-400 italic">
              {currentText.dislikedNone}
            </span>
          ) : (
            profile.disliked.map((item, idx) => (
              <span
                key={idx}
                className="text-xs px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-700 text-stone-200 flex items-center gap-1.5"
              >
                <span>{item}</span>
                <button
                  onClick={() => handleRemoveDislike(item)}
                  className="text-stone-400 hover:text-red-400 text-sm cursor-pointer ml-1"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* PWA Device Installation Card */}
      <div className="bg-stone-850/90 border border-stone-750 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-['Outfit']">
                {currentText.installAppBtn || "Instalar en el Móvil"}
              </h3>
              <p className="text-[11px] text-stone-400">
                {isInstalled
                  ? (currentText.pwaInstalled || "App instalada con éxito")
                  : (currentText.installAppDesc || "Acceso instantáneo a pantalla completa y sin conexión.")}
              </p>
            </div>
          </div>

          <button
            id="pwa-install-action-btn"
            type="button"
            onClick={handleInstallApp}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer shrink-0"
          >
            {isInstalled ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Instalada</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Instructions for iOS/Android if prompt not triggered */}
        {showInstallGuide && !isInstalled && (
          <div className="p-3 bg-stone-900/90 rounded-xl border border-stone-800 text-xs text-stone-300 space-y-1.5 animate-in fade-in duration-200">
            <p className="font-semibold text-emerald-400 flex items-center gap-1">
              <span>📲</span> Instrucciones de instalación directa:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-stone-300">
              <li><strong>iPhone / iPad (Safari):</strong> Pulsa el botón <em>Compartir</em> (icono cuadrado con flecha hacia arriba) y selecciona <em>"Añadir a pantalla de inicio"</em>.</li>
              <li><strong>Android (Chrome):</strong> Pulsa el menú de 3 puntos arriba a la derecha y selecciona <em>"Instalar aplicación"</em> o <em>"Añadir a pantalla de inicio"</em>.</li>
            </ul>
          </div>
        )}
        {/* Landing Page link */}
        {onGoToLanding && (
          <div className="pt-2">
            <button
              id="profile-view-landing-btn"
              type="button"
              onClick={onGoToLanding}
              className="w-full py-2.5 px-4 border border-stone-800 bg-stone-900/60 hover:bg-stone-850 hover:border-emerald-500/40 text-stone-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <Globe className="w-4 h-4 text-emerald-400" />
              <span>
                {language === "es"
                  ? "Ver Landing Page de BalkanBite"
                  : language === "bg"
                  ? "Виж презентационната страница"
                  : "View BalkanBite Landing Page"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Danger Zone: Reset App */}
      <div className="pt-6 pb-8">
        <button
          onClick={() => setShowResetConfirm(true)}
          className="w-full py-3 px-4 border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{currentText.resetAppTitle}</span>
        </button>
      </div>

      {/* Custom Reset Confirm Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={onResetApp}
        title={currentText.resetAppTitle}
        description={currentText.resetAppConfirm}
        confirmText={language === "es" ? "Sí, borrar todo" : language === "bg" ? "Да, изтрий всичко" : "Yes, reset all"}
        cancelText={currentText.cancel}
        danger={true}
      />
    </div>
  );
};
