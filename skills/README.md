# A2PCheck skill for coding agents

The [skill](a2pcheck/SKILL.md) and its [three references](a2pcheck/references/) help an agent review an A2P 10DLC campaign draft using hosted A2PCheck. This is not a local/offline scanner, a provider registration tool, or an approval guarantee.

Read all four files before enabling them. The skill permits an anonymous Basic request within usage limits; authenticated Basic costs one credit and Full costs two. It requires human approval before spending credits, and forbids fabricated consent, subscriber data, credentials in campaign JSON, and automatic paid retry loops.

## Install from a reviewed clone

From the root of this repository, run the following in a shell after reviewing the files. It copies only the skill and its references into the generic/Codex-style skill directory. It refuses to overwrite an existing file, folder, or symlink; choose a new `SKILL_DIR` instead of deleting an existing installation.

<!-- install-from-clone:start -->
```sh
set -eu
skill_dir="${SKILL_DIR:-$HOME/.agents/skills/a2pcheck}"
if [ -e "$skill_dir" ] || [ -L "$skill_dir" ]; then
  printf '%s\n' "Choose an empty SKILL_DIR; the destination already exists." >&2
  exit 1
fi
mkdir -p "$(dirname "$skill_dir")"
mkdir "$skill_dir"
cp -R skills/a2pcheck/. "$skill_dir/"
printf '%s\n' "Copied to $skill_dir. Review the files before enabling the skill."
```
<!-- install-from-clone:end -->

For Claude Code, set `SKILL_DIR="$HOME/.claude/skills/a2pcheck"` with `export` before running the same block. Restart or reload your agent as its own documentation requires; copying files does not itself enable the skill or call the API.

No clone? The [agent guide](https://www.a2pcheck.com/agents) has a four-file HTTP download command and complete request examples. Do not paste an API key into a command, chat, campaign file, or git.

## Ownership and refreshes

This is a version **0.2.0** snapshot of the already-public generic skill. Its canonical downloads are:

- https://www.a2pcheck.com/skill/SKILL.md
- https://www.a2pcheck.com/skill/references/campaign-schema.md
- https://www.a2pcheck.com/skill/references/example-campaign.json
- https://www.a2pcheck.com/skill/references/remediation-workflow.md

The canonical skill is maintained with the hosted app. Make changes there first, then refresh these four files together in a separate scanner-repo PR and update [the snapshot checksums](public-skill.sha256). Keep relative reference paths intact. Never copy private agent/harness instructions, environment files, or account-specific variants into this directory.

This is a manual distribution snapshot: it is not a runtime dependency between repositories, an automatic update channel, or a claim of registry inclusion. Maintainers must compare all four files with the canonical public downloads before a refresh is merged. Checksums prove the reviewed snapshot is unchanged; they do not prove it is the newest hosted version.

The GitHub-hosted verification job checks the snapshot and executes the installation block in temporary directories, including refusal to overwrite an installation. It does not call the scan API or spend credits.
