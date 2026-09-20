import assert from "node:assert/strict";
import test from "node:test";

import type { HealthProfile } from "../src/types";
import {
  ADULT_MAINTENANCE_ENERGY_PURPOSE,
  planAdultMaintenanceEnergyCollection,
} from "../src/utils/adultEnergyCollectionPlan";

test("empty profile requests only the core minimum and does not ask pregnancy status yet", () => {
  assert.deepEqual(planAdultMaintenanceEnergyCollection(undefined), {
    status: "needs_input",
    purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
    fieldsToRequest: [
      "ageYears",
      "heightCm",
      "weightKg",
      "physiologicalSex",
      "activityCategory",
    ],
    unavailableFields: [],
  });
});

test("female equation uses progressive disclosure for pregnancy/lactation", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "known", value: 35 },
    heightCm: { status: "known", value: 170 },
    weightKg: { status: "known", value: 65 },
    physiologicalSex: { status: "known", value: "female" },
    activityCategory: { status: "known", value: "moderately_active" },
  };

  assert.deepEqual(planAdultMaintenanceEnergyCollection(profile), {
    status: "needs_input",
    purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
    fieldsToRequest: ["pregnancyLactationStatus"],
    unavailableFields: [],
  });
});

test("male equation is ready without collecting pregnancy/lactation status", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "known", value: 35 },
    heightCm: { status: "known", value: 180 },
    weightKg: { status: "known", value: 80 },
    physiologicalSex: { status: "known", value: "male" },
    activityCategory: { status: "known", value: "active" },
  };

  assert.equal(planAdultMaintenanceEnergyCollection(profile).status, "ready");
  assert.deepEqual(
    planAdultMaintenanceEnergyCollection(profile).fieldsToRequest,
    [],
  );
});

test("prefer-not-to-say stops further collection instead of pressuring for other data", () => {
  const profile: HealthProfile = {
    version: 1,
    physiologicalSex: {
      status: "prefer_not_to_say",
      source: "self_reported",
    },
  };

  assert.deepEqual(planAdultMaintenanceEnergyCollection(profile), {
    status: "unavailable_by_choice_or_scope",
    purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
    fieldsToRequest: [],
    unavailableFields: [
      {
        field: "physiologicalSex",
        status: "prefer_not_to_say",
      },
    ],
  });
});

test("unknown remains requestable but is never converted into a default", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "unknown" },
    physiologicalSex: { status: "known", value: "male" },
  };

  const plan = planAdultMaintenanceEnergyCollection(profile);
  assert.equal(plan.status, "needs_input");
  assert.deepEqual(plan.fieldsToRequest, [
    "ageYears",
    "heightCm",
    "weightKg",
    "activityCategory",
  ]);
});

test("known under-19 age stops collection before requesting more sensitive inputs", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "known", value: 17 },
  };

  assert.deepEqual(planAdultMaintenanceEnergyCollection(profile), {
    status: "unsupported",
    reason: "age_under_19",
    purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
    fieldsToRequest: [],
    unavailableFields: [],
  });
});

test("known pregnancy/lactation stops the unsupported general-adult path early", () => {
  const profile: HealthProfile = {
    version: 1,
    physiologicalSex: { status: "known", value: "female" },
    pregnancyLactationStatus: {
      status: "known",
      value: "pregnant_or_lactating",
    },
  };

  assert.deepEqual(planAdultMaintenanceEnergyCollection(profile), {
    status: "unsupported",
    reason: "pregnancy_or_lactation_requires_specialized_path",
    purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
    fieldsToRequest: [],
    unavailableFields: [],
  });
});

test("not-applicable on a required female safety field makes the estimate unavailable without re-prompting", () => {
  const profile: HealthProfile = {
    version: 1,
    ageYears: { status: "known", value: 35 },
    heightCm: { status: "known", value: 170 },
    weightKg: { status: "known", value: 65 },
    physiologicalSex: { status: "known", value: "female" },
    activityCategory: { status: "known", value: "low_active" },
    pregnancyLactationStatus: { status: "not_applicable" },
  };

  assert.deepEqual(planAdultMaintenanceEnergyCollection(profile), {
    status: "unavailable_by_choice_or_scope",
    purpose: ADULT_MAINTENANCE_ENERGY_PURPOSE,
    fieldsToRequest: [],
    unavailableFields: [
      {
        field: "pregnancyLactationStatus",
        status: "not_applicable",
      },
    ],
  });
});

test("purpose metadata keeps persistence and privacy choices explicit", () => {
  assert.equal(
    ADULT_MAINTENANCE_ENERGY_PURPOSE.inputPersistence,
    "health_profile_if_explicitly_saved",
  );
  assert.equal(
    ADULT_MAINTENANCE_ENERGY_PURPOSE.derivedEstimatePersistence,
    "not_persisted_by_default",
  );
  assert.equal(ADULT_MAINTENANCE_ENERGY_PURPOSE.requiresPurposeNotice, true);
  assert.equal(
    ADULT_MAINTENANCE_ENERGY_PURPOSE.requiresPrivacyGateBeforeUi,
    true,
  );
  assert.equal(
    ADULT_MAINTENANCE_ENERGY_PURPOSE.outputNature,
    "estimate_not_prescription",
  );
});
