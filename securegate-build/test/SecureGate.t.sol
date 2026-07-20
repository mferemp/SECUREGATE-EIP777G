// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../contracts/SecureGate.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}

contract TestBase {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function assertEq(address a, address b) internal pure {
        require(a == b, "address neq");
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "uint neq");
    }

    function assertTrue(bool x) internal pure {
        require(x, "not true");
    }
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "bal");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SecureGateTest is TestBase {
    uint256 K1_PK = 0xA11CE;
    uint256 K2_PK = 0xB0B;
    uint256 K3_PK = 0xCAFE;

    address K1;
    address K2;
    address K3;

    SecureGate gate;
    MockERC20 token;

    function setUp() public {
        K1 = vm.addr(K1_PK);
        K2 = vm.addr(K2_PK);
        K3 = vm.addr(K3_PK);

        gate = new SecureGate(K1, K2, K3);
        token = new MockERC20();
        token.mint(address(gate), 100 ether);
    }

    function test_constructor_sets_keys() public {
        assertEq(gate.K1(), K1);
        assertEq(gate.K2(), K2);
        assertEq(gate.K3(), K3);
    }

    function test_only_k1_can_queue() public {
        bytes32 nonce = keccak256("nonce");
        uint256 deadline = block.timestamp + 1 days;

        vm.expectRevert(SecureGate.NotK1.selector);
        gate.queueERC20(address(token), 1 ether, nonce, deadline);

        vm.prank(K1);
        bytes32 hash = gate.queueERC20(address(token), 1 ether, nonce, deadline);
        assertTrue(hash != bytes32(0));
    }

    function test_k2_authorizes_and_k1_executes_to_k3() public {
        bytes32 nonce = keccak256("nonce-2");
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(K1);
        bytes32 hash = gate.queueERC20(address(token), 10 ether, nonce, deadline);

        bytes32 digest = gate.computeAuthorizationDigest(hash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(K2_PK, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        gate.authorizeIntent(hash, sig);

        vm.prank(K1);
        gate.executeIntent(hash);

        assertEq(token.balanceOf(K3), 10 ether);
    }

    function test_non_k3_destination_is_captured_not_routed() public {
        address other = address(0xBEEF);

        vm.prank(K1);
        gate.recordAttemptedDestination(other);

        assertTrue(gate.suspectDestination(other));
    }
}
