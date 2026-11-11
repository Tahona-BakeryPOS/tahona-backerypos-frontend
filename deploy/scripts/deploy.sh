#!/usr/bin/env bash
# Deploys (or updates) the frontend on the VPS: it builds the image and starts the container.
# Usage, from frontend/deploy:   bash ./scripts/deploy.sh .env.production
# Requirements: Docker with Compose v2 and this repo up to date (git pull) at the version to deploy.
set -euo pipefail

ENV_FILE="${1:?Usage: ./scripts/deploy.sh .env.staging|.env.production}"
cd "$(dirname "$0")/.."
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE does not exist (copy .env.deploy.example)"; exit 1; }

# Version = this repo's commit, unless VERSION is set to go back to an already built one.
if [ -z "${VERSION:-}" ]; then
  export VERSION="$(git -C .. rev-parse --short HEAD)"
fi
echo "Deploying version $VERSION with $ENV_FILE"

compose() { docker compose --env-file "$ENV_FILE" -f docker-compose.yml "$@"; }

compose build web
compose up -d web
compose ps
echo "Done. Check https://$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)/health"
