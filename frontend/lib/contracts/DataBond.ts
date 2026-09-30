import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { Bond, TransactionReceipt } from "./types";
import { DataBondError, classifyError, rawMessage } from "../utils/errors";
import { withBackoff } from "../utils/retry";

export type TxStep = "awaiting_wallet" | "submitted" | "retrying" | "accepted";

export interface TxProgress {
  step: TxStep;
  txHash?: string;
  message?: string;
}

export interface TxResult {
  txHash: string;
  status: string;
  executionResult: string;
  receipt: TransactionReceipt;
}

/** Pull the contract-execution outcome (and any revert text) out of a consensus receipt. */
export function executionOutcome(receipt: any): { result: string; message: string } {
  const lr = receipt?.consensus_data?.leader_receipt;
  const first = Array.isArray(lr) ? lr[0] : lr;
  const result = String(first?.execution_result ?? receipt?.execution_result ?? "UNKNOWN");
  const g = first?.genvm_result ?? {};
  const message = [g.error_description, g.stderr, Array.isArray(g.raw_error?.causes) ? g.raw_error.causes.join(",") : ""]
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .join(" | ");
  return { result, message };
}

const WRITE_EFFECT: Record<string, string> = {
  post_bond: "no bond was created (the repository may not have loaded from its public API)",
  challenge: "no challenge was recorded",
  adjudicate: "no ruling was recorded (validators may have failed to reach the repository or agree)",
  contest: "the contest was not recorded",
  settle: "nothing was paid out",
  withdraw: "the bond was not withdrawn",
};

/** Typed wrapper around the DataBond Intelligent Contract. */
class DataBond {
  private contractAddress: `0x${string}`;
  private client: any;
  private studioUrl?: string;

  constructor(contractAddress: string, address?: string | null, studioUrl?: string) {
    this.contractAddress = contractAddress as `0x${string}`;
    this.studioUrl = studioUrl;
    const config: any = { chain: studionet };
    if (address) config.account = address as `0x${string}`;
    if (studioUrl) config.endpoint = studioUrl;
    this.client = createClient(config);
  }

  private read<T>(functionName: string, args: unknown[] = []): Promise<T> {
    return withBackoff(
      () => this.client.readContract({ address: this.contractAddress, functionName, args }) as Promise<T>,
      { phase: "read", attempts: 5 }
    );
  }

  listBonds = () => this.read<string[]>("list_bonds").then((v) => (Array.isArray(v) ? v : []));
  listBondsByOwner = (owner: string) =>
    this.read<string[]>("list_bonds_by_owner", [owner]).then((v) => (Array.isArray(v) ? v : []));
  getBond = (id: string) => this.read<Bond>("get_bond", [id]);
  isBacked = async (id: string) => Boolean(await this.read<boolean>("is_backed", [id]));

  async getTransactionStatus(txHash: string): Promise<string> {
    const tx: any = await withBackoff(() => this.client.getTransaction({ hash: txHash as `0x${string}` }), {
      phase: "read",
    });
    return String(tx?.statusName ?? tx?.status_name ?? tx?.status ?? "UNKNOWN");
  }

  postBond(paper: string, statement: string, repository: string, valueWei: bigint, onProgress?: (p: TxProgress) => void) {
    return this.write("post_bond", [paper, statement, repository], valueWei, onProgress);
  }
  challenge(id: string, reason: string, valueWei: bigint, onProgress?: (p: TxProgress) => void) {
    return this.write("challenge", [id, reason], valueWei, onProgress);
  }
  adjudicate(id: string, onProgress?: (p: TxProgress) => void) {
    return this.write("adjudicate", [id], 0n, onProgress);
  }
  contest(id: string, valueWei: bigint, onProgress?: (p: TxProgress) => void) {
    return this.write("contest", [id], valueWei, onProgress);
  }
  settle(id: string, onProgress?: (p: TxProgress) => void) {
    return this.write("settle", [id], 0n, onProgress);
  }
  withdraw(id: string, onProgress?: (p: TxProgress) => void) {
    return this.write("withdraw", [id], 0n, onProgress);
  }

  /**
   * Send a write and wait for consensus. Sends are never auto-retried (each attempt would
   * prompt the wallet again); receipt polling is, because the hash is already known.
   * A call the contract reverted is still ACCEPTED by consensus, so the receipt's
   * execution_result is checked and a revert is reported as such.
   */
  private async write(
    functionName: string,
    args: unknown[],
    value: bigint,
    onProgress?: (p: TxProgress) => void
  ): Promise<TxResult> {
    onProgress?.({ step: "awaiting_wallet", message: "Approve the transaction in your wallet." });
    let txHash: string;
    try {
      txHash = (await this.client.writeContract({ address: this.contractAddress, functionName, args, value })) as string;
    } catch (err) {
      throw classifyError(err, "send");
    }
    onProgress?.({ step: "submitted", txHash, message: "Transaction sent. Waiting for validators." });

    let receipt: any;
    try {
      receipt = await withBackoff(
        () => this.client.waitForTransactionReceipt({ hash: txHash, status: "ACCEPTED" as any, retries: 60, interval: 5000 }),
        {
          phase: "confirm",
          onRetry: (i) =>
            onProgress?.({ step: "retrying", txHash, message: `RPC busy while confirming; retrying in ${Math.round(i.waitMs / 1000)}s` }),
        }
      );
    } catch (err) {
      throw classifyError(err, "confirm", txHash);
    }

    const status = String(receipt?.statusName ?? receipt?.status_name ?? "ACCEPTED");
    const outcome = executionOutcome(receipt);
    onProgress?.({ step: "accepted", txHash, message: `Consensus status: ${status}` });
    if (outcome.result === "ERROR") {
      throw new DataBondError({
        kind: "accepted_no_effect",
        phase: "verify",
        txHash,
        message: `The transaction was ACCEPTED, but the contract rejected the call, so ${WRITE_EFFECT[functionName] ?? "nothing changed"}.`,
        hint: "Open the transaction in the explorer to see the contract's error message.",
        detail: outcome.message || rawMessage(receipt?.result) || "execution_result: ERROR",
      });
    }
    return { txHash, status, executionResult: outcome.result, receipt };
  }
}

export default DataBond;
