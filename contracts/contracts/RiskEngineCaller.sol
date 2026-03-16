// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title RiskEngineCaller
 * @notice EVM contract that delegates EWMA volatility computation to a Rust PVM contract.
 *
 * Exact same pattern as FibCaller → fibonacci, but instead of fib(n)
 * we call pushPrice(price) and assessRisk() on the Rust risk engine.
 *
 * The cross-VM calls:
 *   IRiskEngine(riskEngineAddress).pushPrice(price)
 *   IRiskEngine(riskEngineAddress).assessRisk()
 *
 * pallet-revive routes both to the RISC-V executor transparently.
 */

interface IRiskEngine {
    // selector: 0x17b6c447  — verify with: npx ts-node scripts/selectors.ts
    function pushPrice(uint256 price) external;

    // selector: 0xb5a3d22a
    // returns regime (0=LOW,1=MEDIUM,2=HIGH,3=EXTREME) and ratio in bps (13000=130%)
    function assessRisk() external returns (uint8 regime, uint256 ratio);
}

contract RiskEngineCaller {
    address public riskEngineAddress;

    event PricePushed(uint256 price);
    event RiskAssessed(uint8 regime, uint256 ratio);

    constructor(address _riskEngine) {
        riskEngineAddress = _riskEngine;
    }

    function pushPrice(uint256 price) public {
        IRiskEngine(riskEngineAddress).pushPrice(price);
        emit PricePushed(price);
    }

    /// @notice Cross-VM call: EVM → PVM EWMA computation.
    function assessRisk() public returns (uint8 regime, uint256 ratio) {
        (regime, ratio) = IRiskEngine(riskEngineAddress).assessRisk();
        emit RiskAssessed(regime, ratio);
    }
}
