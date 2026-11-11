# Frontend (PWA) for staging/production: it is built and served by Caddy, which also terminates HTTPS and
# proxies /api to the API (API_UPSTREAM). Everything lives in this repo (Caddyfile and deploy/); it does not depend on the backend.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/pos/browser /srv
