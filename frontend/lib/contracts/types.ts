/** Types and display helpers for the DataBond contract. */

export type Verdict = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | "";
export type BondState = "active" | "challenged" | "ruled" | "closed";

export interface Bond {
  id: string;
  owner: string;
  paper: string;
  statement: string;
  repository: string;
  source: "zenodo" | "figshare" | "github";
  amount: string | number | bigint;
  state: BondState;
  challenger: string;
  challenge_stake: string | number | bigint;
  challenge_reason: string;
  challenged_at: string;
  verdict: Verdict;
  verdict_code: "gone" | "empty" | "judged" | "";
  ruled_at: string;
  contested: boolean;
  contester: string;
  contest_stake: string | number | bigint;
  contest_succeeded: boolean;
  defended: string | number | bigint;
  evidence_json: string;
  history_json: string;
}

export interface Evidence {
  reachable?: boolean;
  open?: boolean;
  file_count?: number;
  total_bytes?: number;
}

export interface HistoryEntry {
  at: string;
  event: "posted" | "challenged" | "ruled" | "contested" | "settled" | "withdrawn";
  [key: string]: unknown;
}

export interface TransactionReceipt {
  status: string;
  hash: string;
  [key: string]: any;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const CONTEST_WINDOW_SECONDS = 600;
export const MIN_BOND_WEI = 10n ** 18n;
export const MIN_CHALLENGE_WEI = 10n ** 17n;

export function wei(v: string | number | bigint | undefined): bigint {
  try {
    return BigInt(v ?? 0);
  } catch {
    return 0n;
  }
}

export function formatGen(v: string | number | bigint | undefined, digits = 2): string {
  const w = wei(v);
  const whole = w / 10n ** 18n;
  const frac = Number((w % 10n ** 18n) / 10n ** 14n) / 10_000;
  return (Number(whole) + frac).toFixed(digits);
}

export function parseGen(input: string): bigint | null {
  const m = input.trim().match(/^(\d+)(?:\.(\d{1,18}))?$/);
  if (!m) return null;
  return BigInt(m[1]) * 10n ** 18n + BigInt((m[2] ?? "").padEnd(18, "0") || "0");
}

export function minChallengeWei(bond: Bond): bigint {
  const tenth = (wei(bond.amount) * 1000n) / 10000n;
  return tenth > MIN_CHALLENGE_WEI ? tenth : MIN_CHALLENGE_WEI;
}

export function parseJson<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export const sameAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function secondsSince(iso: string): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso.endsWith("Z") || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 1000;
}

/** 2 = owner vindicated, 1 = split, 0 = challenger vindicated. */
export function ownerFavour(v: Verdict): number {
  return v === "AVAILABLE" ? 2 : v === "PARTIAL" ? 1 : 0;
}

export const VERDICT_STYLE: Record<Exclude<Verdict, "">, { label: string; cls: string; help: string }> = {
  AVAILABLE: {
    label: "Available",
    cls: "bg-green-500/20 text-green-400 border-green-500/40",
    help: "Every promised item is published. The challenger's stake goes to the author and the bond stays open.",
  },
  PARTIAL: {
    label: "Partial",
    cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    help: "Some promised items are missing. Half the bond goes to the challenger and the bond closes.",
  },
  UNAVAILABLE: {
    label: "Unavailable",
    cls: "bg-red-500/20 text-red-400 border-red-500/40",
    help: "The promised materials are not published as stated. The whole bond goes to the challenger.",
  },
};

export const STATE_STYLE: Record<BondState, string> = {
  active: "bg-accent/15 text-accent border-accent/40",
  challenged: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  ruled: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  closed: "bg-white/5 text-muted-foreground border-white/10",
};

export const SOURCE_LABEL: Record<Bond["source"], string> = {
  zenodo: "Zenodo",
  figshare: "Figshare",
  github: "GitHub",
};

export function formatBytes(n?: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
