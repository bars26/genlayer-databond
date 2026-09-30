"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import DataBond, { type TxProgress, type TxResult } from "../contracts/DataBond";
import type { Bond } from "../contracts/types";
import { getContractAddress, getStudioUrl } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { DataBondError, classifyError } from "../utils/errors";
import { mapWithConcurrency } from "../utils/retry";
import { error, success } from "../utils/toast";
import { startTx, updateTx, type TxKind } from "./useTxLog";

export function useDataBondContract(): DataBond | null {
  const { address } = useWallet();
  const contractAddress = getContractAddress();
  const studioUrl = getStudioUrl();
  return useMemo(
    () => (contractAddress ? new DataBond(contractAddress, address, studioUrl) : null),
    [contractAddress, address, studioUrl]
  );
}

type BondsData = { bonds: Bond[]; failedIds: string[] };

/**
 * Every bond, from the CDN-cached server snapshot (app/api/bonds), so page loads spend
 * none of the visitor's Studio rate-limit budget. Falls back to slow direct reads.
 */
export function useAllBonds() {
  const contract = useDataBondContract();
  const query = useQuery<BondsData, Error>({
    queryKey: ["bonds"],
    queryFn: async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 25_000);
        const res = await fetch("/api/bonds", { signal: ctrl.signal }).finally(() => clearTimeout(timer));
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(body.bonds)) throw new Error(body?.error || `HTTP ${res.status}`);
        return { bonds: body.bonds as Bond[], failedIds: (body.failedIds ?? []) as string[] };
      } catch (snapshotErr) {
        if (!contract) throw classifyError(snapshotErr, "read");
        const ids = await contract.listBonds();
        const rows = await mapWithConcurrency(ids, 2, async (id) => {
          try {
            return { id, bond: await contract.getBond(id) };
          } catch {
            return { id, bond: null as Bond | null };
          }
        });
        return {
          bonds: rows.filter((r) => r.bond).map((r) => r.bond as Bond),
          failedIds: rows.filter((r) => !r.bond).map((r) => r.id),
        };
      }
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });
  return {
    bonds: query.data?.bonds ?? [],
    failedIds: query.data?.failedIds ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** Re-read one bond from the chain after a write and merge it into the cached list. */
async function mergeFreshBond(qc: ReturnType<typeof useQueryClient>, contract: DataBond, id: string) {
  try {
    const bond = await contract.getBond(id);
    qc.setQueryData<BondsData>(["bonds"], (prev) => {
      const bonds = prev?.bonds ?? [];
      const i = bonds.findIndex((b) => b.id === id);
      return {
        bonds: i >= 0 ? bonds.map((b) => (b.id === id ? bond : b)) : [...bonds, bond],
        failedIds: (prev?.failedIds ?? []).filter((x) => x !== id),
      };
    });
  } catch {
    // Already confirmed on chain; the next snapshot refresh picks it up.
  }
}

type WriteVars =
  | { kind: "post"; paper: string; statement: string; repository: string; value: bigint }
  | { kind: "challenge"; id: string; reason: string; value: bigint }
  | { kind: "adjudicate"; id: string }
  | { kind: "contest"; id: string; value: bigint }
  | { kind: "settle"; id: string }
  | { kind: "withdraw"; id: string };

const LABEL: Record<WriteVars["kind"], string> = {
  post: "Post bond",
  challenge: "Challenge",
  adjudicate: "Adjudicate",
  contest: "Contest",
  settle: "Settle",
  withdraw: "Withdraw",
};

/** One mutation for every DataBond write, with a transaction log entry and typed errors. */
export function useBondWrite() {
  const contract = useDataBondContract();
  const { address } = useWallet();
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (vars: WriteVars) => {
      const target = vars.kind === "post" ? vars.repository : vars.id;
      const logId = startTx(vars.kind as TxKind, target);
      setPending(vars.kind === "post" ? "post" : `${vars.kind}:${vars.id}`);
      const onProgress = (p: TxProgress) =>
        updateTx(logId, {
          state: p.step === "awaiting_wallet" ? "awaiting_wallet" : p.step === "accepted" ? "accepted" : "confirming",
          txHash: p.txHash,
          progress: p.message,
        });
      try {
        if (!contract) throw new DataBondError({ kind: "unknown", phase: "send", message: "The contract address is not configured." });
        if (!address) throw new DataBondError({ kind: "wallet_missing", phase: "send", message: "No wallet is connected." });

        let result: TxResult;
        let id = vars.kind === "post" ? "" : vars.id;
        let before: string[] = [];
        switch (vars.kind) {
          case "post":
            before = await contract.listBondsByOwner(address);
            result = await contract.postBond(vars.paper, vars.statement, vars.repository, vars.value, onProgress);
            id = (await contract.listBondsByOwner(address)).find((x) => !before.includes(x)) ?? "";
            if (!id) {
              throw new DataBondError({
                kind: "accepted_no_effect",
                phase: "verify",
                txHash: result.txHash,
                message: "The transaction was ACCEPTED but no bond appeared for your address.",
                hint: "If the RPC was lagging, refresh in a few seconds.",
              });
            }
            break;
          case "challenge": {
            // Re-read right before sending: someone may have challenged it in the meantime.
            const fresh = await contract.getBond(vars.id);
            if (fresh.state !== "active") {
              throw new DataBondError({ kind: "contract_revert", phase: "estimate", message: `This bond is now ${fresh.state}; nothing was sent.`, hint: "The list was refreshed. Pick another bond or wait for the ruling." });
            }
            result = await contract.challenge(vars.id, vars.reason, vars.value, onProgress);
            break;
          }
          case "adjudicate":
            result = await contract.adjudicate(vars.id, onProgress);
            break;
          case "contest": {
            const fresh = await contract.getBond(vars.id);
            if (fresh.state !== "ruled" || fresh.contested) {
              throw new DataBondError({ kind: "contract_revert", phase: "estimate", message: "This ruling can no longer be contested; nothing was sent.", hint: "The list was refreshed." });
            }
            result = await contract.contest(vars.id, vars.value, onProgress);
            break;
          }
          case "settle":
            result = await contract.settle(vars.id, onProgress);
            break;
          case "withdraw":
            result = await contract.withdraw(vars.id, onProgress);
            break;
        }
        updateTx(logId, {
          state: "accepted",
          txHash: result.txHash,
          status: result.status,
          executionResult: result.executionResult,
          siteId: id,
          progress: id && vars.kind === "post" ? `Bond ${id} created.` : "Done.",
        });
        return { id, txHash: result.txHash, kind: vars.kind };
      } catch (err) {
        const e = classifyError(err, "send");
        if (contract && vars.kind !== "post") mergeFreshBond(qc, contract, vars.id);
        updateTx(logId, {
          state: "failed",
          txHash: e.txHash,
          error: { kind: e.kind, message: e.message, hint: e.hint, detail: e.detail, phase: e.phase },
        });
        error(`${LABEL[vars.kind]} failed`, {
          description: [e.message, e.hint].filter(Boolean).join(" "),
          duration: 12000,
        });
        throw err;
      } finally {
        setPending(null);
      }
    },
    onSuccess: ({ id, txHash, kind }) => {
      if (contract && id) mergeFreshBond(qc, contract, id);
      qc.invalidateQueries({ queryKey: ["myBonds"] });
      success(kind === "post" ? `Bond ${id} posted` : `${LABEL[kind]} confirmed`, {
        description: `Tx ${txHash.slice(0, 10)}... is ACCEPTED by validator consensus.`,
        duration: 8000,
      });
    },
  });

  return { write: mutation.mutate, writeAsync: mutation.mutateAsync, pending, isPending: mutation.isPending };
}

export function useMyBonds(owner: string | null) {
  const contract = useDataBondContract();
  return useQuery<string[], Error>({
    queryKey: ["myBonds", owner],
    queryFn: () => (contract && owner ? contract.listBondsByOwner(owner) : Promise.resolve([])),
    enabled: !!contract && !!owner,
    staleTime: 30_000,
  });
}
