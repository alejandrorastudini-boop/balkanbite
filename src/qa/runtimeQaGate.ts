declare const __BALKANBITE_VERCEL_ENV__: string;
declare const __BALKANBITE_VERCEL_GIT_SHA__: string;
declare const __BALKANBITE_VERCEL_DEPLOYMENT_ID__: string;
declare const __BALKANBITE_RUNTIME_QA_FINGERPRINT__: string;

const QA_PREFIX = "/__qa/";
const STARTUP_CLOUD_SYNC_QA_PATH = "/__qa/startup-cloud-sync";
const PROFILE_HEALTH_DATA_QA_PATH = "/__qa/profile-health-data";
const FRESH_GUEST_ONBOARDING_QA_PATH = "/__qa/fresh-guest-onboarding";
const RUNTIME_QA_PREVIEW_HOST =
  "balkanbite-git-preview-qa-agent-runtime-alejandrorastudini-6993.vercel.app";

export function isRuntimeQaRoute(): boolean {
  return window.location.pathname.startsWith(QA_PREFIX);
}

function runtimeQaHostAllowed(): boolean {
  const host = window.location.hostname;
  return (
    host === RUNTIME_QA_PREVIEW_HOST ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

export function isStartupCloudSyncQaRoute(): boolean {
  return (
    runtimeQaHostAllowed() &&
    window.location.pathname === STARTUP_CLOUD_SYNC_QA_PATH
  );
}

export function isProfileHealthDataQaRoute(): boolean {
  return (
    runtimeQaHostAllowed() &&
    window.location.pathname === PROFILE_HEALTH_DATA_QA_PATH
  );
}

export function isFreshGuestOnboardingQaRoute(): boolean {
  return (
    runtimeQaHostAllowed() &&
    window.location.pathname === FRESH_GUEST_ONBOARDING_QA_PATH
  );
}

export function runtimeQaDeploymentSha(): string {
  return __BALKANBITE_VERCEL_GIT_SHA__;
}

export function runtimeQaDeploymentId(): string {
  return __BALKANBITE_VERCEL_DEPLOYMENT_ID__;
}

export function runtimeQaSourceFingerprint(): string {
  return __BALKANBITE_RUNTIME_QA_FINGERPRINT__;
}
