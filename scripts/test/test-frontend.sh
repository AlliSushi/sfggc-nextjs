#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/_helpers.sh"
load_env_local

FRONTEND_TEST_FILES=()
while IFS= read -r test_file; do
  FRONTEND_TEST_FILES+=("${test_file}")
done < <(find tests/unit tests/frontend -type f -name '*.test.js' | sort)

status=0
if ! run_test_command "frontend unit + route tests" node --test --test-concurrency=1 "${FRONTEND_TEST_FILES[@]}"; then
  status=$?
else
  status=0
fi

print_summary
drop_test_db_if_success "$status"
exit "$status"
