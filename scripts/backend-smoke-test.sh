#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-4020}"
BASE="http://127.0.0.1:${PORT}"
LOG_FILE="/tmp/retro-backend-test-dev.log"
DATA_FILE="data/retro-store.json"
DATA_BAK="/tmp/retro-store.backup.$$"

pass_count=0
RESP_CODE=""
RESP_BODY=""

print_case() {
  echo "[CASE] $1"
}

pass_case() {
  pass_count=$((pass_count + 1))
  echo "[PASS] $1"
}

fail_case() {
  echo "[FAIL] $1"
  exit 1
}

assert_eq() {
  local actual="$1"
  local expected="$2"
  local message="$3"
  if [[ "$actual" != "$expected" ]]; then
    fail_case "$message (expected='$expected' actual='$actual')"
  fi
}

json_get() {
  local json="$1"
  local expr="$2"
  echo "$json" | node -p "const x=JSON.parse(require('fs').readFileSync(0,'utf8')); ${expr}"
}

request() {
  local method="$1"
  local url="$2"
  local body="${3:-}"
  local token="${4:-}"
  local tmp
  tmp="$(mktemp)"

  local code
  local body_out

  if [[ -n "$body" && -n "$token" ]]; then
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" -H 'Content-Type: application/json' -H "x-participant-token: $token" -d "$body")
  elif [[ -n "$body" ]]; then
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" -H 'Content-Type: application/json' -d "$body")
  elif [[ -n "$token" ]]; then
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url" -H "x-participant-token: $token")
  else
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" "$url")
  fi

  body_out="$(cat "$tmp")"
  rm -f "$tmp"
  RESP_CODE="$code"
  RESP_BODY="$body_out"
}

cleanup() {
  if [[ -n "${DEV_PID:-}" ]]; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi

  if [[ -f "$DATA_BAK" ]]; then
    mv "$DATA_BAK" "$DATA_FILE"
  else
    rm -f "$DATA_FILE"
  fi
}
trap cleanup EXIT

if [[ -f "$DATA_FILE" ]]; then
  cp "$DATA_FILE" "$DATA_BAK"
fi

mkdir -p data
cat > "$DATA_FILE" <<'JSON'
{
  "sessions": [],
  "participants": [],
  "entries": [],
  "votes": [],
  "happinessChecks": [],
  "navigation": [],
  "authTokens": []
}
JSON

: > "$LOG_FILE"
rm -f .next/dev/lock
npm run dev -- --port "$PORT" > "$LOG_FILE" 2>&1 &
DEV_PID=$!

for _ in {1..60}; do
  if curl -sS "$BASE/api/sessions/nonexistent/state" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

print_case "Create session returns admin token and join URL"
request POST "$BASE/api/sessions" '{"title":"Sprint Retro","adminName":"Owner"}'
create_code="$RESP_CODE"
create_body="$RESP_BODY"
assert_eq "$create_code" "200" "Session creation should succeed"
slug="$(json_get "$create_body" "x.session.slug")"
admin_token="$(json_get "$create_body" "x.token")"
join_url="$(json_get "$create_body" "x.session.joinUrl")"
assert_eq "$join_url" "/session/${slug}/join" "Join URL should include session slug"
pass_case "Create session"

print_case "Join session adds participant"
request POST "$BASE/api/sessions/${slug}/join" '{"name":"Alice"}'
join_code="$RESP_CODE"
join_body="$RESP_BODY"
assert_eq "$join_code" "200" "Join should succeed"
user_token="$(json_get "$join_body" "x.token")"
request GET "$BASE/api/sessions/${slug}/state"
state_code="$RESP_CODE"
state_body="$RESP_BODY"
assert_eq "$state_code" "200" "State should load"
participants_count="$(json_get "$state_body" "x.participants.length")"
assert_eq "$participants_count" "2" "Participants should include admin and joined user"
pass_case "Join + participants list"

print_case "Entry creation works for both participants"
request POST "$BASE/api/sessions/${slug}/entries" '{"type":"went_right","content":"Shipped faster"}' "$admin_token"
e1_code="$RESP_CODE"
e1_body="$RESP_BODY"
assert_eq "$e1_code" "200" "Admin entry create should succeed"
entry_admin_id="$(json_get "$e1_body" "x.entry.id")"
request POST "$BASE/api/sessions/${slug}/entries" '{"type":"went_wrong","content":"CI flaky"}' "$user_token"
e2_code="$RESP_CODE"
e2_body="$RESP_BODY"
assert_eq "$e2_code" "200" "User entry create should succeed"
entry_user_id="$(json_get "$e2_body" "x.entry.id")"
pass_case "Entry creation"

print_case "Vote limit enforces 5 votes per participant"
for i in 1 2 3 4; do
  request POST "$BASE/api/sessions/${slug}/entries" "{\"type\":\"went_right\",\"content\":\"extra-${i}\"}" "$admin_token"
  ex_code="$RESP_CODE"
  ex_body="$RESP_BODY"
  assert_eq "$ex_code" "200" "Setup entry ${i} should be created"
  ex_id="$(json_get "$ex_body" "x.entry.id")"
  request POST "$BASE/api/sessions/${slug}/votes" "{\"entryId\":\"${ex_id}\"}" "$user_token"
  v_code="$RESP_CODE"
  assert_eq "$v_code" "200" "Vote ${i} should succeed"
done
request POST "$BASE/api/sessions/${slug}/votes" "{\"entryId\":\"${entry_admin_id}\"}" "$user_token"
v5_code="$RESP_CODE"
assert_eq "$v5_code" "200" "5th vote should succeed"
request POST "$BASE/api/sessions/${slug}/votes" "{\"entryId\":\"${entry_user_id}\"}" "$user_token"
v6_code="$RESP_CODE"
v6_body="$RESP_BODY"
assert_eq "$v6_code" "409" "6th vote should fail"
assert_eq "$(json_get "$v6_body" "x.error")" "Vote limit reached" "6th vote should return limit message"
pass_case "Vote cap"

print_case "Deletion permissions are enforced"
request DELETE "$BASE/api/sessions/${slug}/entries/${entry_admin_id}" "" "$user_token"
del_forbid_code="$RESP_CODE"
del_forbid_body="$RESP_BODY"
assert_eq "$del_forbid_code" "403" "User should not delete another user's entry"
assert_eq "$(json_get "$del_forbid_body" "x.error")" "Forbidden" "Forbidden delete should return correct error"
request DELETE "$BASE/api/sessions/${slug}/entries/${entry_user_id}" "" "$user_token"
del_own_code="$RESP_CODE"
del_own_body="$RESP_BODY"
assert_eq "$del_own_code" "200" "User should delete own entry"
assert_eq "$(json_get "$del_own_body" "x.success")" "true" "Own delete should return success"
pass_case "Delete permissions"

print_case "Only admin can navigate sections"
request POST "$BASE/api/sessions/${slug}/navigation" '{"activeSection":"discussion"}' "$user_token"
nav_forbid_code="$RESP_CODE"
nav_forbid_body="$RESP_BODY"
assert_eq "$nav_forbid_code" "403" "User should not navigate"
assert_eq "$(json_get "$nav_forbid_body" "x.error")" "Forbidden" "Forbidden navigation should return correct error"
request POST "$BASE/api/sessions/${slug}/navigation" '{"activeSection":"discussion"}' "$admin_token"
nav_ok_code="$RESP_CODE"
nav_ok_body="$RESP_BODY"
assert_eq "$nav_ok_code" "200" "Admin should navigate"
assert_eq "$(json_get "$nav_ok_body" "x.navigation.activeSection")" "discussion" "Section should switch to discussion"
pass_case "Navigation permissions"

print_case "Happiness average is computed from individual submissions"
request POST "$BASE/api/sessions/${slug}/happiness" '{"score":8}' "$admin_token"
h1_code="$RESP_CODE"
assert_eq "$h1_code" "200" "Admin happiness submission should succeed"
request POST "$BASE/api/sessions/${slug}/happiness" '{"score":6}' "$user_token"
h2_code="$RESP_CODE"
assert_eq "$h2_code" "200" "User happiness submission should succeed"
request GET "$BASE/api/sessions/${slug}/state"
state2_code="$RESP_CODE"
state2_body="$RESP_BODY"
assert_eq "$state2_code" "200" "State should load after happiness submissions"
assert_eq "$(json_get "$state2_body" "x.happiness.average")" "7" "Average happiness should be 7"
assert_eq "$(json_get "$state2_body" "x.happiness.count")" "2" "Happiness count should be 2"
pass_case "Happiness aggregate"

print_case "Admin can delete all entries"
before_clear="$(json_get "$state2_body" "x.entries.length")"
if [[ "$before_clear" -lt "1" ]]; then
  fail_case "Expected at least one entry before clear"
fi
request DELETE "$BASE/api/sessions/${slug}/entries" "" "$admin_token"
clear_code="$RESP_CODE"
clear_body="$RESP_BODY"
assert_eq "$clear_code" "200" "Admin clear all should succeed"
assert_eq "$(json_get "$clear_body" "x.success")" "true" "Clear all should return success"
request GET "$BASE/api/sessions/${slug}/state"
state3_code="$RESP_CODE"
state3_body="$RESP_BODY"
assert_eq "$state3_code" "200" "State should load after clear"
assert_eq "$(json_get "$state3_body" "x.entries.length")" "0" "Entries should be empty after admin clear"
pass_case "Admin clear all"

echo ""
echo "All backend smoke tests passed (${pass_count} cases)."
