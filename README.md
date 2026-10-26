# Handbook Q&A

A chat app that answers questions about a company handbook (`data/handbook.pdf`), using only the handbook and citing the passages each answer comes from.

- **Ingestion (Python, run once):** reads the PDF, splits it into passages, embeds them with OpenAI and stores them in Postgres. The database is [ParadeDB](https://www.paradedb.com), which adds BM25 keyword search and pgvector.
- **App (Next.js):** for each question, it searches the passages (keyword + meaning, combined), then an OpenAI model answers from the top results with `[S1]`-style citations.

## Requirements

- Node.js 20.9 or newer
- Python 3.11 or newer, and [uv](https://docs.astral.sh/uv/)
- Docker, for the database
- An OpenAI API key
- The handbook PDF

## Project layout

```
client/        Next.js app: chat page, POST /api/ask, search, answering, evals
ingest/        Python ingestion: PDF → passages → embeddings → database
data/          put handbook.pdf here (not committed)
compose.yaml   the database (ParadeDB: Postgres 17 + BM25 + pgvector)
.env           one config file for everything (copy from .env.example)
```

## Setup

### 1. Install dependencies

```bash
npm install --prefix client
uv sync --project ingest
```

### 2. Add the handbook

Put the PDF at `data/handbook.pdf`.

### 3. Configure

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `EMBEDDING_MODEL` | `text-embedding-3-small`. The app must use the same model that built the index. |
| `ANSWER_MODEL` | An OpenAI model your key can use, e.g. `gpt-5.4-mini` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Any values. Docker creates the database with them. |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5432/DB`, using the three values above |
| `JUDGE_MODEL` | Optional. The model the answer eval uses as judge; defaults to `ANSWER_MODEL`. |

`ANSWER_MODE` and `ANTHROPIC_API_KEY` aren't used yet.

### 4. Start the database

```bash
docker compose up -d
```

This runs ParadeDB on `localhost:5432`. Its data lives in a Docker volume, so it survives restarts.

### 5. Build the search index

```bash
npm run ingest
```

This step:

- converts the PDF to Markdown (`data/handbook.md`);
- splits it into about 3,000 passages;
- embeds them with `EMBEDDING_MODEL`;
- stores them in the database with a BM25 index.

Our run took about 20 minutes, mostly converting the PDF. The embedding cost is small.

Running ingestion again adds a second copy of every passage, so clear the table first:

```bash
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "TRUNCATE document_chunks"'
```

## Run the app

```bash
npm run dev
```

Open http://localhost:3000. Pick an example question or type your own. If the database or the index isn't ready, the page says so at the top.

For a production build: `npm run build`, then `npm --prefix client start`.

The app reads `.env` when it starts, so restart it after changing `.env`.

## Tests and evals

```bash
npm test                 # unit tests (Vitest); no database or API key needed
npm run typecheck        # TypeScript type check
npm run eval:retrieval   # search quality per search mode: hit@5, hit@8, MRR
npm run eval:answers     # runs every case through the app's answering code, then an LLM judge
```

- **Needs:** both evals need the database and `OPENAI_API_KEY`. `eval:answers` also calls `ANSWER_MODEL` (and `JUDGE_MODEL` if set).
- **Cases:** they live in `client/evals/cases.json`. Cases marked `*` in the output haven't been checked against the handbook yet.
- **Results:** each run is saved to `client/evals/results/`.

## Troubleshooting

| Message or problem | Fix |
| --- | --- |
| `ANSWER_MODEL is not set`, but it's in `.env` | Your terminal has an empty variable with that name, and it takes precedence over `.env`. Run `unset ANSWER_MODEL` (likewise for any other variable), or open a new terminal. |
| `Can't reach the database (ECONNREFUSED)` | Start it with `docker compose up -d`, and check `DATABASE_URL`. |
| `The search index hasn't been built yet` | Run step 5. |
| `OpenAI doesn't recognise the model` | `ANSWER_MODEL` or `EMBEDDING_MODEL` isn't available to your API key. |
| `EMBEDDING_MODEL … returns N-dimension vectors, but the index was built with M` | `EMBEDDING_MODEL` changed since ingestion. Change it back, or clear the table and run ingestion again. |
| Port 5432 is already in use | Stop the other Postgres, or change the port in `compose.yaml` and `DATABASE_URL`. |
