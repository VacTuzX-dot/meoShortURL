# Build Rust backend
FROM rust:1.83-bookworm AS rust-builder
WORKDIR /app
# Copy Rust source
COPY rust-backend/Cargo.toml rust-backend/Cargo.lock* ./
COPY rust-backend/src ./src
# Build release binary
RUN cargo build --release

# Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install
COPY src ./src
COPY index.html vite.config.ts tsconfig*.json ./
COPY njz.png ./
RUN npm run build

# Runtime image
FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy binary and frontend
COPY --from=rust-builder /app/target/release/meoshorturl ./server
COPY --from=frontend-builder /app/dist ./dist

# Setup volume for data
VOLUME /app/data

ENV DB_PATH=/app/data/urls.sqlite
ENV PORT=3006

EXPOSE 3006

CMD ["./server"]
