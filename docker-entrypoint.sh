#!/bin/bash
set -euo pipefail

# Determine which Prisma schema to point to if one is not explicitly provided.
if [[ -z "${PRISMA_SCHEMA_PATH:-}" ]]; then
    if [[ "${DATABASE_URL:-}" == sqlite:* || "${DATABASE_URL:-}" == file:* ]]; then
        export PRISMA_SCHEMA_PATH="/usr/src/app/aux-backend/schemas/sqlite/auth.sqlite.prisma"
    else
        export PRISMA_SCHEMA_PATH="/usr/src/app/aux-backend/schemas/auth.prisma"
    fi
fi

exec "$@"
