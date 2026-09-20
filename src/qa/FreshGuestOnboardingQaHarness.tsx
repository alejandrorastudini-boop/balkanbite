import React, { useState } from "react";
import { OnboardingModal } from "../components/OnboardingModal";
import { DEFAULT_PROFILE } from "../data/initialData";
import type { UserProfile } from "../types";
import {
  runtimeQaDeploymentId,
  runtimeQaDeploymentSha,
  runtimeQaSourceFingerprint,
} from "./runtimeQaGate";

export const FreshGuestOnboardingQaHarness: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile>(() => ({
    ...DEFAULT_PROFILE,
    disliked: [...DEFAULT_PROFILE.disliked],
  }));

  return (
    <main
      data-testid="qa-fresh-guest-onboarding-root"
      data-deployment-sha={runtimeQaDeploymentSha()}
      data-deployment-id={runtimeQaDeploymentId()}
      data-source-fingerprint={runtimeQaSourceFingerprint()}
      className="min-h-screen bg-[#0B0F12] text-stone-100"
    >
      <span data-testid="qa-fresh-guest-onboarding-completed" className="sr-only">
        {String(profile.onboardingCompleted)}
      </span>
      <OnboardingModal
        isOpen={!profile.onboardingCompleted}
        language="en"
        onComplete={(updates) =>
          setProfile((current) => ({
            ...current,
            ...updates,
          }))
        }
      />
    </main>
  );
};
