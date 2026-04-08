# AT_Super — Project Instructions

## Project Structure

```
AT_Super/
├── server/          # Node.js + Express + Socket.io backend
│   ├── index.js     # Entry point, listens on port 3001
│   └── data.json    # Persisted list data
├── client/          # React + Vite frontend
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
Loaded 2 list(s) from data.json
Server running on http://localhost:3001
```

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
| Data not persisting | `data.json` missing or corrupt | Check `server/data.json` exists |

### Checking logs

- **Server logs**: visible in the server terminal
- **Client logs**: open browser DevTools → Console tab
- **Network/Socket.io**: open browser DevTools → Network tab → filter by `socket.io`

---

## AI Agent Instructions

When asked to run, restart, or start the app:

1. **Always kill existing processes** on ports 3001, 5173, and 5174 before starting — even if unsure whether they are running.
2. Use `powershell.exe -Command "Stop-Process -Id <PID> -Force"` on Windows to kill processes — `taskkill` does not work reliably in the bash shell.
3. Use `netstat -ano | findstr :<PORT>` (not `grep`) on Windows to find PIDs.
4. Start the server first, wait for the ready message, then start the client.
5. Run both server and client as background processes and confirm their output shows the expected ready messages.
6. Report the exact URLs the app is running on after startup.
