"use client";

import { Coins } from "lucide-react";
import { useAllBonds } from "@/lib/hooks/useDataBond";
import { formatGen, wei } from "@/lib/contracts/types";

export function StatsPanel() {
  const { bonds } = useAllBonds();
  const bonded = bonds.reduce((s, b) => s + wei(b.amount), 0n);
  const count = (s: string) => bonds.filter((b) => b.state === s).length;
  const rulings = bonds.filter((b) => b.verdict);
  const verdict = (v: string) => rulings.filter((b) => b.verdict === v).length;
  const cell = (label: string, value: string | number, cls = "") => (
    <div className="rounded-lg border border-white/10 p-3 text-center">
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
  return (
    <div className="brand-card p-6 space-y-4">
      <h3 className="text-xl font-bold flex items-center gap-2"><Coins className="w-5 h-5 text-accent" /> Bonded right now</h3>
      <div className="text-3xl font-bold">{formatGen(bonded)} <span className="text-base text-muted-foreground">GEN</span></div>
      <div className="grid grid-cols-2 gap-3">
        {cell("Active", count("active"), "text-accent")}
        {cell("Challenged", count("challenged") + count("ruled"), "text-orange-300")}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cell("Available", verdict("AVAILABLE"), "text-green-400")}
        {cell("Partial", verdict("PARTIAL"), "text-yellow-300")}
        {cell("Unavailable", verdict("UNAVAILABLE"), "text-red-400")}
      </div>
      <p className="text-xs text-muted-foreground">Latest ruling per bond. Closed bonds keep their final verdict.</p>
    </div>
  );
}
