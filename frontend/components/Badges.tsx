import { STATE_STYLE, VERDICT_STYLE, type BondState, type Verdict } from "@/lib/contracts/types";

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  if (!verdict) return <span className="text-xs text-muted-foreground">-</span>;
  const v = VERDICT_STYLE[verdict];
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${v.cls}`} title={v.help}>
      {v.label}
    </span>
  );
}

export function StateBadge({ state }: { state: BondState }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${STATE_STYLE[state]}`}>
      {state}
    </span>
  );
}
