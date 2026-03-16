// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PolkaDollar {
    string public name     = "PolkaDollar";
    string public symbol   = "pUSD";
    uint8  public decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public vault;

    event Transfer(address indexed from, address indexed to, uint256 value);

    modifier onlyVault() {
        require(msg.sender == vault, "not vault");
        _;
    }

    constructor(address _vault) {
        vault = _vault;
    }

    function mint(address to, uint256 amount) external onlyVault {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyVault {
        require(balanceOf[from] >= amount, "insufficient");
        totalSupply -= amount;
        balanceOf[from] -= amount;
        emit Transfer(from, address(0), amount);
    }
}