// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PriceFeed {
    uint256 public price;
    address public owner;

    event PriceUpdated(uint256 newPrice);

    constructor(uint256 _initialPrice) {
        price = _initialPrice;
        owner = msg.sender;
    }

    function updatePrice(uint256 _price) external {
        require(msg.sender == owner, "not owner");
        price = _price;
        emit PriceUpdated(_price);
    }
}