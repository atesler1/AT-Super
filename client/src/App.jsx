import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import ListPicker from './ListPicker';
import ShoppingList from './ShoppingList';
import './App.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');
const socket = io(SERVER_URL);

function getListIdFromUrl() {
  return new URLSearchParams(window.location.search).get('list');
}

export default function App() {
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');
  const [nameInput, setNameInput] = useState('');
  const [lists, setLists] = useState([]);
  const [listId, setListId] = useState(getListIdFromUrl);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    if (socket.connected) setConnected(true);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('lists:all', setLists);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('lists:all', setLists);
    };
  }, []);

  // Keep URL in sync with listId
  useEffect(() => {
    const url = new URL(window.location.href);
    if (listId) {
      url.searchParams.set('list', listId);
    } else {
      url.searchParams.delete('list');
    }
    window.history.replaceState({}, '', url);
  }, [listId]);

  const saveName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem('userName', name);
    setUserName(name);
  };

  if (!userName) {
    return (
      <div className="name-screen">
        <div className="name-card">
          <h1>Welcome to ShopSync</h1>
          <p>Enter your name so others can see who added items.</p>
          <input
            autoFocus
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveName()}
            placeholder="Your name..."
            className="name-input"
          />
          <button className="btn-primary" onClick={saveName}>Get Started</button>
        </div>
      </div>
    );
  }

  if (listId) {
    return (
      <ShoppingList
        socket={socket}
        listId={listId}
        userName={userName}
        connected={connected}
        onBack={() => setListId(null)}
      />
    );
  }

  return (
    <ListPicker
      socket={socket}
      lists={lists}
      connected={connected}
      userName={userName}
      onSelect={setListId}
    />
  );
}
