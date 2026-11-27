#!/usr/bin/env bash
# Set up a repository created with "Use this template". Run it once from the new clone,
# and again whenever you like: every step converges to the same state (idempotent).
#
# Usage: scripts/bootstrap.sh [--dry-run] [--repo owner/name] [--prune-labels] [--bot-app-id ID]
#   --dry-run       print what would change; read-only calls only
#   --repo          target repository (default: the current clone's GitHub repository)
#   --prune-labels  delete labels missing from .github/labels.tsv, but only those on no issue or PR
#   --bot-app-id    numeric id of a GitHub App allowed to bypass the "main merge gate" ruleset
#                   (never "main integrity")
#
# Steps:
#   1. rewrite the template's own name in .github/ISSUE_TEMPLATE/config.yml and package*.json
#   2. sync labels from .github/labels.tsv
#   3. create or update the rulesets "main integrity" and "main merge gate"
#   4. enable private vulnerability reporting, secret scanning, push protection,
#      Dependabot alerts and security updates, where the plan allows
#   5. print the steps that stay manual
#
# Needs: gh (authenticated, admin on the repository), jq, git.
# Exit: 0 done, 1 a step failed or needs a person (see the output), 2 usage error.
set -uo pipefail

TEMPLATE_REPO="pacocartones/oss-template"
root="$(cd "$(dirname "$0")/.." && pwd)"
dry=0; repo=""; prune=0; bot_app_id=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry=1 ;;
    --repo) repo="${2:-}"; shift ;;
    --prune-labels) prune=1 ;;
    --bot-app-id) bot_app_id="${2:-}"; shift ;;
    -h|--help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done
for tool in gh jq git; do command -v "$tool" >/dev/null || { echo "missing: $tool" >&2; exit 2; }; done
[ -z "$bot_app_id" ] || [[ "$bot_app_id" =~ ^[0-9]+$ ]] || { echo "--bot-app-id must be numeric" >&2; exit 2; }
if [ -z "$repo" ]; then
  repo="$(cd "$root" && gh repo view --json nameWithOwner --jq .nameWithOwner)" || { echo "cannot detect the repository; pass --repo owner/name" >&2; exit 2; }
fi
[[ "$repo" =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]] || { echo "bad repository name: $repo" >&2; exit 2; }

status=0
manual=()
say() { printf '%s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*"; status=1; }
# do_it <description> <command...>: run it, or only print it with --dry-run.
# The command reads $DO_INPUT on stdin (empty by default), never the caller's stdin:
# inside the label loop that is .github/labels.tsv. Pass a request body as
# DO_INPUT="$body" do_it ...
do_it() {
  local what="$1"; shift
  if [ "$dry" -eq 1 ]; then say "plan  $what"; return 0; fi
  if "$@" <<<"${DO_INPUT:-}" >/dev/null; then say "done  $what"; else warn "failed: $what"; return 1; fi
}

say "Repository: $repo$([ "$dry" -eq 1 ] && echo ' (dry run: nothing changes)')"

# 1. Template name ------------------------------------------------------------
say ""; say "== 1. Template name"
if [ "$repo" = "$TEMPLATE_REPO" ]; then
  say "skip  this is the template itself"
else
  name="${repo#*/}"
  changed=0
  for f in .github/ISSUE_TEMPLATE/config.yml package.json package-lock.json; do
    p="$root/$f"
    [ -f "$p" ] || continue
    if grep -qF "$TEMPLATE_REPO" "$p" || grep -q '"name": "oss-template"' "$p"; then
      changed=1
      do_it "rewrite the template name in $f" sed -i.bak -e "s#$TEMPLATE_REPO#$repo#g" -e "s#\"name\": \"oss-template\"#\"name\": \"$name\"#g" "$p" \
        && rm -f "$p.bak"
    fi
  done
  [ "$changed" -eq 0 ] && say "ok    already rewritten"
  [ "$changed" -eq 1 ] && manual+=("Commit the rewritten files (git diff) in a pull request.")
fi

# 2. Labels -------------------------------------------------------------------
say ""; say "== 2. Labels from .github/labels.tsv"
if current="$(gh label list --repo "$repo" --limit 500 --json name,color,description)"; then
  wanted=""
  while IFS=$'\t' read -r lname color desc; do
    case "$lname" in ''|'#'*) continue ;; esac
    wanted+="${lname,,}"$'\n'
    have="$(jq -c --arg n "$lname" '.[] | select((.name | ascii_downcase) == ($n | ascii_downcase))' <<<"$current")"
    if [ -n "$have" ] && [ "$(jq -r '.name' <<<"$have")" = "$lname" ] \
       && [ "$(jq -r '.color | ascii_downcase' <<<"$have")" = "${color,,}" ] \
       && [ "$(jq -r '.description' <<<"$have")" = "$desc" ]; then
      say "ok    $lname"
    else
      do_it "$([ -n "$have" ] && echo update || echo create) label '$lname'" \
        gh label create "$lname" --repo "$repo" --color "$color" --description "$desc" --force
    fi
  done < "$root/.github/labels.tsv"
  while IFS= read -r extra; do
    [ -n "$extra" ] || continue
    grep -qxF -- "${extra,,}" <<<"$wanted" && continue
    used="$(gh search issues --repo "$repo" --label "$extra" --include-prs --limit 5 --json number --jq '[.[].number | "#\(.)"] | join(" ")' 2>/dev/null)" \
      || { warn "label '$extra': cannot check where it is used; left alone"; continue; }
    if [ -n "$used" ]; then
      say "keep  '$extra' is outside the standard and on $used; move those items, then delete it by hand"
    elif [ "$prune" -eq 1 ]; then
      do_it "delete unused label '$extra'" gh label delete "$extra" --repo "$repo" --yes
    else
      say "extra '$extra' is outside the standard and unused (rerun with --prune-labels to delete)"
    fi
  done < <(jq -r '.[].name' <<<"$current")
else
  warn "cannot list labels"
fi

# 3. Rulesets -----------------------------------------------------------------
say ""; say "== 3. Rulesets on the default branch"
# Required checks are "<caller job id> / <reusable job name>" for the jobs that call
# pacocartones/.github, and the job name for a job of its own. This list is their single
# source; scripts/bootstrap.test.mjs fails when it misses a pull request job of .github/workflows/.
codeql_lang="$(sed -n 's/^ *language: *//p' "$root/.github/workflows/codeql.yml" | head -n 1)"
required_checks=("verify / Verify" "commit-policy / Commit policy" "PR description" "codeql / Analyze (${codeql_lang:-javascript-typescript})")

integrity="$(jq -n '{
  name: "main integrity", target: "branch", enforcement: "active", bypass_actors: [],
  conditions: {ref_name: {include: ["~DEFAULT_BRANCH"], exclude: []}},
  rules: [{type: "deletion"}, {type: "non_fast_forward"}]
}')"
merge_gate="$(jq -n --arg app "$bot_app_id" '$ARGS.positional as $checks | {
  name: "main merge gate", target: "branch", enforcement: "active",
  bypass_actors: (if $app == "" then [] else [{actor_id: ($app | tonumber), actor_type: "Integration", bypass_mode: "always"}] end),
  conditions: {ref_name: {include: ["~DEFAULT_BRANCH"], exclude: []}},
  rules: [
    {type: "pull_request", parameters: {
      required_approving_review_count: 0, dismiss_stale_reviews_on_push: false,
      require_code_owner_review: false, require_last_push_approval: false,
      required_review_thread_resolution: true}},
    {type: "required_status_checks", parameters: {
      strict_required_status_checks_policy: false,
      required_status_checks: [$checks[] | {context: .}]}}
  ]
}' --args "${required_checks[@]}")"

if existing="$(gh api "repos/$repo/rulesets?includes_parents=false" 2>/dev/null)"; then
  for body in "$integrity" "$merge_gate"; do
    rname="$(jq -r .name <<<"$body")"
    id="$(jq -r --arg n "$rname" '[.[] | select(.name == $n)][0].id // empty' <<<"$existing")"
    if [ -n "$id" ]; then
      DO_INPUT="$body" do_it "update ruleset '$rname' (id $id)" gh api -X PUT "repos/$repo/rulesets/$id" --input -
    else
      DO_INPUT="$body" do_it "create ruleset '$rname'" gh api -X POST "repos/$repo/rulesets" --input -
    fi
  done
  say "      required checks: $(printf '"%s" ' "${required_checks[@]}")"
else
  warn "rulesets are not available here (a private repository may need a paid plan)"
  manual+=("Protect the default branch by hand: no deletion or force push for anyone; pull request, conversation resolution and the checks $(printf '"%s" ' "${required_checks[@]}")before merging.")
fi

# 4. Security features --------------------------------------------------------
say ""; say "== 4. Security features"
security() { # <description> <method> <endpoint> [json body]
  local what="$1" method="$2" endpoint="$3" body="${4:-}"
  if [ "$dry" -eq 1 ]; then say "plan  enable $what"; return; fi
  local args=(api -X "$method" "$endpoint")
  [ -n "$body" ] && args+=(--input -)
  if gh "${args[@]}" <<<"$body" >/dev/null 2>&1; then
    say "done  $what enabled"
  else
    say "skip  $what is not available for this repository or plan"
    manual+=("Enable $what in Settings > Advanced Security if your plan offers it.")
  fi
}
security "private vulnerability reporting (SECURITY.md relies on it)" PUT "repos/$repo/private-vulnerability-reporting"
security "secret scanning" PATCH "repos/$repo" '{"security_and_analysis":{"secret_scanning":{"status":"enabled"}}}'
security "secret scanning push protection" PATCH "repos/$repo" '{"security_and_analysis":{"secret_scanning_push_protection":{"status":"enabled"}}}'
security "Dependabot alerts" PUT "repos/$repo/vulnerability-alerts"
security "Dependabot security updates" PUT "repos/$repo/automated-security-fixes"

# 5. Manual steps -------------------------------------------------------------
say ""; say "== 5. Remaining manual steps"
sha="$(git ls-remote https://github.com/pacocartones/.github refs/heads/main 2>/dev/null | cut -f1)"
pinned="$(sed -n 's#^ *uses: pacocartones/\.github/\.github/workflows/[^@]*@\([0-9a-f]\{40\}\).*#\1#p' "$root"/.github/workflows/*.yml | sort -u | tr '\n' ' ')"
if [ -n "$sha" ] && [ "${pinned% }" = "$sha" ]; then
  say "ok    the reusable workflows are pinned to pacocartones/.github main ($sha)"
else
  manual+=("The reusable workflows in .github/workflows/*.yml are pinned to ${pinned:-no SHA }and pacocartones/.github main is ${sha:-unknown (cannot reach it)}; move the pin in a pull request when they differ (see the comment at the top of each file).")
fi
manual+=(
  "Replace README.md with the project's own, and set the repository description and topics."
  "List the maintainers in GOVERNANCE.md, and set the CodeQL language in .github/workflows/codeql.yml (then rerun this script, which reads it)."
  "Add the project's real checks to package.json: extend \"test\" (keep the template's scripts/*.test.mjs) and \"check\"."
  "Settings > Actions > General: workflow permissions 'Read repository contents', and leave 'Allow GitHub Actions to create and approve pull requests' off."
  "Settings > Advanced Security: keep CodeQL 'Default setup' off; the codeql.yml workflow is the advanced setup."
  "Settings > General: allow squash merging only, and 'Automatically delete head branches'."
  "If the shared bot App should work here, install it on this repository; rerun with --bot-app-id ID only if it must push to the default branch."
)
i=1; for step in "${manual[@]}"; do say "$i. $step"; i=$((i + 1)); done

[ "$dry" -eq 1 ] && say "" && say "Dry run: nothing changed."
exit "$status"
