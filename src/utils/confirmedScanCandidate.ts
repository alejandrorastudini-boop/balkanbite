import {
  isCandidateReadyForPantry,
  type SafeScanCandidate,
} from "./safeScanCandidate";

/**
 * Capture output is only a review candidate. Quantity and unit must each be
 * explicitly confirmed by the user before the candidate can cross the pantry
 * persistence boundary, even when the scanner supplied both values.
 */
export const isConfirmedScanCandidate = (
  candidate: SafeScanCandidate,
  quantityConfirmed: boolean,
  unitConfirmed: boolean
): boolean =>
  quantityConfirmed && unitConfirmed && isCandidateReadyForPantry(candidate);
