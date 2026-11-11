#!/usr/bin/env bash
# Despliega (o actualiza) el frontend en el VPS: construye la imagen y levanta el contenedor.
# Uso, desde frontend/deploy:   bash ./scripts/deploy.sh .env.production
# Requisitos: Docker con Compose v2 y este repo actualizado (git pull) en la versión a desplegar.
set -euo pipefail

ENV_FILE="${1:?Uso: ./scripts/deploy.sh .env.staging|.env.production}"
cd "$(dirname "$0")/.."
[ -f "$ENV_FILE" ] || { echo "No existe $ENV_FILE (copia .env.deploy.example)"; exit 1; }

# Versión = commit de este repo, salvo que se fije VERSION para volver a una ya construida.
if [ -z "${VERSION:-}" ]; then
  export VERSION="$(git -C .. rev-parse --short HEAD)"
fi
echo "Desplegando versión $VERSION con $ENV_FILE"

compose() { docker compose --env-file "$ENV_FILE" -f docker-compose.yml "$@"; }

compose build web
compose up -d web
compose ps
echo "Listo. Revisa https://$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)/health"
