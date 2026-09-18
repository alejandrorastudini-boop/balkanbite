declare const __BALKANBITE_VERCEL_ENV__: string;
declare const __BALKANBITE_VERCEL_GIT_SHA__: string;
declare const __BALKANBITE_VERCEL_DEPLOYMENT_ID__: string;
declare const __BALKANBITE_RUNTIME_QA_FINGERPRINT__: string;

const QA_PREFIX = "/__qa/";
const STARTUP_CLOUD_SYNC_QA_PATH = "/__qa/startup-cloud-sync";
const RUNTIME_QA_PREVIEW_HOST =
  "balkanbite-git-preview-qa-agent-runtime-alejandrorastudini-6993.vercel.app";

export function isRuntimeQaRoute(): boolean {
  return window.location.pathname.startsWith(QA_PREFIX);
}

export function isStartupCloudSyncQaRoute(): boolean {
  const host = window.location.hostname;
  const qaHostAllowed =
    host === RUNTIME_QA_PREVIEW_HOST ||
    host === "localhost" ||
    host === "127.0.0.1";

  return qaHostAllowed && window.location.pathname === STARTUP_CLOUD_SYNC_QA_PATH;
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
