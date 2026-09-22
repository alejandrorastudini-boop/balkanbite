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
  Mail,
  KeyRound,
  UserPlus,
  LogIn,
} from "lucide-react";
import { User } from "firebase/auth";
import {
  signInWithGoogle,
  loginWithEmail,
  signUpWithEmail,
  resetPassword,
  logout,
} from "../lib/firebase";
import { Language } from "../types";
import { t } from "../utils/translations";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  language: Language;
  onGuestAccess?: () => void;
}

type AuthMode = "login" | "signup";

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  language,
  onGuestAccess,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentText = t[language] as any;

  const copy =
    language === "es"
      ? {
          accountTitle: "Cuenta BalkanBite",
          accountConnected: "Cuenta BalkanBite conectada",
          accountSubtitle: "Google o correo electrónico",
          cloudNote:
            "BalkanBite usa esta identidad para aislar tus datos personales en la nube. La sincronización depende de la disponibilidad del servicio de nube.",
          sameAccount: "La misma cuenta en tus dispositivos",
          accessMethods: "Google o email",
          login: "Entrar",
          signup: "Crear cuenta",
          name: "Nombre o apodo",
          namePlaceholder: "Ej. Alex",
          email: "Correo electrónico",
          emailPlaceholder: "tu@email.com",
          password: "Contraseña",
          loginAction: "Iniciar sesión",
          signupAction: "Crear mi cuenta",
          working: "Procesando...",
          or: "o",
          google: "Continuar con Google",
          googleConnecting: "Conectando con Google...",
          forgotPassword: "¿Has olvidado la contraseña?",
          resetSent:
            "Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña.",
          missingFields: "Introduce tu correo y contraseña.",
          invalidEmail: "Introduce un correo electrónico válido.",
          shortPassword: "La contraseña debe tener al menos 6 caracteres.",
          emailInUse: "Ese correo ya está registrado. Inicia sesión con él.",
          badCredentials: "Correo o contraseña incorrectos.",
          tooManyRequests: "Demasiados intentos. Espera un poco antes de volver a intentarlo.",
          providerDisabled:
            "El acceso con correo y contraseña todavía no está habilitado en el servicio de autenticación.",
          networkError: "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.",
          genericError: "No se pudo completar la autenticación. Inténtalo de nuevo.",
          resetNeedsEmail: "Introduce primero el correo de tu cuenta.",
        }
      : language === "bg"
      ? {
          accountTitle: "BalkanBite акаунт",
          accountConnected: "BalkanBite акаунтът е свързан",
          accountSubtitle: "Google или имейл",
          cloudNote:
            "BalkanBite използва тази самоличност, за да изолира личните ви данни в облака. Синхронизацията зависи от наличността на облачната услуга.",
          sameAccount: "Същият акаунт на вашите устройства",
          accessMethods: "Google или имейл",
          login: "Вход",
          signup: "Създай акаунт",
          name: "Име или псевдоним",
          namePlaceholder: "Напр. Алекс",
          email: "Имейл",
          emailPlaceholder: "you@email.com",
          password: "Парола",
          loginAction: "Вход",
          signupAction: "Създай акаунт",
          working: "Обработване...",
          or: "или",
          google: "Продължи с Google",
          googleConnecting: "Свързване с Google...",
          forgotPassword: "Забравена парола?",
          resetSent:
            "Ако съществува акаунт с този имейл, ще получите инструкции за възстановяване на паролата.",
          missingFields: "Въведете имейл и парола.",
          invalidEmail: "Въведете валиден имейл адрес.",
          shortPassword: "Паролата трябва да съдържа поне 6 знака.",
          emailInUse: "Този имейл вече е регистриран. Влезте с него.",
          badCredentials: "Грешен имейл или парола.",
          tooManyRequests: "Твърде много опити. Изчакайте малко и опитайте отново.",
          providerDisabled:
            "Входът с имейл и парола все още не е активиран в услугата за удостоверяване.",
          networkError: "Няма връзка. Проверете интернет връзката си и опитайте отново.",
          genericError: "Удостоверяването не можа да завърши. Опитайте отново.",
          resetNeedsEmail: "Първо въведете имейла на акаунта си.",
        }
      : {
          accountTitle: "BalkanBite account",
          accountConnected: "BalkanBite account connected",
          accountSubtitle: "Google or email",
          cloudNote:
            "BalkanBite uses this identity to isolate your personal cloud data. Synchronization depends on cloud service availability.",
          sameAccount: "The same account across your devices",
          accessMethods: "Google or email",
          login: "Sign in",
          signup: "Create account",
          name: "Name or nickname",
          namePlaceholder: "e.g. Alex",
          email: "Email",
          emailPlaceholder: "you@email.com",
          password: "Password",
          loginAction: "Sign in",
          signupAction: "Create my account",
          working: "Working...",
          or: "or",
          google: "Continue with Google",
          googleConnecting: "Connecting to Google...",
          forgotPassword: "Forgot password?",
          resetSent:
            "If an account exists for that email, you will receive password reset instructions.",
          missingFields: "Enter your email and password.",
          invalidEmail: "Enter a valid email address.",
          shortPassword: "Password must be at least 6 characters.",
          emailInUse: "That email is already registered. Sign in with it.",
          badCredentials: "Invalid email or password.",
          tooManyRequests: "Too many attempts. Wait a little before trying again.",
          providerDisabled:
            "Email/password access is not enabled in the authentication service yet.",
          networkError: "Could not connect. Check your connection and try again.",
          genericError: "Authentication could not be completed. Please try again.",
          resetNeedsEmail: "Enter your account email first.",
        };

  const clearFeedback = () => {
    setErrorMessage(null);
    setNoticeMessage(null);
  };

  const mapAuthError = (err: any) => {
    switch (err?.code) {
      case "auth/email-already-in-use":
        return copy.emailInUse;
      case "auth/invalid-email":
        return copy.invalidEmail;
      case "auth/weak-password":
        return copy.shortPassword;
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return copy.badCredentials;
      case "auth/too-many-requests":
        return copy.tooManyRequests;
      case "auth/operation-not-allowed":
        return copy.providerDisabled;
      case "auth/network-request-failed":
        return copy.networkError;
      default:
        return copy.genericError;
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    clearFeedback();
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
            ? "Tu navegador bloqueó la ventana emergente de Google. Permite las ventanas emergentes para este sitio."
            : language === "bg"
            ? "Браузърът блокира изскачащия прозорец на Google. Разрешете изскачащите прозорци за този сайт."
            : "Your browser blocked the Google popup. Allow popups for this site."
        );
      } else if (err?.code !== "auth/popup-closed-by-user") {
        setErrorMessage(copy.networkError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setErrorMessage(copy.missingFields);
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setErrorMessage(copy.invalidEmail);
      return;
    }

    if (password.length < 6) {
      setErrorMessage(copy.shortPassword);
      return;
    }

    setIsLoading(true);
    try {
      if (authMode === "signup") {
        await signUpWithEmail(normalizedEmail, password, displayName.trim());
      } else {
        await loginWithEmail(normalizedEmail, password);
      }
      onClose();
    } catch (err: any) {
      console.error("Email auth error:", err);
      setErrorMessage(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const normalizedEmail = email.trim();
    clearFeedback();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setErrorMessage(copy.resetNeedsEmail);
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(normalizedEmail);
      setNoticeMessage(copy.resetSent);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setErrorMessage(mapAuthError(err));
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
        className="bg-[#0B0F12] border border-white/[0.08] rounded-3xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.8)] transition-all animate-in slide-in-from-bottom-5 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-white/[0.04] bg-[#131A1F]/80 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/images/logo.jpg"
                alt="BalkanBite Logo"
                className="w-11 h-11 rounded-2xl object-cover border-2 border-emerald-500/30 shadow-[0_2px_10px_rgba(16,185,129,0.2)] shrink-0"
              />
              <div>
                <h2 className="text-lg font-bold text-white font-['Outfit'] tracking-wide">
                  {currentUser ? currentText.signedInAs : copy.accountTitle}
                </h2>
                <p className="text-xs text-stone-400 font-medium">
                  {currentUser ? currentUser.email : copy.accountSubtitle}
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

        <div className="p-5 sm:p-6 space-y-5">
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
                      {copy.accountConnected}
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
                  {copy.accountConnected}
                </span>
                <p className="text-[11px] leading-relaxed text-stone-300 font-medium">
                  {copy.cloudNote}
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
              <div className="grid grid-cols-2 gap-1 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.05]">
                <button
                  id="auth-tab-login"
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    clearFeedback();
                  }}
                  className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authMode === "login"
                      ? "bg-emerald-500 text-stone-950 shadow-md"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{copy.login}</span>
                </button>
                <button
                  id="auth-tab-signup"
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    clearFeedback();
                  }}
                  className={`py-2.5 px-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    authMode === "signup"
                      ? "bg-emerald-500 text-stone-950 shadow-md"
                      : "text-stone-400 hover:text-white"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{copy.signup}</span>
                </button>
              </div>

              {errorMessage && (
                <div
                  id="auth-error-message"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2 shadow-inner"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium">{errorMessage}</div>
                </div>
              )}

              {noticeMessage && (
                <div
                  id="auth-notice-message"
                  className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium"
                >
                  {noticeMessage}
                </div>
              )}

              <form id="auth-email-form" onSubmit={handleEmailAuth} className="space-y-3">
                {authMode === "signup" && (
                  <div>
                    <label
                      htmlFor="auth-display-name"
                      className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1"
                    >
                      {copy.name}
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="auth-display-name"
                        type="text"
                        autoComplete="name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={copy.namePlaceholder}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1"
                  >
                    {copy.email}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={copy.emailPlaceholder}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="text-[11px] font-bold text-stone-300 uppercase tracking-wider block mb-1"
                  >
                    {copy.password}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                {authMode === "login" && (
                  <div className="text-right">
                    <button
                      id="auth-reset-password-btn"
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={isLoading}
                      className="text-[11px] font-semibold text-stone-400 hover:text-emerald-400 transition-colors disabled:opacity-60"
                    >
                      {copy.forgotPassword}
                    </button>
                  </div>
                )}

                <button
                  id="auth-email-submit"
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-stone-950 font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-60 uppercase tracking-wider"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-stone-950" />
                      <span>{copy.working}</span>
                    </>
                  ) : authMode === "login" ? (
                    copy.loginAction
                  ) : (
                    copy.signupAction
                  )}
                </button>
              </form>

              <div className="flex items-center gap-3">
                <div className="h-px bg-white/[0.06] flex-1" />
                <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">
                  {copy.or}
                </span>
                <div className="h-px bg-white/[0.06] flex-1" />
              </div>

              <button
                id="btn-google-sign-in"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white font-bold tracking-wide text-sm transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{copy.googleConnecting}</span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-xs bg-white text-stone-950 shrink-0">
                      G
                    </div>
                    <span>{copy.google}</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between gap-3 text-[10px] text-stone-500 px-1 font-medium pt-1">
                <div className="flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3" />
                  <Laptop className="w-3 h-3" />
                  <span>{copy.sameAccount}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Lock className="w-3 h-3 text-emerald-500" />
                  <span>{copy.accessMethods}</span>
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
