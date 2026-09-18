declare const __BALKANBITE_VERCEL_ENV__: string;

const QA_PREFIX = "/__qa/";
const STARTUP_CLOUD_SYNC_QA_PATH = "/__qa/startup-cloud-sync";

export function isRuntimeQaRoute(): boolean {
  return window.location.pathname.startsWith(QA_PREFIX);
}

export function isStartupCloudSyncQaRoute(): boolean {
  return (
    __BALKANBITE_VERCEL_ENV__ === "preview" &&
    window.location.pathname === STARTUP_CLOUD_SYNC_QA_PATH
  );
}
