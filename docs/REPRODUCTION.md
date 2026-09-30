# Reproducing DataBond

Everything here can be checked without trusting this file: the hashes open on the public Studio explorer and every
view can be called from the CLI or the live UI.

- **Live UI:** https://databond-bars26.vercel.app
- **Contract:** [`0xfCc592fcFcf0b4bDECCe66d94B9B18CAA6f6eB6e`](https://explorer-studio.genlayer.com/address/0xfCc592fcFcf0b4bDECCe66d94B9B18CAA6f6eB6e) on GenLayer Studio (chain 61999)
- **Rerun it:** `npm install && node scripts/demo.mjs 0xfCc592fcFcf0b4bDECCe66d94B9B18CAA6f6eB6e`
  (creates two fresh accounts, funds them from the Studio faucet, runs every bond through its lifecycle)

## Live run, 2026-09-30

Author `0x264e5F87120DF639e577241875084B574f1BCb34`, challenger `0x79e725496ab7bC64a31651EA82176f23Ab5Ba3f1`, both funded with 100 GEN from the faucet.
The raw log is in [`demo-run.json`](demo-run.json).

| Bond | Case | Repository | Ruling | After settlement |
|---|---|---|---|---|
| bond_1 | Depositor's own description | [Zenodo 23041043](https://zenodo.org/records/23041043) (data/ + code/) | **AVAILABLE** | Active, defended once, `is_backed` true |
| bond_2 | DEMO over-broad claim (adds raw scrapes the deposit does not have) | Zenodo 23041043 | **PARTIAL** | Closed; 2.5 GEN to each side |
| bond_3 | DEMO claim of survey microdata + Stata files | [Zenodo 1188976](https://zenodo.org/records/1188976) (audio/video dataset) | **UNAVAILABLE** | Closed; bond to challenger |
| bond_4 | DEMO claim of unrestricted download | [Zenodo 23050408](https://zenodo.org/records/23050408) (restricted access) | **UNAVAILABLE** | Closed; bond to challenger |
| bond_5 | DEMO honest controlled-access statement | Zenodo 23050408 | **AVAILABLE**, contested, re-ruled **AVAILABLE** | Active; challenge stake and contest stake to the author |

The first run on the earlier deployment gave the same five rulings, so the model's judgments are stable across
independent validator sets.

### Money actually moved

| Wallet | Start | End | Why |
|---|---|---|---|
| Author | 100 GEN | **80.5 GEN** | Bonded 5 x 5 GEN + a 2 GEN bond it withdrew (+2). Won the stake on bond_1 (+1), half of bond_2 (+2.5), stake + contest stake on bond_5 (+2). bond_1 and bond_5 still lock 10 GEN. |
| Challenger | 100 GEN | **109.5 GEN** | Staked 5 x 1 GEN + a 1 GEN contest. Won stake + half bond on bond_2 (+3.5), stake + bond on bond_3 and bond_4 (+6, +6). |
| Contract | 0 | **10 GEN** | Exactly the two surviving bonds. |

Balances are read with `eth_getBalance` after the transfer transactions finalized.

### Every transaction

| # | Who | Call | GEN | Tx | Consensus | Contract |
|---|---|---|---|---|---|---|
| 1 | author | `post_bond("Who benefits, who pays? Distributional , "Contents: data/ - the cleaned, de-ident, "https://zenodo.org/records/23041043")` | 5 | [`0x1b838684…`](https://explorer-studio.genlayer.com/tx/0x1b838684c2b0bb98e27096105451053f951ee55d5dcfedcadcf84dcb2f93feef) | ACCEPTED | SUCCESS |
| 2 | author | `post_bond("DEMO statement (over-broad) for the NEV, "All materials are openly available on Z, "https://zenodo.org/records/23041043")` | 5 | [`0x8113c05d…`](https://explorer-studio.genlayer.com/tx/0x8113c05ddfa06f387d60fb8c997561f4ed191567905d945494de3412c4323998) | ACCEPTED | SUCCESS |
| 3 | author | `post_bond("DEMO statement pointing at an unrelated, "The household survey microdata (CSV) an, "https://zenodo.org/records/1188976")` | 5 | [`0x390ae5f7…`](https://explorer-studio.genlayer.com/tx/0x390ae5f74aa90b6795a81ab90e39fe7f08d3efeaa5aeec21aef404153ab35744) | ACCEPTED | SUCCESS |
| 4 | author | `post_bond("DEMO statement promising open access to, "The germline and somatic variant call f, "https://zenodo.org/records/23050408")` | 5 | [`0xcbdf2ce5…`](https://explorer-studio.genlayer.com/tx/0xcbdf2ce5c372f92be394ac887c88cf876f2b9d52be1b435880d0b91c85ab29b5) | ACCEPTED | SUCCESS |
| 5 | author | `post_bond("DEMO statement that honestly declares c, "Because they derive from patient sequen, "https://zenodo.org/records/23050408")` | 5 | [`0x3e783e03…`](https://explorer-studio.genlayer.com/tx/0x3e783e0354d582638950184b9d54186655df51718f3469f841f01af2f18147a3) | ACCEPTED | SUCCESS |
| 6 | author | `post_bond("DEMO withdrawal", "Contents: data/ - the cleaned, de-ident, "https://zenodo.org/records/23041043")` | 2 | [`0xc05a8bf5…`](https://explorer-studio.genlayer.com/tx/0xc05a8bf5bf599849015bfa606c7ddba47bc0f8d03000e8cc1853a257ce10fcea) | ACCEPTED | SUCCESS |
| 7 | author | `withdraw("bond_6")` |  | [`0x800b7a39…`](https://explorer-studio.genlayer.com/tx/0x800b7a396f314e8b1053c280831bbe46cd6b60288e2285e585b6a34f35680620) | ACCEPTED | SUCCESS |
| 8 | challenger | `challenge("bond_1", "The statement is not honoured by the re)` | 1 | [`0xb206df76…`](https://explorer-studio.genlayer.com/tx/0xb206df763fde032c4aa5d494613e5864ac31f3c301992a957ecb9cddb257ac56) | ACCEPTED | SUCCESS |
| 9 | challenger | `challenge("bond_2", "The statement is not honoured by the re)` | 1 | [`0x7da9b889…`](https://explorer-studio.genlayer.com/tx/0x7da9b88976c0fa6d0042bf9332ddc567eb9661d9df7a4ac8b370bbc8854bd4c8) | ACCEPTED | SUCCESS |
| 10 | challenger | `challenge("bond_3", "The statement is not honoured by the re)` | 1 | [`0x27aeeccf…`](https://explorer-studio.genlayer.com/tx/0x27aeeccf62f6a85375d2f08ffee6864267ad46fa8248a57013006de5b72714c8) | ACCEPTED | SUCCESS |
| 11 | challenger | `challenge("bond_4", "The statement is not honoured by the re)` | 1 | [`0x3113618f…`](https://explorer-studio.genlayer.com/tx/0x3113618f50e9b8a2d7c3d20b9e38cb4ec7a6639f7273fec78c4652b79f47929c) | ACCEPTED | SUCCESS |
| 12 | challenger | `challenge("bond_5", "The statement is not honoured by the re)` | 1 | [`0x3253e469…`](https://explorer-studio.genlayer.com/tx/0x3253e4692f4dbe67b358288c4da65b486149ef6d1f32718eb4850cd40dbf5a4e) | ACCEPTED | SUCCESS |
| 13 | challenger | `adjudicate("bond_1")` |  | [`0x498dd7f3…`](https://explorer-studio.genlayer.com/tx/0x498dd7f3e2e39fe364ef9e6701f06de255052e592d54bdea81671f617e26621c) | ACCEPTED | SUCCESS |
| 14 | challenger | `adjudicate("bond_2")` |  | [`0x3b7ff9e7…`](https://explorer-studio.genlayer.com/tx/0x3b7ff9e7bc2d929163784800f159fdabb992849e68a5c21560c36bfdb46bc3bc) | ACCEPTED | SUCCESS |
| 15 | challenger | `adjudicate("bond_3")` |  | [`0x92b99ff8…`](https://explorer-studio.genlayer.com/tx/0x92b99ff8f62fc1ee6a2cccc2bdfe8487a357449c4164de4882305dc4aefcfdc1) | ACCEPTED | SUCCESS |
| 16 | challenger | `adjudicate("bond_4")` |  | [`0x237cc9ee…`](https://explorer-studio.genlayer.com/tx/0x237cc9ee95dd15f5dc68cab402f28c3ff6877621ce237dcacc51eecca06c7e73) | ACCEPTED | SUCCESS |
| 17 | challenger | `adjudicate("bond_5")` |  | [`0x9cb84fe1…`](https://explorer-studio.genlayer.com/tx/0x9cb84fe1147fe9757003afe8621f97c0e3192b215ba7f82046470ed01b346742) | ACCEPTED | SUCCESS |
| 18 | challenger | `contest("bond_5")` | 1 | [`0xb02107b4…`](https://explorer-studio.genlayer.com/tx/0xb02107b44d7aeeb4eb70a933feb2006715de0c68f85d0804623e9ab8730636d2) | ACCEPTED | SUCCESS |
| 19 | challenger | `settle("bond_1")` |  | [`0xf2d802cf…`](https://explorer-studio.genlayer.com/tx/0xf2d802cfc80313a3013704493a2dd306bb167c16f319ed9a3e4b91619189fc5b) | ACCEPTED | SUCCESS |
| 20 | author | `settle("bond_2")` |  | [`0x767ca9ee…`](https://explorer-studio.genlayer.com/tx/0x767ca9ee20ebde4b10156ec07bf844b0315d9ba6e786c9f5d0ff09a9cae965eb) | ACCEPTED | SUCCESS |
| 21 | author | `settle("bond_3")` |  | [`0x7ad976c8…`](https://explorer-studio.genlayer.com/tx/0x7ad976c86ab42cf05123b9c72211e36e61bd27a70fcde48070abe7137e7976cf) | ACCEPTED | SUCCESS |
| 22 | author | `settle("bond_4")` |  | [`0x0aeecbfb…`](https://explorer-studio.genlayer.com/tx/0x0aeecbfbf84218e74f9e5b4ab782f3c1327d4553f06e3205baed6f1286886160) | ACCEPTED | SUCCESS |
| 23 | author | `settle("bond_5")` |  | [`0x4c6b10dc…`](https://explorer-studio.genlayer.com/tx/0x4c6b10dc88dc0d564a67d18e55dae6ac276bfecbf3b83db5af90c1d5ee34cd4b) | ACCEPTED | SUCCESS |

## Why payouts use an external EVM transfer

The first deployment (`0x3db0C3391Ca1A614F635473b7429165575EE416C`) paid with
`gl.get_contract_at(addr).emit_transfer(...)`, which sends an internal GenVM message. For a wallet address the child
transaction ends `NO_MAJORITY` with `value_credited: false`: the contract balance dropped but the wallets never
received anything (author stayed at 73 GEN, challenger at 94 GEN after "settling"). Payouts now go through
`gl.evm.contract_interface` (`EthSend` with empty calldata). `scripts/probe-transfer.mjs` shows the fix on its own: a 2 GEN
withdrawal finalizes with `value_credited: true` and the wallet goes from 8 back to 10 GEN.

## Try it from the live UI

| # | In the UI | Check independently |
|---|---|---|
| 1 | Open the app, expand **bond_1** and **bond_2**: statement, repository file count, ruling, on-chain history with payouts | `genlayer call <contract> get_bond --args bond_2` |
| 2 | **Integrator check**: `bond_1` → `is_backed → true`; `bond_3` → `false` | `genlayer call <contract> is_backed --args bond_1` |
| 3 | Connect MetaMask on GenLayer Studio, click **Test GEN** (Studio faucet) | `eth_getBalance` on your address |
| 4 | Expand **bond_1** (active, not yours), stake the suggested 0.5 GEN and **Challenge** | Transactions panel shows the hash, ACCEPTED, contract result SUCCESS |
| 5 | **Adjudicate now** (about a minute of validator work) | `get_bond` shows `state: ruled` and the verdict |
| 6 | If the ruling is AVAILABLE, you lost: **Accept ruling and settle** (or **Contest** for a second opinion) | The author's wallet receives your stake once the transfer finalizes |
| 7 | **Post a bond** on any Zenodo record with its real statement | `list_bonds_by_owner` with your address |
