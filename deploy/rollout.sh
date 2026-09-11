#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────
NETWORK="aeropos-backend_default"
BACKEND_CONTAINER="appointment_booking_backend"
FRONTEND_CONTAINER="appointment_booking_frontend"
DB_CONTAINER="new_project_db"
HEALTH_URL="http://localhost:5000/api/health"

BACKEND_IMAGE="${BACKEND_IMAGE:?BACKEND_IMAGE is required}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:?FRONTEND_IMAGE is required}"

ENVFILE="/tmp/.backend.env"
cleanup() { rm -f "$ENVFILE"; }
trap cleanup EXIT

# ── Write env file from secrets (passed as SSH envs by GitHub Actions) ─
echo "==> Writing backend env file..."
cat > "$ENVFILE" <<EOF
DATABASE_URL=${DATABASE_URL}
JWT_SECRET=${JWT_SECRET}
NODE_ENV=production
GEMINI_API_KEY=${GEMINI_API_KEY}
WA_PROVIDER=${WA_PROVIDER}
EVOLUTION_API_URL=${EVOLUTION_API_URL}
EVOLUTION_API_KEY=${EVOLUTION_API_KEY}
BACKEND_URL=${BACKEND_URL}
EVO_SYSTEM_INSTANCE=${EVO_SYSTEM_INSTANCE:-chandan}
EMAIL_HOST=${EMAIL_HOST:-}
EMAIL_PORT=${EMAIL_PORT:-}
EMAIL_SECURE=${EMAIL_SECURE:-}
EMAIL_USERNAME=${EMAIL_USERNAME:-}
EMAIL_PASSWORD=${EMAIL_PASSWORD:-}
WA_AUTH_URL=${WA_AUTH_URL:-}
WA_AUTH_USER=${WA_AUTH_USER:-}
WA_AUTH_PASS=${WA_AUTH_PASS:-}
WA_AUTH_SENDER=${WA_AUTH_SENDER:-BUZWAP}
WA_AUTH_TEMPLATE=${WA_AUTH_TEMPLATE:-aero_auth}
WA_GATEWAY_URL=${WA_GATEWAY_URL:-}
WA_GATEWAY_USER=${WA_GATEWAY_USER:-}
WA_GATEWAY_PASS=${WA_GATEWAY_PASS:-}
WA_GATEWAY_SENDER=${WA_GATEWAY_SENDER:-BUZWAP}
EOF

# Remove any lines where required vars expanded to empty
sed -i '/^DATABASE_URL=$/d' "$ENVFILE"
sed -i '/^JWT_SECRET=$/d' "$ENVFILE"

# ── Pull images ────────────────────────────────────────────────────────
echo "==> Pulling latest images..."
docker pull "$BACKEND_IMAGE"
docker pull "$FRONTEND_IMAGE"

# ── Ensure Docker network ─────────────────────────────────────────────
echo "==> Ensuring Docker network..."
docker network inspect "$NETWORK" >/dev/null 2>&1 \
  || docker network create "$NETWORK"

# ── Ensure PostgreSQL ─────────────────────────────────────────────────
echo "==> Ensuring PostgreSQL..."
docker start "$DB_CONTAINER" 2>/dev/null || docker run -d \
  --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  -e POSTGRES_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}" \
  -e POSTGRES_DB=appointment_booking \
  -v appointment_booking_pgdata:/var/lib/postgresql/data \
  postgres:16-alpine

docker exec "$DB_CONTAINER" psql -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='appointment_booking'" | grep -q 1 \
  || docker exec "$DB_CONTAINER" psql -U postgres -c "CREATE DATABASE appointment_booking"

# ── Restart backend ───────────────────────────────────────────────────
echo "==> Restarting backend..."
docker stop "$BACKEND_CONTAINER" 2>/dev/null || true
docker rm "$BACKEND_CONTAINER" 2>/dev/null || true
docker run -d --name "$BACKEND_CONTAINER" \
  --network "$NETWORK" \
  -p 7680:5000 \
  --env-file "$ENVFILE" \
  "$BACKEND_IMAGE"

echo "==> Waiting for backend health..."
sleep 10
for i in 1 2 3 4 5; do
  if docker exec "$BACKEND_CONTAINER" wget -qO- "$HEALTH_URL" >/dev/null 2>&1; then
    echo "    Backend healthy"
    break
  fi
  echo "    Attempt $i/5 - waiting..."
  sleep 5
done

# ── Restart frontend ──────────────────────────────────────────────────
echo "==> Restarting frontend..."
docker stop "$FRONTEND_CONTAINER" 2>/dev/null || true
docker rm "$FRONTEND_CONTAINER" 2>/dev/null || true
docker run -d --name "$FRONTEND_CONTAINER" \
  --network "$NETWORK" \
  -p 7679:80 \
  "$FRONTEND_IMAGE"

# ── Show status ───────────────────────────────────────────────────────
echo "==> Deploy complete"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
