#!/usr/bin/env bash
# PreToolUse guard: refuses edits to files that must never be written by hand.
#
# - .backlog/**  task, draft, document, decision and milestone markdown is owned
#   by the `backlog` CLI; editing it directly desynchronises metadata and history.
# - .env*        secrets, except the committed .env.example template.
#
# Exit 2 blocks the tool call and shows stderr to Claude.
set -euo pipefail

path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
[ -n "$path" ] || exit 0

case "$path" in
  */.env.example|.env.example) exit 0 ;;
esac

case "$path" in
  */.backlog/*|.backlog/*)
    echo "Blocked: $path is owned by the backlog CLI. Use \`backlog\` commands so metadata, relationships and history stay consistent." >&2
    exit 2
    ;;
  */.env|.env|*/.env.*|.env.*)
    echo "Blocked: $path holds secrets and is never edited by Claude. Ask the user to change it, or run \`vercel env pull\`." >&2
    exit 2
    ;;
esac

exit 0
