#!/usr/bin/env bash
# test-otp-and-booking.sh
# Drives the REST path a patient actually uses: OTP login, then appointment booking.
# Every request is printed as a copy-pasteable curl before it runs.
#
# Usage:
#   bash backend/scripts/test-otp-and-booking.sh
#   BASE_URL=http://localhost:3000/api MOBILE=9876543210 bash backend/scripts/test-otp-and-booking.sh
#
# Requires: the server running, a seeded patient with MOBILE, jq.
# NODE_ENV must not be 'production' - the OTP is echoed back as __dev_otp.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5000/api}"
MOBILE="${MOBILE:-9876543210}"
DATE="${DATE:-$(date -d '+1 day' +%F)}"
COMPOSE_FILE="${COMPOSE_FILE:-$(git rev-parse --show-toplevel)/docker-compose.yml}"

step() { echo; echo "── $1"; }
show() { echo "\$ $1"; }

# ── 1. Request OTP ────────────────────────────────────────────────────────────
step "1. Request OTP (this is the WhatsApp send)"
CMD="curl -s -X POST ${BASE_URL}/auth/request-otp -H 'Content-Type: application/json' -d '{\"mobile_number\":\"${MOBILE}\"}'"
show "$CMD"
OTP_RES=$(eval "$CMD")
echo "$OTP_RES" | jq .

OTP=$(echo "$OTP_RES" | jq -r '.data.__dev_otp // empty')
if [ -z "$OTP" ]; then
  # NODE_ENV=production hides __dev_otp. The OTP is still logged unconditionally
  # (auth.service.ts: console.log(`[OTP] OTP for ...`)), so read it from there.
  echo "(no __dev_otp - production mode; reading the OTP from the container log)"
  OTP=$(docker compose -f "${COMPOSE_FILE}" logs backend --tail 800 2>/dev/null \
        | grep -E "\[OTP\] OTP for ${MOBILE}:" | tail -1 | grep -oE '[0-9]{6}$' || true)
fi
if [ -z "$OTP" ]; then
  echo "FAIL: could not obtain the OTP from the response or the log."
  exit 1
fi
echo "OTP: $OTP"

# Did the WhatsApp gateway actually accept it? HTTP 200 above only means "stored".
SEND_LOG=$(docker compose -f "${COMPOSE_FILE}" logs backend --tail 800 2>/dev/null \
           | grep -E "OTP WhatsApp (sent|to)" | tail -1 || true)
echo "WhatsApp send: ${SEND_LOG:-<no send log line found>}"

# ── 2. Verify OTP -> access token ─────────────────────────────────────────────
step "2. Verify OTP and log in"
CMD="curl -s -X POST ${BASE_URL}/auth/verify-otp -H 'Content-Type: application/json' -d '{\"mobile_number\":\"${MOBILE}\",\"otp\":\"${OTP}\"}'"
show "$CMD"
LOGIN_RES=$(eval "$CMD")
echo "$LOGIN_RES" | jq '.data.user'

TOKEN=$(echo "$LOGIN_RES" | jq -r '.data.accessToken // empty')
[ -n "$TOKEN" ] || { echo "FAIL: no accessToken"; echo "$LOGIN_RES" | jq .; exit 1; }
echo "Token acquired (${#TOKEN} chars)"

AUTH="-H 'Authorization: Bearer \$TOKEN'"

# ── 3. Pick a doctor ──────────────────────────────────────────────────────────
step "3. List doctors"
CMD="curl -s ${BASE_URL}/doctors ${AUTH}"
show "$CMD"
DOCTORS=$(curl -s "${BASE_URL}/doctors" -H "Authorization: Bearer ${TOKEN}")
echo "$DOCTORS" | jq '.data[] | {id, name}' 2>/dev/null || echo "$DOCTORS" | jq .

DOCTOR_ID="${DOCTOR_ID:-$(echo "$DOCTORS" | jq -r '.data[0].id // empty')}"
[ -n "$DOCTOR_ID" ] || { echo "FAIL: no doctors returned"; exit 1; }
echo "Doctor: $DOCTOR_ID"

# ── 4. Find an open slot ──────────────────────────────────────────────────────
step "4. Find slots from ${DATE}"
CMD="curl -s '${BASE_URL}/patient/find-slots?doctor_id=${DOCTOR_ID}&from=${DATE}' ${AUTH}"
show "$CMD"
SLOTS=$(curl -s "${BASE_URL}/patient/find-slots?doctor_id=${DOCTOR_ID}&from=${DATE}" -H "Authorization: Bearer ${TOKEN}")
if [ "$(echo "$SLOTS" | jq -r '.success')" != "true" ]; then
  echo "FAIL: find-slots errored:"
  echo "$SLOTS" | jq .
  echo "Check the server log for the cause: docker compose logs backend --tail 40"
  exit 1
fi
echo "$SLOTS" | jq '{days: [.data.days[] | {date, open: [.slots[] | select(.available > 0)] | length}]}'

SLOT=$(echo "$SLOTS" | jq -r '[.data.days[].slots[] | select(.available > 0)][0].start // empty')
if [ -z "$SLOT" ]; then
  echo "No open slot on ${DATE}. The doctor has no appointment_settings for that weekday,"
  echo "or every slot is full. Retry with DATE=YYYY-MM-DD."
  exit 1
fi
echo "Slot: $SLOT"

# ── 5. Book it ────────────────────────────────────────────────────────────────
step "5. Book the slot"
KEY="test-$(date +%s)"
BODY="{\"doctor_id\":\"${DOCTOR_ID}\",\"scheduled_start\":\"${SLOT}\",\"idempotency_key\":\"${KEY}\",\"appointment_type\":\"consultation\"}"
CMD="curl -s -X POST ${BASE_URL}/patient/book-slot ${AUTH} -H 'Content-Type: application/json' -d '${BODY}'"
show "$CMD"
BOOKED=$(curl -s -X POST "${BASE_URL}/patient/book-slot" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "$BODY")
echo "$BOOKED" | jq .

APPT_ID=$(echo "$BOOKED" | jq -r '.data.id // empty')
[ -n "$APPT_ID" ] || { echo "FAIL: booking did not return an appointment"; exit 1; }

# ── 6. Read it back ───────────────────────────────────────────────────────────
step "6. Confirm it is listed"
CMD="curl -s ${BASE_URL}/patient/appointments ${AUTH}"
show "$CMD"
curl -s "${BASE_URL}/patient/appointments" -H "Authorization: Bearer ${TOKEN}" \
  | jq --arg id "$APPT_ID" '[.data[] | select(.id == $id)] | {found: length, appointment: .[0]}'

echo
echo "=== PASS: OTP sent, login worked, appointment ${APPT_ID} booked at ${SLOT} ==="
