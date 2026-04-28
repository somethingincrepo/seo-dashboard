FROM mcr.microsoft.com/playwright:v1.50.0-jammy

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
