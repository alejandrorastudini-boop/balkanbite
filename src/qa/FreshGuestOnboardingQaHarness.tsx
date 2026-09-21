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
      <span data-testid="qa-fresh-guest-household-size" className="sr-only">
        {profile.householdSize === undefined
          ? "absent"
          : String(profile.householdSize)}
      </span>
      <span data-testid="qa-fresh-guest-diet-style" className="sr-only">
        {profile.dietStyle}
      </span>
      <span data-testid="qa-fresh-guest-cooking-speed" className="sr-only">
        {profile.cookingSpeed}
      </span>
      <span data-testid="qa-fresh-guest-budget" className="sr-only">
        {profile.monthlyBudgetEUR === undefined
          ? "absent"
          : String(profile.monthlyBudgetEUR)}
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
