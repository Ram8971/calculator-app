const express = require('express');
const cors = require('cors');
const { evaluate } = require('mathjs');
const path = require('path');

const app = express();
const PORT = 3000;

// In-memory history store
let history = [];
let historyIdCounter = 1;

app.use(cors());
app.use(express.json());

// Serve static front-end files
app.use(express.static(path.join(__dirname, '../public')));

// POST /api/calculate
app.post('/api/calculate', (req, res) => {
  const { expression } = req.body;

  if (!expression || typeof expression !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid expression.' });
  }

  // Safety: only allow safe math characters
  const safe = /^[0-9+\-*/^()%.e\s]+$/i;
  if (!safe.test(expression)) {
    return res.status(400).json({ error: 'Invalid characters in expression.' });
  }

  try {
    const result = evaluate(expression);

    if (!isFinite(result)) {
      return res.status(400).json({ error: 'Result is undefined (e.g.: division by zero).' });
    }

    // Store in history (keep last 50)
    const entry = {
      id: historyIdCounter++,
      expression,
      result: +result.toFixed(10),
      timestamp: new Date().toISOString(),
    };
    history.unshift(entry);
    if (history.length > 50) history.pop();

    return res.json({ result: entry.result, id: entry.id });
  } catch (err) {
    return res.status(400).json({ error: 'Invalid expression.' });
  }
});

// GET /api/history
app.get('/api/history', (req, res) => {
  res.json(history);
});

// DELETE /api/history
app.delete('/api/history', (req, res) => {
  history = [];
  historyIdCounter = 1;
  res.json({ message: 'History cleared.' });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Calculator server running at http://localhost:${PORT}\n`);
});
