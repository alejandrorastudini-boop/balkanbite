import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {
  isFreshGuestOnboardingQaRoute,
  isProfileHealthDataQaRoute,
  isRuntimeQaRoute,
  isStartupCloudSyncQaRoute,
} from './qa/runtimeQaGate';
import './index.css';

const root = createRoot(document.getElementById('root')!);

async function bootstrap() {
  if (isStartupCloudSyncQaRoute()) {
    const {StartupCloudSyncQaHarness} = await import('./qa/StartupCloudSyncQaHarness.tsx');
    root.render(<StartupCloudSyncQaHarness />);
    return;
  }

  if (isProfileHealthDataQaRoute()) {
    const {ProfileHealthDataQaHarness} = await import('./qa/ProfileHealthDataQaHarness.tsx');
    root.render(<ProfileHealthDataQaHarness />);
    return;
  }

  if (isFreshGuestOnboardingQaRoute()) {
    const {FreshGuestOnboardingQaHarness} = await import('./qa/FreshGuestOnboardingQaHarness.tsx');
    root.render(<FreshGuestOnboardingQaHarness />);
    return;
  }

  if (isRuntimeQaRoute()) {
    root.render(
      <main data-testid="qa-disabled" className="min-h-screen bg-[#0B0F12] text-stone-100 p-8">
        Not found
      </main>,
    );
    return;
  }

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
