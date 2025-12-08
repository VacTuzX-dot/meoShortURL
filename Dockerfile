FROM oven/bun:1 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --production

# Copy source
COPY src src

# Setup Volume สำหรับเก็บไฟล์ DB (สำคัญ! ไม่งั้น restart แล้วหาย)
VOLUME /app/data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV DB_PATH=/app/data/urls.sqlite
CMD ["bun", "src/index.ts"]
