#!/usr/bin/env bash
# PostToolUse: lints a just-edited module file so an architecture boundary
# violation surfaces in the same turn instead of in CI.
#
# Scoped to the files the `boundaries` rules actually govern — module layers in
# apps/web and apps/api, and the package sources — so ordinary test or config
# edits pay nothing. Husky already handles formatting at commit time; this is
# only about the rules husky cannot fix automatically.
set -uo pipefail

repo=${CLAUDE_PROJECT_DIR:-$(pwd)}
path=$(jq -r '.tool_input.file_path // empty')
[ -n "$path" ] || exit 0

case "$path" in
  *apps/web/src/modules/*|*apps/web/src/shared/*|*apps/web/src/app/*) ;;
  *apps/api/src/modules/*|*apps/api/src/shared/*) ;;
  *packages/domain/src/*|*packages/contracts/src/*|*packages/ui/src/*) ;;
  *) exit 0 ;;
esac

case "$path" in
  *.ts|*.vue|*.js) ;;
  *) exit 0 ;;
esac

# The MODULE_TYPELESS_PACKAGE_JSON notice from eslint.config.js is noise.
if output=$(cd "$repo" && bunx eslint "$path" 2>&1); then exit 0; fi
output=$(echo "$output" | grep -vE "MODULE_TYPELESS_PACKAGE_JSON|Reparsing as ES module|add \"type\": \"module\"|trace-warnings")

echo "eslint on $path:" >&2
echo "$output" >&2
exit 2
