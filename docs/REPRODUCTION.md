# Reproducing DataBond

Everything here can be checked without trusting this file: the hashes open on the public Studio explorer and every
view can be called from the CLI or the live UI.

- **Live UI:** https://databond-bars26.vercel.app
- **Contract:** [`0x3f0A10DE7cF2e4E6ad5874772dF197FD45e4B4BF`](https://explorer-studio.genlayer.com/address/0x3f0A10DE7cF2e4E6ad5874772dF197FD45e4B4BF) on GenLayer Studio (chain 61999).
  Its on-chain code is byte-identical to [`contracts/data_bond.py`](../contracts/data_bond.py) (checked with `getContractCode`).
- **Rerun it:** `npm install && node scripts/demo.mjs 0x3f0A10DE7cF2e4E6ad5874772dF197FD45e4B4BF` creates two fresh accounts, funds them from the Studio faucet and
  runs every bond through its lifecycle.

## Live run, 2026-09-30

Author `0xF730fc4d5BeaFFcBD0F0D1c394d37B8CDBFce6D7`, challenger `0xfC5e03f4f6dc837E0f9e93fb6Aa9aC3249a7a9bc`, each funded with 100 GEN. Raw log: [`demo-run.json`](demo-run.json).

| Bond | Case | Repository | Ruling | After settlement |
|---|---|---|---|---|
| bond_0 | Depositor's own description | [Zenodo 23041043](https://zenodo.org/records/23041043) (data/ + code/) | **AVAILABLE** | Active, defended once, `is_backed` true |
| bond_1 | DEMO over-broad claim (adds raw scrapes the deposit does not have) | Zenodo 23041043 | **PARTIAL** | Closed; 2.5 GEN to each side |
| bond_2 | DEMO claim of survey microdata + Stata files | [Zenodo 1188976](https://zenodo.org/records/1188976) (audio/video dataset) | **UNAVAILABLE** | Closed; bond to challenger |
| bond_3 | DEMO claim of unrestricted download | [Zenodo 23050408](https://zenodo.org/records/23050408) (restricted access) | **UNAVAILABLE** | Closed; bond to challenger |
| bond_4 | DEMO honest controlled-access statement | Zenodo 23050408 | **AVAILABLE**, contested, re-ruled **AVAILABLE** | Active; challenge and contest stakes to the author |
| bond_5 | Posted and withdrawn untouched | Zenodo 23041043 | – | Closed; 2 GEN back to the author |

Before the rulings, the challenger tried to challenge bond_0 with 0.1 GEN (the minimum is 0.5). The contract returned
`REFUNDED: A challenge must stake at least …` and sent the 0.1 GEN back instead of reverting (a reverted call would keep it).

Three independent runs on three deployments gave the same five rulings.

### Money actually moved

| Wallet | Start | End | Why |
|---|---|---|---|
| Author | 100 GEN | **80.5 GEN** | Bonded 5 x 5 GEN and a 2 GEN bond it withdrew (+2). Won the stake on bond_0 (+1), half of bond_1 (+2.5), stake + contest stake on bond_4 (+2). bond_0 and bond_4 still lock 10 GEN. |
| Challenger | 100 GEN | **109.5 GEN** | Staked 5 x 1 GEN and a 1 GEN contest; the 0.1 GEN refused challenge came back. Won stake + half bond on bond_1 (+3.5), stake + bond on bond_2 and bond_3 (+6, +6). |
| Contract | 0 | **10 GEN** | Exactly the two surviving bonds; nothing stranded. |

Balances read with `eth_getBalance` after the transfer transactions finalized.

### Every transaction

| # | Who | Call | GEN | Returned | Tx | Consensus | Contract |
|---|---|---|---|---|---|---|---|
| 1 | author | `post_bond("Who benefits, who pays? Distributional , "Contents: data/ - the cleaned, de-ident, "https://zenodo.org/records/23041043")` | 5 | bond_0 | [`0x7855e0a2…`](https://explorer-studio.genlayer.com/tx/0x7855e0a2f00a49e4c39868d80dad5945f90cf30400cbeeb75c4303cb908e4a97) | ACCEPTED | SUCCESS |
| 2 | author | `post_bond("DEMO statement (over-broad) for the NEV, "All materials are openly available on Z, "https://zenodo.org/records/23041043")` | 5 | bond_1 | [`0x8fb9dde0…`](https://explorer-studio.genlayer.com/tx/0x8fb9dde0796eaca3473496b346f48aba6f3659b33ae1b054a80494bfc53aee34) | ACCEPTED | SUCCESS |
| 3 | author | `post_bond("DEMO statement pointing at an unrelated, "The household survey microdata (CSV) an, "https://zenodo.org/records/1188976")` | 5 | bond_2 | [`0x91374268…`](https://explorer-studio.genlayer.com/tx/0x913742682af10e2537421675144bfc82037abd5ae46a6d1076ae2bf2e4e8c18a) | ACCEPTED | SUCCESS |
| 4 | author | `post_bond("DEMO statement promising open access to, "The germline and somatic variant call f, "https://zenodo.org/records/23050408")` | 5 | bond_3 | [`0x721ce2aa…`](https://explorer-studio.genlayer.com/tx/0x721ce2aa8e6821d52d8e071737e55b378f434e4667b5cb69216ae3a1c5eaaf2c) | ACCEPTED | SUCCESS |
| 5 | author | `post_bond("DEMO statement that honestly declares c, "Because they derive from patient sequen, "https://zenodo.org/records/23050408")` | 5 | bond_4 | [`0x715660f0…`](https://explorer-studio.genlayer.com/tx/0x715660f0c92ff7dc804d9d4c1ed3f90e41480d2548e11f5d5d01122e890eca10) | ACCEPTED | SUCCESS |
| 6 | author | `post_bond("DEMO withdrawal", "Contents: data/ - the cleaned, de-ident, "https://zenodo.org/records/23041043")` | 2 | bond_5 | [`0x39db2011…`](https://explorer-studio.genlayer.com/tx/0x39db20113bce4f92eb1f95e73db36c8ddc1497c934fcfed61303f752d8709bf4) | ACCEPTED | SUCCESS |
| 7 | author | `withdraw("bond_5")` |  |  | [`0xf679a951…`](https://explorer-studio.genlayer.com/tx/0xf679a9514cc4da69f63893c816bc834903ccfbed0614c779b8800a5025c57905) | ACCEPTED | SUCCESS |
| 8 | challenger | `challenge("bond_0", "too cheap")` | 0.1 | REFUNDED: A challenge must stake at least 500000000000000… | [`0x259fbb39…`](https://explorer-studio.genlayer.com/tx/0x259fbb3979088f6b9fd98342df403f7de918d67e4c7320b39602c00278a5bb60) | ACCEPTED | SUCCESS |
| 9 | challenger | `challenge("bond_0", "The statement is not honoured by the re)` | 1 | challenged | [`0x7724511f…`](https://explorer-studio.genlayer.com/tx/0x7724511f979fe0a19554f5b14582851918864e13db3d750718e5ed6ab11f8264) | ACCEPTED | SUCCESS |
| 10 | challenger | `challenge("bond_1", "The statement is not honoured by the re)` | 1 | challenged | [`0x0e55b659…`](https://explorer-studio.genlayer.com/tx/0x0e55b659df11f2f7384c1c30e72c49fbdc7558880ab0c6782a72559afcaf5710) | ACCEPTED | SUCCESS |
| 11 | challenger | `challenge("bond_2", "The statement is not honoured by the re)` | 1 | challenged | [`0x81afe1a7…`](https://explorer-studio.genlayer.com/tx/0x81afe1a7d12d2a611cd4d5d8c211412361a4067afeba2e7acfc5c689696c73fc) | ACCEPTED | SUCCESS |
| 12 | challenger | `challenge("bond_3", "The statement is not honoured by the re)` | 1 | challenged | [`0xa7394e1f…`](https://explorer-studio.genlayer.com/tx/0xa7394e1f38ae2202fd4548cf2cf8acac6009431740c2149218871221756e01ad) | ACCEPTED | SUCCESS |
| 13 | challenger | `challenge("bond_4", "The statement is not honoured by the re)` | 1 | challenged | [`0xf51d8dde…`](https://explorer-studio.genlayer.com/tx/0xf51d8dde8dbeedea478d6443e552eba859a6afab6296e94e63f2d59b0d8040a5) | ACCEPTED | SUCCESS |
| 14 | challenger | `adjudicate("bond_0")` |  | AVAILABLE | [`0x0fefe34e…`](https://explorer-studio.genlayer.com/tx/0x0fefe34e5bc8eac9ad5f2503c4645823858d3c285bee0a89ba01285c250b592f) | ACCEPTED | SUCCESS |
| 15 | challenger | `adjudicate("bond_1")` |  | PARTIAL | [`0x876afb7b…`](https://explorer-studio.genlayer.com/tx/0x876afb7b1ede29eee13e63cd4c985fdcfc7ea8497d68acee9afd574cbbdd055e) | ACCEPTED | SUCCESS |
| 16 | challenger | `adjudicate("bond_2")` |  | UNAVAILABLE | [`0x706d1b7c…`](https://explorer-studio.genlayer.com/tx/0x706d1b7c591de66729be6c1bcb36fa7173aede797cc36eaab95a2fb29704778e) | ACCEPTED | SUCCESS |
| 17 | challenger | `adjudicate("bond_3")` |  | UNAVAILABLE | [`0x3c779779…`](https://explorer-studio.genlayer.com/tx/0x3c779779a2d5b8a2364fe03293702ad0ebbdc8beb5988cc1ea5efd4e9c0a9618) | ACCEPTED | SUCCESS |
| 18 | challenger | `adjudicate("bond_4")` |  | AVAILABLE | [`0xa3ad16b3…`](https://explorer-studio.genlayer.com/tx/0xa3ad16b31ea9297e7d9e2258098fde3eb28b1e423f8b6bec1a3f611105f3390b) | ACCEPTED | SUCCESS |
| 19 | challenger | `contest("bond_4")` | 1 | AVAILABLE | [`0x632aac0e…`](https://explorer-studio.genlayer.com/tx/0x632aac0e65e30873663be64f5ec7eca516bf4ab1fceb01f3e3ac6c7975138810) | ACCEPTED | SUCCESS |
| 20 | challenger | `settle("bond_0")` |  | AVAILABLE | [`0xe338dfdd…`](https://explorer-studio.genlayer.com/tx/0xe338dfdd57861bf348e53f4a6ff7621605263e7c4a8e8be0dfac12ddcd135802) | ACCEPTED | SUCCESS |
| 21 | author | `settle("bond_1")` |  | PARTIAL | [`0x43d67961…`](https://explorer-studio.genlayer.com/tx/0x43d67961fb1b57cfcbc53b1130364aef2442fb2d19597047a45ee8efb576a8ba) | ACCEPTED | SUCCESS |
| 22 | author | `settle("bond_2")` |  | UNAVAILABLE | [`0x4e8da561…`](https://explorer-studio.genlayer.com/tx/0x4e8da5611b5ca7fd92adeaaf82ba79b8ad90066649705c2e041a3842294525d7) | ACCEPTED | SUCCESS |
| 23 | author | `settle("bond_3")` |  | UNAVAILABLE | [`0xe050309c…`](https://explorer-studio.genlayer.com/tx/0xe050309c71107e92ac82318911da615c8242aa9299c09b8f55303d5dd896d2b6) | ACCEPTED | SUCCESS |
| 24 | author | `settle("bond_4")` |  | AVAILABLE | [`0x98e4208f…`](https://explorer-studio.genlayer.com/tx/0x98e4208f2e7c817f74bb4816bd143e53401fc175e58dcbd6b56fcda6f0b19fc2) | ACCEPTED | SUCCESS |

## From the production UI with MetaMask

After the scripted run, the project owner's MetaMask wallet (`0x4F80B5c475fcEd34fc9A07FfCcF39E1Adc1406bf`) ran a full
challenge through https://databond-bars26.vercel.app on 2026-09-30:

| Step in the UI | Tx | Result |
|---|---|---|
| **Challenge** bond_0 with the suggested 0.5 GEN | [`0x40b335d7…`](https://explorer-studio.genlayer.com/tx/0x40b335d7b39d7a3ced991f51bec4ba4710d2f22179e58b118ed7dd2c2619c5a0) | FINALIZED, SUCCESS, returned `challenged` |
| **Adjudicate now** | [`0x8bc2d9d7…`](https://explorer-studio.genlayer.com/tx/0x8bc2d9d7be5ffd579725f1c7b50f4cc6b5691c24cf8b1687e435db216003046e) | FINALIZED, SUCCESS, ruling `AVAILABLE` |
| **Accept ruling and settle** | [`0x52aa1abd…`](https://explorer-studio.genlayer.com/tx/0x52aa1abd712c855a65fe1582d015446902a5004029ddd23898af374cf43bfb28) | FINALIZED, SUCCESS; the author's wallet went from 80.5 to **81.0 GEN** |

bond_0 is still active and now shows `defended: 2`; the contract still holds exactly the 10 GEN of the two live bonds.
The **Test GEN** button was also used from that wallet: both faucet transfers landed (`value_credited: true`).

## Two GenLayer money pitfalls this run proves are handled

1. **Wallet payouts use an external EVM transfer** (`gl.evm.contract_interface` + `emit_transfer`). With
   `gl.get_contract_at(wallet).emit_transfer` the child transaction ends `NO_MAJORITY`, `value_credited: false`, and the
   wallet gets nothing. That is what happened on the first deployment `0x3db0C3391Ca1A614F635473b7429165575EE416C`.
2. **Payable calls refuse by refunding, not by reverting.** A reverted payable call leaves its value in the contract
   (verified on `0xfCc592fcFcf0b4bDECCe66d94B9B18CAA6f6eB6e`: a reverted 1 GEN challenge left the sender at 4 GEN and the
   contract 1 GEN richer). Here the refused 0.1 GEN challenge was returned.

## Try it from the live UI

| # | In the UI | Check independently |
|---|---|---|
| 1 | Open the app, expand **bond_0** and **bond_1**: statement, repository file count, ruling, on-chain history with payouts | `genlayer call 0x3f0A10DE7cF2e4E6ad5874772dF197FD45e4B4BF get_bond --args bond_1` |
| 2 | **Integrator check**: `bond_0` → `is_backed → true`; `bond_2` → `false` | `genlayer call 0x3f0A10DE7cF2e4E6ad5874772dF197FD45e4B4BF is_backed --args bond_0` |
| 3 | Connect MetaMask on GenLayer Studio, click **Test GEN** (Studio faucet, 50 GEN) | `eth_getBalance` on your address |
| 4 | Expand **bond_0** (active, not yours), keep the suggested 0.5 GEN stake and **Challenge** | Transactions panel: hash, ACCEPTED, contract result SUCCESS |
| 5 | **Adjudicate now** (about a minute of validator work) | `get_bond` shows `state: ruled` and the verdict |
| 6 | If the ruling is AVAILABLE you lost: **Accept ruling and settle** (or **Contest** once) | The author's wallet receives your stake once the transfer finalizes |
| 7 | **Post a bond** on any Zenodo record with its real statement | `list_bonds_by_owner` with your address |
