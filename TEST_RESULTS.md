# Test Results: TC01 to TC10

Tester: ____________  Date: ____________  Build: local, Supabase project `sad-scholarship-monitoring`
Fill in "Actual result" and "Pass/Fail" after running each test. Report defects honestly.

| Test ID | Input or action | Expected result | Actual result | Pass/Fail | Evidence |
|---|---|---|---|---|---|
| TC01 | Staff opens A01 (Merit, GWA 1.75, 18 units, submitted exactly 2026-10-30 17:00), clicks Evaluate | Compliant; all checks pass | | | evidence/TC01-A01-compliant.png |
| TC02 | Evaluate A02 (Merit, GWA 1.76) | With Deficiency; reason says GWA 1.76 is above 1.75 | | | evidence/TC02-A02-gwa.png |
| TC03 | Evaluate A03 (Community, 1 dropped) | Compliant; 1 dropped allowed for Community | | | evidence/TC03-A03-program.png |
| TC04 | Evaluate A04 (Community, 14 units, 1 incomplete) | With Deficiency; reasons list insufficient units AND incomplete grade | | | evidence/TC04-A04-multiple.png |
| TC05 | Evaluate A05 (Merit, 1 failed, submitted 17:01) | With Deficiency; reasons list failed subject AND late submission | | | evidence/TC05-A05-fail-late.png |
| TC06 | On A06 (Pending), click Evaluate, then Approve renewal | Both blocked with clear messages until verified and evaluated | | | evidence/TC06-A06-gate.png |
| TC07 | As scholar A06: submit a duplicate semester; submit GWA 0.50; submit a negative count | Each rejected with a clear message; nothing saved | | | evidence/TC07-validation.png |
| TC08 | As scholar A06: click both Access check buttons | Returns 0 other records; verification changes 0 rows (denied by the database) | | | evidence/TC08-role-isolation.png |
| TC09 | Staff returns A06 with a reason; scholar corrects and resubmits; refresh the page | Status is Pending verification; history keeps return and resubmission entries | | | evidence/TC09-correction.png |
| TC10 | Staff approve A01 (Compliant) and hold A02 (deficient); scholar tries to change the decision | A01 Approved; A02 Held; scholar has no control and the database denies edits | | | evidence/TC10-renewal.png |

## Defects found
(None recorded yet. List each defect: test ID, what happened, status.)

## Run order that avoids conflicts
1. Staff: Verified records A01 to A05 are ready. Run TC01 to TC05, then TC10 (approve A01, hold A02).
2. Scholar A06: TC07 and TC08 (before any change to A06).
3. Staff and A06 together: TC06 (A06 still Pending), then TC09.
