# Site Twin Creation Demo Flow (End-to-End)

Updated: 2026-05-31

This is the canonical demo path for creating/importing a Site Twin with the draft approval gate.

## Demo objective

Show that SentinelTwin supports multiple intake sources and that **Site Draft Review is the single activation gate** before any new Site Twin becomes active.

## Demo entry

1. Open `/` (Command Center).
2. Click **Create Site Twin** (left nav).
3. Confirm `SiteIntakeHub` opens with source cards.

## Intake source options to demonstrate

- Scan Site Photos (`scan`)
- Describe with AI (`ai_prompt`)
- Upload Floor Plan (`floor_plan`)
- Import Site Twin (`json`)
- Build Manually (`manual`)
- Verify from Footage (`camera_evidence`, preview maturity)

## Canonical lifecycle (all sources)

1. Start from selected source card CTA.
2. Source flow produces candidate scene or parsed input.
3. System creates `SiteIntakeSession` draft.
4. UI navigates to **Site Draft Review**.
5. Active scene remains unchanged until **Approve**.
6. Approve promotes draft to active Site Twin.
7. Baseline simulation runs after approval when requirements are ready.

## JSON import demo path

1. From Site Intake, click **Import Site Twin**.
2. Upload a valid SecurityScene JSON.
3. Review draft in **Site Draft Review**.
4. Approve and open Studio.
5. Run simulation, then open Audit Report.

## Pass criteria for demo sign-off

- No source path mutates active scene before approval.
- Cancel from draft review returns to intake without activation.
- `failedZones` only lists failing/partial zones.
- `zoneFindings` lists all critical zones.
- Report/Issues/Compare/Outcome show consistent status and primary risk source.
- Home controls are either truly actionable or clearly non-interactive status.
