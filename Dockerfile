FROM oven/bun:latest as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --production

# Copy source
COPY src src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY njz.png ./njz.png

# Build Frontend
RUN bun run build

# Setup Volume
VOLUME /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV DB_PATH=/app/data/urls.sqlite
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "src/index.ts"]
