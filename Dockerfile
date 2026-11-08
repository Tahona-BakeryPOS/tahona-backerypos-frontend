# Frontend (PWA) para staging/producción (D-10): se compila y lo sirve Caddy, que además termina HTTPS y hace de
# proxy de /api (el Caddyfile vive en el repo del backend: deploy/Caddyfile).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM caddy:2.10-alpine
COPY --from=build /app/dist/pos/browser /srv
