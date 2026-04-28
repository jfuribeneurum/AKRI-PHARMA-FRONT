ARG NODE_IMAGE=node:22-bookworm-slim
FROM ${NODE_IMAGE} AS build

ARG NPM_REGISTRY=https://registry.npmjs.org/
WORKDIR /app

COPY package*.json .npmrc* ./
RUN npm config set registry "${NPM_REGISTRY}" \
 && npm ci --include=dev --no-fund --no-audit --registry="${NPM_REGISTRY}"

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/akripharmacy/browser /usr/share/nginx/html

EXPOSE 80
