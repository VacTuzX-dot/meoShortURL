# Build Rust backend
FROM rust:latest AS rust-builder
WORKDIR /app

# Cache dependencies - copy only Cargo files first
COPY rust-backend/Cargo.toml rust-backend/Cargo.lock* ./

# Create dummy src to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release && rm -rf src target/release/deps/meoshorturl*

# Copy actual source and build
COPY rust-backend/src ./src
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
