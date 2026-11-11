# Frontend (PWA) para staging/producción: se compila y lo sirve Caddy, que además termina HTTPS y hace de
# proxy de /api hacia el API (API_UPSTREAM). Todo vive en este repo (Caddyfile y deploy/); no depende del backend.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/pos/browser /srv
