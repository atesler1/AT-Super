import { useState, useRef, useEffect } from 'react';

function formatPrice(p) {
  if (!p && p !== 0) return null;
  return '₪' + Number(p).toFixed(2);
}

export default function ListPicker({ socket, lists, connected, userName, onSelect }) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef(null);
  const [expanded, setExpanded] = useState({});
  const [fullData, setFullData] = useState({});
  const [editPriceId, setEditPriceId] = useState(null); // "listId:itemId"
  const [editPriceValue, setEditPriceValue] = useState('');
  const editPriceRef = useRef(null);
  const [addInputs, setAddInputs] = useState({}); // listId -> { name, qty, price }

  // Single persistent listener for list data — updates fullData by list id
  useEffect(() => {
    const onListData = (list) => setFullData(prev => ({ ...prev, [list.id]: list }));
    socket.on('list:data', onListData);
    return () => socket.off('list:data', onListData);
  }, []);

  // Join/leave rooms based on which stores are expanded
  useEffect(() => {
    const openIds = Object.keys(expanded).filter(id => expanded[id]);
    openIds.forEach(id => socket.emit('list:join', id));
    return () => openIds.forEach(id => socket.emit('list:leave', id));
  }, [JSON.stringify(expanded)]);

  useEffect(() => {
    if (editId !== null && editRef.current) editRef.current.focus();
  }, [editId]);

  useEffect(() => {
    if (editPriceId !== null && editPriceRef.current) editPriceRef.current.focus();
  }, [editPriceId]);

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

  const toggleExpand = (e, id) => {
    e.stopPropagation();
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getAdd = (listId) => addInputs[listId] || { name: '', qty: 1, price: '' };
  const setAdd = (listId, patch) =>
    setAddInputs(prev => ({ ...prev, [listId]: { ...getAdd(listId), ...patch } }));

  const addItem = (listId) => {
    const { name, qty, price } = getAdd(listId);
    if (!name.trim()) return;
    const p = parseFloat(price);
    socket.emit('item:add', { listId, name: name.trim(), qty, addedBy: userName, price: isNaN(p) ? 0 : p });
    setAddInputs(prev => ({ ...prev, [listId]: { name: '', qty: 1, price: '' } }));
  };

  const submitPriceEdit = (listId, itemId) => {
    const price = parseFloat(editPriceValue);
    socket.emit('item:setprice', { listId, id: itemId, price: isNaN(price) ? 0 : price });
    setEditPriceId(null);
  };

  const grandTotal = lists.reduce((sum, s) => sum + (s.total || 0), 0);
  const hasAnyPrice = lists.some(s => s.total > 0);

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-left">
          <h1 className="app-title">Supermarket List</h1>
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
            {lists.map(store => {
              const isOpen = !!expanded[store.id];
              const full = fullData[store.id];
              const unchecked = full ? full.items.filter(i => !i.checked) : [];
              const checked = full ? full.items.filter(i => i.checked) : [];

              return (
                <li key={store.id} className="list-card" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
                  {/* Store header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn-icon"
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                      onClick={e => toggleExpand(e, store.id)}
                      title={isOpen ? 'Collapse' : 'Expand items'}
                    >
                      {isOpen ? '▾' : '▸'}
                    </button>

                    {editId === store.id ? (
                      <input
                        ref={editRef}
                        className="inline-edit"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => submitEdit(store.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') submitEdit(store.id);
                          if (e.key === 'Escape') setEditId(null);
                        }}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <div
                        className="list-card-info"
                        style={{ flex: 1, cursor: 'pointer' }}
                        onClick={() => onSelect(store.id)}
                      >
                        <span className="list-card-name">{store.name}</span>
                        <span className="list-card-count">{store.count} item{store.count !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {editId !== store.id && store.total > 0 && (
                      <span className="item-price-badge">{formatPrice(store.total)}</span>
                    )}

                    <div style={{ display: 'flex', gap: 4 }}>
                      {editId !== store.id && (
                        <button className="btn-icon" title="Rename store" onClick={e => startEdit(e, store)}>✎</button>
                      )}
                      <button className="btn-icon danger" title="Delete store" onClick={() => deleteStore(store.id, store.name)}>✕</button>
                    </div>
                  </div>

                  {/* Expanded items */}
                  {isOpen && (
                    <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                      {!full ? (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '4px 0' }}>Loading...</p>
                      ) : (
                        <>
                          {/* Add item row */}
                          {(() => {
                            const a = getAdd(store.id);
                            return (
                              <div className="picker-item-row" style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                                <input
                                  className="text-input"
                                  style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', padding: '6px 10px' }}
                                  placeholder="Add item..."
                                  value={a.name}
                                  onChange={e => setAdd(store.id, { name: e.target.value })}
                                  onKeyDown={e => e.key === 'Enter' && addItem(store.id)}
                                />
                                <div className="qty-spinner small">
                                  <button onClick={() => setAdd(store.id, { qty: Math.max(1, a.qty - 1) })}>−</button>
                                  <span>{a.qty}</span>
                                  <button onClick={() => setAdd(store.id, { qty: a.qty + 1 })}>+</button>
                                </div>
                                <div className="price-wrapper" style={{ display: 'inline-flex' }}>
                                  <span className="price-symbol">₪</span>
                                  <input
                                    className="price-input"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="Price"
                                    value={a.price}
                                    onChange={e => setAdd(store.id, { price: e.target.value })}
                                    onKeyDown={e => e.key === 'Enter' && addItem(store.id)}
                                    style={{ width: 55 }}
                                  />
                                </div>
                                <button className="btn-primary" style={{ padding: '5px 10px', fontSize: '0.8rem' }} onClick={() => addItem(store.id)}>Add</button>
                              </div>
                            );
                          })()}
                          {unchecked.map(item => {
                            const priceKey = `${store.id}:${item.id}`;
                            return (
                              <div key={item.id} className="picker-item-row">
                                <input
                                  type="checkbox"
                                  style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }}
                                  onChange={() => socket.emit('item:toggle', { listId: store.id, id: item.id })}
                                />
                                <span className="picker-item-name">{item.name}</span>
                                <div className="qty-spinner small">
                                  <button onClick={() => socket.emit('item:setqty', { listId: store.id, id: item.id, qty: item.qty - 1 })}>−</button>
                                  <span>{item.qty}</span>
                                  <button onClick={() => socket.emit('item:setqty', { listId: store.id, id: item.id, qty: item.qty + 1 })}>+</button>
                                </div>
                                {editPriceId === priceKey ? (
                                  <div className="price-wrapper" style={{ display: 'inline-flex' }}>
                                    <span className="price-symbol">₪</span>
                                    <input
                                      ref={editPriceRef}
                                      className="price-input"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editPriceValue}
                                      onChange={e => setEditPriceValue(e.target.value)}
                                      onBlur={() => submitPriceEdit(store.id, item.id)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') submitPriceEdit(store.id, item.id);
                                        if (e.key === 'Escape') setEditPriceId(null);
                                      }}
                                      style={{ width: 55 }}
                                    />
                                  </div>
                                ) : (
                                  <span
                                    className={`item-price-badge${item.price > 0 ? '' : ' no-price'}`}
                                    style={{ cursor: 'pointer', fontSize: '0.72rem' }}
                                    onClick={() => { setEditPriceId(priceKey); setEditPriceValue(item.price > 0 ? String(item.price) : ''); }}
                                  >
                                    {item.price > 0 ? formatPrice(item.price) : '+ price'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {checked.length > 0 && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                              {checked.map(item => (
                                <div key={item.id} className="picker-item-row" style={{ opacity: 0.5 }}>
                                  <input
                                    type="checkbox"
                                    checked
                                    style={{ width: 16, height: 16, accentColor: 'var(--primary)', flexShrink: 0 }}
                                    onChange={() => socket.emit('item:toggle', { listId: store.id, id: item.id })}
                                  />
                                  <span className="picker-item-name" style={{ textDecoration: 'line-through' }}>{item.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>x{item.qty}</span>
                                  {item.price > 0 && (
                                    <span className="item-price-badge" style={{ fontSize: '0.72rem' }}>{formatPrice(item.price)}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {hasAnyPrice && (
          <div className="total-bar" style={{ marginTop: 16 }}>
            <span className="total-bar-label">∑ All Stores Total</span>
            <span className="total-bar-amount">{formatPrice(grandTotal)}</span>
          </div>
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
