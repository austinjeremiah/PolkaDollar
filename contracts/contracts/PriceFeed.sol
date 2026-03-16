// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PriceFeed is Ownable {
    uint256 public price;
    uint256 public lastUpdatedAt;

    event PriceUpdated(uint256 newPrice, uint256 timestamp);

    constructor(uint256 initialPrice, address initialOwner) Ownable(initialOwner) {
        price = initialPrice;
        lastUpdatedAt = block.timestamp;
        emit PriceUpdated(initialPrice, block.timestamp);
    }

    function updatePrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "zero price");
        price = newPrice;
        lastUpdatedAt = block.timestamp;
        emit PriceUpdated(newPrice, block.timestamp);
    }
}
