import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { QuillBinding } from 'y-quill';


const VITE_YWS_URL = import.meta.env.VITE_YWS_URL || 'ws://localhost:1234';
const VITE_API_URL = import.meta.env.VITE_API_URL || '';


function uint8ToBase64(u8) {
const CHUNK_SIZE = 0x8000;
let index = 0;
let result = '';
while (index < u8.length) {
result += String.fromCharCode.apply(null, Array.from(u8.subarray(index, Math.min(index + CHUNK_SIZE, u8.length))));
index += CHUNK_SIZE;
}
return btoa(result);
}

export default function App() {
  const editorRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [docId, setDocId] = useState(() => new URLSearchParams(window.location.search).get('docId') || 'demo-doc');
  const [username] = useState(() => 'User' + Math.floor(Math.random() * 10000));


  useEffect(() => {
  const ydoc = new Y.Doc();
  const wsUrl = VITE_YWS_URL; // example: ws://localhost:1234
  const provider = new WebsocketProvider(wsUrl, docId, ydoc);


  provider.on('status', (e) => setConnected(e.status === 'connected'));


// presence
  provider.awareness.setLocalStateField('user', {
    name: username,
    color: '#' + ((1 << 24) * Math.random() | 0).toString(16).padStart(6, '0'),
  });


  const quill = new Quill(editorRef.current, {
    theme: 'snow',
    modules: {
      toolbar: [['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link']],
    },
  });


  const ytext = ydoc.getText('quill');
  const binding = new QuillBinding(ytext, quill, provider.awareness);


  // Load snapshot if server has it
  (async () => {

    try {
      const resp = await fetch(`${VITE_API_URL}/api/documents/${docId}/snapshot`);
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        Y.applyUpdate(ydoc, new Uint8Array(ab));
      }
    } catch (err) { /* ignore */ }
})();


// Auto-save (every 15s)
const interval = setInterval(async () => {
  try {
    const update = Y.encodeStateAsUpdate(ydoc);
    const b64 = uint8ToBase64(update);
    await fetch(`${VITE_API_URL}/api/documents/${docId}/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stateUpdateBase64: b64 }),
    });
  } catch (err) {
// silent
  }
}, 15000);


return () => {
  clearInterval(interval);
  binding.destroy();
  provider.destroy();
  ydoc.destroy();
 };
}, [docId, username]);


return (
  <div className="app-root">
    <header className="topbar">
      <div className="brand">Realtime Collaborative Editor</div>
      <div className="meta">{connected ? 'Online' : 'Offline'} — doc: <strong>{docId}</strong></div>
    </header>


    <main className="editor-wrap">
      <div className="controls">
        <label>Document ID:</label>
        <input value={docId} onChange={(e) => setDocId(e.target.value)} />
        <small>Open same docId in multiple tabs to collaborate.</small>
      </div>
      <div ref={editorRef} className="quill-editor" />
    </main>


    <footer className="foot">User: {username}</footer>
    </div>
   );
}