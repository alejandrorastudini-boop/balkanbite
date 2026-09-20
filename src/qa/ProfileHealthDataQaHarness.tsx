import React, { useState } from "react";
import { ProfileView } from "../components/ProfileView";
import { DEFAULT_PROFILE } from "../data/initialData";
import type { UserProfile } from "../types";
import {
  runtimeQaDeploymentId,
  runtimeQaDeploymentSha,
  runtimeQaSourceFingerprint,
} from "./runtimeQaGate";

const INITIAL_PROFILE: UserProfile = {
  ...DEFAULT_PROFILE,
  onboardingCompleted: true,
  healthProfile: {
    version: 1,
    ageYears: {
      status: "known",
      value: 35,
      source: "imported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    heightCm: {
      status: "known",
      value: 175,
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    weightKg: {
      status: "known",
      value: 75,
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    physiologicalSex: {
      status: "known",
      value: "female",
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    activityCategory: {
      status: "known",
      value: "moderately_active",
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
    pregnancyLactationStatus: {
      status: "prefer_not_to_say",
      source: "self_reported",
      recordedAt: "2026-09-20T09:00:00.000Z",
    },
  },
};

export function ProfileHealthDataQaHarness() {
  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);

  return (
    <div
      data-testid="qa-profile-health-root"
      data-deployment-sha={runtimeQaDeploymentSha()}
      data-deployment-id={runtimeQaDeploymentId()}
      data-source-fingerprint={runtimeQaSourceFingerprint()}
      className="min-h-screen bg-[#0B0F12] text-stone-100 p-4"
    >
      <span data-testid="qa-health-profile-present" className="sr-only">
        {String(Boolean(profile.healthProfile))}
      </span>
      <span data-testid="qa-health-field-count" className="sr-only">
        {String(
          profile.healthProfile
            ? Object.keys(profile.healthProfile).filter(
                (key) => key !== "version",
              ).length
            : 0,
        )}
      </span>
      <span data-testid="qa-health-age-status" className="sr-only">
        {profile.healthProfile?.ageYears?.status ?? "absent"}
      </span>
      <span data-testid="qa-health-age-value" className="sr-only">
        {profile.healthProfile?.ageYears?.status === "known"
          ? String(profile.healthProfile.ageYears.value ?? "")
          : ""}
      </span>
      <span data-testid="qa-health-age-source" className="sr-only">
        {profile.healthProfile?.ageYears?.source ?? "absent"}
      </span>
      <span data-testid="qa-health-age-recorded-at" className="sr-only">
        {profile.healthProfile?.ageYears?.recordedAt ?? "absent"}
      </span>
      <div className="mx-auto max-w-4xl">
        <ProfileView
          profile={profile}
          onUpdateProfile={(updated) =>
            setProfile((current) => ({ ...current, ...updated }))
          }
          onOpenProModal={() => {}}
          onResetApp={() => {}}
          language="en"
          currency="EUR"
        />
      </div>
    </div>
  );
}
