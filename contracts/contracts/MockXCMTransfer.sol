// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockXCMTransfer {
    event XcmSent(
        address indexed sender,
        address indexed recipient,
        bytes destination,
        bytes message,
        bytes32 messageId
    );

    function send(bytes calldata destination, bytes calldata message, address recipient)
        external
        returns (bytes32 messageId)
    {
        require(recipient != address(0), "zero recipient");
        messageId = keccak256(
            abi.encodePacked(msg.sender, recipient, destination, message, block.chainid, block.number)
        );
        emit XcmSent(msg.sender, recipient, destination, message, messageId);
    }
}
