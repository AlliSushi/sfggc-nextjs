#!/usr/bin/env bash
set -euo pipefail

FAILED_SUMMARY=()
ENV_LOCAL_PATH=""

find_env_local() {
  local search_dir env_file
  search_dir="$1"
  while [[ "${search_dir}" != "/" ]]; do
    env_file="${search_dir}/.env.local"
    if [[ -f "${env_file}" ]]; then
      echo "${env_file}"
      return 0
    fi
    search_dir="$(dirname "${search_dir}")"
  done
  return 1
}

load_env_local() {
  local script_dir cwd env_file git_root
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cwd="$(pwd)"

  if command -v git >/dev/null 2>&1; then
    git_root="$(git -C "${script_dir}" rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "${git_root}" ]]; then
      env_file="$(find_env_local "${git_root}" || true)"
    fi
  fi
  env_file="$(find_env_local "${script_dir}" || true)"
  if [[ -z "${env_file}" ]]; then
    env_file="$(find_env_local "${cwd}" || true)"
  fi
  if [[ -z "${env_file}" ]]; then
    local fallback
    fallback="$(cd "${script_dir}/../.." && pwd)/.env.local"
    if [[ -f "${fallback}" ]]; then
      env_file="${fallback}"
    else
      return 0
    fi
  fi

  ENV_LOCAL_PATH="${env_file}"

  while IFS= read -r line || [[ -n "${line}" ]]; do
    local trimmed key value
    trimmed="${line#"${line%%[![:space:]]*}"}"
    trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
    if [[ -z "${trimmed}" ]] || [[ "${trimmed}" == \#* ]]; then
      continue
    fi
    trimmed="${trimmed#export }"
    if [[ "${trimmed}" != *"="* ]]; then
      continue
    fi
    key="${trimmed%%=*}"
    value="${trimmed#*=}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    export "${key}"="${value}"
  done < "${env_file}"
}

load_env_value() {
  local key="$1"
  local file="$2"
  if [[ -z "${file}" ]]; then
    return 1
  fi
  local line value
  line="$(grep -E "^(export[[:space:]]+)?${key}=" "${file}" | tail -n 1 || true)"
  if [[ -z "${line}" ]]; then
    return 1
  fi
  line="${line#export }"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "${value}"
  return 0
}

run_test_command() {
  local name="$1"
  shift
  local output_file
  output_file="$(mktemp)"

  echo "Running ${name}..."
  set +e
  "$@" 2>&1 | tee "$output_file"
  local status=${PIPESTATUS[0]}
  set -e

  local failures
  failures="$(grep -E "not ok|✖" "$output_file" || true)"
  if [[ -n "${failures}" ]]; then
    FAILED_SUMMARY+=("${name}:")
    FAILED_SUMMARY+=("${failures}")
  fi

  rm -f "$output_file"
  return "$status"
}

print_summary() {
  if [[ ${#FAILED_SUMMARY[@]} -eq 0 ]]; then
    echo "All tests passed."
    return 0
  fi
  echo ""
  echo "Test failures summary:"
  printf '%s\n' "${FAILED_SUMMARY[@]}"
  return 1
}

ensure_db_env() {
  if [[ -n "${PORTAL_DATABASE_URL:-}" ]] || [[ -n "${PORTAL_TEST_DATABASE_URL:-}" ]]; then
    return 0
  fi
  local script_dir env_file
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  env_file="$(cd "${script_dir}/../.." && pwd)/.env.local"
  if [[ -f "${env_file}" ]]; then
    ENV_LOCAL_PATH="${env_file}"
    local env_test env_main
    env_test="$(load_env_value "PORTAL_TEST_DATABASE_URL" "${env_file}" || true)"
    env_main="$(load_env_value "PORTAL_DATABASE_URL" "${env_file}" || true)"
    if [[ -n "${env_test}" ]]; then
      export PORTAL_TEST_DATABASE_URL="${env_test}"
    fi
    if [[ -n "${env_main}" ]]; then
      export PORTAL_DATABASE_URL="${env_main}"
    fi
  fi
}

drop_test_db_if_success() {
  local status="$1"
  if [[ "$status" -ne 0 ]]; then
    echo "Tests failed; keeping test database."
    return 0
  fi

  load_env_local
  ensure_db_env

  local test_url="${PORTAL_TEST_DATABASE_URL:-}"
  local derived="false"
  if [[ -z "${test_url}" ]]; then
    if [[ -n "${PORTAL_DATABASE_URL:-}" ]]; then
      test_url="${PORTAL_DATABASE_URL}"
      derived="true"
    else
      local script_dir candidate env_test env_main
      script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
      for candidate in "${ENV_LOCAL_PATH}" "$(cd "${script_dir}/../.." && pwd)/.env.local" "$(pwd)/.env.local"; do
        if [[ -n "${candidate}" ]] && [[ -f "${candidate}" ]]; then
          env_test="$(load_env_value "PORTAL_TEST_DATABASE_URL" "${candidate}" || true)"
          env_main="$(load_env_value "PORTAL_DATABASE_URL" "${candidate}" || true)"
          if [[ -n "${env_test}" ]]; then
            test_url="${env_test}"
            break
          fi
          if [[ -n "${env_main}" ]]; then
            test_url="${env_main}"
            derived="true"
            break
          fi
        fi
      done
    fi
  fi
  if [[ -z "${test_url}" ]] && [[ -f "$(pwd)/.env.local" ]]; then
    local fallback_main
    fallback_main="$(load_env_value "PORTAL_DATABASE_URL" "$(pwd)/.env.local" || true)"
    if [[ -n "${fallback_main}" ]]; then
      test_url="${fallback_main}"
      derived="true"
    fi
  fi
  if [[ -z "${test_url}" ]]; then
    echo "No DB URL found; skipping test database drop."
    return 0
  fi

  if ! command -v mysql >/dev/null 2>&1; then
    echo "mysql not found; skipping test database drop."
    return 0
  fi

  local drop_info
  drop_info="$(TEST_URL="${test_url}" DERIVED="${derived}" node -e "
    const raw = process.env.TEST_URL || '';
    if (!raw) {
      console.log('|||||false');
      process.exit(0);
    }
    const url = new URL(raw);
    const derived = process.env.DERIVED === 'true';
    const currentDb = url.pathname.replace(/^\\//, '');
    const dbName = derived ? ((currentDb || 'sfggc_portal') + '_test') : currentDb;
    const safe = dbName.endsWith('_test');
    const host = url.hostname || 'localhost';
    const port = url.port || '3306';
    const user = decodeURIComponent(url.username || '');
    const password = decodeURIComponent(url.password || '');
    console.log([dbName, host, port, user, password, safe].join('|'));
  ")"

  local db_name host port user password safe
  IFS="|" read -r db_name host port user password safe <<<"${drop_info}"

  if [[ -z "${db_name}" ]]; then
    echo "No DB URL found; skipping test database drop."
    return 0
  fi
  if [[ "${safe}" != "true" ]]; then
    echo "Refusing to drop non-test database: ${db_name}"
    return 0
  fi

  echo "Dropping test database ${db_name}..."
  set +e
  if [[ -n "${password}" ]]; then
    MYSQL_PWD="${password}" mysql --protocol=tcp -h "${host}" -P "${port}" -u "${user}" mysql -e "drop database if exists \`${db_name}\`;"
  else
    mysql --protocol=tcp -h "${host}" -P "${port}" -u "${user}" mysql -e "drop database if exists \`${db_name}\`;"
  fi
  local drop_status=$?
  set -e
  if [[ "${drop_status}" -ne 0 ]]; then
    echo "Unable to drop test database; keeping it for debugging."
  fi
}
