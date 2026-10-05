import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {
  isCookConfirmationQaRoute,
  isDerivedInventoryPropagationQaRoute,
  isFreshGuestOnboardingQaRoute,
  isManualShoppingQaRoute,
  isProfileHealthDataQaRoute,
  isRuntimeQaRoute,
  isShortageShoppingQaRoute,
  isVoiceLotReviewQaRoute,
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

  if (isManualShoppingQaRoute()) {
    const {ManualShoppingQaHarness} = await import('./qa/ManualShoppingQaHarness.tsx');
    root.render(<ManualShoppingQaHarness />);
    return;
  }

  if (isCookConfirmationQaRoute()) {
    const {CookConfirmationQaHarness} = await import('./qa/CookConfirmationQaHarness.tsx');
    root.render(<CookConfirmationQaHarness />);
    return;
  }

  if (isVoiceLotReviewQaRoute()) {
    const {VoiceLotReviewQaHarness} = await import('./qa/VoiceLotReviewQaHarness.tsx');
    root.render(<VoiceLotReviewQaHarness />);
    return;
  }

  if (isShortageShoppingQaRoute()) {
    const {ShortageShoppingQaHarness} = await import('./qa/ShortageShoppingQaHarness.tsx');
    root.render(<ShortageShoppingQaHarness />);
    return;
  }

  if (isDerivedInventoryPropagationQaRoute()) {
    const {DerivedInventoryPropagationQaHarness} = await import('./qa/DerivedInventoryPropagationQaHarness.tsx');
    root.render(<DerivedInventoryPropagationQaHarness />);
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
