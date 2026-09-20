import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  Target,
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
import { UserProfile, Language, Currency } from "../types";
import { t } from "../utils/translations";
import { ConfirmModal } from "./ConfirmModal";
import { AdminAgentStatusPanel } from "./AdminAgentStatusPortal";
import { signInWithGoogle, logout, auth } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { getLocalResetCopy } from "../utils/localResetCopy";

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onOpenProModal: () => void;
  onResetApp: () => void;
  onGoToLanding?: () => void;
  onOpenAuthModal?: () => void;
  language: Language;
  currency: Currency;
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
}) => {
  const currentText = t[language];
  const localResetCopy = getLocalResetCopy(language, user !== null);
  const [newDislike, setNewDislike] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showClearHealthDataConfirm, setShowClearHealthDataConfirm] = useState(false);
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
        <div className="flex items-center gap-2.5 text-white font-bold text-xs uppercase tracking-widest bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20 w-fit"><Target className="w-4 h-4 text-amber-400" /><span>{currentText.healthGoals}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[{ id: "balanced", label: currentText.goalBalanced }, { id: "muscle", label: currentText.goalMuscle }, { id: "fat_loss", label: currentText.goalFatLoss }, { id: "heart", label: currentText.goalHeart }].map((opt) => <button key={opt.id} onClick={() => onUpdateProfile({ healthGoal: opt.id as any })} className={`p-4 rounded-2xl border text-sm font-bold text-left transition-all cursor-pointer ${profile.healthGoal === opt.id ? "bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.1)]" : "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:bg-white/[0.04] hover:text-stone-300"}`}><div className="flex items-center justify-between"><span>{opt.label}</span>{profile.healthGoal === opt.id && <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 ml-1" />}</div></button>)}</div>
      </div>

      <div className="bg-black/20 border border-white/[0.04] rounded-3xl p-6 space-y-4 shadow-inner">
        <div className="flex items-center gap-2.5 text-white font-bold text-xs uppercase tracking-widest bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20 w-fit"><Utensils className="w-4 h-4 text-teal-400" /><span>{currentText.dietType}</span></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[{ id: "all", label: currentText.dietAll }, { id: "mediterranean", label: currentText.dietMed }, { id: "vegetarian", label: currentText.dietVegetarian }, { id: "vegan", label: currentText.dietVegan }].map((opt) => <button key={opt.id} onClick={() => onUpdateProfile({ dietStyle: opt.id as any })} className={`p-4 rounded-2xl border text-sm font-bold text-left transition-all cursor-pointer ${profile.dietStyle === opt.id ? "bg-teal-500/10 border-teal-500/40 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.1)]" : "bg-white/[0.02] border-white/[0.04] text-stone-400 hover:bg-white/[0.04] hover:text-stone-300"}`}><div className="flex items-center justify-between"><span>{opt.label}</span>{profile.dietStyle === opt.id && <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 ml-1" />}</div></button>)}</div>
      </div>

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
