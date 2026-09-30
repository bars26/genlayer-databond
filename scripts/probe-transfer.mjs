// Proves payouts reach a wallet: post a 2 GEN bond, withdraw it, wait for the
// transfer to finalize and compare the wallet balance.
import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
const CONTRACT = process.argv[2];
const RPC = "https://studio.genlayer.com/api";
const rpc = async (method, params) => (await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const bal = async (a) => Number(BigInt(await rpc("eth_getBalance", [a, "latest"]))) / 1e18;
const acct = createAccount(generatePrivateKey());
const c = createClient({ chain: studionet, endpoint: RPC, account: acct });
await rpc("sim_fundAccount", [acct.address, 10 * 1e18]);
await new Promise((r) => setTimeout(r, 3000));
console.log("start", await bal(acct.address));
const send = async (fn, args, value = 0n) => {
  const hash = await c.writeContract({ address: CONTRACT, functionName: fn, args, value });
  const r = await c.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 60, interval: 5000 });
  const lr = r.consensus_data?.leader_receipt; console.log(fn, hash, (Array.isArray(lr) ? lr[0] : lr)?.execution_result);
  return hash;
};
const ids = await c.readContract({ address: CONTRACT, functionName: "list_bonds", args: [] });
await send("post_bond", ["probe", "The analysis code and the cleaned panel are openly available on Zenodo.", "https://zenodo.org/records/23041043"], 2n * 10n ** 18n);
console.log("after post", await bal(acct.address));
const w = await send("withdraw", [`bond_${ids.length}`]);
for (let i = 0; i < 60; i++) {
  const t = await c.getTriggeredTransactionIds({ hash: w }).catch(() => []);
  if (t.length) {
    const tx = await c.getTransaction({ hash: t[0] });
    if (tx.statusName === "FINALIZED") { console.log("transfer", t[0], tx.statusName, tx.result_name, "credited", tx.value_credited); break; }
  }
  await new Promise((r) => setTimeout(r, 10000));
}
console.log("end", await bal(acct.address));
