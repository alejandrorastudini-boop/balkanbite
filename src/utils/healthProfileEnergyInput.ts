import type { HealthProfile } from "../types";
import type { EfsaAdultMaintenanceEnergyInput } from "./euAdultMaintenanceEnergy";
import {
  getKnownHealthNumber,
  getKnownHealthValue,
} from "./healthProfile";

/**
 * Builds only the inputs explicitly known in HealthProfile.
 *
 * Unknown, not-applicable and prefer-not-to-say values remain absent. This
 * adapter never substitutes population averages or product defaults.
 */
export function buildEfsaAdultMaintenanceEnergyInputFromHealthProfile(
  profile: HealthProfile | undefined,
): EfsaAdultMaintenanceEnergyInput {
  return {
    ageYears: getKnownHealthNumber(profile?.ageYears),
    heightCm: getKnownHealthNumber(profile?.heightCm),
    weightKg: getKnownHealthNumber(profile?.weightKg),
    physiologicalSex: getKnownHealthValue(profile?.physiologicalSex),
    activityCategory: getKnownHealthValue(profile?.activityCategory),
    pregnancyLactationStatus: getKnownHealthValue(
      profile?.pregnancyLactationStatus,
    ),
  };
}
