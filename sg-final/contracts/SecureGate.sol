// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interfaces to avoid external dependency drift.
interface IERC20Like {
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IERC721Like {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

interface IERC1155Like {
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;
}

interface IERC165Like {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @title SecureGate — EIP-777G reference gate
/// @notice K1 queues, K2 authorizes, K3 is immutable forced destination.
/// @dev This contract forwards assets already held by this contract to K3.
///      Browser-side K1 recovery actions remain a separate missing layer.
contract SecureGate {
    enum AssetKind {
        ERC20,
        ERC721,
        ERC1155
    }

    struct Intent {
        AssetKind kind;
        address token;
        uint256 id;
        uint256 amount;
        bytes32 nonce;
        uint256 deadline;
        bool authorized;
        bool executed;
        bool exists;
    }

    address public immutable K1;
    address public immutable K2;
    address public immutable K3;
    uint256 public immutable GATE_CHAIN_ID;
    address private immutable SELF;

    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private constant AUTHORIZE_TYPEHASH =
        keccak256("AuthorizeIntent(bytes32 intentHash,uint256 deadline,bytes32 nonce,address k3,uint256 chainId,address verifyingContract)");

    bytes32 private constant ACTION_TYPEHASH =
        keccak256("SecureGateAction(uint8 kind,address token,uint256 id,uint256 amount,address k3,bytes32 nonce,uint256 deadline,uint256 chainId,address verifyingContract)");

    mapping(bytes32 => Intent) public intents;
    mapping(bytes32 => bool) public usedNonces;
    mapping(address => bool) public suspectDestination;

    event IntentQueued(bytes32 indexed intentHash, AssetKind kind, address indexed token, uint256 id, uint256 amount);
    event IntentAuthorized(bytes32 indexed intentHash);
    event IntentExecuted(bytes32 indexed intentHash, address indexed token, address indexed k3);
    event NonK3DestinationCaptured(address indexed attempted);

    error NotK1();
    error InvalidAddress();
    error InvalidNonce();
    error InvalidDeadline();
    error IntentExists();
    error IntentMissing();
    error NotAuthorized();
    error AlreadyExecuted();
    error BadSignature();
    error DelegatecallBlocked();
    error TransferFailed();

    modifier onlyK1() {
        if (msg.sender != K1) revert NotK1();
        _;
    }

    modifier noDelegatecall() {
        if (address(this) != SELF) revert DelegatecallBlocked();
        _;
    }

    constructor(address k1_, address k2_, address k3_) {
        if (k1_ == address(0) || k2_ == address(0) || k3_ == address(0)) revert InvalidAddress();
        if (k1_ == k2_ || k2_ == k3_ || k1_ == k3_) revert InvalidAddress();

        K1 = k1_;
        K2 = k2_;
        K3 = k3_;
        GATE_CHAIN_ID = block.chainid;
        SELF = address(this);

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("SecureGate")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function queueERC20(address token, uint256 amount, bytes32 nonce, uint256 deadline)
        external
        onlyK1
        noDelegatecall
        returns (bytes32 intentHash)
    {
        return _queue(AssetKind.ERC20, token, 0, amount, nonce, deadline);
    }

    function queueERC721(address token, uint256 tokenId, bytes32 nonce, uint256 deadline)
        external
        onlyK1
        noDelegatecall
        returns (bytes32 intentHash)
    {
        return _queue(AssetKind.ERC721, token, tokenId, 1, nonce, deadline);
    }

    function queueERC1155(address token, uint256 tokenId, uint256 amount, bytes32 nonce, uint256 deadline)
        external
        onlyK1
        noDelegatecall
        returns (bytes32 intentHash)
    {
        return _queue(AssetKind.ERC1155, token, tokenId, amount, nonce, deadline);
    }

    function _queue(
        AssetKind kind,
        address token,
        uint256 id,
        uint256 amount,
        bytes32 nonce,
        uint256 deadline
    ) internal returns (bytes32 intentHash) {
        if (token == address(0)) revert InvalidAddress();
        if (nonce == bytes32(0) || usedNonces[nonce]) revert InvalidNonce();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        usedNonces[nonce] = true;

        intentHash = computeIntentHash(kind, token, id, amount, nonce, deadline);
        if (intents[intentHash].exists) revert IntentExists();

        intents[intentHash] = Intent({
            kind: kind,
            token: token,
            id: id,
            amount: amount,
            nonce: nonce,
            deadline: deadline,
            authorized: false,
            executed: false,
            exists: true
        });

        emit IntentQueued(intentHash, kind, token, id, amount);
    }

    function authorizeIntent(bytes32 intentHash, bytes calldata sig) external noDelegatecall {
        Intent storage intent = intents[intentHash];
        if (!intent.exists) revert IntentMissing();
        if (intent.authorized) revert NotAuthorized();
        if (block.timestamp > intent.deadline) revert InvalidDeadline();

        bytes32 digest = computeAuthorizationDigest(intentHash);
        address signer = _recover(digest, sig);
        if (signer != K2) revert BadSignature();

        intent.authorized = true;
        emit IntentAuthorized(intentHash);
    }

    function executeIntent(bytes32 intentHash) external onlyK1 noDelegatecall {
        Intent storage intent = intents[intentHash];
        if (!intent.exists) revert IntentMissing();
        if (!intent.authorized) revert NotAuthorized();
        if (intent.executed) revert AlreadyExecuted();
        if (block.timestamp > intent.deadline) revert InvalidDeadline();

        intent.executed = true;

        if (intent.kind == AssetKind.ERC20) {
            bool ok = IERC20Like(intent.token).transfer(K3, intent.amount);
            if (!ok) revert TransferFailed();
        } else if (intent.kind == AssetKind.ERC721) {
            IERC721Like(intent.token).safeTransferFrom(address(this), K3, intent.id);
        } else {
            IERC1155Like(intent.token).safeTransferFrom(address(this), K3, intent.id, intent.amount, "");
        }

        emit IntentExecuted(intentHash, intent.token, K3);
    }

    function recordAttemptedDestination(address attempted) external onlyK1 {
        if (attempted != address(0) && attempted != K3) {
            suspectDestination[attempted] = true;
            emit NonK3DestinationCaptured(attempted);
        }
    }

    function computeIntentHash(
        AssetKind kind,
        address token,
        uint256 id,
        uint256 amount,
        bytes32 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                ACTION_TYPEHASH,
                kind,
                token,
                id,
                amount,
                K3,
                nonce,
                deadline,
                GATE_CHAIN_ID,
                address(this)
            )
        );
    }

    function computeAuthorizationDigest(bytes32 intentHash) public view returns (bytes32) {
        Intent storage intent = intents[intentHash];
        if (!intent.exists) revert IntentMissing();

        bytes32 structHash = keccak256(
            abi.encode(
                AUTHORIZE_TYPEHASH,
                intentHash,
                intent.deadline,
                intent.nonce,
                K3,
                GATE_CHAIN_ID,
                address(this)
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert BadSignature();

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        if (uint256(s) > 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0) {
            revert BadSignature();
        }

        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert BadSignature();

        address signer = ecrecover(digest, v, r, s);
        if (signer == address(0)) revert BadSignature();

        return signer;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return 0x150b7a02;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return 0xf23a6e61;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return 0xbc197c81;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x150b7a02 || interfaceId == 0x4e2312e0;
    }

    receive() external payable {}
}
