#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "$0")/_helpers.sh"
load_env_local

status=0
if ! run_test_command "frontend unit + route tests" node --test --test-concurrency=1 tests/unit/*.test.js tests/unit/migrations/*.test.js tests/unit/deployment/*.test.js tests/frontend/*.test.js; then
  status=$?
else
  status=0
fi

print_summary
drop_test_db_if_success "$status"
exit "$status"
