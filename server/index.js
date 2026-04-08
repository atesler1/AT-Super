const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const CLIENT_BUILD = path.join(__dirname, '../client/dist');

const DATA_FILE = path.join(__dirname, 'data.json');
const SEED_FILE = path.join(__dirname, 'data.seed.json');
const CURRENT_SCHEMA = 1;

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

if (fs.existsSync(CLIENT_BUILD)) {
  app.use(express.static(CLIENT_BUILD));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(CLIENT_BUILD, 'index.html')));
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

// Migrate data to current schema version
function migrate(data) {
  let v = data.schemaVersion || 0;
  if (v === CURRENT_SCHEMA) return data;

  // v0 → v1: added `price` field to items
  if (v < 1) {
    for (const list of Object.values(data.lists || {})) {
      for (const item of list.items || []) {
        if (item.price === undefined) item.price = 0;
      }
    }
    v = 1;
    console.log('Migrated data.json: v0 → v1');
  }

  // Add future migrations here:
  // if (v < 2) { ... v = 2; console.log('Migrated data.json: v1 → v2'); }

  data.schemaVersion = v;
  return data;
}

// Load or initialize state
let state = { schemaVersion: CURRENT_SCHEMA, lists: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    state = migrate(loaded);
    if ((loaded.schemaVersion || 0) !== CURRENT_SCHEMA) save(); // persist migration
    console.log(`Loaded ${Object.keys(state.lists).length} list(s) from data.json (schema v${state.schemaVersion})`);
  } catch (e) {
    console.error('Failed to parse data.json, starting fresh');
  }
} else if (fs.existsSync(SEED_FILE)) {
  try {
    state = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    save();
    console.log('No data.json found, initialized from seed');
  } catch (e) {
    console.error('Failed to parse data.seed.json, starting fresh');
  }
}

function summaries() {
  return Object.values(state.lists).map(l => ({
    id: l.id,
    name: l.name,
    count: l.items.length,
    createdAt: l.createdAt,
  }));
}

function broadcastSummaries() {
  io.emit('lists:all', summaries());
}

function broadcastList(listId) {
  const list = state.lists[listId];
  if (list) io.to(listId).emit('list:data', list);
}

io.on('connection', (socket) => {
  socket.emit('lists:all', summaries());

  socket.on('list:create', ({ name }) => {
    if (!name || !name.trim()) return;
    const id = randomUUID();
    state.lists[id] = { id, name: name.trim(), createdAt: Date.now(), items: [] };
    save();
    broadcastSummaries();
    socket.emit('list:created', id);
  });

  socket.on('list:rename', ({ id, name }) => {
    if (!state.lists[id] || !name || !name.trim()) return;
    state.lists[id].name = name.trim();
    save();
    broadcastSummaries();
  });

  socket.on('list:delete', (id) => {
    if (!state.lists[id]) return;
    delete state.lists[id];
    save();
    broadcastSummaries();
    io.to(id).emit('list:deleted');
  });

  socket.on('list:join', (id) => {
    socket.join(id);
    if (state.lists[id]) socket.emit('list:data', state.lists[id]);
  });

  socket.on('list:leave', (id) => {
    socket.leave(id);
  });

  socket.on('list:clearcart', (listId) => {
    const list = state.lists[listId];
    if (!list) return;
    list.items = list.items.filter(i => !i.checked);
    save();
    broadcastList(listId);
  });

  socket.on('item:add', ({ listId, name, qty, category, addedBy, price }) => {
    const list = state.lists[listId];
    if (!list || !name || !name.trim()) return;
    const maxId = list.items.reduce((m, i) => Math.max(m, i.id), 0);
    list.items.push({
      id: maxId + 1,
      name: name.trim(),
      qty: Math.max(1, qty || 1),
      category: category || 'Other',
      addedBy: (addedBy || 'Unknown').trim(),
      price: Math.max(0, parseFloat(price) || 0),
      checked: false,
    });
    save();
    broadcastList(listId);
  });

  socket.on('item:toggle', ({ listId, id }) => {
    const list = state.lists[listId];
    if (!list) return;
    const item = list.items.find(i => i.id === id);
    if (item) item.checked = !item.checked;
    save();
    broadcastList(listId);
  });

  socket.on('item:delete', ({ listId, id }) => {
    const list = state.lists[listId];
    if (!list) return;
    list.items = list.items.filter(i => i.id !== id);
    save();
    broadcastList(listId);
  });

  socket.on('item:rename', ({ listId, id, name }) => {
    const list = state.lists[listId];
    if (!list || !name || !name.trim()) return;
    const item = list.items.find(i => i.id === id);
    if (item) item.name = name.trim();
    save();
    broadcastList(listId);
  });

  socket.on('item:setqty', ({ listId, id, qty }) => {
    const list = state.lists[listId];
    if (!list) return;
    const item = list.items.find(i => i.id === id);
    if (item) item.qty = Math.max(1, qty);
    save();
    broadcastList(listId);
  });

  socket.on('item:setcategory', ({ listId, id, category }) => {
    const list = state.lists[listId];
    if (!list) return;
    const item = list.items.find(i => i.id === id);
    if (item) item.category = category;
    save();
    broadcastList(listId);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
