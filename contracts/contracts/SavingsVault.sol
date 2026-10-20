// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title SavingsVault
/// @notice Single-asset balance sheet. Deposits require a sorted-pair Merkle proof unless the root is zero.
contract SavingsVault {
    IERC20 public immutable asset;
    address public owner;
    bytes32 public allowlistRoot;
    bool public paused;
    uint256 public totalAssets;
    uint256 private locked = 1;

    mapping(address => uint256) public balanceOf;

    error NotOwner();
    error Paused();
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();
    error NotAllowlisted();
    error TransferFailed();
    error Reentrancy();

    event Deposited(address indexed account, uint256 assets);
    event Withdrawn(address indexed account, uint256 assets);
    event AllowlistUpdated(bytes32 root);
    event PausedSet(bool status);
    event OwnershipTransferred(address indexed owner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier nonReentrant() {
        if (locked != 1) revert Reentrancy();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(IERC20 asset_, bytes32 root) {
        if (address(asset_) == address(0)) revert ZeroAddress();
        asset = asset_;
        owner = msg.sender;
        allowlistRoot = root;
        emit AllowlistUpdated(root);
    }

    function setPaused(bool status) external onlyOwner {
        paused = status;
        emit PausedSet(status);
    }

    function setAllowlistRoot(bytes32 root) external onlyOwner {
        allowlistRoot = root;
        emit AllowlistUpdated(root);
    }

    function transferOwnership(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        owner = next;
        emit OwnershipTransferred(next);
    }

    function isAllowlisted(address account, bytes32[] calldata proof) external view returns (bool) {
        return _isAllowlisted(account, proof);
    }

    /// @dev State is updated before the token call. A false return or a revert rolls the whole transaction back.
    function deposit(uint256 assets, bytes32[] calldata proof) external whenNotPaused nonReentrant {
        if (assets == 0) revert ZeroAmount();
        if (!_isAllowlisted(msg.sender, proof)) revert NotAllowlisted();
        balanceOf[msg.sender] += assets;
        totalAssets += assets;
        bool ok = asset.transferFrom(msg.sender, address(this), assets);
        if (!ok) revert TransferFailed();
        emit Deposited(msg.sender, assets);
    }

    function withdraw(uint256 assets) external whenNotPaused nonReentrant {
        if (assets == 0) revert ZeroAmount();
        uint256 bal = balanceOf[msg.sender];
        if (assets > bal) revert InsufficientBalance();
        unchecked {
            balanceOf[msg.sender] = bal - assets;
            totalAssets -= assets;
        }
        bool ok = asset.transfer(msg.sender, assets);
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, assets);
    }

    function _isAllowlisted(address account, bytes32[] calldata proof) private view returns (bool) {
        if (allowlistRoot == bytes32(0)) return true;
        bytes32 computed = _leaf(account);
        uint256 length = proof.length;
        for (uint256 i = 0; i < length; i++) {
            computed = _hashPair(computed, proof[i]);
        }
        return computed == allowlistRoot;
    }

    function _leaf(address account) private pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(account))));
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
}
