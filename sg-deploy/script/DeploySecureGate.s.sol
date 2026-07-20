// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/SecureGate.sol";

interface Vm {
    function envAddress(string calldata key) external view returns (address);
    function startBroadcast() external;
    function stopBroadcast() external;
}

contract DeploySecureGate {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        address k1 = vm.envAddress("K1_ADDRESS");
        address k2 = vm.envAddress("K2_ADDRESS");
        address k3 = vm.envAddress("K3_ADDRESS");

        require(k1 != address(0), "K1 not set");
        require(k2 != address(0), "K2 not set");
        require(k3 != address(0), "K3 not set");
        require(k1 != k2 && k2 != k3 && k1 != k3, "keys must differ");

        vm.startBroadcast();
        new SecureGate(k1, k2, k3);
        vm.stopBroadcast();
    }
}
