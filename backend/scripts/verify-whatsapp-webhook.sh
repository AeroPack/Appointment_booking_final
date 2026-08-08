#!/usr/bin/env bash
# verify-whatsapp-webhook.sh
# End-to-end verification of the WhatsApp webhook flow.
#
# Prerequisites:
#   1. Server running on localhost:5000
#   2. Database seeded (npm run seed, npm run seed:shared-flow)
#   3. Clinic has whatsapp_enabled=true and dummy UltraMsg credentials
#
# Usage:
#   CLINIC_ID=<uuid> WEBHOOK_SECRET=<uuid> bash backend/scripts/verify-whatsapp-webhook.sh

set -euo pipefail

BASE_URL="http://localhost:5000/api"
CLINIC_ID="${CLINIC_ID:?CLINIC_ID is required}"
WEBHOOK_SECRET="${WEBHOOK_SECRET:?WEBHOOK_SECRET is required}"
PHONE="+919876543210"

pass=0
fail=0

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS: $label (HTTP $actual)"
    pass=$((pass + 1))
  else
    echo "  FAIL: $label (expected HTTP $expected, got $actual)"
    fail=$((fail + 1))
  fi
}

echo "=== WhatsApp Webhook Verification ==="
echo ""

# 1. Wrong secret -> 401
echo "1. Wrong webhook key -> 401"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/webhooks/whatsapp/${CLINIC_ID}?key=wrong-secret" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"${PHONE}\",\"body\":\"hi\",\"id\":\"test1\"}")
assert_status "Auth rejects wrong key" "401" "$status"

# 2. Missing key -> 401
echo "2. Missing webhook key -> 401"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/webhooks/whatsapp/${CLINIC_ID}" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"${PHONE}\",\"body\":\"hi\",\"id\":\"test2\"}")
assert_status "Auth rejects missing key" "401" "$status"

# 3. Valid webhook, normal message -> 200
echo "3. Valid webhook, normal message -> 200"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/webhooks/whatsapp/${CLINIC_ID}?key=${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"${PHONE}\",\"body\":\"hi\",\"id\":\"test3\"}")
assert_status "Webhook accepts valid request" "200" "$status"

# 4. fromMe echo -> 200, no new session
echo "4. fromMe echo -> 200, no new session created"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/webhooks/whatsapp/${CLINIC_ID}?key=${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"${PHONE}\",\"body\":\"echo\",\"id\":\"test4\",\"fromMe\":true}")
assert_status "Webhook accepts echo" "200" "$status"

# 5. Flat body variant (no data wrapper) -> 200
echo "5. Flat body variant -> 200"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/webhooks/whatsapp/${CLINIC_ID}?key=${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"from\":\"${PHONE}\",\"body\":\"hello flat\",\"id\":\"test5\"}")
assert_status "Webhook handles flat body" "200" "$status"

# 6. Wrapped body variant (data wrapper) -> 200
echo "6. Wrapped body variant -> 200"
status=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/webhooks/whatsapp/${CLINIC_ID}?key=${WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"data\":{\"from\":\"${PHONE}\",\"body\":\"hello wrapped\",\"id\":\"test6\"}}")
assert_status "Webhook handles wrapped body" "200" "$status"

echo ""
echo "=== Results: ${pass} passed, ${fail} failed ==="

if [ "$fail" -gt 0 ]; then
  exit 1
fi
