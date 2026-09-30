"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useBondWrite } from "@/lib/hooks/useDataBond";
import { useWallet } from "@/lib/genlayer/wallet";
import { MIN_BOND_WEI, parseGen } from "@/lib/contracts/types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const REPO_RE = [
  /^https:\/\/(www\.)?zenodo\.org\/(records?|api\/records)\/\d+\/?$/,
  /^https:\/\/doi\.org\/10\.5281\/zenodo\.\d+\/?$/i,
  /^https:\/\/([a-z0-9-]+\.)?figshare\.com\/articles\/.+\/\d{5,}(\/\d+)?\/?$/,
  /^https:\/\/api\.figshare\.com\/v2\/articles\/\d+\/?$/,
  /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/,
];

const EMPTY = { paper: "", statement: "", repository: "", amount: "5" };

export function PostBondModal() {
  const { isConnected } = useWallet();
  const { writeAsync, pending } = useBondWrite();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof EMPTY, string>>>({});
  const busy = pending === "post";

  useEffect(() => {
    if (!isConnected && open && !busy) setOpen(false);
  }, [isConnected, open, busy]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setErrors({ ...errors, [k]: "" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const value = parseGen(form.amount);
    if (!form.paper.trim()) next.paper = "Give the paper's title or DOI";
    if (form.statement.trim().length < 20) next.statement = "Paste the paper's data-availability statement (at least 20 characters)";
    if (!REPO_RE.some((re) => re.test(form.repository.trim())))
      next.repository = "Use a Zenodo record, Figshare article or GitHub repository URL";
    if (value === null || value < MIN_BOND_WEI) next.amount = "A bond must be at least 1 GEN";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await writeAsync({ kind: "post", paper: form.paper.trim(), statement: form.statement.trim(), repository: form.repository.trim(), value: value! });
      setForm(EMPTY);
      setOpen(false);
    } catch {
      // The error toast and the transaction panel already explain what happened.
    }
  };

  const field = (k: keyof typeof EMPTY, label: string, placeholder: string, hint?: string, mono = false) => (
    <div className="space-y-1.5">
      <Label htmlFor={`pb-${k}`}>{label}</Label>
      <Input id={`pb-${k}`} value={form[k]} onChange={set(k)} placeholder={placeholder} className={`${mono ? "font-mono text-sm" : ""} ${errors[k] ? "border-destructive" : ""}`} />
      {errors[k] ? <p className="text-xs text-destructive">{errors[k]}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="gradient" disabled={!isConnected}>
          <Plus className="w-4 h-4 mr-2" /> Post a bond
        </Button>
      </DialogTrigger>
      <DialogContent className="brand-card border-2 sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Bond a data-availability statement</DialogTitle>
          <DialogDescription>
            Lock GEN behind what a paper says about its data and code. Validators check that the repository resolves before the bond
            is accepted. Anyone who proves the statement false can claim the bond.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 mt-2">
          {field("paper", "Paper", "Title and/or DOI of the paper")}
          <div className="space-y-1.5">
            <Label htmlFor="pb-statement">Data-availability statement</Label>
            <textarea
              id="pb-statement"
              value={form.statement}
              onChange={set("statement")}
              rows={4}
              placeholder="e.g. The raw survey responses and the R scripts for every analysis are openly available on Zenodo."
              className={`flex w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${errors.statement ? "border-destructive" : "border-input"}`}
            />
            {errors.statement ? (
              <p className="text-xs text-destructive">{errors.statement}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Paste it verbatim. Validators judge the repository against exactly this text.</p>
            )}
          </div>
          {field("repository", "Repository", "https://zenodo.org/records/...", "Zenodo record, Figshare article or GitHub repository", true)}
          {field("amount", "Bond (GEN)", "5", "At least 1 GEN. A challenger must stake 10% of it.", true)}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="gradient" className="flex-1" disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting...</> : "Post bond"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
