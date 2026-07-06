// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ProofOfExistence
 * -----------------
 * Anchors a report hash on-chain so its existence at a point in time can be
 * proven later, without ever storing the report's actual contents.
 *
 * Deploy this once to Polygon Amoy testnet (or mainnet Polygon/BSC/Ethereum
 * later — no code changes needed, just a different RPC + deployment).
 *
 * Flow:
 *   1. App computes SHA-256 hash of the finished tax report (reportHash.js)
 *   2. App calls anchor(hash) — this contract records msg.sender + timestamp
 *   3. Anyone can later call getProof(hash) to verify it was anchored, by
 *      whom, and when — proving the report existed unmodified since then.
 */
contract ProofOfExistence {
    struct Proof {
        address submitter;
        uint256 timestamp;
        bool exists;
    }

    mapping(bytes32 => Proof) private proofs;

    event ReportAnchored(bytes32 indexed reportHash, address indexed submitter, uint256 timestamp);

    /// Anchors a report hash. Reverts if this exact hash was already anchored,
    /// since a proof-of-existence timestamp should never be overwritable.
    function anchor(bytes32 reportHash) external {
        require(!proofs[reportHash].exists, 'Already anchored');
        proofs[reportHash] = Proof({ submitter: msg.sender, timestamp: block.timestamp, exists: true });
        emit ReportAnchored(reportHash, msg.sender, block.timestamp);
    }

    /// Returns (submitter, timestamp, exists) for a given report hash.
    function getProof(bytes32 reportHash) external view returns (address, uint256, bool) {
        Proof memory p = proofs[reportHash];
        return (p.submitter, p.timestamp, p.exists);
    }
}
