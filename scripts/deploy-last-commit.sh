#!/bin/bash

cd /Users/cemvalot/Desktop/smaca

git diff --name-only HEAD~1..HEAD \
  | grep -vE '^(vendor/|node_modules/|storage/|\.cursor/|\.git/|deploy/)' \
  | grep -vE '\.html$' \
  | grep -viE 'backup|\.log$' \
  | sort > deploy-last-commit.files

rsync -avz \
  --files-from=deploy-last-commit.files \
  ./ \
  chirpstack@195.251.231.125:/tmp/smaca_last_commit/

scp deploy-last-commit.files \
  chirpstack@195.251.231.125:/tmp/deploy-last-commit.files

echo "Upload completed."
