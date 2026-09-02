#!/bin/sh
set -e

echo ">> Running database migrations..."
node --import dotenv/config dist/migrate.js

echo ">> Starting server..."
exec node --import dotenv/config dist/index.js
