#!/usr/bin/env bash
# Bibliography sync -- copies new or changed book files (data/books/*.yaml)
# from this repo to every other repo in ALL_REPOS, one commit per repo.
#
# Deletions are deliberately NOT copied: a book removed here may still be
# cited on another site, and deleting it there would silently drop it from
# that post's bibliography. Remove a book by hand in each repo if needed.
#
# Run by .github/workflows/sync-books.yml. Needs the BOOK_SYNC_TOKEN secret:
# a fine-grained GitHub token with Contents: read & write on all four repos.
set -euo pipefail

ALL_REPOS="evenlater/evenlater-shared evenlater/stages-and-screens evenlater/ideational-evolution evenlater/septimus-carr"

: "${GH_TOKEN:?The BOOK_SYNC_TOKEN secret is not set in this repo}"
SELF="$GITHUB_REPOSITORY"
ZERO=0000000000000000000000000000000000000000

# Which files to send: everything on a manual run (or a first push),
# otherwise only the book files added/changed/renamed by this push.
if [[ -z "${BEFORE:-}" || "$BEFORE" == "$ZERO" ]] || ! git cat-file -e "$BEFORE^{commit}" 2>/dev/null; then
  mapfile -t FILES < <(git ls-files 'data/books/*.yaml')
  why="full sync"
else
  mapfile -t FILES < <(git diff --name-only --diff-filter=AMR "$BEFORE" "$GITHUB_SHA" -- 'data/books/*.yaml')
  why="changes in ${GITHUB_SHA:0:7}"
fi

if (( ${#FILES[@]} == 0 )); then echo "No book files changed; nothing to sync."; exit 0; fi
printf 'Syncing %d book file(s):\n' "${#FILES[@]}"; printf '  %s\n' "${FILES[@]}"

SRC="$PWD"; WORK="$(mktemp -d)"; failed=0
for repo in $ALL_REPOS; do
  [[ "$repo" == "$SELF" ]] && continue
  dir="$WORK/${repo#*/}"
  echo "::group::$repo"
  if git clone -q --filter=blob:none "https://x-access-token:${GH_TOKEN}@github.com/${repo}.git" "$dir"; then
    for f in "${FILES[@]}"; do mkdir -p "$dir/$(dirname "$f")"; cp "$SRC/$f" "$dir/$f"; done
    (
      cd "$dir"
      git add data/books
      if git diff --cached --quiet; then echo "Already up to date."; exit 0; fi
      # The [book-sync] prefix is what stops the receiving repo from
      # syncing these files straight back (see the workflow's `if:`).
      git -c user.name="book-sync" -c user.email="book-sync@users.noreply.github.com" \
        commit -q -m "[book-sync] from ${SELF#*/}: ${why}"
      branch="$(git rev-parse --abbrev-ref HEAD)"
      for i in 1 2 3; do
        git push -q origin "HEAD:$branch" && { echo "Pushed."; exit 0; }
        echo "Push rejected (someone else pushed first); rebasing and retrying ($i/3)..."
        sleep $((i * 5))
        git pull -q --rebase origin "$branch" || exit 1
      done
      exit 1
    ) || { echo "::error::Sync to $repo failed -- see log above"; failed=1; }
  else
    echo "::error::Could not clone $repo (does it exist, and can BOOK_SYNC_TOKEN reach it?)"; failed=1
  fi
  echo "::endgroup::"
done
exit $failed
