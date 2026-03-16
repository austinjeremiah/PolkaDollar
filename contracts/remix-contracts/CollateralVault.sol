// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRiskEngine {
    function assessRisk() external returns (uint8 regime, uint256 ratio);
}

interface IPolkaDollar {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

interface IPriceFeed {
    function price() external view returns (uint256);
}

contract CollateralVault {
    IRiskEngine  public riskEngine;
    IPolkaDollar public pusd;
    IPriceFeed   public priceFeed;

    mapping(address => uint256) public collateral;
    mapping(address => uint256) public debt;

    uint256 constant PRICE_DECIMALS  = 1e8;
    uint256 constant RATIO_DECIMALS  = 10000;
    uint256 constant LIQUIDATION_BPS = 12000;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Minted(address indexed user, uint256 amount, uint256 ratio);
    event Burned(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator);

    constructor(address _riskEngine, address _pusd, address _priceFeed) {
        riskEngine = IRiskEngine(_riskEngine);
        pusd       = IPolkaDollar(_pusd);
        priceFeed  = IPriceFeed(_priceFeed);
    }

    function setPusd(address _pusd) external {
        require(address(pusd) == address(0), "already set");
        pusd = IPolkaDollar(_pusd);
    }

    function deposit() external payable {
        require(msg.value > 0, "zero deposit");
        collateral[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function mint(uint256 pusdAmount) external {
        require(pusdAmount > 0, "zero mint");
        (, uint256 ratio) = riskEngine.assessRisk();
        uint256 dotPrice      = priceFeed.price();
        uint256 collateralUSD = collateral[msg.sender] * dotPrice / PRICE_DECIMALS;
        uint256 newDebt       = debt[msg.sender] + pusdAmount;
        uint256 required      = newDebt * ratio / RATIO_DECIMALS;
        require(collateralUSD >= required, "undercollateralised");
        debt[msg.sender] += pusdAmount;
        pusd.mint(msg.sender, pusdAmount);
        emit Minted(msg.sender, pusdAmount, ratio);
    }

    function burn(uint256 pusdAmount) external {
        require(debt[msg.sender] >= pusdAmount, "excess burn");
        debt[msg.sender] -= pusdAmount;
        pusd.burn(msg.sender, pusdAmount);
        emit Burned(msg.sender, pusdAmount);
    }

    function withdraw(uint256 amount) external {
        require(collateral[msg.sender] >= amount, "insufficient");
        uint256 newCollateral = collateral[msg.sender] - amount;
        if (debt[msg.sender] > 0) {
            (, uint256 ratio) = riskEngine.assessRisk();
            uint256 dotPrice      = priceFeed.price();
            uint256 collateralUSD = newCollateral * dotPrice / PRICE_DECIMALS;
            uint256 required      = debt[msg.sender] * ratio / RATIO_DECIMALS;
            require(collateralUSD >= required, "would undercollateralise");
        }
        collateral[msg.sender] = newCollateral;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function liquidate(address user) external {
        uint256 dotPrice      = priceFeed.price();
        uint256 collateralUSD = collateral[user] * dotPrice / PRICE_DECIMALS;
        uint256 required      = debt[user] * LIQUIDATION_BPS / RATIO_DECIMALS;
        require(collateralUSD < required, "not liquidatable");
        uint256 debtAmount       = debt[user];
        uint256 collateralSeized = collateral[user];
        debt[user]       = 0;
        collateral[user] = 0;
        pusd.burn(msg.sender, debtAmount);
        payable(msg.sender).transfer(collateralSeized);
        emit Liquidated(user, msg.sender);
    }

    function healthFactor(address user) external view returns (uint256) {
        if (debt[user] == 0) return type(uint256).max;
        uint256 dotPrice      = priceFeed.price();
        uint256 collateralUSD = collateral[user] * dotPrice / PRICE_DECIMALS;
        return collateralUSD * RATIO_DECIMALS / debt[user];
    }
}