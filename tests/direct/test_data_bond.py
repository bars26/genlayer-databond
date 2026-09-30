"""Direct-mode tests for the DataBond contract."""

import json

import pytest

CONTRACT_PATH = "contracts/data_bond.py"

GEN = 10**18
ZENODO_URL = "https://zenodo.org/records/1234567"
ZENODO_API_RE = r"^https://zenodo\.org/api/records/1234567$"
STATEMENT = (
    "The raw survey responses (CSV) and the R scripts used for every analysis in the paper are "
    "openly available on Zenodo under a CC-BY 4.0 license."
)
PAPER = "Doe et al. (2026) Commuting and wellbeing, doi:10.1234/example"


def _zenodo(files=None, access="open"):
    if files is None:
        files = [
            {"key": "survey_responses.csv", "size": 482113},
            {"key": "analysis.R", "size": 9120},
            {"key": "README.md", "size": 2048},
        ]
    return {
        "id": 1234567,
        "metadata": {
            "title": "Replication package: Commuting and wellbeing",
            "access_right": access,
            "license": {"id": "cc-by-4.0"},
            "description": "<p>Survey data and R code.</p>",
        },
        "files": files,
    }


def _mock_json(direct_vm, pattern, body, status=200):
    direct_vm.mock_web(
        pattern,
        {
            "method": "GET",
            "response": {
                "status": status,
                "headers": {"Content-Type": b"application/json"},
                "body": json.dumps(body).encode("utf-8") if body is not None else b"not found",
            },
        },
    )


def _setup(direct_vm, record=None, status=200, verdict="AVAILABLE"):
    direct_vm.clear_mocks()
    _mock_json(direct_vm, ZENODO_API_RE, _zenodo() if record is None else record, status)
    direct_vm.mock_llm(r".*", json.dumps({"verdict": verdict}))


def _post(direct_vm, direct_deploy, owner, amount=10 * GEN, **setup):
    direct_vm.sender = owner
    contract = direct_deploy(CONTRACT_PATH)
    _setup(direct_vm, **setup)
    direct_vm.value = amount
    bond_id = contract.post_bond(PAPER, STATEMENT, ZENODO_URL)
    direct_vm.value = 0
    return contract, bond_id


def _challenge(direct_vm, contract, bond_id, challenger, stake=2 * GEN):
    direct_vm.sender = challenger
    direct_vm.value = stake
    contract.challenge(bond_id, "The data are only 'available on request'.")
    direct_vm.value = 0


def _ruled(direct_vm, direct_deploy, owner, challenger, verdict, record=None, status=200):
    contract, bond_id = _post(direct_vm, direct_deploy, owner)
    _challenge(direct_vm, contract, bond_id, challenger)
    _setup(direct_vm, record=record, status=status, verdict=verdict)
    direct_vm.sender = challenger
    contract.adjudicate(bond_id)
    return contract, bond_id


def _expire_window(contract, bond_id):
    contract.bonds[bond_id].ruled_at = "2000-01-01T00:00:00+00:00"


# --- posting ----------------------------------------------------------------


def test_post_bond_locks_gen_and_probes_the_repository(direct_vm, direct_deploy, direct_alice):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)

    bond = contract.get_bond(bond_id)
    assert bond_id == "bond_0"
    assert bond.state == "active"
    assert int(bond.amount) == 10 * GEN
    assert bond.source == "zenodo"
    assert json.loads(bond.evidence_json) == {
        "file_count": 3, "open": True, "reachable": True, "total_bytes": 493281,
    }
    assert contract.get_stats()["total_bonded"] == str(10 * GEN)
    assert contract.is_backed(bond_id) is True
    assert [e["event"] for e in contract.get_history(bond_id)] == ["posted"]


def test_post_bond_requires_at_least_one_gen(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT_PATH)
    _setup(direct_vm)
    direct_vm.value = GEN - 1
    with direct_vm.expect_revert("A bond must be at least 1 GEN"):
        contract.post_bond(PAPER, STATEMENT, ZENODO_URL)


def test_post_bond_rejects_unsupported_repositories(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.value = 5 * GEN
    for url in ("https://example.com/data", "http://zenodo.org/records/1", "https://osf.io/abcde"):
        with direct_vm.expect_revert("repository must be a Zenodo record"):
            contract.post_bond(PAPER, STATEMENT, url)


def test_post_bond_validates_the_statement(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.value = 5 * GEN
    with direct_vm.expect_revert("statement must be the paper's data-availability statement"):
        contract.post_bond(PAPER, "data on zenodo", ZENODO_URL)
    with direct_vm.expect_revert("paper must be a title or DOI"):
        contract.post_bond("", STATEMENT, ZENODO_URL)


def test_post_bond_refuses_a_repository_that_does_not_resolve(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT_PATH)
    _setup(direct_vm, record=None, status=404)
    direct_vm.clear_mocks()
    _mock_json(direct_vm, ZENODO_API_RE, None, status=404)
    direct_vm.value = 5 * GEN
    with direct_vm.expect_revert("Could not load the repository from its public API"):
        contract.post_bond(PAPER, STATEMENT, ZENODO_URL)
    assert contract.list_bonds() == []


def test_repository_url_forms(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.value = 5 * GEN

    direct_vm.clear_mocks()
    _mock_json(direct_vm, ZENODO_API_RE, _zenodo())
    direct_vm.mock_llm(r".*", '{"verdict": "AVAILABLE"}')
    contract.post_bond(PAPER, STATEMENT, "https://doi.org/10.5281/zenodo.1234567")

    direct_vm.clear_mocks()
    _mock_json(
        direct_vm,
        r"^https://api\.figshare\.com/v2/articles/5616445$",
        {"title": "Data", "files": [{"name": "data.csv", "size": 10}], "is_embargoed": False,
         "license": {"name": "CC BY 4.0"}, "description": "x"},
    )
    direct_vm.mock_llm(r".*", '{"verdict": "AVAILABLE"}')
    contract.post_bond(PAPER, STATEMENT, "https://figshare.com/articles/dataset/Some_title/5616445/2")

    direct_vm.clear_mocks()
    _mock_json(direct_vm, r"^https://api\.github\.com/repos/acme/paper-code$",
               {"full_name": "acme/paper-code", "default_branch": "main", "private": False,
                "license": {"spdx_id": "MIT"}, "description": "Code"})
    _mock_json(direct_vm, r"^https://api\.github\.com/repos/acme/paper-code/git/trees/main\?recursive=1$",
               {"tree": [{"path": "analysis.R", "type": "blob", "size": 100},
                         {"path": "data", "type": "tree"},
                         {"path": "data/raw.csv", "type": "blob", "size": 5000}]})
    direct_vm.mock_llm(r".*", '{"verdict": "AVAILABLE"}')
    bond_id = contract.post_bond(PAPER, STATEMENT, "https://github.com/acme/paper-code")

    sources = [contract.get_bond(b).source for b in contract.list_bonds()]
    assert sources == ["zenodo", "figshare", "github"]
    assert json.loads(contract.get_bond(bond_id).evidence_json)["file_count"] == 2


# --- challenging --------------------------------------------------------------


def test_challenge_requires_ten_percent_stake(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    direct_vm.value = GEN - 1  # bond is 10 GEN, so 1 GEN is needed
    with direct_vm.expect_revert("A challenge must stake at least"):
        contract.challenge(bond_id, "missing data")


def test_owner_cannot_challenge_own_bond(direct_vm, direct_deploy, direct_alice):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_alice
    direct_vm.value = 2 * GEN
    with direct_vm.expect_revert("The bond owner cannot challenge their own bond"):
        contract.challenge(bond_id, "self")


def test_challenge_blocks_a_second_challenger(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    _challenge(direct_vm, contract, bond_id, direct_bob)
    assert contract.get_bond(bond_id).state == "challenged"
    direct_vm.sender = direct_charlie
    direct_vm.value = 2 * GEN
    with direct_vm.expect_revert("Only an active bond can be challenged"):
        contract.challenge(bond_id, "me too")


# --- adjudication -------------------------------------------------------------


def test_adjudicate_requires_a_challenge(direct_vm, direct_deploy, direct_alice):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    with direct_vm.expect_revert("Only a challenged bond can be adjudicated"):
        contract.adjudicate(bond_id)


@pytest.mark.parametrize("verdict", ["AVAILABLE", "PARTIAL", "UNAVAILABLE"])
def test_llm_verdicts_are_recorded(direct_vm, direct_deploy, direct_alice, direct_bob, verdict):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, verdict)
    bond = contract.get_bond(bond_id)
    assert bond.state == "ruled"
    assert bond.verdict == verdict
    assert bond.verdict_code == "judged"


def test_deleted_record_is_unavailable_without_asking_a_model(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    _challenge(direct_vm, contract, bond_id, direct_bob)
    direct_vm.clear_mocks()
    _mock_json(direct_vm, ZENODO_API_RE, None, status=410)
    direct_vm.mock_llm(r".*", '{"verdict": "AVAILABLE"}')  # must be ignored
    contract.adjudicate(bond_id)
    bond = contract.get_bond(bond_id)
    assert (bond.verdict, bond.verdict_code) == ("UNAVAILABLE", "gone")


@pytest.mark.parametrize("verdict", ["AVAILABLE", "UNAVAILABLE"])
def test_restricted_record_is_judged_against_the_statement(direct_vm, direct_deploy, direct_alice, direct_bob, verdict):
    # Controlled access is legitimate when the statement says so, so a restricted
    # record goes to the model with its access status instead of failing mechanically.
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, verdict,
                               record=_zenodo(files=[], access="restricted"))
    bond = contract.get_bond(bond_id)
    assert (bond.verdict, bond.verdict_code) == (verdict, "judged")
    assert json.loads(bond.evidence_json)["open"] is False


def test_record_without_files_is_unavailable(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "AVAILABLE",
                               record=_zenodo(files=[]))
    bond = contract.get_bond(bond_id)
    assert (bond.verdict, bond.verdict_code) == ("UNAVAILABLE", "empty")


def test_non_enum_llm_verdict_reverts(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    _challenge(direct_vm, contract, bond_id, direct_bob)
    _setup(direct_vm, verdict="probably fine")
    with direct_vm.expect_revert("LLM verdict must be one of AVAILABLE, PARTIAL, UNAVAILABLE"):
        contract.adjudicate(bond_id)
    assert contract.get_bond(bond_id).state == "challenged"


# --- settlement ---------------------------------------------------------------


def test_settle_waits_for_the_contest_window(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "UNAVAILABLE")
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("The contest window is still open"):
        contract.settle(bond_id)
    direct_vm.sender = direct_bob  # the winner cannot rush it either
    with direct_vm.expect_revert("The contest window is still open"):
        contract.settle(bond_id)


def test_losing_side_can_waive_and_settle_early(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "UNAVAILABLE")
    direct_vm.sender = direct_alice  # the owner lost and accepts the ruling
    assert contract.settle(bond_id) == "UNAVAILABLE"
    bond = contract.get_bond(bond_id)
    assert bond.state == "closed"
    assert int(bond.amount) == 0
    assert contract.get_stats()["total_bonded"] == "0"
    assert contract.is_backed(bond_id) is False
    settled = contract.get_history(bond_id)[-1]
    assert settled["event"] == "settled"
    assert settled["challenger_paid"] == str(12 * GEN)  # 2 GEN stake back + 10 GEN bond
    assert settled["owner_paid"] == "0"


def test_available_ruling_keeps_the_bond_alive(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "AVAILABLE")
    _expire_window(contract, bond_id)
    direct_vm.sender = direct_charlie  # anyone can settle after the window
    contract.settle(bond_id)
    bond = contract.get_bond(bond_id)
    assert bond.state == "active"
    assert int(bond.defended) == 1
    assert int(bond.amount) == 10 * GEN
    assert int(bond.challenge_stake) == 0
    assert contract.get_history(bond_id)[-1]["owner_paid"] == str(2 * GEN)
    assert contract.is_backed(bond_id) is True
    _challenge(direct_vm, contract, bond_id, direct_charlie)  # open to the next challenger


def test_partial_ruling_splits_the_bond(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "PARTIAL")
    _expire_window(contract, bond_id)
    contract.settle(bond_id)
    settled = contract.get_history(bond_id)[-1]
    assert settled["challenger_paid"] == str(2 * GEN + 5 * GEN)
    assert settled["owner_paid"] == str(5 * GEN)
    assert contract.get_bond(bond_id).state == "closed"


# --- contesting ---------------------------------------------------------------


def test_contest_rules(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "AVAILABLE")
    direct_vm.value = 2 * GEN
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("The owner cannot contest a ruling in their favour"):
        contract.contest(bond_id)
    direct_vm.sender = direct_charlie
    with direct_vm.expect_revert("Only the bond owner or the challenger can contest"):
        contract.contest(bond_id)
    direct_vm.sender = direct_bob
    direct_vm.value = GEN
    with direct_vm.expect_revert("A contest must stake at least as much as the challenge"):
        contract.contest(bond_id)


def test_successful_contest_flips_the_payout(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "AVAILABLE")
    _setup(direct_vm, verdict="UNAVAILABLE")
    direct_vm.sender = direct_bob
    direct_vm.value = 2 * GEN
    assert contract.contest(bond_id) == "UNAVAILABLE"
    direct_vm.value = 0
    bond = contract.get_bond(bond_id)
    assert bond.contested is True and bond.contest_succeeded is True
    contract.settle(bond_id)  # no window left after a contest
    settled = contract.get_history(bond_id)[-1]
    assert settled["challenger_paid"] == str(2 * GEN + 10 * GEN + 2 * GEN)
    assert settled["owner_paid"] == "0"


def test_failed_contest_forfeits_the_contest_stake(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "UNAVAILABLE")
    _setup(direct_vm, verdict="UNAVAILABLE")
    direct_vm.sender = direct_alice
    direct_vm.value = 2 * GEN
    contract.contest(bond_id)
    direct_vm.value = 0
    assert contract.get_bond(bond_id).contest_succeeded is False
    with direct_vm.expect_revert("A ruling can only be contested once"):
        direct_vm.value = 2 * GEN
        contract.contest(bond_id)
    direct_vm.value = 0
    contract.settle(bond_id)
    settled = contract.get_history(bond_id)[-1]
    assert settled["challenger_paid"] == str(2 * GEN + 10 * GEN + 2 * GEN)


def test_contest_window_closes(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _ruled(direct_vm, direct_deploy, direct_alice, direct_bob, "UNAVAILABLE")
    _expire_window(contract, bond_id)
    direct_vm.sender = direct_alice
    direct_vm.value = 2 * GEN
    with direct_vm.expect_revert("The contest window has closed"):
        contract.contest(bond_id)


# --- withdrawal ---------------------------------------------------------------


def test_owner_can_withdraw_an_unchallenged_bond(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("Only the bond owner can withdraw it"):
        contract.withdraw(bond_id)
    direct_vm.sender = direct_alice
    contract.withdraw(bond_id)
    bond = contract.get_bond(bond_id)
    assert bond.state == "closed" and int(bond.amount) == 0
    assert contract.is_backed(bond_id) is False


def test_cannot_withdraw_while_challenged(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    _challenge(direct_vm, contract, bond_id, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("Only an active, unchallenged bond can be withdrawn"):
        contract.withdraw(bond_id)


def test_views(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract, bond_id = _post(direct_vm, direct_deploy, direct_alice)
    assert contract.list_bonds() == ["bond_0"]
    from tests.direct.conftest import to_hex

    assert contract.list_bonds_by_owner(to_hex(direct_alice)) == ["bond_0"]
    assert contract.list_bonds_by_owner(to_hex(direct_bob)) == []
    assert contract.contest_window_seconds() == 600
    with direct_vm.expect_revert("No bond with id bond_9"):
        contract.get_bond("bond_9")
