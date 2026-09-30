"use client";

import { Navbar } from "@/components/Navbar";
import { BondsTable } from "@/components/BondsTable";
import { StatsPanel } from "@/components/StatsPanel";
import { BackedLookup } from "@/components/BackedLookup";
import { TransactionPanel } from "@/components/TransactionPanel";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-20 pb-12 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4">DataBond</h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
              &quot;Data available on request&quot; is where replication goes to die. DataBond lets authors put GEN behind their
              data-availability statement. Anyone who proves it false claims the bond, and GenLayer validators decide by checking the
              public repository themselves.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <div className="lg:col-span-8">
              <h2 className="text-xl font-bold mb-4">Bonds</h2>
              <BondsTable />
            </div>
            <div className="lg:col-span-4 space-y-6">
              <StatsPanel />
              <BackedLookup />
              <TransactionPanel />
            </div>
          </div>

          <section className="mt-8 brand-card p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-4">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm text-muted-foreground">
              <div className="space-y-2">
                <div className="text-accent font-bold text-lg">1. Bond</div>
                <p>The author pastes the paper&apos;s data-availability statement, points at the Zenodo, Figshare or GitHub repository and locks at least 1 GEN. Validators check the repository resolves first.</p>
              </div>
              <div className="space-y-2">
                <div className="text-accent font-bold text-lg">2. Challenge</div>
                <p>Anyone who finds the promise broken stakes 10% of the bond. Only one challenge runs at a time, and the author cannot challenge themselves.</p>
              </div>
              <div className="space-y-2">
                <div className="text-accent font-bold text-lg">3. Rule</div>
                <p>Every validator fetches the repository&apos;s public API. Deleted or empty records fail in code. Otherwise an LLM compares the promised materials with the actual file list and returns Available, Partial or Unavailable.</p>
              </div>
              <div className="space-y-2">
                <div className="text-accent font-bold text-lg">4. Contest and settle</div>
                <p>For 10 minutes the losing side can pay for one independent re-ruling. Then payouts are pure arithmetic: an honest bond survives and earns the stake; a false one goes to the challenger.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
      <footer className="border-t border-white/10 py-3 text-center text-sm text-muted-foreground">
        <a href="https://genlayer.com" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Powered by GenLayer</a>
        {" · "}
        <a href="https://github.com/bars26/genlayer-databond" target="_blank" rel="noopener noreferrer" className="hover:text-accent">Source</a>
      </footer>
    </div>
  );
}
