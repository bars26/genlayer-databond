"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useDataBondContract } from "@/lib/hooks/useDataBond";
import { classifyError } from "@/lib/utils/errors";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/** The call a journal, grant programme or repository makes before it shows a "data bonded" badge. */
export function BackedLookup() {
  const contract = useDataBondContract();
  const [id, setId] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract || !id.trim()) return;
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      setResult(await contract.isBacked(id.trim()));
    } catch (e) {
      const c = classifyError(e, "read");
      setErr(c.kind === "rate_limited" || c.kind === "rpc_unreachable" ? `${c.message} ${c.hint ?? ""}` : "No bond with that id. Try bond_0.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="brand-card p-6 space-y-3">
      <h3 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-accent" /> Integrator check</h3>
      <p className="text-sm text-muted-foreground">
        Reads <code className="text-xs">is_backed(bond_id)</code> from the contract: true while GEN still stands behind the statement and no ruling has gone against it.
      </p>
      <form onSubmit={lookup} className="flex gap-2">
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="bond_0" className="font-mono" aria-label="Bond id to check" />
        <Button type="submit" variant="gradient" disabled={loading || !id.trim()}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}</Button>
      </form>
      {result !== null && (
        <p className={`text-sm ${result ? "text-green-400" : "text-red-400"}`}>
          is_backed → {String(result)}. {result ? "The statement is bonded and unrefuted." : "No bond currently stands behind this statement."}
        </p>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
    </div>
  );
}
