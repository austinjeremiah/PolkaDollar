#include <stdint.h>

extern "C" {

// Compute protocol stability score and flag
// Inputs:
//   total_collateral_usd  — total DOT locked × price (in cents)
//   total_debt            — total pUSD minted
//   volatility            — EWMA volatility × 100 (e.g. 5.5% = 550)
//   current_ratio         — collateral ratio (130, 150, 180, 220)
// Outputs written to pointers:
//   score  — 0 to 100 (higher = healthier)
//   flag   — 0 = STABLE, 1 = CAUTION, 2 = AT_RISK

void compute_stability(
    uint64_t total_collateral_usd,
    uint64_t total_debt,
    uint64_t volatility,
    uint64_t current_ratio,
    uint64_t* score,
    uint64_t* flag
) {
    // ── Component 1: Collateralization score (0–40 points) ───────────────
    // How well collateral covers debt
    // collateral_ratio = (total_collateral_usd * 100) / total_debt
    uint64_t col_score = 0;
    if (total_debt > 0) {
        uint64_t col_ratio = (total_collateral_usd * 100) / total_debt;
        // col_ratio >= 300 → full 40 pts
        // col_ratio 120–300 → scaled
        // col_ratio < 120  → 0 pts (danger zone)
        if (col_ratio >= 300) {
            col_score = 40;
        } else if (col_ratio >= 120) {
            col_score = ((col_ratio - 120) * 40) / 180;
        } else {
            col_score = 0;
        }
    }

    // ── Component 2: Volatility score (0–30 points) ──────────────────────
    // Lower volatility = higher score
    // volatility is × 100, so 5% = 500
    // volatility <= 200  (2%)  → full 30 pts
    // volatility >= 3000 (30%) → 0 pts
    uint64_t vol_score = 0;
    if (volatility <= 200) {
        vol_score = 30;
    } else if (volatility < 3000) {
        vol_score = ((3000 - volatility) * 30) / 2800;
    } else {
        vol_score = 0;
    }

    // ── Component 3: Ratio buffer score (0–30 points) ────────────────────
    // How much buffer above minimum (120%) the current ratio gives
    // ratio 220 → 30 pts (maximum buffer)
    // ratio 180 → 20 pts
    // ratio 150 → 10 pts
    // ratio 130 → 5 pts
    uint64_t ratio_score = 0;
    if (current_ratio >= 220) {
        ratio_score = 30;
    } else if (current_ratio >= 180) {
        ratio_score = 20;
    } else if (current_ratio >= 150) {
        ratio_score = 10;
    } else {
        ratio_score = 5;
    }

    // ── Final score ───────────────────────────────────────────────────────
    uint64_t total = col_score + vol_score + ratio_score;
    if (total > 100) total = 100;
    *score = total;

    // ── Flag ──────────────────────────────────────────────────────────────
    // 0 = STABLE   score >= 60
    // 1 = CAUTION  score 30–59
    // 2 = AT_RISK  score < 30
    if (total >= 60) {
        *flag = 0;
    } else if (total >= 30) {
        *flag = 1;
    } else {
        *flag = 2;
    }
}

} // extern "C"