// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IXcm {
    function send(bytes memory dest, bytes memory message) external returns (bool);
}

contract XCMTransfer {
    address public immutable precompile;

    event XCMSent(
        address indexed sender,
        bytes dest,
        bytes message,
        bool ok
    );

    constructor(address _precompile) {
        require(_precompile != address(0), "zero precompile");
        precompile = _precompile;
    }

    function sendCrossChain(bytes calldata dest, bytes calldata message) external {
        (bool ok,) = precompile.call(abi.encodeWithSelector(IXcm.send.selector, dest, message));
        require(ok, "XCM send failed");
        emit XCMSent(msg.sender, dest, message, ok);
    }

    function send(bytes calldata dest, bytes calldata message, address)
        external
    {
        (bool ok,) = precompile.call(abi.encodeWithSelector(IXcm.send.selector, dest, message));
        require(ok, "XCM send failed");
        emit XCMSent(msg.sender, dest, message, ok);
    }
}

