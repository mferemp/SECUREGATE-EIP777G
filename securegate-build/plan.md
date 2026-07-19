# Plan — DAPINK pre-auth "centered terminal hero" layout fix

**Summary:** Stop the pre-auth main canvas from looking empty. Vertically center and enlarge the `STANDALONE OPERATION` + gold `CAUTION` stack into a full-height DAPINK hero. Keep the recovery/dashboard workspace fully gated behind Auth-Gate. No backend, contract, or security-model changes.

## What changes (2 files)

### 1. `frontend/src/App.tsx` (small wrapper only, ~8 lines)
- On `<main className="sg-main">` (line 905): drop the inline `grid` style and switch to a state class — `sg-main sg-main--locked` when `!dashboardUnlocked`, `sg-main sg-main--unlocked` after unlock.
- Wrap the existing `sg-standalone` + `sg-caution` + `sg-gate-hint` blocks (lines 907–926) in a new `<div className="sg-hero">`. No text, no fields, no new sections added.
- The gated `{dashboardUnlocked ? (…workspace…) : null}` block (line 928+) is left exactly as-is — recovery form, tabs, 2FA, deploy progress, thank-you all still reveal only after Auth-Gate.

### 2. `frontend/src/index.css` (layout + emphasis)
- `.sg-main--locked`: fill available height (`min-height: calc(100vh - topbar)`), `display:flex`, center vertically and horizontally so the hero sits mid-canvas.
- `.sg-main--unlocked`: normal top-aligned stacked flow (today's behavior) so the workspace reads correctly.
- `.sg-hero`: centered column, `width:100%`, `max-width:760px`, generous vertical rhythm (gap ~28px).
- Enlarge `.sg-standalone` / `.sg-caution`: wider cards, bigger padding (~34px), larger `.sg-standalone-title`, stronger neon border + cyan/gold outer glow (`box-shadow`) to match the DAPINK terminal look.
- Keep the existing palette vars (cyan `#35e0d8`, pink `#ff3fb4`, gold `#d9b25a`, bg `#05070d`).

## Explicitly NOT touched
- No pre-auth recovery/deploy form, K1/K2/K3 fields, chain/funding/deploy controls, 2FA panels, deploy progress, or dashboard tabs (they stay gated).
- `backend/`, `contracts/`, `out/`, `test/` — untouched.
- Auth-Gate sidebar (SCAN, K1 input, LINK DEVICE, PASSKEY, ENTER) — untouched.
- `scripts/verify-design-fidelity.cjs` label/gate assertions — still pass (STANDALONE stays before tabs, gate still wraps the workspace, SCAN still gated).

## Verify after
- `verify-design-fidelity.cjs` → 29/29, frontend type-check + build OK, backend/contracts diff empty.
