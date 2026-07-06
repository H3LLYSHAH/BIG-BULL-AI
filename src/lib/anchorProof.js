import { BrowserProvider, Contract } from 'ethers';

/**
 * anchorProof.js
 * --------------
 * npm install ethers
 *
 * Talks to the deployed ProofOfExistence contract (see ProofOfExistence.sol).
 * Defaults to Polygon Amoy testnet — swap POLYGON_AMOY for mainnet Polygon,
 * BSC, or Ethereum by changing chainId/rpc below; the contract + calls stay
 * identical.
 *
 * Prereqs before this works:
 *   1. Deploy ProofOfExistence.sol (e.g. via Remix or Hardhat) to Polygon
 *      Amoy testnet: https://faucet.polygon.technology/ for free test MATIC
 *   2. Paste the deployed address into CONTRACT_ADDRESS below
 *   3. User needs MetaMask (or similar) installed to sign the anchor() call
 */

const CONTRACT_ADDRESS = 'PASTE_YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE';

const ABI = [
  'function anchor(bytes32 reportHash) external',
  'function getProof(bytes32 reportHash) external view returns (address, uint256, bool)',
  'event ReportAnchored(bytes32 indexed reportHash, address indexed submitter, uint256 timestamp)',
];

const POLYGON_AMOY = {
  chainId: '0x13882', // 80002
  chainName: 'Polygon Amoy Testnet',
  rpcUrls: ['https://rpc-amoy.polygon.technology'],
  nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  blockExplorerUrls: ['https://amoy.polygonscan.com'],
};

async function getSignerOnCorrectChain() {
  if (!window.ethereum) {
    throw new Error('No wallet found — install MetaMask to anchor or verify a proof.');
  }
  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (network.chainId.toString() !== '80002') {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: POLYGON_AMOY.chainId }],
      });
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [POLYGON_AMOY],
        });
      } else {
        throw switchErr;
      }
    }
  }
  return provider.getSigner();
}

/**
 * Anchors a report hash on-chain. Returns { txHash, blockTimestamp }.
 * Throws if the wallet rejects, the network can't be reached, or this exact
 * hash was already anchored (the contract itself reverts on duplicates).
 */
export async function anchorReportHash(reportHash) {
  const signer = await getSignerOnCorrectChain();
  const contract = new Contract(CONTRACT_ADDRESS, ABI, signer);
  const tx = await contract.anchor(reportHash);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

/**
 * Verifies whether a report hash was previously anchored.
 * Returns { exists, submitter, timestamp } — read-only, no wallet signature
 * needed, works even for a visitor who's never connected a wallet, as long
 * as window.ethereum (or any injected read provider) is present.
 */
export async function verifyReportHash(reportHash) {
  if (!window.ethereum) {
    throw new Error('No wallet/provider found to read from the chain.');
  }
  const provider = new BrowserProvider(window.ethereum);
  const contract = new Contract(CONTRACT_ADDRESS, ABI, provider);
  const [submitter, timestamp, exists] = await contract.getProof(reportHash);
  return {
    exists,
    submitter: exists ? submitter : null,
    timestamp: exists ? new Date(Number(timestamp) * 1000) : null,
  };
}
