// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StabilityAnalyzer {

    address public vault           = 0x54Dc42542E36F10b5Ff8B60A00cf1e48278006ae;
    address public priceFeed       = 0xCDe170C92E281757aD961Ba47B33DFacd827a761;
    address public riskEngine      = 0xF11336b3910426e1A4433adA20E19eA73876A306;
    address public stabilityEngine = 0x0a86C6f085E7De256F44fADb7F39DEB122d8017c;

    event StabilityChecked(address indexed user, uint64 score, uint64 flag);

    struct Inputs {
        uint64 collateralUSD;
        uint64 debt;
        uint64 vol;
        uint64 ratio;
    }

    function _getPrice() internal returns (uint256) {
        (bool ok, bytes memory r) = priceFeed.call(abi.encodeWithSignature("price()"));
        require(ok);
        return abi.decode(r, (uint256));
    }

    function _getRisk() internal returns (uint8 regime, uint256 ratio) {
        (bool ok, bytes memory r) = riskEngine.call(abi.encodeWithSignature("assessRisk()"));
        require(ok);
        return abi.decode(r, (uint8, uint256));
    }

    function _getCollateral(address user) internal returns (uint256) {
        (bool ok, bytes memory r) = vault.call(abi.encodeWithSignature("collateral(address)", user));
        require(ok);
        return abi.decode(r, (uint256));
    }

    function _getDebt(address user) internal returns (uint256) {
        (bool ok, bytes memory r) = vault.call(abi.encodeWithSignature("debt(address)", user));
        require(ok);
        return abi.decode(r, (uint256));
    }

    function _buildInputs(address user) internal returns (Inputs memory inp) {
        uint256 price  = _getPrice();
        uint256 col    = _getCollateral(user);
        uint256 dbt    = _getDebt(user);
        (uint8 regime, uint256 ratio) = _getRisk();
        inp.collateralUSD = uint64(col * price / 1e8);
        inp.debt          = uint64(dbt / 1e18);
        inp.vol           = uint64(regime) * 500 + 200;
        inp.ratio         = uint64(ratio / 100);
    }

    function _callEngine(Inputs memory inp) internal returns (uint64 score, uint64 flag) {
        (bool ok, bytes memory r) = stabilityEngine.call(
            abi.encodeWithSignature(
                "call(uint64,uint64,uint64,uint64)",
                inp.collateralUSD,
                inp.debt,
                inp.vol,
                inp.ratio
            )
        );
        require(ok, "engine failed");
        return abi.decode(r, (uint64, uint64));
    }

    function analyze(address user) external returns (uint64 score, uint64 flag) {
        Inputs memory inp = _buildInputs(user);
        (score, flag) = _callEngine(inp);
        emit StabilityChecked(user, score, flag);
    }

    function analyzeRaw(
        uint64 collateralUSD,
        uint64 debt,
        uint64 volatility,
        uint64 ratio
    ) external returns (uint64 score, uint64 flag) {
        Inputs memory inp = Inputs(collateralUSD, debt, volatility, ratio);
        (score, flag) = _callEngine(inp);
    }

    function getFlag(uint64 flag) external pure returns (string memory) {
        if (flag == 0) return "STABLE";
        if (flag == 1) return "CAUTION";
        return "AT_RISK";
    }
}