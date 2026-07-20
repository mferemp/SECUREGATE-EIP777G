// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Minimal mock assets for the LOCAL E2E harness ONLY. They implement just the
// surface SecureGate calls during executeIntent:
//   ERC20   -> transfer(to, amount)
//   ERC721  -> safeTransferFrom(from, to, tokenId)
//   ERC1155 -> safeTransferFrom(from, to, id, amount, data)
// Ownership/balance is seeded straight onto the gate via mint* so we never rely
// on receiver callbacks. These are NOT production token contracts.

contract MockERC20E2E {
    string public name = "MockERC20E2E";
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

contract MockERC721E2E {
    mapping(uint256 => address) public ownerOf;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "not owner");
        require(msg.sender == from, "not holder");
        ownerOf[tokenId] = to;
    }
}

contract MockERC1155E2E {
    // balanceOf[id][account]
    mapping(uint256 => mapping(address => uint256)) public balances;

    function mint(address to, uint256 id, uint256 amount) external {
        balances[id][to] += amount;
    }

    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return balances[id][account];
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata) external {
        require(msg.sender == from, "not holder");
        require(balances[id][from] >= amount, "bal");
        balances[id][from] -= amount;
        balances[id][to] += amount;
    }
}
