"use client";

import { useState } from "react";
import { getAddress } from "viem";
import { Droplets, Loader2 } from "lucide-react";
import { useWallet } from "@/lib/genlayer/wallet";
import { getStudioUrl } from "@/lib/genlayer/client";
import { error, success } from "@/lib/utils/toast";
import { Button } from "./ui/button";

/** GenLayer Studio has a public faucet (sim_fundAccount); bonds need test GEN. */
export function FaucetButton() {
  const { address, isConnected } = useWallet();
  const [busy, setBusy] = useState(false);
  if (!isConnected || !address) return null;

  const fund = async () => {
    setBusy(true);
    try {
      const res = await fetch(getStudioUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Studio keys faucet balances by the checksummed address: funding the lowercase form
        // (what MetaMask returns) succeeds but the GEN never shows up on the wallet.
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sim_fundAccount", params: [getAddress(address), 50 * 1e18] }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error.message);
      success("50 test GEN sent", { description: "Studio faucet funded your wallet. It may take a few seconds to show." });
    } catch (e: any) {
      error("Faucet failed", { description: e?.message || "Try again in a minute." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" size="sm" onClick={fund} disabled={busy} title="Get 50 test GEN on GenLayer Studio">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Droplets className="w-4 h-4" />}
      <span className="ml-1 hidden sm:inline">Test GEN</span>
    </Button>
  );
}
