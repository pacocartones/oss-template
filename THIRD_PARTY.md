# Third-party notices

## Adopted files

These files are copied from `templates/` in pacocartones/dasousa-contributors-strategy (standards v2) at commit 6caf476. Each one names its source in its first lines. Read on 2026-11-27 at the commit given; modified only where the standard's decisions require.

| File | Source and revision | Licence | Change |
|---|---|---|---|
| `GOVERNANCE.md`, `MAINTAINERS.md` | [cncf/project-template](https://github.com/cncf/project-template) `GOVERNANCE-maintainer.md`, `MAINTAINERS.md` @ `e66ba44` | Apache-2.0 (`LICENSES/Apache-2.0.txt`) | Trimmed for one maintainer: council, voting, meetings, CNCF resources and affiliations removed; scope column added. Here, GOVERNANCE.md also links to the inherited Code of Conduct in pacocartones/.github. |
| `.github/workflows/scorecard.yml`, `.github/actionlint.yaml` | [ossf/scorecard-action](https://github.com/ossf/scorecard-action) `examples/scorecard.yml` @ `df56f2d` (2026-11-24), as adopted in standards v2; copied from pacocartones/.github @ `e20cca0`, which pins `github/codeql-action/upload-sarif` to v4.39.4 (its `codeql.yml` version) and adds `.github/actionlint.yaml` | Apache-2.0 (`LICENSES/Apache-2.0.txt`; its header names the standard's path `templates/LICENSES/Apache-2.0.txt`) | `scorecard.yml` unchanged from pacocartones/.github (`scripts/upstream.test.mjs` compares them). `actionlint.yaml`: first comment line rewritten, since no workflow here runs actionlint; it accepts only the `cache-mode` key in `scorecard.yml`, which actionlint v1.7.12 does not know yet. |
| `AI_POLICY.md` | Own text; the policies and page they link to informed them. No text copied: those policies state no licence. | — | — |

The issue forms and `CODE_OF_CONDUCT.md` are no longer copied here: repositories inherit them from pacocartones/.github, whose `THIRD_PARTY.md` lists their sources and notices. A repository that copies the forms (`scripts/bootstrap.sh --own-forms`) copies their rows and the vitejs/vite notice from there too.

Not copied, only linked: `github/.github` (no licence), the projects' AI policies (no licence), and CC BY-SA guides other than the Contributor Covenant.
