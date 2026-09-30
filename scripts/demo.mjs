// Live end-to-end demo of DataBond on GenLayer Studio.
//
//   node scripts/demo.mjs <contract-address>
//
// Creates two throwaway Studio accounts (an author and a challenger), funds them
// from the Studio faucet, then runs every bond through its full lifecycle against
// real public repositories. Prints each transaction hash, consensus status and the
// contract's own execution result (a reverted call is still ACCEPTED on GenLayer).

import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = process.argv[2];
if (!CONTRACT) {
  console.error("usage: node scripts/demo.mjs <contract-address>");
  process.exit(1);
}
const RPC = "https://studio.genlayer.com/api";
const GEN = 10n ** 18n;

const PAPER_NEV =
  "Who benefits, who pays? Distributional incidence of China's new energy vehicle tax exemption (submitted to Energy Economics)";
const NEV = "https://zenodo.org/records/23041043";

// Bonds to run. The first uses the depositor's own description as the statement.
// The others are clearly labelled DEMO statements written for this test: they do not
// claim to be what any real author wrote; they show how a false or over-broad
// statement is caught against a real repository.
const CASES = [
  {
    key: "honest",
    paper: PAPER_NEV,
    statement:
      "Contents: data/ - the cleaned, de-identified series-month panel of the Chinese passenger-vehicle market and the aggregate outputs behind every table and figure; code/ - Python scripts that clean the raw series, estimate the quasi-experiment and reproduce all tables and figures.",
    repository: NEV,
    bond: 5n * GEN,
  },
  {
    key: "overclaim",
    paper: "DEMO statement (over-broad) for the NEV replication package",
    statement:
      "All materials are openly available on Zenodo: the analysis code, the cleaned panel, AND the full raw web-page scrapes from 16888.com and Autohome that the panel was built from.",
    repository: NEV,
    bond: 5n * GEN,
  },
  {
    key: "mismatch",
    paper: "DEMO statement pointing at an unrelated dataset",
    statement:
      "The household survey microdata (CSV) and the Stata do-files for every regression table are openly available at this Zenodo record.",
    repository: "https://zenodo.org/records/1188976",
    bond: 5n * GEN,
  },
  {
    key: "restricted-open-claim",
    paper: "DEMO statement promising open access to a restricted-access record",
    statement:
      "The germline and somatic variant call files are openly and publicly available for download without restriction at this Zenodo record.",
    repository: "https://zenodo.org/records/23050408",
    bond: 5n * GEN,
  },
  {
    key: "restricted-honest",
    paper: "DEMO statement that honestly declares controlled access",
    statement:
      "Because they derive from patient sequencing data, the germline and somatic variant call files are deposited on Zenodo under restricted access and are shared with qualified researchers upon approved request.",
    repository: "https://zenodo.org/records/23050408",
    bond: 5n * GEN,
  },
];

function client(account) {
  return createClient({ chain: studionet, endpoint: RPC, account });
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = [];

async function write(c, who, functionName, args, value = 0n) {
  for (let attempt = 1; ; attempt++) {
    try {
      const hash = await c.writeContract({ address: CONTRACT, functionName, args, value });
      const receipt = await c.waitForTransactionReceipt({ hash, status: "ACCEPTED", retries: 60, interval: 5000 });
      const lr = receipt?.consensus_data?.leader_receipt;
      const exec = (Array.isArray(lr) ? lr[0] : lr)?.execution_result ?? "?";
      const row = { who, call: `${functionName}(${args.map((a) => JSON.stringify(a).slice(0, 40)).join(", ")})`, value: String(value / 10n ** 16n / 100n), hash, status: receipt.statusName ?? receipt.status_name ?? "ACCEPTED", exec };
      log.push(row);
      console.log(`${row.who.padEnd(10)} ${row.call.padEnd(58)} ${row.status.padEnd(9)} ${row.exec.padEnd(7)} ${hash}`);
      if (exec !== "SUCCESS") throw new Error(`${functionName} executed with ${exec}`);
      return receipt;
    } catch (err) {
      const msg = String(err?.message || err);
      if (/rate limit/i.test(msg) && attempt < 5) {
        console.log(`  rate limited, waiting ${15 * attempt}s`);
        await sleep(15000 * attempt);
        continue;
      }
      throw err;
    }
  }
}

async function read(c, functionName, args = []) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await c.readContract({ address: CONTRACT, functionName, args });
    } catch (err) {
      if (/rate limit/i.test(String(err?.message)) && attempt < 5) {
        await sleep(15000 * attempt);
        continue;
      }
      throw err;
    }
  }
}

const balance = async (addr) => BigInt(await rpc("eth_getBalance", [addr, "latest"]));
const fmt = (wei) => (Number(wei) / 1e18).toFixed(2);

const owner = createAccount(generatePrivateKey());
const challenger = createAccount(generatePrivateKey());
const O = client(owner);
const C = client(challenger);

console.log("contract  ", CONTRACT);
console.log("author    ", owner.address);
console.log("challenger", challenger.address);
await rpc("sim_fundAccount", [owner.address, Number(100n * GEN)]);
await rpc("sim_fundAccount", [challenger.address, Number(100n * GEN)]);
await sleep(3000);
const start = { owner: await balance(owner.address), challenger: await balance(challenger.address) };
console.log(`funded: author ${fmt(start.owner)} GEN, challenger ${fmt(start.challenger)} GEN\n`);

const firstId = Number((await read(O, "list_bonds")).length);
const ids = {};
for (const [i, c] of CASES.entries()) {
  await write(O, "author", "post_bond", [c.paper, c.statement, c.repository], c.bond);
  ids[c.key] = `bond_${firstId + i}`;
}
// One more bond that is posted and then withdrawn untouched.
await write(O, "author", "post_bond", ["DEMO withdrawal", CASES[0].statement, NEV], 2n * GEN);
const withdrawId = `bond_${firstId + CASES.length}`;
await write(O, "author", "withdraw", [withdrawId]);

console.log("");
for (const c of CASES) {
  await write(C, "challenger", "challenge", [ids[c.key], "The statement is not honoured by the repository."], 1n * GEN);
}
console.log("");
const verdicts = {};
for (const c of CASES) {
  await write(C, "challenger", "adjudicate", [ids[c.key]]);
  const b = await read(O, "get_bond", [ids[c.key]]);
  verdicts[c.key] = b.verdict ?? b.get?.("verdict");
  console.log(`  -> ${ids[c.key]} ${c.key}: ${verdicts[c.key]}`);
}

// The challenger contests the honest restricted-access ruling if it went to the author.
console.log("");
if (verdicts["restricted-honest"] === "AVAILABLE") {
  await write(C, "challenger", "contest", [ids["restricted-honest"]], 1n * GEN);
  const b = await read(O, "get_bond", [ids["restricted-honest"]]);
  console.log(`  -> contest re-ruled: ${b.verdict}, succeeded: ${b.contest_succeeded}`);
}

// Settle: the losing side waives the contest window so the demo does not wait 10 minutes.
console.log("");
for (const c of CASES) {
  const b = await read(O, "get_bond", [ids[c.key]]);
  const v = b.verdict;
  const settler = b.contested ? O : v === "AVAILABLE" ? C : O;
  await write(settler, settler === O ? "author" : "challenger", "settle", [ids[c.key]]);
}

await sleep(5000);
const end = { owner: await balance(owner.address), challenger: await balance(challenger.address) };
console.log("\nfinal bonds:");
for (const c of CASES) {
  const b = await read(O, "get_bond", [ids[c.key]]);
  console.log(`  ${ids[c.key]} ${c.key.padEnd(22)} verdict=${b.verdict.padEnd(11)} code=${b.verdict_code.padEnd(7)} state=${b.state.padEnd(7)} backed=${await read(O, "is_backed", [ids[c.key]])}`);
}
console.log(`\nbalances: author ${fmt(start.owner)} -> ${fmt(end.owner)} GEN, challenger ${fmt(start.challenger)} -> ${fmt(end.challenger)} GEN`);
console.log("(transfers are emitted on finalization, so balances catch up once the appeal window closes)");
console.log("\nJSON:", JSON.stringify({ contract: CONTRACT, owner: owner.address, challenger: challenger.address, ids, verdicts, log }));
