import { createPublicClient, createWalletClient, custom, defineChain, formatEther, http, parseEther } from "viem";
import { QUESTFORGE_MAINNET_ADDRESS } from "./deployment";

export const botchainMainnet = defineChain({
  id: 677,
  name: "BOT Chain Mainnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.botchain.ai"] } },
  blockExplorers: { default: { name: "BOT Chain Mainnet Explorer", url: "https://scan.botchain.ai" } },
});

const configuredAddress = process.env.NEXT_PUBLIC_QUESTFORGE_ADDRESS as `0x${string}` | undefined;
export const CONTRACT_ADDRESS = configuredAddress || QUESTFORGE_MAINNET_ADDRESS;

export const questForgeAbi = [
  { type: "event", name: "QuestCreated", inputs: [{ indexed: true, name: "questId", type: "uint256" }, { indexed: true, name: "creator", type: "address" }, { indexed: false, name: "rewardPerWinner", type: "uint256" }, { indexed: false, name: "maxWinners", type: "uint256" }, { indexed: false, name: "deadline", type: "uint256" }] },
  { type: "event", name: "ProofSubmitted", inputs: [{ indexed: true, name: "questId", type: "uint256" }, { indexed: true, name: "participant", type: "address" }, { indexed: false, name: "proof", type: "string" }] },
  { type: "event", name: "SubmissionApproved", inputs: [{ indexed: true, name: "questId", type: "uint256" }, { indexed: true, name: "participant", type: "address" }, { indexed: false, name: "reward", type: "uint256" }] },
  { type: "function", name: "questCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "getQuest", stateMutability: "view", inputs: [{ name: "questId", type: "uint256" }], outputs: [{ name: "creator", type: "address" }, { name: "title", type: "string" }, { name: "description", type: "string" }, { name: "requirements", type: "string" }, { name: "deadline", type: "uint64" }, { name: "rewardPerWinner", type: "uint256" }, { name: "maxWinners", type: "uint32" }, { name: "winners", type: "uint32" }, { name: "cancelled", type: "bool" }] },
  { type: "function", name: "getSubmission", stateMutability: "view", inputs: [{ name: "questId", type: "uint256" }, { name: "participant", type: "address" }], outputs: [{ name: "proof", type: "string" }, { name: "submittedAt", type: "uint64" }, { name: "approved", type: "bool" }] },
  { type: "function", name: "createQuest", stateMutability: "payable", inputs: [{ name: "title", type: "string" }, { name: "description", type: "string" }, { name: "requirements", type: "string" }, { name: "deadline", type: "uint64" }, { name: "rewardPerWinner", type: "uint96" }, { name: "maxWinners", type: "uint32" }], outputs: [{ name: "questId", type: "uint256" }] },
  { type: "function", name: "submitProof", stateMutability: "nonpayable", inputs: [{ name: "questId", type: "uint256" }, { name: "proof", type: "string" }], outputs: [] },
  { type: "function", name: "approveSubmission", stateMutability: "nonpayable", inputs: [{ name: "questId", type: "uint256" }, { name: "participant", type: "address" }], outputs: [] },
  { type: "function", name: "cancelQuest", stateMutability: "nonpayable", inputs: [{ name: "questId", type: "uint256" }], outputs: [] },
] as const;

export type Quest = { id: bigint; creator: `0x${string}`; title: string; description: string; requirements: string; deadline: number; reward: bigint; maxWinners: number; winners: number; cancelled: boolean };

export const publicClient = createPublicClient({ chain: botchainMainnet, transport: http() });

export function getWalletClient(account: `0x${string}`) {
  if (!window.ethereum) throw new Error("Install an EVM wallet to continue.");
  return createWalletClient({ account, chain: botchainMainnet, transport: custom(window.ethereum) });
}

export async function ensureBotchain() {
  if (!window.ethereum) throw new Error("Install an EVM wallet to continue.");
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x2a5" }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw new Error("Switch your wallet to BOT Chain Mainnet to continue.");
    await window.ethereum.request({ method: "wallet_addEthereumChain", params: [{ chainId: "0x2a5", chainName: "BOT Chain Mainnet", nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 }, rpcUrls: ["https://rpc.botchain.ai"], blockExplorerUrls: ["https://scan.botchain.ai"] }] });
  }
}

export function userError(error: unknown) {
  const message = error instanceof Error ? error.message : "The transaction could not be completed.";
  if (/Install an EVM wallet/i.test(message)) return "Install or open an EVM wallet such as Bitget Wallet or TokenPocket to continue.";
  if (/Switch your wallet/i.test(message)) return "Switch your wallet to BOT Chain Mainnet and try again.";
  if (/rejected|denied/i.test(message)) return "You cancelled the request in your wallet.";
  if (/insufficient funds/i.test(message)) return "Your wallet does not have enough BOT for this transaction.";
  if (/InvalidDeadline/i.test(message)) return "Choose a deadline that is still in the future.";
  if (/InvalidReward/i.test(message)) return "Check the reward and winner count, then try again.";
  if (/InvalidContent/i.test(message)) return "Complete every required field before continuing.";
  if (/QuestClosed/i.test(message)) return "This quest is no longer accepting this action.";
  if (/QuestExpired/i.test(message)) return "This quest has already ended.";
  if (/AlreadySubmitted/i.test(message)) return "You already submitted proof for this quest.";
  if (/MissingSubmission/i.test(message)) return "That participant has not submitted proof for this quest.";
  if (/AlreadyApproved/i.test(message)) return "This submission has already been approved and paid.";
  if (/NotCreator/i.test(message)) return "Only the quest creator can do that.";
  if (/network|fetch|HTTP request failed|timeout/i.test(message)) return "BOT Chain could not be reached. Check your connection and try again.";
  return "The request could not be completed. Check your wallet and try again.";
}

export { formatEther, parseEther };

declare global {
  interface Window { ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown>; on?: (event: string, listener: (...args: unknown[]) => void) => void; removeListener?: (event: string, listener: (...args: unknown[]) => void) => void }; }
  interface Document { modelContext?: { registerTool(tool: { name: string; title?: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute(input: unknown): unknown | Promise<unknown> }, options?: { signal?: AbortSignal }): void | Promise<void> } }
}
