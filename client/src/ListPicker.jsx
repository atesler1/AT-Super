import { useState, useRef, useEffect } from 'react';

export default function ListPicker({ socket, lists, connected, userName, onSelect }) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef(null);

  useEffect(() => {
    if (editId !== null && editRef.current) editRef.current.focus();
  }, [editId]);

  const createStore = () => {
    const name = newName.trim();
    if (!name) return;
    socket.emit('list:create', { name });
    socket.once('list:created', (id) => onSelect(id));
    setNewName('');
  };

  const deleteStore = (id, name) => {
    if (window.confirm(`Delete store "${name}"? This cannot be undone.`)) {
      socket.emit('list:delete', id);
    }
  };

  const startEdit = (e, store) => {
    e.stopPropagation();
    setEditId(store.id);
    setEditValue(store.name);
  };

  const submitEdit = (id) => {
    const name = editValue.trim();
    if (name) socket.emit('list:rename', { id, name });
    setEditId(null);
  };

  const cancelEdit = () => setEditId(null);

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-left">
          <h1 className="app-title">SuperMarket Shopping List</h1>
        </div>
        <span className={`status-badge ${connected ? 'on' : 'off'}`}>
          {connected ? 'Live' : 'Offline'}
        </span>
      </header>

      <div className="new-list-card">
        <div className="section-label" style={{ marginBottom: 12 }}>Stores</div>

        {lists.length === 0 ? (
          <p className="empty-state" style={{ padding: '10px 0' }}>No stores yet. Create one below.</p>
        ) : (
          <ul className="list-cards">
            {lists.map(store => (
              <li
                key={store.id}
                className="list-card"
                onClick={() => editId !== store.id && onSelect(store.id)}
              >
                {editId === store.id ? (
                  <input
                    ref={editRef}
                    className="inline-edit"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => submitEdit(store.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitEdit(store.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <div className="list-card-info">
                    <span className="list-card-name">{store.name}</span>
                    <span className="list-card-count">{store.count} item{store.count !== 1 ? 's' : ''}</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                  {editId !== store.id && (
                    <button
                      className="btn-icon"
                      title="Rename store"
                      onClick={e => startEdit(e, store)}
                    >✎</button>
                  )}
                  <button
                    className="btn-icon danger"
                    title="Delete store"
                    onClick={() => deleteStore(store.id, store.name)}
                  >✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <label className="field-label" style={{ marginTop: lists.length ? 20 : 0 }}>New Store</label>
        <div className="create-bar">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createStore()}
            placeholder="Store name..."
            className="text-input"
          />
          <button className="btn-primary" onClick={createStore}>+ Create</button>
        </div>
      </div>
    </div>
  );
}
