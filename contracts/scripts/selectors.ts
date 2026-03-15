/**
 * selectors.ts — prints function selectors for risk_engine.rs
 * Run: npx ts-node scripts/selectors.ts
 * Verify the output matches SEL_PUSH_PRICE and SEL_ASSESS_RISK in risk_engine.rs
 */
import { ethers } from "ethers";

const sigs = ["pushPrice(uint256)", "assessRisk()"];
const names = ["SEL_PUSH_PRICE ", "SEL_ASSESS_RISK"];

console.log("\n  Rust constants to put in risk_engine.rs:\n");
for (let i = 0; i < sigs.length; i++) {
  const hex = ethers.id(sigs[i]).slice(2, 10); // 8 hex chars
  const bytes = `[0x${hex.slice(0,2)}, 0x${hex.slice(2,4)}, 0x${hex.slice(4,6)}, 0x${hex.slice(6,8)}]`;
  console.log(`  const ${names[i]}: [u8; 4] = ${bytes}; // ${sigs[i]}`);
}
console.log();
