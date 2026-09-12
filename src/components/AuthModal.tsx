import React, { useState } from "react";
import {
  X,
  ShieldCheck,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  User as UserIcon,
  Smartphone,
  Laptop,
  Lock,
  Mail,
  KeyRound,
  UserPlus,
  LogIn,
} from "lucide-react";
import { User } from "firebase/auth";
import { signInWithGoogle, loginWithEmail, signUpWithEmail, logout } from "../lib/firebase";
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
  const [authTab, setAuthTab] = useState<"google" | "login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentText = t[language] as any;

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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage(language === "es" ? "Rellena todos los campos" : "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (authTab === "signup") {
        if (password.length < 6) {
          setErrorMessage(language === "es" ? "La contraseña debe tener al menos 6 caracteres" : "Password must be at least 6 characters");
          setIsLoading(false);
          return;
        }
        await signUpWithEmail(email, password, displayName || "Usuario");
      } else {
        await loginWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      console.error("Email auth error:", err);
      if (err?.code === "auth/email-already-in-use") {
        setErrorMessage(language === "es" ? "Ese correo ya está registrado. Inicia sesión con él." : "Email is already registered. Please log in.");
      } else if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password" || err?.code === "auth/user-not-found") {
        setErrorMessage(language === "es" ? "Correo o contraseña incorrectos." : "Invalid email or password.");
      } else {
        setErrorMessage(err?.message || (language === "es" ? "Error al autenticar. Inténtalo de nuevo." : "Authentication error."));
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="auth-modal-card"
        className="bg-[#0B0F12] border border-white/[0.08] rounded-3xl max-w-md w-full overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)] transition-all animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
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
                  {currentUser ? currentUser.email : "Sincronización & Nube Segura"}
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

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {currentUser ? (
            /* User Authenticated State */
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
                      Sesión Activa
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 truncate mt-1 font-medium">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              {/* Synchronized features pill list */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 space-y-3">
                <span className="text-[10px] font-extrabold text-emerald-400 flex items-center gap-1.5 uppercase tracking-widest">
                  <Cloud className="w-3.5 h-3.5" />
                  {currentText.syncActive}
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-300 font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Despensa en tiempo real</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Recetas guardadas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Menú semanal planificado</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Lista de la compra</span>
                  </div>
                </div>
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
            /* Unauthenticated State */
            <div className="space-y-4">
              {/* Tab Selector */}
              <div className="grid grid-cols-3 gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.05]">
                <button
                  type="button"
                  onClick={() => { setAuthTab("login"); setErrorMessage(null); }}
                  className={`py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authTab === "login"
                      ? "bg-emerald-500 text-stone-950 shadow-md"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab("signup"); setErrorMessage(null); }}
                  className={`py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authTab === "signup"
                      ? "bg-emerald-500 text-stone-950 shadow-md"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Registro</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthTab("google"); setErrorMessage(null); }}
                  className={`py-2 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authTab === "google"
                      ? "bg-emerald-500 text-stone-950 shadow-md"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-stone-900 text-white flex items-center justify-center text-[9px] font-black">
                    G
                  </div>
                  <span>Google</span>
                </button>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 shadow-inner">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              {/* Form per Tab */}
              {authTab === "google" && (
                <div className="space-y-4 pt-1">
                  <p className="text-xs text-stone-300 leading-relaxed font-medium text-center">
                    Accede de forma rápida y segura con tu cuenta de Google. Sincronizará tu despensa automáticamente en la nube.
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
                        <span>Conectando con Google...</span>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-xs bg-[#0B0F12] text-white shrink-0 border border-white/[0.08]">
                          G
                        </div>
                        <span>Continuar con Google</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {(authTab === "login" || authTab === "signup") && (
                <form onSubmit={handleEmailAuth} className="space-y-3 pt-1">
                  {authTab === "signup" && (
                    <div>
                      <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1">
                        Tu Nombre / Apodo
                      </label>
                      <div className="relative">
                        <UserIcon className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Ej. Alex"
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@email.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-stone-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-60 uppercase tracking-wider"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                    ) : authTab === "login" ? (
                      "Iniciar Sesión"
                    ) : (
                      "Crear Mi Cuenta"
                    )}
                  </button>
                </form>
              )}

              {/* Devices & Privacy Note */}
              <div className="flex items-center justify-between text-[10px] text-stone-500 px-1 font-medium pt-2">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" />
                  <Laptop className="w-3 h-3" />
                  <span>Sincronizado en todos tus dispositivos</span>
                </div>
                <div className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>Cifrado de grado médico</span>
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
