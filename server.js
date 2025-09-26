const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { setupWsConnection } = require('y-websocket/bin/utils');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const Doc = require('./models/Doc');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

app.post('/api/documents', async (req, res) => {
  const { docId } = req.body;
  if (!docId) return res.status(400).json({ error:'docId required' });
  try {
    const exists = await Doc.findOne({ docId });
    if (exists) return res.status(409).json({ error: 'Document already exists' });
    const d = new Doc({ docId });
    await d.save();
    res.json({ ok: true, docId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:docId', async (req, res) => {
  try {   
    const doc = await Doc.findOne({ docId:req.params.docId });
    if (!doc) return res.status(400).json({ error: 'Not found' });
    res.json({ docId:doc.docId, updatedAt:doc.updatedAt });
  } catch(err){
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/:docId/snapshot', async (req, res) => {
  try {
    const { stateUpdateBase64 } = req.body;
    if (!stateUpdateBase64) return res.status(400).json({ error: 'stateUpdateBase64 required' });
    const buf = Buffer.from(stateUpdateBase64,'base64');
    await Doc.findOneAndUpdate(
      { docId:req.params.docId },
      { snapshot:buf, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ ok:true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/:docId/snapshot', async (req, res) => { 
  try{
    const doc = await Doc.findOne({ docId:req.params.docId });
    if(!doc || !doc.snapshot) return res.status(404).json({ error:'No snapshot' });
    res.set('Content-Type', 'application/octet-stream');
    res.send(doc.snapshot);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection',(conn, req) => {
  setupWsConnection(conn, req, { gc: true });
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/realtime-editor';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    const PORT = process.env.PORT || 1234;
    server.listen(PORT, () => console.log('Server running on', PORT));
  })
  .catch(err => {
    console.error('Mongo connection error', err);
    process.exit(1);
  });
