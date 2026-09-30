"use client";

import { Fragment, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, ExternalLink, FileSearch, Loader2, Search } from "lucide-react";
import { useAllBonds } from "@/lib/hooks/useDataBond";
import {
  SOURCE_LABEL,
  formatBytes,
  formatGen,
  parseJson,
  type Bond,
  type BondState,
  type Evidence,
  type HistoryEntry,
} from "@/lib/contracts/types";
import { toErrorInfo } from "@/lib/utils/errors";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StateBadge, VerdictBadge } from "./Badges";
import { BondActions } from "./BondActions";
import { AddressDisplay } from "./AddressDisplay";

const STATES: (BondState | "any")[] = ["any", "active", "challenged", "ruled", "closed"];

export function BondsTable() {
  const { bonds, failedIds, isLoading, isFetching, isError, error, refetch } = useAllBonds();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<BondState | "any">("any");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...bonds]
      .reverse()
      .filter(
        (b) =>
          (state === "any" || b.state === state) &&
          (!q || b.id === q || b.paper.toLowerCase().includes(q) || b.repository.toLowerCase().includes(q))
      );
  }, [bonds, query, state]);

  if (isLoading) {
    return (
      <div className="brand-card p-8 flex items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-accent" /> Loading bonds...
      </div>
    );
  }
  if (isError && bonds.length === 0) {
    const e = toErrorInfo(error);
    return (
      <div className="brand-card p-8 space-y-3 text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
        <p className="text-destructive font-semibold">{e.message}</p>
        {e.hint && <p className="text-sm text-muted-foreground">{e.hint}</p>}
        <Button variant="gradient" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }
  if (bonds.length === 0) {
    return (
      <div className="brand-card p-12 text-center space-y-3">
        <FileSearch className="w-14 h-14 mx-auto text-muted-foreground opacity-30" />
        <h3 className="text-xl font-bold">No bonds yet</h3>
        <p className="text-muted-foreground">Post the first one: bond GEN behind a paper&apos;s data-availability statement.</p>
      </div>
    );
  }

  return (
    <div className="brand-card p-6 overflow-hidden">
      {failedIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm">
          <span>{failedIds.length} bond(s) could not be read just now because the Studio RPC was busy.</span>
          <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>Retry</Button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search paper, repository or bond id..." className="pl-9" aria-label="Search bonds" />
        </div>
        <select value={state} onChange={(e) => setState(e.target.value as BondState | "any")} aria-label="Filter by state" className="rounded-md border border-input bg-transparent px-3 text-sm">
          {STATES.map((s) => (
            <option key={s} value={s} className="bg-background">{s === "any" ? "Any state" : s}</option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No bonds match.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {["Paper", "Repository", "Bond", "State", "Verdict"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((b) => <BondRow key={b.id} bond={b} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BondRow({ bond }: { bond: Bond }) {
  const [open, setOpen] = useState(false);
  const evidence = parseJson<Evidence>(bond.evidence_json, {});
  const history = parseJson<HistoryEntry[]>(bond.history_json, []);

  return (
    <Fragment>
      <tr className="hover:bg-white/5 transition-colors">
        <td className="px-3 py-4 max-w-[22rem]">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-start gap-2 text-left">
            {open ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>
              <span className="block text-sm font-semibold line-clamp-2">{bond.paper}</span>
              <span className="block text-xs font-mono text-muted-foreground mt-1">{bond.id}</span>
            </span>
          </button>
        </td>
        <td className="px-3 py-4 text-sm">
          <a href={bond.repository} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
            {SOURCE_LABEL[bond.source]} <ExternalLink className="w-3 h-3" />
          </a>
          <span className="block text-xs text-muted-foreground mt-1">
            {evidence.file_count ?? 0} files · {formatBytes(evidence.total_bytes)}{evidence.open === false ? " · restricted" : ""}
          </span>
        </td>
        <td className="px-3 py-4 text-sm font-mono whitespace-nowrap">{formatGen(bond.amount)} GEN</td>
        <td className="px-3 py-4"><StateBadge state={bond.state} /></td>
        <td className="px-3 py-4"><VerdictBadge verdict={bond.verdict} /></td>
      </tr>
      {open && (
        <tr className="bg-white/[0.02]">
          <td colSpan={5} className="px-3 pb-6 pt-2">
            <div className="ml-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Data-availability statement</p>
                  <blockquote className="text-sm border-l-2 border-accent/50 pl-3">{bond.statement}</blockquote>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Author: <AddressDisplay address={bond.owner} /></p>
                  {bond.state !== "active" && bond.state !== "closed" && (
                    <p>Challenger: <AddressDisplay address={bond.challenger} /> · stake {formatGen(bond.challenge_stake)} GEN</p>
                  )}
                  {bond.challenge_reason && <p>Challenge reason: &quot;{bond.challenge_reason}&quot;</p>}
                  {bond.verdict && (
                    <p>
                      Last ruling: <strong>{bond.verdict}</strong> ({bond.verdict_code === "judged" ? "validators compared the statement with the file list" : bond.verdict_code === "gone" ? "the record no longer resolves" : "the record has no files"})
                    </p>
                  )}
                  <p>Challenges defended: {String(bond.defended)}</p>
                </div>
                <BondActions bond={bond} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">On-chain history</p>
                <ol className="space-y-1.5">
                  {[...history].reverse().map((h, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-mono text-muted-foreground">{h.at.replace("T", " ")}</span>{" "}
                      <strong className="capitalize">{h.event}</strong>
                      {typeof h.verdict === "string" && <> · {h.verdict}</>}
                      {h.event === "contested" && <> · {h.succeeded ? "changed the outcome" : "confirmed"}</>}
                      {h.event === "settled" && (
                        <> · author +{formatGen(h.owner_paid as string)} · challenger +{formatGen(h.challenger_paid as string)} GEN</>
                      )}
                      {(h.event === "posted" || h.event === "withdrawn") && h.amount ? <> · {formatGen(h.amount as string)} GEN</> : null}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
