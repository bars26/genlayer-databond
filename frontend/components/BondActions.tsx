"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useBondWrite } from "@/lib/hooks/useDataBond";
import { useWallet } from "@/lib/genlayer/wallet";
import {
  CONTEST_WINDOW_SECONDS,
  formatGen,
  minChallengeWei,
  ownerFavour,
  parseGen,
  sameAddress,
  secondsSince,
  wei,
  type Bond,
} from "@/lib/contracts/types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/** The actions the connected wallet can take on this bond right now, and why others are not offered. */
export function BondActions({ bond }: { bond: Bond }) {
  const { address, isConnected } = useWallet();
  const { write, pending } = useBondWrite();
  const [reason, setReason] = useState("");
  const [stake, setStake] = useState(formatGen(minChallengeWei(bond)));
  const busy = (kind: string) => pending === `${kind}:${bond.id}`;

  if (!isConnected) {
    return <p className="text-sm text-muted-foreground">Connect a wallet to act on this bond.</p>;
  }

  const isOwner = sameAddress(address, bond.owner);
  const isChallenger = sameAddress(address, bond.challenger);
  const favour = ownerFavour(bond.verdict);
  const windowLeft = Math.max(0, CONTEST_WINDOW_SECONDS - secondsSince(bond.ruled_at));
  const windowOpen = bond.state === "ruled" && !bond.contested && windowLeft > 0;
  const canContest = windowOpen && ((isOwner && favour < 2) || (isChallenger && favour > 0));
  const canSettle =
    bond.state === "ruled" &&
    (!windowOpen || bond.contested || (isOwner && favour < 2) || (isChallenger && favour > 0));

  const btn = (kind: string, label: string, onClick: () => void, variant: "gradient" | "secondary" = "gradient") => (
    <Button size="sm" variant={variant} onClick={onClick} disabled={!!pending}>
      {busy(kind) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
      {label}
    </Button>
  );

  if (bond.state === "active") {
    if (isOwner) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Your bond is open to challenges. You can take it back while nobody has challenged it.
          </p>
          {btn("withdraw", `Withdraw ${formatGen(bond.amount)} GEN`, () => write({ kind: "withdraw", id: bond.id }), "secondary")}
        </div>
      );
    }
    const stakeWei = parseGen(stake);
    const tooLow = stakeWei === null || stakeWei < minChallengeWei(bond);
    return (
      <div className="space-y-3 max-w-md">
        <p className="text-sm text-muted-foreground">
          Think the repository does not deliver what the statement promises? Stake at least{" "}
          <strong>{formatGen(minChallengeWei(bond))} GEN</strong> (10% of the bond). If validators agree, you receive the bond.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor={`reason-${bond.id}`}>What is missing?</Label>
          <Input id={`reason-${bond.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. the raw survey data is not in the record" />
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`stake-${bond.id}`}>Stake (GEN)</Label>
            <Input id={`stake-${bond.id}`} value={stake} onChange={(e) => setStake(e.target.value)} className="w-32 font-mono" />
          </div>
          <Button
            size="sm"
            variant="gradient"
            disabled={!!pending || tooLow}
            onClick={() => write({ kind: "challenge", id: bond.id, reason: reason.trim(), value: stakeWei! })}
          >
            {busy("challenge") ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Challenge
          </Button>
        </div>
        {tooLow && <p className="text-xs text-destructive">The stake must be at least {formatGen(minChallengeWei(bond))} GEN.</p>}
      </div>
    );
  }

  if (bond.state === "challenged") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Anyone can trigger the ruling. Every validator fetches the repository&apos;s public API itself and compares it with the statement.
        </p>
        {btn("adjudicate", "Adjudicate now", () => write({ kind: "adjudicate", id: bond.id }))}
      </div>
    );
  }

  if (bond.state === "ruled") {
    return (
      <div className="space-y-2">
        {windowOpen && (
          <p className="text-sm text-muted-foreground">
            Contest window: <strong>{Math.ceil(windowLeft / 60)} min</strong> left. The losing side can pay{" "}
            {formatGen(bond.challenge_stake)} GEN for one independent re-ruling, or settle now to accept the ruling.
          </p>
        )}
        {bond.contested && (
          <p className="text-sm text-muted-foreground">
            Contested once ({bond.contest_succeeded ? "the re-ruling changed the outcome" : "the re-ruling confirmed it"}). It can be settled now.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {canContest && btn("contest", `Contest (${formatGen(bond.challenge_stake)} GEN)`, () => write({ kind: "contest", id: bond.id, value: wei(bond.challenge_stake) }), "secondary")}
          {canSettle && btn("settle", windowOpen && !bond.contested ? "Accept ruling and settle" : "Settle", () => write({ kind: "settle", id: bond.id }))}
        </div>
        {!canSettle && (
          <p className="text-xs text-muted-foreground">Only the losing side can settle before the window closes; anyone can after.</p>
        )}
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">This bond is closed.</p>;
}
