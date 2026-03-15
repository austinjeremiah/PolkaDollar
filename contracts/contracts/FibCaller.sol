// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title FibCaller
 * @notice EVM contract that delegates Fibonacci computation to a Rust PVM contract.
 *
 * This is the payoff demo: an EVM Solidity contract calling a PVM Rust contract
 * to do something that would be expensive on EVM alone.
 *
 * The cross-VM call:
 *   IFibonacci(fibContractAddress).fib(n)
 *
 * This is syntactically identical to calling any other contract. pallet-revive
 * sees that `fibContractAddress` belongs to a PVM contract and routes to the
 * RISC-V executor. The result comes back as a uint256.
 *
 * Deploy target: EVM (compiled with solc)
 */

/**
 * @dev Interface matching the Rust fibonacci contract's ABI.
 *      The selector for fib(uint256) = keccak256("fib(uint256)")[0:4] = 0x5e2b6729
 *      This selector is what pallet-revive sends to the Rust contract's call()
 *      entry point as the first 4 bytes of calldata.
 */
interface IFibonacci {
    function fib(uint256 n) external returns (uint256);
}

contract FibCaller {
    address public fibContractAddress;

    event FibResult(uint256 indexed n, uint256 result, address computedBy);

    constructor(address _fibContractAddress) {
        fibContractAddress = _fibContractAddress;
    }

    /**
     * @notice Compute the nth Fibonacci number using the Rust PVM contract.
     * @param n The index. fib(0)=0, fib(1)=1, fib(10)=55, fib(50)=12586269025.
     * @return result The nth Fibonacci number.
     *
     * @dev This line is the cross-VM call. `fibContractAddress` is a PVM contract.
     *      EVM → PVM dispatch happens transparently via pallet-revive.
     */
    function computeFib(uint256 n) public returns (uint256 result) {
        result = IFibonacci(fibContractAddress).fib(n);
        emit FibResult(n, result, fibContractAddress);
    }
}
