FROM oven/bun:latest as base
WORKDIR /app

# Install all dependencies (including dev for build)
COPY package.json bun.lock ./
RUN bun install

# Copy source
COPY src src
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY njz.png ./njz.png

# Build Frontend
RUN bun run build

# Remove dev dependencies after build
RUN bun install --production

# Setup Volume
VOLUME /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV DB_PATH=/app/data/urls.sqlite
ENV PORT=3006

EXPOSE 3006

CMD ["bun", "src/index.ts"]
