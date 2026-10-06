import type { HealthProfile } from "../types";
import type { BulgarianAdultEnergyReferenceInput } from "./bulgariaAdultEnergyReference";
import { getKnownHealthNumber, getKnownHealthValue } from "./healthProfile";

export function buildBulgarianAdultEnergyReferenceInputFromHealthProfile(
  profile: HealthProfile | undefined,
): BulgarianAdultEnergyReferenceInput {
  return {
    ageYears: getKnownHealthNumber(profile?.ageYears),
    physiologicalSex: getKnownHealthValue(profile?.physiologicalSex),
    activityCategory: getKnownHealthValue(profile?.activityCategory),
  };
}
