---
name: Dashboard and markers must follow per-transformer gas limit standard
description: User expects map marker color and TransformerHealthDashboard to evaluate DGA against the gas limit standard saved per transformer (dga_gas_limit_standard), not a hardcoded set of limits.
type: feedback
---

The gas limit standard chosen in the DGA Analysis modal (DGAWorkbenchModal) is the source of truth per transformer. Map markers (red/yellow/green) and the TransformerHealthDashboard must read from it.

**Why:** User explicitly wants "i will link status to marker red, yellow and green in the map then also the dashboard of gas limit to show too" — and complained the chosen standard "not save permanent" because the dashboard was using hardcoded IEEE_2008 limits, making changes feel ineffective even though Supabase was saving correctly.

**How to apply:**
- Persist per-transformer DGA prefs (oilType, gasLimitStandard, methodView) via `transformerService.updateDgaPreferences`. Saves succeed via the auto-save effect in DGAWorkbenchModal.
- After save, bubble the new preferences up to App.jsx (`handleDgaPreferencesSaved`) so `transformers` and `selectedTransformer` are updated immediately. Don't rely on a local override in OilTestSection — that gets lost across re-mounts and makes saves look like they revert.
- Anywhere that interprets DGA values (markers via `analyzeSample` in App.jsx, TransformerHealthDashboard limits, etc.) must derive limits from the saved standard + oil type, not hardcoded constants.
