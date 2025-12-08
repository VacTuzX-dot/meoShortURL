# meoshorturl

To install dependencies:

```bash
bun install
```

To run:

```bash
bun start
```

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Deploy to Debian VPS (Docker Compose + GitHub Actions)
1. Ensure Docker and Docker Compose plugin are installed on the VPS.
2. Add repository secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY` (private key), `APP_DIR` (e.g. `/opt/meoshorturl`), optional `SSH_PORT` (default 22), optional `BASE_URL` (e.g. `https://short.meo.in.th`), optional `PORT` (default 3000).
3. Push to `main`; the workflow `.github/workflows/deploy.yml` will upload the project, run `docker compose build`, and start the app with a persistent `data` volume for the SQLite DB.
4. Expose the chosen port (default 3001, change with `PORT`) via firewall/reverse proxy as needed.
