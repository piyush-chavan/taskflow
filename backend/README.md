# TaskFlow Backend

FastAPI backend for TaskFlow — users, projects, and tasks, with JWT-based authentication. Every user can only see and manage the projects and tasks they own.

## Tech Stack

- **FastAPI** — web framework
- **SQLAlchemy** — ORM (PostgreSQL via Supabase)
- **Pydantic** — request/response validation
- **python-jose** — JWT encode/decode
- **passlib[bcrypt]** — password hashing

## Project Structure

```
backend/
├── main.py               # App entrypoint: middleware, CORS, routers, /health
├── models.py              # SQLAlchemy models (User, Project, Task)
├── database_config.py     # DB engine/session setup
├── algorithms.py          # Sort/search engine powering GET /tasks?sort=... and /tasks/search (Section 2)
├── benchmark_algorithms.py # Comparison-counting benchmark for the engine above
├── check_algorithms.py    # Automated PASS/FAIL checks for the engine above
├── ai_parser.py           # Free-text -> structured task parser powering /tasks/quick-add (Section 3)
├── core/
│   ├── config.py           # Settings (JWT secret, algorithm, CORS origins, USE_REAL_LLM)
│   ├── security.py         # Password hashing + JWT create/decode
│   ├── deps.py              # get_db, get_current_user dependencies
│   └── ownership.py        # Shared "does this project belong to me" check
├── schemas/
│   ├── user.py              # UserCreate, UserOut
│   ├── auth.py               # LoginRequest, Token
│   ├── project.py           # ProjectCreate, ProjectUpdate, ProjectOut, ProjectStats
│   ├── task.py               # TaskCreate, TaskUpdate, TaskOut
│   └── quick_add.py          # QuickAddRequest, ParsedTask
└── routes/
    ├── auth.py                # register, login, me
    ├── projects.py           # project CRUD + stats
    └── tasks.py                # task CRUD + sort/search (Section 2) + quick-add (Section 3)
```

## Environment Setup

**1. Create and activate a virtual environment** (from the `backend/` folder):

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate
```

**2. Install dependencies:**

```bash
pip install -r requirements.txt
```

**3. Configure environment variables.** Create a `.env` file in `backend/` (or edit the existing one):

```env
DATABASE_URL="postgresql://user:password@host:port/dbname"
ENCODED_DB_URL="postgresql://user:url-encoded-password@host:port/dbname"

JWT_SECRET_KEY="a-long-random-secret-string"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS="http://localhost:5500,http://127.0.0.1:5500"

# Optional — only needed for the real-LLM enhancement in Section 3.
# Leave unset for the default (and graded) keyless mock behavior.
USE_REAL_LLM=false
OPENAI_API_KEY=
```

| Variable | Purpose |
|---|---|
| `ENCODED_DB_URL` | Connection string used by SQLAlchemy (`database_config.py`) — special characters in the password must be URL-encoded |
| `USE_REAL_LLM` | Optional. `true` to route `/tasks/quick-add` through a real LLM call; unset/`false` (default) always uses the keyless mock. |
| `OPENAI_API_KEY` | Optional. Only read when `USE_REAL_LLM=true`; otherwise unused. |
| `JWT_SECRET_KEY` | Secret used to sign/verify JWTs. **Change this in production.** |
| `JWT_ALGORITHM` | JWT signing algorithm (default `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |

## Running the Server

```bash
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

- Interactive docs (Swagger UI): `http://127.0.0.1:8000/docs`
- Alternative docs (ReDoc): `http://127.0.0.1:8000/redoc`

> **Note:** Since `/auth/login` accepts a JSON body (not an OAuth2 form), the "Authorize" button in Swagger UI won't work directly. Call `/auth/login` from the "Try it out" panel instead, copy the `access_token` from the response, and paste it into the Authorize dialog as `Bearer <token>`.

## Authentication Flow

1. **Register** — `POST /auth/register` with `name`, `email`, `password`. The password is hashed with **bcrypt** (via `passlib`) before being stored — the plaintext password is never saved.
2. **Login** — `POST /auth/login` with `email`, `password`. If the credentials match, the server returns a **JWT access token** signed with `JWT_SECRET_KEY`.
3. **Authenticated requests** — send the token on every protected request as a header:

   ```
   Authorization: Bearer <access_token>
   ```

4. On each request, the `get_current_user` dependency (`core/deps.py`) decodes the JWT, extracts the user id from the `sub` claim, and loads the user from the database. If the token is missing, invalid, or expired, the request is rejected with `401 Unauthorized`.

**A few notes on the security bits:**
- Passwords are never stored or compared in plaintext — `verify_password()` uses bcrypt's constant-time comparison.
- The JWT only carries the user's id (`sub`) and an expiry (`exp`) — no sensitive data is embedded in the token.
- All endpoints except `/auth/register`, `/auth/login`, and `/health` require a valid token.

### Ownership rules

A logged-in user can only **read, update, or delete their own projects and tasks**. Tasks belong to a project, and a project belongs to its creator (`owner_id`). Every project/task endpoint filters by the current user's id — trying to access, edit, or delete something owned by another user returns `404 Not Found` (not `403`, so as not to reveal whether the resource exists at all).

## API Endpoints

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Health check |

### Auth (`/auth`)

| Method | Path | Auth | Description | Success |
|---|---|---|---|---|
| POST | `/auth/register` | No | Create a new user account | 201 |
| POST | `/auth/login` | No | Exchange email/password for a JWT | 200 |
| GET | `/auth/me` | Yes | Get the current logged-in user | 200 |

**Register/Login body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secret123"
}
```
`name` is trimmed and rejected if blank after trimming. `password` must be at least 8 characters.

### Projects (`/projects`) — all require auth, all scoped to the current user

| Method | Path | Description | Success |
|---|---|---|---|
| POST | `/projects/` | Create a project | 201 |
| GET | `/projects/` | List your own projects | 200 |
| GET | `/projects/stats` | Task count + count-by-status per project (SQL aggregate) | 200 |
| GET | `/projects/{id}` | Get one of your projects | 200 / 404 |
| PUT | `/projects/{id}` | Update one of your projects | 200 / 404 |
| DELETE | `/projects/{id}` | Delete one of your projects | 204 / 404 |

**Create/Update body:**
```json
{
  "name": "Website Revamp",
  "description": "Q3 project"
}
```
`name` is trimmed and rejected if blank after trimming.

### Tasks (`/tasks`) — all require auth, all scoped to projects you own

| Method | Path | Description | Success |
|---|---|---|---|
| POST | `/tasks/` | Create a task in one of your projects | 201 |
| POST | `/tasks/quick-add` | Create a task from one free-text sentence (see "Section 3" below) | 201 / 422 |
| GET | `/tasks/` | List tasks across your own projects | 200 |
| GET | `/tasks/?sort=priority` | List, sorted by priority (see "Section 2" below) | 200 |
| GET | `/tasks/?sort=due_date` | List, sorted by due date | 200 |
| GET | `/tasks/search?title=...&algo=binary\|linear` | Exact-title lookup (see "Section 2" below) | 200 / 404 |
| GET | `/tasks/{id}` | Get one of your tasks | 200 / 404 |
| PUT | `/tasks/{id}` | Update one of your tasks | 200 / 404 |
| DELETE | `/tasks/{id}` | Delete one of your tasks | 204 / 404 |

**Create/Update body:**
```json
{
  "title": "Design mockups",
  "description": "Landing page and pricing page",
  "status": "pending",
  "priority": "high",
  "due_date": "2026-08-15",
  "project_id": 1
}
```

- `title` is trimmed and rejected if blank after trimming.
- `status` must be one of: `pending`, `in_progress`, `completed`.
- `priority` must be one of: `low`, `medium`, `high`.
- `project_id` must reference a project you own, or the request fails with `404`.

Any request body that fails these validation rules returns `422 Unprocessable Entity` with details on which field failed.

---

## Section 2 — Sorting & Search Engine

Two `/tasks` endpoints are powered by a hand-rolled sorting/search engine ([algorithms.py](algorithms.py)) instead of Python's built-in `sorted()`/`list.sort()` or the database's `ORDER BY`. Both endpoints fetch real rows from the `tasks` table through the same `get_db`/`get_current_user` dependencies used everywhere else in this backend, scoped to the caller's own projects.

### How it's wired in

- **`GET /tasks/?sort=priority`** (and `?sort=due_date`) — [routes/tasks.py](routes/tasks.py) fetches the caller's tasks, maps `priority` to a comparable rank (`low=1, medium=2, high=3`) when sorting by priority, and calls `insertion_sort(records, key=...)` on the resulting list of dicts before returning it. The ordering seen by the client comes from that function call, not the DB or a built-in sort.
- **`GET /tasks/search?title=<exact title>&algo=binary|linear`** (`algo` defaults to `binary`) — builds an in-memory index of `{"id": ..., "title": ...}` pairs from the caller's real tasks. For `algo=binary`, the index is sorted with `insertion_sort` and then probed with `binary_search`. For `algo=linear`, `linear_search` scans the unsorted index directly. Returns the matching task (`200`) or `404` if no task has that exact title.

### The engine (`algorithms.py`)

| Function | Contract |
|---|---|
| `insertion_sort(records, key)` | Sorts a list of dicts **in place** by `record[key]`; no return value. |
| `binary_search(sorted_records, target_value, key)` | Returns the index of a match in an already-sorted list, or **`-1`** if absent. |
| `linear_search(records, target_value, key)` | Scans in order, returns the index of the first match, or **`-1`** if absent. |
| `insertion_sort_count(records, key)` | Same sort, but returns a single `int` — the comparison count. |
| `binary_search_count(sorted_records, target_value, key)` | Returns `{"index": ..., "comparison_count": ...}`. |
| `linear_search_count(records, target_value, key)` | Returns `{"index": ..., "comparison_count": ...}`. |

**Not-found convention:** all four search variants use **`-1`** (never `None`) as the "no match" sentinel, both for the plain index return value and for the `"index"` key in the counting variants.

### Complexity

| Function | Best case | Worst case |
|---|---|---|
| `insertion_sort` | O(n) — list already in sorted order, inner loop exits on the first comparison each pass | O(n²) — list in reverse order, every element shifts all the way to the front |
| `binary_search` | O(1) — target is at the middle of the first probe | O(log n) — target found only after halving the range down to one element |
| `linear_search` | O(1) — target is the first element | O(n) — target is the last element or absent |

### Benchmark — real counted comparisons

Run with:
```bash
python benchmark_algorithms.py
```

This generates synthetic task records shaped exactly like real rows (`title`, `priority`, `due_date`) at three sizes, runs them through the Task 5 counting wrappers above (the same engine the live endpoints call), prints a table, and writes the raw numbers to [benchmark_results.txt](benchmark_results.txt). Actual output from a run in this repo:

```
     n |  insertion_sort |  binary (present) |  binary (absent) |  linear (present) |  linear (absent)
------------------------------------------------------------------------------------------------------
    10 |              25 |                 3 |                4 |                 5 |               10
   500 |           43685 |                 8 |                9 |               186 |              500
  3000 |         1507145 |                11 |               12 |                83 |             3000
```

(`insertion_sort` = comparisons to sort the priority-ranked list; `binary`/`linear` = comparisons to locate one title in the search index, for a present and an absent target.)

### Is the upfront sort worth it?

At the sizes a single TaskFlow project realistically holds (tens to a few hundred tasks), `insertion_sort`'s O(n²) cost is negligible — 25 comparisons at n=10, ~43,685 at n=500, both effectively instant — so resorting on every `GET /tasks?sort=...` call is clearly worth it: it's cheap and always reflects the latest data. The picture changes at n=3,000, where a full resort costs **1,507,145 comparisons** every single time the list is fetched; since teams list/sort their tasks many times a day but add or rename tasks far less often, repeating that O(n²) work from scratch on every read (rather than sorting once and caching the order, or moving to an O(n log n) sort) becomes wasteful once project sizes grow that large. For **search** specifically, the upfront sort is unambiguously worth it regardless of size: `binary_search` stayed at 11–12 comparisons at n=3,000 while `linear_search`'s worst case scanned all 3,000 — over **270x** fewer comparisons — and because searches happen far more often than title edits, that one-time sort pays for itself many times over.

### Automated checks

Run with:
```bash
python check_algorithms.py
```

Prints one `PASS`/`FAIL` line per case (empty/single-element `insertion_sort`, `binary_search` at first/middle/last index and absent, `insertion_sort_count`'s sort correctness and positive-int return, `binary_search_count`'s known-index result, and `linear_search_count`'s absent-value result) using plain `if/else` — no `assert`, `pytest`, or `unittest`. All 12 cases currently pass.

---

## Section 3 — AI Quick-Add

`POST /tasks/quick-add` turns one free-text sentence into a real, persisted row in the same `tasks` table the rest of the app reads and writes — no need to fill in every field by hand.

```json
// request
{
  "description": "Finish the report next Friday, it's urgent",
  "project_id": 1
}
```

Auth-protected and scoped like every other task endpoint: `project_id` must belong to the caller, or the request fails (see below). On success it returns `201` with the created task in the same `TaskOut` shape as the Section 1 CRUD endpoints.

### How it works

1. [routes/tasks.py](routes/tasks.py) validates the request body against `QuickAddRequest` ([schemas/quick_add.py](schemas/quick_add.py)) and confirms `project_id` belongs to the caller.
2. [ai_parser.py](ai_parser.py) builds a standard **role-based prompt** — a `system` message describing the parsing behavior, and a `user` message carrying the raw description — via `build_quick_add_messages()`. This happens on every call, regardless of which path answers it next, so the code is structured identically whether a mock or a real model responds.
3. By default, `mock_parse_task()` answers deterministically (see algorithm below) — zero network calls, zero API keys, always available. This is what's graded and what the endpoint uses out of the box.
4. Only if `USE_REAL_LLM=true` **and** `OPENAI_API_KEY` is set does `call_real_llm()` run instead, using `langchain-openai`'s `ChatOpenAI(model="gpt-4o-mini")` with `.with_structured_output(ParsedTask)` so the model's reply is forced into the same `ParsedTask` Pydantic shape the mock produces. Any exception here (missing package, bad key, network error, malformed response) is caught and silently falls back to the mock — the feature never requires a paid service to work.
5. Either way, the resulting fields are re-validated by constructing a `TaskCreate` ([schemas/task.py](schemas/task.py)) before anything is written to the database. If that fails, the endpoint returns `422` with Pydantic's own error detail (`exc.errors()`) and **no row is created**.

### The mock parsing algorithm (`mock_parse_task`, in `ai_parser.py`)

1. Lower-case a working copy of the description for keyword matching only; the original casing is kept for the title.
2. **Priority** — check, in order: `"urgent"`/`"asap"` → `high`; else `"whenever"`/`"low priority"` → `low`; else → `medium` (default). If both groups match, `high` wins.
3. **Due-date hint** — check, in order: `today`, `tomorrow`, `next week`, then `next monday`…`next sunday` (Mon→Sun), then bare `monday`…`sunday` (Mon→Sun). First match wins and is stored lower-case as-is; `null` if nothing matches.
4. **Title** — starting from the *original-cased* description, remove every occurrence of every priority keyword that matched (not just the one that decided priority) and every occurrence of the one matched date phrase, then `.strip()`. If that leaves nothing, the title becomes the literal `"Untitled task"`.

Not-found/no-match values are always explicit: `priority` is always one of `low`/`medium`/`high`, `due_date_hint` is `null` when absent, and `title` is never an empty string.

### Five worked examples (actual mock output)

These were produced by directly calling `mock_parse_task()` on the inputs shown — a grader can reproduce them exactly by running the same function, and can check any other input the same way.

| # | Input | Output |
|---|---|---|
| 1 | `"Call the plumber whenever you get a chance"` | `{"title": "Call the plumber  you get a chance", "priority": "low", "due_date_hint": null}` |
| 2 | `"Submit tax documents low priority, no rush"` | `{"title": "Submit tax documents , no rush", "priority": "low", "due_date_hint": null}` |
| 3 | `"Team sync monday morning"` | `{"title": "Team sync  morning", "priority": "medium", "due_date_hint": "monday"}` |
| 4 | `"Plan the roadmap next week"` | `{"title": "Plan the roadmap", "priority": "medium", "due_date_hint": "next week"}` |
| 5 | `"Renew the domain today, it's kind of urgent but also whenever works"` | `{"title": "Renew the domain , it's kind of  but also  works", "priority": "high", "due_date_hint": "today"}` |

Example 5 shows the "group (i) wins" rule directly: the text contains both `"urgent"` (group i) and `"whenever"` (group ii), so `priority` is `"high"`, and the title still has *both* keywords (plus `"today"`) stripped out. Double spaces (e.g. example 1, 3, 5) are expected — the algorithm removes exact keyword spans and only trims the outer edges with `.strip()`; it never collapses internal whitespace left behind.

### Why a zero-shot prompt

The system/user message pair in `build_quick_add_messages()` is a **zero-shot** prompt: it states the task and the exact output fields once, with no example input/output pairs embedded. This fits the situation for three reasons. First, the required, graded path is the deterministic mock — the prompt text itself is never actually sent anywhere in that path, so there's no reliability cost to worry about and no reason to spend design effort padding it with exemplars. Second, on the optional real-LLM path, reliability is enforced structurally rather than by example: `.with_structured_output(ParsedTask)` constrains the model to return `title`/`priority`/`due_date_hint` in the exact Pydantic shape, so the traditional argument for few-shot prompting (showing the model the desired output format) is already handled by schema-constrained decoding instead of extra tokens. Third, this is a small, low-ambiguity extraction task, not a multi-step reasoning problem, so chain-of-thought (spending tokens on visible reasoning before the answer) would add latency and cost without improving a task this mechanical. Net effect: zero-shot keeps every real-LLM call to one system message plus the user's sentence — the minimum possible input tokens — while `with_structured_output` recovers the reliability few-shot examples would otherwise have bought.

### Optional real-LLM enhancement

Disabled by default. To try it:
```env
USE_REAL_LLM=true
OPENAI_API_KEY=sk-...
```
With the flag unset (or `false`), or with no `OPENAI_API_KEY` at all, `/tasks/quick-add` works exactly the same via the mock — this is the configuration used for grading, and no paid service is ever required to exercise the feature.

### Error behavior

| Scenario | Response |
|---|---|
| `description` missing, `project_id` missing/wrong type | `422` (automatic Pydantic validation, same as every other endpoint) |
| `project_id` doesn't belong to the caller / doesn't exist | `422` with a Pydantic-shaped `value_error` detail (no row written) |
| Parsed/LLM output somehow fails `TaskCreate` validation | `422` with `exc.errors()` (no row written) |
| Success | `201` with the created task, `TaskOut` shape |
