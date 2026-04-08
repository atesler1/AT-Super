# AT_Super — Project Instructions

## Project Structure

```
AT_Super/
├── server/              # Node.js + Express + Socket.io backend
│   ├── index.js         # Entry point, listens on port 3001
│   ├── data.seed.json   # Committed — empty template + schema version (source of truth for structure)
│   └── data.json        # NOT committed (gitignored) — live runtime data, persisted via Railway Volume
├── client/              # React + Vite frontend
│   └── src/
│       ├── App.jsx
│       ├── ShoppingList.jsx
│       └── ListPicker.jsx
└── CLAUDE.md
```

## Prerequisites

- **Node.js**: v18 or higher (`node -v` to check)
- **npm**: v9 or higher (`npm -v` to check)

---

## Startup Sequence

Always follow this order: kill → install → start.

### 1. Kill existing processes

Kill any process already using the server or client ports before starting.

**Windows:**
```bash
# Find PID
netstat -ano | findstr :<PORT>
# Kill it (only if a process is found)
powershell.exe -Command "Stop-Process -Id <PID> -Force"
```

**macOS / Linux:**
```bash
lsof -ti :<PORT> | xargs kill -9
```

Ports to clear:
- `3001` — server
- `5173` — client (primary)
- `5174` — client (fallback, if 5173 is taken)

If no process is listening on a port, skip that kill step.

### 2. Install dependencies

Run once (or after pulling changes):

```bash
cd server && npm install
cd ../client && npm install
```

### 3. Start the server

Open a terminal and run:

```bash
cd server && node index.js
```

**Success looks like:**
```
Loaded 2 list(s) from data.json (schema v1)
Server running on http://localhost:3001
```
> If `data.json` did not exist yet: `No data.json found, initialized from seed` — this is normal on first run.

### 4. Start the client

Open a **separate terminal** and run:

```bash
cd client && npm run dev
```

**Success looks like:**
```
VITE v8.x  ready in Xms
➜  Local:   http://localhost:5173/
```

> Note: If port 5173 is taken, Vite will automatically use 5174.

### 5. Verify

- Open **http://localhost:5173** (or 5174) in the browser
- The app should load and connect to the server via Socket.io
- The status badge should show **"Live"** (not "Offline")
- No errors should appear in the browser console or server terminal

---

## Socket.io Connection

- The client connects to the server at `http://localhost:3001`
- On successful connection, the status badge in the UI shows **"Live"**
- If the badge shows **"Offline"**, the server is not running or not reachable

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Status badge shows "Offline" | Server not running | Start `server/index.js` |
| Vite uses port 5174 instead of 5173 | 5173 is in use | Kill port 5173 or use 5174 |
| `Cannot find module` error | Dependencies not installed | Run `npm install` in the affected directory |
| Port already in use error | Old process still running | Kill the process on that port |
| Data not persisting | `data.json` missing or corrupt | Check `server/data.json` exists; on Railway, check Volume is mounted at `/app/server/` |
| Data wiped on every Railway deploy | No Railway Volume | Add Volume in Railway dashboard mounted at `/app/server/` |
| Server logs `Migrated data.json: vX → vY` | Schema version was behind | Normal — migration ran automatically, data was preserved |

### Checking logs

- **Server logs**: visible in the server terminal
- **Client logs**: open browser DevTools → Console tab
- **Network/Socket.io**: open browser DevTools → Network tab → filter by `socket.io`

---

## Data Schema Versioning

### Two files — different roles

| File | Committed? | Purpose |
|---|---|---|
| `server/data.seed.json` | **Yes** | Empty template. Used to create `data.json` on first startup. Defines the current structure. |
| `server/data.json` | **No** (gitignored) | Live runtime data. Written and updated by the server. Persisted via Railway Volume. |

### How it works on startup

`server/index.js` runs this logic every time the server starts:

1. If `data.json` **exists**: load it, check its `schemaVersion`, run any migrations needed to bring it up to `CURRENT_SCHEMA`, then save if migrated.
2. If `data.json` **does not exist**: read `data.seed.json`, write it as `data.json`, start fresh.

This means **deploying new code never wipes live data** — it only migrates the structure if needed.

### When you change the structure of data (add/remove/rename fields on items or lists)

You must do all three steps:

**Step 1 — Bump `CURRENT_SCHEMA` in `server/index.js` line 12:**
```js
const CURRENT_SCHEMA = 2; // was 1
```

**Step 2 — Add a migration block inside `migrate()` in `server/index.js` after the existing blocks:**
```js
if (v < 2) {
  // Example: add a new `notes` field to every item
  for (const list of Object.values(data.lists || {})) {
    for (const item of list.items || []) {
      if (item.notes === undefined) item.notes = '';
    }
  }
  v = 2;
  console.log('Migrated data.json: v1 → v2');
}
```
Rules for writing migrations:
- Always guard with `if (v < N)` so it only runs once
- Always assign the new `v` value at the end of the block
- Never delete existing user data — only add or transform
- The migration runs on the Railway server's live `data.json` on next deploy startup

**Step 3 — Update `server/data.seed.json`** to match the new structure and bump `schemaVersion`:
```json
{
  "schemaVersion": 2,
  "lists": {}
}
```

### What NOT to do

- **Do not edit `server/data.json` directly** — it is gitignored and managed by the server at runtime.
- **Do not reset `CURRENT_SCHEMA` to a lower number** — migrations are cumulative and order-dependent.
- **Do not skip the `data.seed.json` update** — it must always match `CURRENT_SCHEMA` so fresh installs start with the correct structure.

### Railway Volume setup (required for persistence)

Without a Railway Volume, `data.json` lives only in the container's ephemeral filesystem and is **lost on every redeploy**, making migrations irrelevant.

To set up persistence:
1. In the Railway dashboard, open the service → **Volumes**
2. Add a Volume mounted at `/app/server/`
3. Railway will mount this path persistently — `data.json` written there survives redeploys

Once the Volume is set up, the migration system works correctly: deploys update code, startup migrates data, live data is preserved.

---

## AI Agent Instructions

### Running / restarting the app

1. **Always kill existing processes** on ports 3001, 5173, and 5174 before starting — even if unsure whether they are running.
2. Use `powershell.exe -Command "Stop-Process -Id <PID> -Force"` on Windows to kill processes — `taskkill` does not work reliably in the bash shell.
3. Use `netstat -ano | findstr :<PORT>` (not `grep`) on Windows to find PIDs.
4. Start the server first, wait for the ready message, then start the client.
5. Run both server and client as background processes and confirm their output shows the expected ready messages.
6. Report the exact URLs the app is running on after startup.

### Changing the data structure (items or lists)

When asked to add, remove, or rename a field on items or lists, always do all three of the following — never skip any:

1. **Bump `CURRENT_SCHEMA`** in `server/index.js` line 12 by 1.
2. **Add a migration block** in the `migrate()` function in `server/index.js` (after the last existing `if (v < N)` block) that transforms existing live data to the new shape.
3. **Update `server/data.seed.json`** — change `schemaVersion` to match the new `CURRENT_SCHEMA` and update the template structure.

Do **not** modify `server/data.json` directly — it is gitignored and runtime-managed.
