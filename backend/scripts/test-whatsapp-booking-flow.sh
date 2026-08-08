#!/usr/bin/env bash
# test-whatsapp-booking-flow.sh
# Walks through the full WhatsApp booking conversation step by step.
#
# Prerequisites:
#   1. Server running on localhost:5000
#   2. Database seeded (npm run seed, npm run seed:shared-flow)
#   3. Solo doctor clinic has appointment_settings for Friday
#   4. Clinic has whatsapp_enabled=true and dummy UltraMsg credentials
#
# Usage:
#   bash backend/scripts/test-whatsapp-booking-flow.sh

set -euo pipefail

BASE_URL="http://localhost:5000/api"
CLINIC_ID="fedf9fe4-f253-43bc-a2f0-40d28fe63e70"
WEBHOOK_SECRET="c9dce214-ce88-4fda-862a-ad0138865003"
PHONE="+919876543999"
SLOT_DATE="2026-07-31 10:00"

pass=0
fail=0

query_db() {
  docker compose -f "$(git -C /home/dell/Documents/AppointMentBooking rev-parse --show-toplevel)/docker-compose.yml" exec -T postgres psql -U appointment -d appointment_booking -t -A -c "$1" 2>/dev/null
}

send_msg() {
  local body="$1"
  curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${BASE_URL}/webhooks/whatsapp/${CLINIC_ID}?key=${WEBHOOK_SECRET}" \
    -H "Content-Type: application/json" \
    -d "$body"
}

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

assert_row_count() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  PASS: $label (count=$actual)"
    pass=$((pass + 1))
  else
    echo "  FAIL: $label (expected=$expected, got=$actual)"
    fail=$((fail + 1))
  fi
}

assert_not_empty() {
  local label="$1" value="$2"
  if [ -n "$value" ] && [ "$value" != "" ]; then
    echo "  PASS: $label ($value)"
    pass=$((pass + 1))
  else
    echo "  FAIL: $label (empty)"
    fail=$((fail + 1))
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  PASS: $label (found '$needle')"
    pass=$((pass + 1))
  else
    echo "  FAIL: $label ('$needle' not found in: $haystack)"
    fail=$((fail + 1))
  fi
}

echo "=== WhatsApp Booking Flow E2E Test ==="
echo "Clinic:   $CLINIC_ID"
echo "Phone:    $PHONE"
echo "Slot:     $SLOT_DATE"
echo ""

# Clean up any prior sessions for this phone to start fresh
query_db "DELETE FROM flow_messages WHERE session_id IN (SELECT id FROM flow_sessions WHERE channel_session_id='${PHONE}');"
query_db "DELETE FROM flow_sessions WHERE channel_session_id='${PHONE}';"
echo "Cleaned up prior sessions for ${PHONE}"
echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Step 1: Send "hi" to start a new session
# ──────────────────────────────────────────────────────────────────────────────
echo "Step 1: Patient says 'hi' -> expect session created at n_reason"
status=$(send_msg "{\"from\":\"${PHONE}\",\"body\":\"hi\",\"id\":\"step1\"}")
assert_status "Webhook accepts" "200" "$status"

SESSION_ID=$(query_db "SELECT id FROM flow_sessions WHERE channel_session_id='${PHONE}' AND status != 'expired' ORDER BY created_at DESC LIMIT 1;")
assert_not_empty "Session created" "$SESSION_ID"

NODE=$(query_db "SELECT current_node_id FROM flow_sessions WHERE id='${SESSION_ID}';")
assert_status "At n_reason node" "n_reason" "$NODE"

MSG_COUNT=$(query_db "SELECT COUNT(*)::text FROM flow_messages WHERE session_id='${SESSION_ID}';")
assert_row_count "2 outbound messages (greet + reason)" "2" "$MSG_COUNT"

GREET_MSG=$(query_db "SELECT content FROM flow_messages WHERE session_id='${SESSION_ID}' AND direction='outbound' ORDER BY created_at ASC LIMIT 1;")
assert_contains "Greeting message" "$GREET_MSG" "Hi! I can help you book"

REASON_MSG=$(query_db "SELECT content FROM flow_messages WHERE session_id='${SESSION_ID}' AND direction='outbound' ORDER BY created_at DESC LIMIT 1;")
assert_contains "Reason prompt" "$REASON_MSG" "reason for your visit"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Step 2: Provide reason
# ──────────────────────────────────────────────────────────────────────────────
echo "Step 2: Patient says 'Annual checkup' -> expect moves to n_slot"
status=$(send_msg "{\"from\":\"${PHONE}\",\"body\":\"Annual checkup\",\"id\":\"step2\"}")
assert_status "Webhook accepts" "200" "$status"

NODE=$(query_db "SELECT current_node_id FROM flow_sessions WHERE id='${SESSION_ID}';")
assert_status "At n_slot node" "n_slot" "$NODE"

INBOUND=$(query_db "SELECT content FROM flow_messages WHERE session_id='${SESSION_ID}' AND direction='inbound' ORDER BY created_at DESC LIMIT 1;")
assert_contains "Inbound message recorded" "$INBOUND" "Annual checkup"

SLOT_MSG=$(query_db "SELECT content FROM flow_messages WHERE session_id='${SESSION_ID}' AND direction='outbound' ORDER BY created_at DESC LIMIT 1;")
assert_contains "Slot prompt sent" "$SLOT_MSG" "date and time"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Step 3: Provide slot
# ──────────────────────────────────────────────────────────────────────────────
echo "Step 3: Patient says '${SLOT_DATE}' -> expect moves to n_name"
status=$(send_msg "{\"from\":\"${PHONE}\",\"body\":\"${SLOT_DATE}\",\"id\":\"step3\"}")
assert_status "Webhook accepts" "200" "$status"

NODE=$(query_db "SELECT current_node_id FROM flow_sessions WHERE id='${SESSION_ID}';")
assert_status "At n_name node" "n_name" "$NODE"

NAME_MSG=$(query_db "SELECT content FROM flow_messages WHERE session_id='${SESSION_ID}' AND direction='outbound' ORDER BY created_at DESC LIMIT 1;")
assert_contains "Name prompt sent" "$NAME_MSG" "full name"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Step 4: Provide name
# ──────────────────────────────────────────────────────────────────────────────
echo "Step 4: Patient says 'Test Patient' -> expect moves to n_phone"
status=$(send_msg "{\"from\":\"${PHONE}\",\"body\":\"Test Patient\",\"id\":\"step4\"}")
assert_status "Webhook accepts" "200" "$status"

NODE=$(query_db "SELECT current_node_id FROM flow_sessions WHERE id='${SESSION_ID}';")
assert_status "At n_phone node" "n_phone" "$NODE"

PHONE_MSG=$(query_db "SELECT content FROM flow_messages WHERE session_id='${SESSION_ID}' AND direction='outbound' ORDER BY created_at DESC LIMIT 1;")
assert_contains "Phone prompt sent" "$PHONE_MSG" "mobile number"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Step 5: Provide phone -> triggers booking_action
# ──────────────────────────────────────────────────────────────────────────────
echo "Step 5: Patient says '${PHONE}' -> expect booking_action runs, session completes"
status=$(send_msg "{\"from\":\"${PHONE}\",\"body\":\"${PHONE}\",\"id\":\"step5\"}")
assert_status "Webhook accepts" "200" "$status"

STATUS=$(query_db "SELECT status FROM flow_sessions WHERE id='${SESSION_ID}';")
assert_status "Session completed" "completed" "$STATUS"

APPT_COUNT=$(query_db "SELECT COUNT(*)::text FROM appointments WHERE patient_id IN (SELECT id FROM users WHERE mobile_number='${PHONE}' AND role='patient') AND appointment_status='booked';")
assert_row_count "Appointment created" "1" "$APPT_COUNT"

APPT_INFO=$(query_db "SELECT token_number::text || '|' || scheduled_start::text FROM appointments WHERE patient_id IN (SELECT id FROM users WHERE mobile_number='${PHONE}' AND role='patient') AND appointment_status='booked' ORDER BY created_at DESC LIMIT 1;")
assert_not_empty "Appointment has token and time" "$APPT_INFO"

CONFIRM_MSG=$(query_db "SELECT content FROM flow_messages WHERE session_id='${SESSION_ID}' AND direction='outbound' AND content LIKE '%Appointment booked%' LIMIT 1;")
assert_contains "Confirmation message sent" "$CONFIRM_MSG" "Appointment booked successfully"

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────────────
echo "=== Final State ==="
echo "Session status: $STATUS"
echo "Appointment:    $APPT_INFO"
echo ""
echo "=== Results: ${pass} passed, ${fail} failed ==="

if [ "$fail" -gt 0 ]; then
  exit 1
fi
