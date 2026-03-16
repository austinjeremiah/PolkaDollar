// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IRiskEngine {
    function assessRisk() external returns (uint8 regime, uint256 ratio);
}

interface IPolkaDollar {
    function mint(address to, uint256 amount) external;
    function burnFromVault(address from, uint256 amount) external;
}

interface IPriceFeed {
    function price() external view returns (uint256);
    function lastUpdatedAt() external view returns (uint256);
}

contract CollateralVault is Ownable {
    IRiskEngine public riskEngine;
    IPolkaDollar public pusd;
    IPriceFeed public priceFeed;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;

    uint256 public constant PRICE_DECIMALS = 1e18;
    uint256 public constant RATIO_BPS = 10_000;
    uint256 public constant LIQUIDATION_BONUS_BPS = 10_500;
    uint256 public constant MAX_PRICE_AGE = 30 minutes;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Minted(address indexed user, uint256 amount, uint8 regime, uint256 ratio);
    event Burned(address indexed user, uint256 amount);
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        uint256 debtRepaid,
        uint256 collateralSeized
    );
    event RiskEngineUpdated(address indexed newRiskEngine);
    event PriceFeedUpdated(address indexed newPriceFeed);

    constructor(address _riskEngine, address _pusd, address _priceFeed, address _owner) Ownable(_owner) {
        require(_riskEngine != address(0), "zero risk");
        require(_pusd != address(0), "zero pusd");
        require(_priceFeed != address(0), "zero feed");
        riskEngine = IRiskEngine(_riskEngine);
        pusd = IPolkaDollar(_pusd);
        priceFeed = IPriceFeed(_priceFeed);
    }

    function setRiskEngine(address _riskEngine) external onlyOwner {
        require(_riskEngine != address(0), "zero risk");
        riskEngine = IRiskEngine(_riskEngine);
        emit RiskEngineUpdated(_riskEngine);
    }

    function setPriceFeed(address _priceFeed) external onlyOwner {
        require(_priceFeed != address(0), "zero feed");
        priceFeed = IPriceFeed(_priceFeed);
        emit PriceFeedUpdated(_priceFeed);
    }

    function deposit() external payable {
        require(msg.value > 0, "zero deposit");
        collateral[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function mint(uint256 pusdAmount) external {
        require(pusdAmount > 0, "zero mint");
        (uint8 regime, uint256 ratio) = _assessRisk();

        uint256 newDebt = debt[msg.sender] + pusdAmount;
        _requireHealthy(collateral[msg.sender], newDebt, ratio);

        debt[msg.sender] = newDebt;
        pusd.mint(msg.sender, pusdAmount);
        emit Minted(msg.sender, pusdAmount, regime, ratio);
    }

    function burn(uint256 pusdAmount) external {
        require(pusdAmount > 0, "zero burn");
        require(debt[msg.sender] >= pusdAmount, "excess burn");
        pusd.burnFromVault(msg.sender, pusdAmount);
        debt[msg.sender] -= pusdAmount;
        emit Burned(msg.sender, pusdAmount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "zero withdraw");
        require(collateral[msg.sender] >= amount, "insufficient collateral");

        uint256 newCollateral = collateral[msg.sender] - amount;
        if (debt[msg.sender] > 0) {
            (, uint256 ratio) = _assessRisk();
            _requireHealthy(newCollateral, debt[msg.sender], ratio);
        }

        collateral[msg.sender] = newCollateral;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    function liquidate(address user) external {
        require(user != address(0), "zero user");
        uint256 debtAmount = debt[user];
        require(debtAmount > 0, "no debt");

        (, uint256 ratio) = _assessRisk();
        require(!_isHealthy(collateral[user], debtAmount, ratio), "healthy");

        uint256 currentPrice = _freshPrice();
        uint256 seizeValueUsd = (debtAmount * LIQUIDATION_BONUS_BPS) / RATIO_BPS;
        uint256 seizeCollateral = (seizeValueUsd * PRICE_DECIMALS) / currentPrice;
        if (seizeCollateral > collateral[user]) {
            seizeCollateral = collateral[user];
        }

        pusd.burnFromVault(msg.sender, debtAmount);
        debt[user] -= debtAmount;
        collateral[user] -= seizeCollateral;

        (bool ok,) = payable(msg.sender).call{value: seizeCollateral}("");
        require(ok, "liq transfer failed");
        emit Liquidated(user, msg.sender, debtAmount, seizeCollateral);
    }

    function healthFactor(address user) external view returns (uint256) {
        uint256 userDebt = debt[user];
        if (userDebt == 0) return type(uint256).max;
        uint256 currentPrice = priceFeed.price();
        uint256 collateralUsd = (collateral[user] * currentPrice) / PRICE_DECIMALS;
        return (collateralUsd * RATIO_BPS) / userDebt;
    }

    function _freshPrice() internal view returns (uint256 currentPrice) {
        currentPrice = priceFeed.price();
        require(currentPrice > 0, "bad price");
        require(block.timestamp - priceFeed.lastUpdatedAt() <= MAX_PRICE_AGE, "stale price");
    }

    function _assessRisk() internal returns (uint8 regime, uint256 ratio) {
        (regime, ratio) = riskEngine.assessRisk();
        require(ratio >= 13_000 && ratio <= 22_000, "bad ratio");
    }

    function _requireHealthy(uint256 userCollateral, uint256 userDebt, uint256 ratio) internal view {
        require(_isHealthy(userCollateral, userDebt, ratio), "undercollateralized");
    }

    function _isHealthy(uint256 userCollateral, uint256 userDebt, uint256 ratio) internal view returns (bool) {
        if (userDebt == 0) return true;
        uint256 currentPrice = _freshPrice();
        uint256 collateralUsd = (userCollateral * currentPrice) / PRICE_DECIMALS;
        uint256 requiredUsd = (userDebt * ratio) / RATIO_BPS;
        return collateralUsd >= requiredUsd;
    }
}
