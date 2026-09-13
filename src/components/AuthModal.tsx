import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  Cloud,
  AlertCircle,
  Loader2,
  LogOut,
  User as UserIcon,
  Smartphone,
  Laptop,
  Lock,
} from "lucide-react";
import { User } from "firebase/auth";
import { signInWithGoogle, logout } from "../lib/firebase";
import { Language } from "../types";
import { t } from "../utils/translations";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  language: Language;
  onGuestAccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  language,
  onGuestAccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentText = t[language] as any;

  const googleIntro =
    language === "es"
      ? "Accede con Google para vincular tu identidad de BalkanBite. Esta release no ofrece acceso por correo y contraseña."
      : language === "bg"
      ? "Влезте с Google, за да свържете своята BalkanBite идентичност. Тази версия не предлага вход с имейл и парола."
      : "Continue with Google to link your BalkanBite identity. This release does not offer email/password sign-in.";

  const connectedTitle =
    language === "es"
      ? "Cuenta de Google conectada"
      : language === "bg"
      ? "Google акаунтът е свързан"
      : "Google account connected";

  const cloudNote =
    language === "es"
      ? "BalkanBite usa esta identidad para aislar tus datos personales en la nube. La sincronización depende de la disponibilidad del servicio de nube."
      : language === "bg"
      ? "BalkanBite използва тази идентичност, за да изолира личните ви данни в облака. Синхронизацията зависи от наличността на облачната услуга."
      : "BalkanBite uses this identity to isolate your personal cloud data. Synchronization depends on cloud service availability.";

  const sameAccountLabel =
    language === "es"
      ? "La misma cuenta en tus dispositivos"
      : language === "bg"
      ? "Същият акаунт на вашите устройства"
      : "The same account across your devices";

  const googleAccessLabel =
    language === "es"
      ? "Acceso con Google"
      : language === "bg"
      ? "Вход с Google"
      : "Google sign-in";

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = await signInWithGoogle();
      if (user) {
        onClose();
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      if (err?.code === "auth/popup-blocked") {
        setErrorMessage(
          language === "es"
            ? "Tu navegador bloqueó la ventana emergente de Google. Por favor, permite las ventanas emergentes para este sitio."
            : language === "bg"
            ? "Браузърът блокира изскачащия прозорец на Google. Моля, разрешете изскачащите прозорци."
            : "Browser blocked the Google popup window. Please allow popups for this site."
        );
      } else if (err?.code !== "auth/popup-closed-by-user") {
        setErrorMessage(
          language === "es"
            ? "No se pudo conectar con Google. Comprueba tu conexión e inténtalo de nuevo."
            : language === "bg"
            ? "Неуспешна връзка с Google. Проверете връзката си и опитайте отново."
            : "Could not connect with Google. Please check your connection and retry."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      onClose();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="auth-modal-card"
        className="bg-[#0B0F12] border border-white/[0.08] rounded-3xl max-w-md w-full overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] transition-all animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.04] bg-[#131A1F]/80 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo.jpg"
                alt="BalkanBite Logo"
                className="w-11 h-11 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-[0_2px_10px_rgba(16,185,129,0.2)] shrink-0"
              />
              <div>
                <h2 className="text-lg font-bold text-white font-['Outfit'] tracking-wide">
                  {currentUser ? currentText.signedInAs : "Identificación BalkanBite"}
                </h2>
                <p className="text-xs text-stone-400 font-medium">
                  {currentUser ? currentUser.email : "Acceso con Google"}
                </p>
              </div>
            </div>

            <button
              id="auth-modal-close-btn"
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-stone-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {currentUser ? (
            <div className="space-y-4">
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 flex items-center gap-3.5 shadow-inner">
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || "Usuario"}
                    className="w-12 h-12 rounded-full border-2 border-emerald-500/50 object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-base shadow-inner">
                    <UserIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white truncate">
                      {currentUser.displayName || currentText.guestUser}
                    </h3>
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {connectedTitle}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 truncate mt-1 font-medium">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 space-y-2">
                <span className="text-[10px] font-extrabold text-emerald-400 flex items-center gap-1.5 uppercase tracking-widest">
                  <Cloud className="w-3.5 h-3.5" />
                  {connectedTitle}
                </span>
                <p className="text-[11px] leading-relaxed text-stone-300 font-medium">
                  {cloudNote}
                </p>
              </div>

              <button
                id="auth-sign-out-btn"
                type="button"
                onClick={handleSignOut}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.02] hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/30 border border-white/[0.04] text-stone-400 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <LogOut className="w-4 h-4" />
                {currentText.signOut}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 shadow-inner">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              <div className="space-y-4 pt-1">
                <p className="text-xs text-stone-300 leading-relaxed font-medium text-center">
                  {googleIntro}
                </p>
                <button
                  id="btn-google-sign-in"
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-stone-950 font-extrabold tracking-wide text-sm transition-all flex items-center justify-center gap-3 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-60 border border-emerald-400/50 uppercase"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                      <span>
                        {language === "es"
                          ? "Conectando con Google..."
                          : language === "bg"
                          ? "Свързване с Google..."
                          : "Connecting to Google..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-xs bg-[#0B0F12] text-white shrink-0 border border-white/[0.08]">
                        G
                      </div>
                      <span>
                        {language === "es"
                          ? "Continuar con Google"
                          : language === "bg"
                          ? "Продължете с Google"
                          : "Continue with Google"}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 text-[10px] text-stone-500 px-1 font-medium pt-2">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" />
                  <Laptop className="w-3 h-3" />
                  <span>{sameAccountLabel}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>{googleAccessLabel}</span>
                </div>
              </div>

              {onGuestAccess && (
                <div className="pt-2 text-center border-t border-white/[0.04]">
                  <button
                    id="auth-modal-guest-btn"
                    type="button"
                    onClick={onGuestAccess}
                    className="text-xs font-bold text-stone-400 hover:text-white transition-colors underline cursor-pointer uppercase tracking-wider"
                  >
                    {currentText.continueAsGuest}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};