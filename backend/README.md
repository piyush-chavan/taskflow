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
├── core/
│   ├── config.py           # Settings (JWT secret, algorithm, CORS origins)
│   ├── security.py         # Password hashing + JWT create/decode
│   ├── deps.py              # get_db, get_current_user dependencies
│   └── ownership.py        # Shared "does this project belong to me" check
├── schemas/
│   ├── user.py              # UserCreate, UserOut
│   ├── auth.py               # LoginRequest, Token
│   ├── project.py           # ProjectCreate, ProjectUpdate, ProjectOut, ProjectStats
│   └── task.py               # TaskCreate, TaskUpdate, TaskOut
└── routes/
    ├── auth.py                # register, login, me
    ├── projects.py           # project CRUD + stats
    └── tasks.py                # task CRUD
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
```

| Variable | Purpose |
|---|---|
| `ENCODED_DB_URL` | Connection string used by SQLAlchemy (`database_config.py`) — special characters in the password must be URL-encoded |
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
| GET | `/tasks/` | List tasks across your own projects | 200 |
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
