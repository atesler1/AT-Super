import { useEffect, useState, useRef } from 'react';

const CATEGORIES = ['Fruits', 'Vegetables', 'Dairy', 'Meat', 'Bakery', 'Frozen', 'Beverages', 'Snacks', 'Household', 'Other'];

const CATEGORY_COLORS = {
  Fruits: '#fed7aa',
  Vegetables: '#bbf7d0',
  Dairy: '#bfdbfe',
  Meat: '#fecaca',
  Bakery: '#fef08a',
  Frozen: '#e0e7ff',
  Beverages: '#cffafe',
  Snacks: '#fae8ff',
  Household: '#f1f5f9',
  Other: '#e5e7eb',
};

const CATEGORY_EMOJI = {
  Fruits: '🍎',
  Vegetables: '🥦',
  Dairy: '🥛',
  Meat: '🥩',
  Bakery: '🍞',
  Frozen: '🧊',
  Beverages: '🧃',
  Snacks: '🍿',
  Household: '🏠',
  Other: '📦',
};

function formatPrice(p) {
  if (!p && p !== 0) return null;
  return '₪' + Number(p).toFixed(2);
}

export default function ShoppingList({ socket, listId, userName, connected, onBack }) {
  const [list, setList] = useState(null);
  const [input, setInput] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [newPrice, setNewPrice] = useState('');
  const [editId, setEditId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef(null);

  useEffect(() => {
    const joinList = () => socket.emit('list:join', listId);
    const onListDeleted = () => onBack();
    joinList();
    socket.on('list:data', setList);
    socket.on('list:deleted', onListDeleted);
    socket.on('connect', joinList);
    return () => {
      socket.emit('list:leave', listId);
      socket.off('list:data', setList);
      socket.off('list:deleted', onListDeleted);
      socket.off('connect', joinList);
    };
  }, [listId]);

  useEffect(() => {
    if (editId !== null && editRef.current) editRef.current.focus();
  }, [editId]);

  const addItem = () => {
    const name = input.trim();
    if (!name) return;
    const price = newPrice !== '' ? parseFloat(newPrice) : 0;
    socket.emit('item:add', { listId, name, qty: newQty, addedBy: userName, price: isNaN(price) ? 0 : price });
    setInput('');
    setNewQty(1);
    setNewPrice('');
  };

  const submitEdit = (id) => {
    if (editValue.trim()) socket.emit('item:rename', { listId, id, name: editValue });
    setEditId(null);
  };

  if (!list) {
    return (
      <div className="page">
        <div className="loading">Loading store...</div>
      </div>
    );
  }

  const unchecked = list.items.filter(i => !i.checked);
  const checked = list.items.filter(i => i.checked);

  const uncheckedTotal = unchecked.reduce((sum, i) => sum + (i.qty * (i.price || 0)), 0);
  const checkedTotal = checked.reduce((sum, i) => sum + (i.qty * (i.price || 0)), 0);
  const hasAnyPrice = list.items.some(i => i.price > 0);

  const filteredUnchecked = unchecked;

  // Group unchecked items by category
  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filteredUnchecked.filter(i => i.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="page">
      <header className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={onBack}>← Stores</button>
          <h1 className="list-title">{list.name}</h1>
        </div>
        <span className={`status-badge ${connected ? 'on' : 'off'}`}>
          {connected ? 'Live' : 'Offline'}
        </span>
      </header>

      <div className="add-bar">
        <input
          className="text-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Add item..."
        />
        <div className="qty-spinner">
          <button onClick={() => setNewQty(q => Math.max(1, q - 1))}>−</button>
          <span>{newQty}</span>
          <button onClick={() => setNewQty(q => q + 1)}>+</button>
        </div>
        <div className="price-wrapper">
          <span className="price-symbol">₪</span>
          <input
            className="price-input"
            type="number"
            min="0"
            step="0.01"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Price"
          />
        </div>
        <button className="btn-primary" onClick={addItem}>Add</button>
      </div>

      {unchecked.length === 0 && checked.length === 0 && (
        <p className="empty-state">🛒 Store list is empty. Add your first item above.</p>
      )}

      {filteredUnchecked.length > 0 && (
        <ul className="item-list">
          {filteredUnchecked.map(item => (
            <li key={item.id} className="item-row">
              <input
                type="checkbox"
                onChange={() => socket.emit('item:toggle', { listId, id: item.id })}
              />
              <div className="item-body">
                {editId === item.id ? (
                  <input
                    ref={editRef}
                    className="inline-edit"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => submitEdit(item.id)}
                    onKeyDown={e => e.key === 'Enter' && submitEdit(item.id)}
                  />
                ) : (
                  <span className="item-name" onDoubleClick={() => { setEditId(item.id); setEditValue(item.name); }}>
                    {item.name}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="item-by">by {item.addedBy}</span>
                  {item.price > 0 && (
                    <>
                      <span className="item-price-badge">{formatPrice(item.price)}</span>
                      {item.qty > 1 && (
                        <span className="item-subtotal">= {formatPrice(item.qty * item.price)}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="qty-spinner small">
                <button onClick={() => socket.emit('item:setqty', { listId, id: item.id, qty: item.qty - 1 })}>−</button>
                <span>{item.qty}</span>
                <button onClick={() => socket.emit('item:setqty', { listId, id: item.id, qty: item.qty + 1 })}>+</button>
              </div>
              <button className="btn-icon" onClick={() => socket.emit('item:delete', { listId, id: item.id })}>✕</button>
            </li>
          ))}
        </ul>
      )}

      {hasAnyPrice && unchecked.length > 0 && (
        <div className="total-bar">
          <span className="total-bar-label">🛒 Shopping Total</span>
          <span className="total-bar-amount">{formatPrice(uncheckedTotal)}</span>
        </div>
      )}

      {checked.length > 0 && (
        <div className="cart-section">
          <div className="cart-header">
            <span className="section-label">In cart ({checked.length})</span>
            <button
              className="btn-clear"
              onClick={() => window.confirm('Remove all checked items?') && socket.emit('list:clearcart', listId)}
            >
              Clear cart
            </button>
          </div>
          <ul className="item-list done">
            {checked.map(item => (
              <li key={item.id} className="item-row checked">
                <input
                  type="checkbox"
                  checked
                  onChange={() => socket.emit('item:toggle', { listId, id: item.id })}
                />
                <div className="item-body">
                  <span className="item-name">{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="item-by">by {item.addedBy}</span>
                    {item.price > 0 && (
                      <>
                        <span className="item-price-badge">{formatPrice(item.price)}</span>
                        {item.qty > 1 && (
                          <span className="item-subtotal">= {formatPrice(item.qty * item.price)}</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <span className="item-qty-label">x{item.qty}</span>
                <button className="btn-icon" onClick={() => socket.emit('item:delete', { listId, id: item.id })}>✕</button>
              </li>
            ))}
          </ul>
          {hasAnyPrice && checkedTotal > 0 && (
            <div className="total-bar" style={{ marginTop: 10 }}>
              <span className="total-bar-label">✓ Cart Total</span>
              <span className="total-bar-amount">{formatPrice(checkedTotal)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
