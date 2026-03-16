// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PolkaDollar is ERC20, Ownable {
    address public vault;

    error NotVault();
    error ZeroAddress();

    event VaultUpdated(address indexed previousVault, address indexed newVault);

    constructor(address initialOwner) ERC20("PolkaDollar", "pUSD") Ownable(initialOwner) {}

    modifier onlyVault() {
        if (msg.sender != vault) revert NotVault();
        _;
    }

    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert ZeroAddress();
        address previous = vault;
        vault = newVault;
        emit VaultUpdated(previous, newVault);
    }

    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    function burnFromVault(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }
}
