# Receipt-Budgeter

A small web app that analyzes receipt images, suggests budget categories for items using an LLM, and integrates with the Actual Budget API. The repository contains a Vite + React client (`client/`) and an Express server (`server/`).

## Table of Contents
- **Project**: Basic overview and quick start
- **Docker**: How to run with Docker Compose (root and server)
- **Local**: How to run the client and server locally without Docker
- **Configuration**: Environment variables and examples
- **Architecture**: High-level component overview and data flow

## Getting Started

First, clone the repository:

```bash
git clone https://github.com/masoncfrancis/receipt-budgeter.git
cd receipt-budgeter`
```

### Environment / Configuration 

This project relies on environment variables for external integrations and runtime configuration. The server uses `dotenv` and will load either `.env.local` (default for development) or `.env.production` when `NODE_ENV=production`.

Server environment variables (put in `server/.env.local` or export in your shell):

- `ACTUAL_BUDGET_FILE_ID` : (required) Budget file id for Actual API to optionally download a specific budget file (more info about how to get it [here](https://actualbudget.org/docs/settings/#budget-id))
- `NODE_ENV` : `local` or `production` — affects which env file is loaded
- `GEMINI_API_KEY` : (required) API key for Google Gemini
- `ACTUAL_SERVER_URL` : (required) URL to your Actual API server
- `ACTUAL_PASSWORD` : Password for Actual API (if required by your Actual server)
- `PORT` : Port for Express to listen on (server defaults to `3010` if not provided)

Client environment variables (Vite — put in `client/.env` or `client/.env.local`):

- `VITE_BACKEND_URL` : (required) URL of the backend API used by the client during development (e.g. `http://localhost:3010`). The client ships example files that set this.
- `VITE_OIDC_CLIENT_ID` : (required) OIDC client ID for user authentication
- `VITE_OIDC_ISSUER` : (required) OIDC issuer URL for user authentication


Notes and example `server/.env.production`:

```env
# Example server/.env.local
ACTUAL_SERVER_URL=https://actual.example.org
ACTUAL_PASSWORD=supersecret
ACTUAL_BUDGET_FILE_ID=12345abcdef
ALLOW_ANONYMOUS=false
NODE_ENV=production
PORT=3010
```

Example `client/.env` (Vite):

```env
VITE_ALLOW_ANONYMOUS=false
VITE_OIDC_ISSUER=https://auth.example.org
VITE_OIDC_CLIENT_ID=my-client-id
```

### Docker Compose (recommended)

**Note:** If you already have an Actual server set up, you can remove the `actual` service from the `docker-compose.yml` file.

From the project root run the default compose that builds both client and server:

```bash
docker compose up --build
```

The app will appear on the port(s) declared in the compose files (server default port is `3010` if not overridden).

### Local / no Docker

- Prerequisites: Node.js (24+ recommended) and npm installed.

- Start the server:

```bash
cd server
npm install
npm start
```

- Build the client for production:

```bash
cd client
npm install
npm run build
```

After building, the `dist` directory will contain the production-ready static assets. You can serve these files with any static web server. A quick Google search of "how to serve a static website" will help you get started.

For example, using `serve` (a popular quick-and-dirtyNode.js static server):

```bash
npx serve -s dist
```

**Architecture (high-level)**

- **Client (`client/`)**: A Vite + React single-page app. Responsible for the UI, authenticating users (optional), and sending receipt images and submit requests to the server. Authentication is configured via OIDC environment variables (`VITE_OIDC_*`). The client exposes a small set of components including `ReceiptForm` and `ReceiptItemRow`.

- **Server (`server/`)**: An Express.js API that exposes endpoints such as:
  - `GET /status` — health check
  - `GET /getBudgetInformation` — returns available budget categories and accounts (from Actual API or sample data)
  - `POST /analyzeReceipt` — accepts a multipart `file` upload and returns analyzed receipt data and item categorizations
  - `POST /submitReceipt` — accepts a finalized receipt submission (JSON) and would record the transaction (example placeholder)

- **Services**:
  - `services/budgetService.js` — responsible for communicating with the Actual API, caching, and returning a simplified categories/accounts list. It reads config from `ACTUAL_*` env vars.
  - The server also calls the Google GenAI API (via `@google/genai`) to analyze images and classify items.

- **Data flow (receipt analysis)**:
  1. Client gets budget account and category information from `GET /getBudgetInformation`.
  2. Client uploads an image to `POST /analyzeReceipt`.
  3. Server forwards the image to the Google GenAI client to extract structured receipt fields (items, subtotals, totals, store name).
  4. Server requests budget categories from the Actual API 
  5. Server asks the LLM to map each item to a budget category, then returns a normalized `AnalyzeReceiptResponse` JSON to the client.

**Development Notes & Tips**
- If you're prototyping without an Actual server, set `TEST_DATA_ENABLED=true` in `server/.env.local` to avoid needing Actual or Google Gemini credentials.
- The server creates (or expects) an `actualcache` directory in its working directory to store cached Actual API data; this is created automatically when the server starts.
- For Google GenAI make sure your service account has appropriate permissions and your environment points to the credentials with `GOOGLE_APPLICATION_CREDENTIALS`.

**Troubleshooting**
- If `GET /getBudgetInformation` fails with `ACTUAL_SERVER_URL not configured`, ensure the server env file includes `ACTUAL_SERVER_URL` or enable `TEST_DATA_ENABLED` for testing.
- If AI calls fail, check that Google credentials are available to the server process and that network egress is permitted from your environment.

**Contributing**
- Bug reports and PRs welcome. Follow the existing code style and keep changes minimal and focused.
