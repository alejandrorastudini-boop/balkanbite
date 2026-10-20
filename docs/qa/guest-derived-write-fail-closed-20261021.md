# Guest derived write failure remains blocked after unrelated shopping success

Date: 2026-10-21. Functional Draft #453 baseline `2950db8a694d057da40d48a4387e7545e177e9ea`.

## Problem
Guest cache writer effects for recipes, meal plan and progression caught thrown localStorage errors and logged a warning, but left React's inventory/shopping consistency gate clear. They did not detect silent setItem failures either. A later successful shopping list update could set `guestDerivedShoppingRecoveryProblem=false` without confirming those other bytes. A verified shopping key does **not** prove a committed pantry/recipe/menu/progression transition.

## Change
- App now readbacks the exact serialized guest recipes, meal plan and progression after their own localStorage writes and latches `guestDerivedStorageWriteFailed=true` on thrown or silent failures.
- A separate combined `guestShoppingConsistencyProblem` gates pantry-derived mutations, Chef facts and warning UI even if a later independent shopping writer succeeds.
- Runtime Chromium QA: perform a real pantry quantity update while silently dropping just the meal plan or recipe write, require the warning, then restore storage and toggle a real shopping checkbox successfully. The warning must remain; unchanged failed derived bytes are retained.
- The latch lasts until new page mount, not a durable cross-tab CAS or guarantee of consistency after reload. This is deliberately a bounded fail-closed improvement, **not** closure of #459; further crash recovery, valid/invalid key matrix and atomicity remain open.

## Required gate
Exact SHA tests/lint/build, six local Chromium harness scenarios, Firestore emulator, diff review. QA draft only, non-force FF into PR #453 after success. No merge main, no hosted writes, no deployments or paid services.
