# DataBond

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/license/mit/)

<img src="assets/databond-logo.png" alt="DataBond logo" width="96" align="right" />

**Bonded data-availability statements, adjudicated by GenLayer validators.**

Most papers end with a data-availability statement: *"the data and code are openly available at …"*. Journals and funders
require one, but nobody checks it. Links rot, deposits turn out to hold only a README, "openly available" becomes
"available on request", and a replication study finds out years later.

DataBond puts money behind the statement:

1. An **author** (or lab, or journal) pastes the paper's data-availability statement, points at the Zenodo record,
   Figshare article or GitHub repository, and **locks GEN** behind it.
2. Anyone who thinks the statement is not honoured **challenges** it by staking 10% of the bond.
3. **Every GenLayer validator** fetches the repository's public API itself and rules **Available**, **Partial** or
   **Unavailable**.
4. The losing side can pay for **one independent re-ruling** within 10 minutes.
5. **Settlement is pure arithmetic**: an honest bond survives and earns the challenger's stake; a false one pays the
   challenger. The GEN moves to the winners' wallets.

A journal, funder or repository then calls `is_backed(bond_id)` to show a "data bonded" badge that no single party
decided.

**Live app:** [databond-bars26.vercel.app](https://databond-bars26.vercel.app). Reads need no wallet. Writes need MetaMask on
GenLayer Studio (chain 61999); the **Test GEN** button funds your wallet from the Studio faucet.
**Contract:** [`0xfCc592fcFcf0b4bDECCe66d94B9B18CAA6f6eB6e`](https://explorer-studio.genlayer.com/address/0xfCc592fcFcf0b4bDECCe66d94B9B18CAA6f6eB6e) on GenLayer Studio.

## Verified live

A full lifecycle run against real public repositories, with real validator consensus and real LLM calls, is recorded
with every transaction hash in [`docs/REPRODUCTION.md`](docs/REPRODUCTION.md) and can be rerun with
`node scripts/demo.mjs <contract>`.

| Bond | Statement vs. repository | Ruling | Outcome |
|---|---|---|---|
| Honest | The depositor's own description of a Zenodo replication package (`data/` panel + `code/` scripts) | **Available** | Bond survives, author earns the challenger's stake |
| Over-broad | Same repository, but the statement also promises the raw web scrapes, which the deposit does not contain | **Partial** | Half the bond to the challenger, half back to the author |
| Mismatch | Promises survey microdata and Stata do-files; the record is an unrelated audio-video dataset | **Unavailable** | Whole bond to the challenger |
| Restricted, "open" claim | Promises unrestricted download of a restricted-access Zenodo record | **Unavailable** | Whole bond to the challenger |
| Restricted, honest | Same restricted record, statement honestly declares controlled access on request | **Available** | Challenger contests; the independent re-ruling agrees, the contest stake goes to the author |

The DEMO statements are written for the test and labelled as such on chain; they do not claim to be what any real author
wrote. The honest case uses the depositor's own description.

## How a ruling is made

Each validator runs the same function inside `gl.eq_principle.strict_eq`:

1. **Fetch the manifest** from the repository's public JSON API: Zenodo `api/records/{id}`, Figshare `v2/articles/{id}`,
   GitHub `repos/{o}/{r}` + `git/trees/{branch}?recursive=1`. Normalised to reachable / open / file list with sizes /
   title / license / description.
2. **Mechanical failures are decided in code, never by a model.** A record that no longer resolves is Unavailable
   (`gone`); an open record with no files is Unavailable (`empty`).
3. Otherwise **an LLM compares the promised materials with the actual file list** and must answer exactly one of
   `AVAILABLE`, `PARTIAL`, `UNAVAILABLE`. Anything else reverts; nothing is coerced.
4. **Restricted access is judged, not failed.** Controlled access is legitimate for patient or proprietary data, so a
   restricted record goes to the model with its access status: Available only if the statement itself says access is
   controlled or by request, Unavailable if the statement promised open access. This is exactly the difference between
   the two restricted demo bonds.

Validators agree on a small JSON of coarse facts (reachable, open, file count, total bytes, verdict), not on free text.

## Game theory

| Rule | Why |
|---|---|
| Bond at least 1 GEN; challenge must stake 10% of it (min 0.1 GEN) | Frivolous challenges cost money; a bond is worth challenging |
| Posting is a real probe: a repository that does not resolve cannot be bonded | No bonds on dead links from day one |
| One challenge at a time; the owner cannot challenge themselves | No self-dealing, no parallel races |
| Adjudication is permissionless | A stalled challenge can always be moved forward |
| One contest per ruling, by the losing side only, same stake as the challenge, 10-minute window | A second, independent validator set can correct a bad ruling, but not forever |
| The losing side can waive the window and settle early | No forced waiting when everyone accepts the result |
| Available → bond stays open and `defended` increments | Honest statements accumulate a public track record |
| Partial → half the bond; Unavailable → the whole bond | Over-claiming is punished proportionally |
| Payouts are integer arithmetic in the contract | No model decides who gets paid |
| Statement and repository metadata are wrapped as untrusted data in the prompt; the challenger's reason is never shown to the model | Prompt injection from either party is contained |

## Paying wallets on GenLayer: the part that is easy to get wrong

`gl.get_contract_at(addr).emit_transfer(value=...)` sends an **internal** GenVM message. A wallet has no code to run, so on
Studio that child transaction ends `NO_MAJORITY` with `value_credited: false`: the GEN leaves the contract and never
arrives. The first deployment of this contract (`0x3db0C339…`) did exactly that. DataBond now pays through an
**external** EVM message:

```python
@gl.evm.contract_interface
class _Wallet:
    class View: pass
    class Write: pass

_Wallet(to).emit_transfer(value=u256(amount))  # EthSend with empty calldata
```

Verified live: a 2 GEN withdrawal's transfer finalized with `value_credited: true` and the wallet went from 8 back to
10 GEN (`scripts/probe-transfer.mjs`).

## Contract API

| Method | Kind | What it does |
|---|---|---|
| `post_bond(paper, statement, repository)` | payable write | Bond ≥ 1 GEN behind a statement; probes the repository first |
| `challenge(bond_id, reason)` | payable write | Stake ≥ 10% of the bond against the statement |
| `adjudicate(bond_id)` | write | Consensus ruling, anyone can call |
| `contest(bond_id)` | payable write | Losing side pays for one independent re-ruling within 10 minutes |
| `settle(bond_id)` | write | Pays out; the bond survives on Available, closes otherwise |
| `withdraw(bond_id)` | write | Owner takes an unchallenged bond back |
| `get_bond`, `get_history`, `list_bonds`, `list_bonds_by_owner`, `get_stats`, `is_backed`, `contest_window_seconds` | views | |

## Frontend

Next.js app in `frontend/`: bonds table with per-bond statement, repository manifest, on-chain history and the actions
your wallet can take right now (withdraw, challenge, adjudicate, contest, settle), a post-a-bond form, stats, an
integrator `is_backed` check, a transactions panel (hash, consensus status, contract result, finality) and a Studio faucet
button.

Lessons carried over from earlier projects:

- **Reads never spend the visitor's rate-limit budget.** Studio allows 30 `gen_call`/`eth_sendRawTransaction` per minute
  per IP, shared. The bond list comes from a CDN-cached server snapshot (`/api/bonds`); after a write only that bond is
  re-read.
- **ACCEPTED is not success.** The receipt's `execution_result` is checked, so a reverted call is reported as reverted, with
  the hash and the contract's message.
- **Distinct errors** for wallet rejection, wrong network, rate limit, unreachable RPC, revert and timeout, with the raw
  error kept.

## Tests

29 direct-mode tests (`tests/direct/test_data_bond.py`): posting and URL forms for all three sources, the minimum bond and
stake, self-challenge, second challenger, every verdict path, deleted/empty records decided without the model, restricted
records judged both ways, the non-enum LLM guard, settlement arithmetic for all three outcomes, early settlement by the
losing side, successful and failed contests, the contest window, withdrawal, and the views.

```shell
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
genvm-lint check contracts/data_bond.py
python -m pytest tests/direct -v
```

## Run it yourself

```shell
genlayer network set studionet
genlayer deploy --contract contracts/data_bond.py
npm install && node scripts/demo.mjs <contract-address>     # full live lifecycle with two faucet-funded accounts
cp frontend/.env.example frontend/.env                        # set NEXT_PUBLIC_CONTRACT_ADDRESS
cd frontend && npm install && npm run dev
```

## License
MIT. See [LICENSE](LICENSE).
