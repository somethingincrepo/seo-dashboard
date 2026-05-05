# Pinned to a specific digest so a Microsoft-side retag of v1.59.1-jammy
# can never silently change the Chromium binary under us. To bump:
#   curl -sI https://mcr.microsoft.com/v2/playwright/manifests/v1.59.1-jammy \
#     -H "Accept: application/vnd.docker.distribution.manifest.v2+json"
#   → copy the docker-content-digest into the line below.
FROM mcr.microsoft.com/playwright:v1.59.1-jammy@sha256:45b20531f82127c1d50feaf11cd90d0e1410e04af70014b3492eb3e2cbe20ec1

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Strip dev deps after build
RUN npm prune --production

EXPOSE 8080
CMD ["node", "dist/index.js"]
