# TaskFlow

TaskFlow is a full-stack task and project management app: a FastAPI backend (JWT auth, project/task CRUD, a hand-rolled sort/search engine, and an AI-powered "quick add" feature) paired with a vanilla HTML/CSS/JS frontend.

## Live Demo

- **Frontend:** https://taskflow-nine-rose.vercel.app/
- **Backend API:** https://taskflow-backend-bju2.onrender.com (docs at `/docs`)

> The backend is hosted on a free-tier service and spins down when idle — the first request after a while can take up to a minute to wake it up. The frontend shows a "Connecting to server..." toast while this happens.

---

## Backend Setup (Local)

Run these commands from the project root.

```bash
cd backend

# 1. Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create a .env file in backend/ with the required variables
#    (see "Environment Variables" section below for the full list)

# 4. Run the server
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`, with interactive docs at `http://127.0.0.1:8000/docs`.

## Frontend Setup (Local)

The frontend is static HTML/CSS/JS — no build step, no `npm install`. It just needs to be served (not opened via `file://`) so the browser sends a proper origin the backend's CORS config allows.

```bash
cd frontend

# Point the frontend at your local backend instead of the deployed one:
# open js/config.js and set BASE_URL to "http://127.0.0.1:8000"

# Serve the folder on port 5500 (matches the backend's allowed CORS origins)
python -m http.server 5500
```

Then open `http://127.0.0.1:5500/login.html` in a browser. (Any static server works — e.g. the VS Code "Live Server" extension set to port 5500 — as long as it serves on `http://localhost:5500` or `http://127.0.0.1:5500`.)

---

## Tech Stack

**Backend**
- **FastAPI** — web framework
- **Uvicorn** — ASGI server
- **SQLAlchemy** — ORM
- **PostgreSQL** (via Supabase) — database
- **Pydantic v2** — request/response validation
- **python-jose** — JWT encode/decode
- **passlib + bcrypt** — password hashing
- **LangChain + langchain-openai** — optional real-LLM path for AI quick-add (`gpt-4o-mini`), with a keyless deterministic mock as the default/graded path

**Frontend**
- **HTML5 / CSS3** — no framework, hand-written responsive layout
- **Vanilla JavaScript (ES6+)** — no bundler, plain `<script>` tags
- **Google Fonts (Sora)** — typography
- **Font Awesome** — icons

---

## Demo User Credentials

A demo account is pre-seeded on the deployed backend with 4 realistic projects and ~26 tasks (varied statuses, priorities, and due dates) so the app's functionality can be explored without creating data from scratch:

| Field | Value |
|---|---|
| Email | `demo@test.com` |
| Password | `demo1234` |

Log in with these at the [live demo link](#live-demo) above, or locally once you've registered/seeded your own data.

---

## Environment Variables (`.env`)

Create a `.env` file inside `backend/` with the following keys. None of the values below are real — replace them with your own.

```env
# Database (Supabase/Postgres connection strings)
DATABASE_URL="postgresql://username:password@host:port/dbname"
ENCODED_DB_URL="postgresql://username:url-encoded-password@host:port/dbname"

# JWT auth
JWT_SECRET_KEY="replace-with-a-long-random-secret"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=60

# CORS — comma-separated list of allowed frontend origins
CORS_ORIGINS="http://localhost:5500,http://127.0.0.1:5500"

# Optional: real-LLM path for /tasks/quick-add (leave unset/false for the keyless mock)
USE_REAL_LLM=false
OPENAI_API_KEY=
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Plain (non-encoded) Postgres connection string, kept for reference/tools that need it |
| `ENCODED_DB_URL` | The connection string SQLAlchemy actually uses (`database_config.py`) — special characters in the password must be URL-encoded |
| `JWT_SECRET_KEY` | Secret used to sign/verify JWTs — must be changed for any real deployment |
| `JWT_ALGORITHM` | JWT signing algorithm (`HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime in minutes |
| `CORS_ORIGINS` | Comma-separated list of origins allowed to call the API |
| `USE_REAL_LLM` | `true` to route AI quick-add through a real OpenAI call; unset/`false` uses the free, keyless mock parser |
| `OPENAI_API_KEY` | Only read when `USE_REAL_LLM=true`; otherwise unused and not required |

---

## `requirements.txt`

`backend/requirements.txt` pins every Python dependency (generated via `pip freeze`), so `pip install -r requirements.txt` reproduces the exact working environment. The notable direct dependencies are:

`fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2-binary`, `pydantic`, `python-jose`, `passlib`, `bcrypt`, `python-dotenv`, `python-multipart`, `email-validator`, `langchain-core`, `langchain-openai`, `openai`

Everything else in the file is a transitive dependency of these.

---

## Backend Architecture

```
backend/
├── main.py                    # FastAPI app entrypoint: CORS, request-logging middleware, routers, /health
├── models.py                  # SQLAlchemy models — User, Project, Task
├── database_config.py         # SQLAlchemy engine/session setup
├── algorithms.py              # Hand-rolled insertion_sort / binary_search / linear_search + counting variants
├── ai_parser.py                # Free-text -> structured task parser (mock parser + optional real-LLM call)
├── benchmark_algorithms.py    # Comparison-counting benchmark for algorithms.py, at 3 data sizes
├── check_algorithms.py        # Automated PASS/FAIL correctness checks for algorithms.py
├── benchmark_results.txt      # Saved raw output from the last benchmark run
├── requirements.txt           # Pinned Python dependencies
├── .env                       # Local environment variables (not committed)
├── README.md                  # Backend-specific documentation (full API + algorithm reference)
├── core/
│   ├── config.py                # Settings loaded from .env (JWT, CORS, LLM flags)
│   ├── security.py              # bcrypt password hashing + JWT create/decode
│   ├── deps.py                   # get_db and get_current_user dependencies, shared across all routes
│   └── ownership.py             # Shared "does this project belong to the current user" check
├── schemas/
│   ├── user.py                   # UserCreate, UserOut
│   ├── auth.py                    # LoginRequest, Token
│   ├── project.py                # ProjectCreate, ProjectUpdate, ProjectOut, ProjectStats
│   ├── task.py                    # TaskCreate, TaskUpdate, TaskOut (priority/status constraints + title validator)
│   └── quick_add.py              # QuickAddRequest, ParsedTask
└── routes/
    ├── auth.py                    # POST /auth/register, /auth/login, GET /auth/me
    ├── projects.py                # Project CRUD + GET /projects/stats (SQL aggregate stats)
    └── tasks.py                    # Task CRUD + GET /tasks?sort=... + GET /tasks/search + POST /tasks/quick-add
```

**One by one:**

- **`main.py`** — wires everything together: CORS middleware (explicit origins/methods/headers), a custom middleware that logs method/path/status/response time on every request, all three routers, and the public `/health` endpoint.
- **`models.py`** — the three SQLAlchemy tables: `User` (owns `Project`s), `Project` (owns `Task`s, cascades on delete), `Task`.
- **`database_config.py`** — creates the SQLAlchemy engine from `ENCODED_DB_URL` and exposes `SessionLocal` for the `get_db` dependency.
- **`algorithms.py`** — the Section 2 engine: `insertion_sort`, `binary_search`, `linear_search` (used directly by the live endpoints), plus `insertion_sort_count`, `binary_search_count`, `linear_search_count` (comparison-counting variants used by the benchmark and checks scripts). No built-in `sorted()`/`.sort()` anywhere.
- **`ai_parser.py`** — the Section 3 engine behind `/tasks/quick-add`: builds a role-based (system/user) prompt, and either resolves it with a deterministic, keyless, rule-based mock parser (the default and graded path) or, only when explicitly enabled, a real `gpt-4o-mini` call via LangChain with structured Pydantic output — falling back to the mock on any failure.
- **`benchmark_algorithms.py`** / **`check_algorithms.py`** — run with `python benchmark_algorithms.py` / `python check_algorithms.py` from `backend/`. The benchmark prints (and saves to `benchmark_results.txt`) real comparison counts for the sort/search engine at three data sizes; the checks script prints a `PASS`/`FAIL` line for each of 12 correctness cases using plain `if/else` (no test framework).
- **`core/`** — cross-cutting concerns: settings, password/JWT security helpers, the two FastAPI dependencies (`get_db`, `get_current_user`) reused across every route module, and the shared project-ownership check.
- **`schemas/`** — all Pydantic request/response models, including the `Literal`-typed `priority`/`status` fields and the blank-title validator on tasks.
- **`routes/`** — the actual endpoints, grouped by resource. Every project/task endpoint is scoped to the authenticated user's own data.

---

## Frontend Directory Structure

```
frontend/
├── index.html            # Main dashboard: projects grid -> tasks view, add-task modal, search/sort/stats
├── login.html             # Login page
├── register.html          # Registration page
├── styles.css             # Shared stylesheet — orange theme, Sora font, responsive layout, box model, sticky header
└── js/
    ├── config.js            # Single BASE_URL constant pointing at the backend (change this to repoint deployments)
    ├── storage.js           # localStorage helpers — auth token, cached projects/tasks per project
    ├── api.js               # fetch wrapper — attaches the JWT, normalizes backend errors, redirects to login on 401
    ├── toast.js             # Toast notification system (used for every success/error/info message)
    ├── server-status.js    # Pings /health on load; shows "Connecting to server..." / "Connected to server" toasts
    ├── ui-utils.js          # Shared per-button loading/disable helpers used by every API-triggering button
    ├── auth.js              # Login & register page logic (client-side validation + API calls)
    └── app.js                # Dashboard logic — projects, tasks, sort, search, stats, add/edit/delete, quick-add
```

All DOM rendering uses `document.createElement`/`appendChild`/`textContent` (no `innerHTML` on user-provided data), and every interactive control is wired with `addEventListener` (no inline `onclick`).

---

## Developer

**Piyush Chavan**
Education: B.Tech, Computer Science and Engineering — IIT Roorkee, 2026

---

## API Endpoints

### health
- /health GET
    {
    "status": "ok"
    }

### auth
- /auth/register POST
    request_body = {
        "name":"Piyush",
        "email":"piyush@test.com",
        "password":"abcd1234"
    }

    // 201 Created
    response = {
    "name": "Piyush",
    "email": "piyush@test.com",
    "id": 6
    }

- /auth/login POST
    request_body = {
        "email":"piyush@test.com",
        "password":"abcd1234"
    }

    // 200 OK
    response = {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2IiwiZXhwIjoxNzg1NjIxMzg2fQ.0x0Ax2Fjz3_sYizGu_EEexwlF6jglESL_5_iRym5AwQ",
    "token_type": "bearer"
    }

    // 401 Unauthorised
    response = {
    "detail": "Incorrect email or password"
    }

- auth/me GET

    // 200 OK
    response={
    "name": "Piyush",
    "email": "piyush@test.com",
    "id": 6
    }

    // 401 Unauthorised
    response={
    "detail": "Could not validate credentials"
    }

### projects

- projects/ POST

    request_body = {
        "name":"piyush demo project",
        "descreption":"this is just a demo project. for purpose of testing"
    }

    // 201 Created
    response={
    "name": "piyush demo project",
    "description": null,
    "id": 5,
    "owner_id": 6
    }

- projects/ GET

    // 200 OK
    response=[
        {
            "name": "piyush demo project",
            "description": null,
            "id": 5,
            "owner_id": 6
        }
    ]

- projects/{project_id} GET
    // projects/5
    response={
    "name": "piyush demo project",
    "description": null,
    "id": 5,
    "owner_id": 6
    }

    // projects/6
    // 404 Not Found
    response={
    "detail": "Project not found"
    }

- projects/{project_id} PUT
- project/{project_id} DELETE

### tasks
- tasks/ POST
    request_body={
    "title":"Complete Fundamental Backend for Taskflow Project",
    "description":"N/A",
    "status":"in_progress",
    "priority":"high",
    "due_date":"today",
    "project_id":5
    }

    // 201 Created
    response={
    "id": 4,
    "title": "Complete Fundamental Backend for Taskflow Project",
    "description": "N/A",
    "status": "in_progress",
    "priority": "high",
    "due_date": "today",
    "project_id": 5
    }

    //  422 Unprocessable Content
    response = {
        "detail": [
            {
                "type": "literal_error",
                "loc": [
                    "body",
                    "status"
                ],
                "msg": "Input should be 'pending', 'in_progress' or 'completed'",
                "input": "in-progress",
                "ctx": {
                    "expected": "'pending', 'in_progress' or 'completed'"
                }
            },
            {
                "type": "literal_error",
                "loc": [
                    "body",
                    "priority"
                ],
                "msg": "Input should be 'low', 'medium' or 'high'",
                "input": "max",
                "ctx": {
                    "expected": "'low', 'medium' or 'high'"
                }
            },
            {
                "type": "missing",
                "loc": [
                    "body",
                    "project_id"
                ],
                "msg": "Field required",
                "input": {
                    "title": "Complete Fundamental Backend for Taskflow Project",
                    "description": "N/A",
                    "status": "in-progress",
                    "priority": "max",
                    "due_date": "today"
                }
            }
        ]
    }

- tasks/ GET
    response=[
        {
            "id": 4,
            "title": "Complete Fundamental Backend for Taskflow Project",
            "description": "N/A",
            "status": "in_progress",
            "priority": "high",
            "due_date": "today",
            "project_id": 5
        }
    ]
- tasks/{task_id} GET
- tasks/{task_id} PUT
- tasks/{task_id} DELETE

