import {
  isCandidateReadyForPantry,
  type SafeScanCandidate,
} from "./safeScanCandidate";

/**
 * Capture output is only a review candidate. Quantity and unit must each be
 * explicitly confirmed before the row can become selectable. ScanModal row
 * selection separately confirms the displayed product identity/category before
 * the candidate may cross the pantry persistence boundary.
 */
export const isConfirmedScanCandidate = (
  candidate: SafeScanCandidate,
  quantityConfirmed: boolean,
  unitConfirmed: boolean
): boolean =>
  quantityConfirmed && unitConfirmed && isCandidateReadyForPantry(candidate);
