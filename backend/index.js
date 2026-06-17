const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// Auth Routes (Simplified for initial version)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.password === password) { // In production, use bcrypt
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    const newUser = await prisma.user.create({
      data: { name, email, password, role: role || 'employee' }
    });
    res.json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attendance Routes
app.get('/api/logs/:userId', async (req, res) => {
  try {
    const logs = await prisma.log.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/logs', async (req, res) => {
  try {
    const logs = await prisma.log.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/punch-in', async (req, res) => {
  const { userId, userName, date, timeIn, status } = req.body;
  try {
    const newLog = await prisma.log.create({
      data: { userId, userName, date, timeIn, status }
    });
    res.json(newLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/punch-out', async (req, res) => {
  const { logId, timeOut } = req.body;
  try {
    const updatedLog = await prisma.log.update({
      where: { id: logId },
      data: { timeOut }
    });
    res.json(updatedLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/logs/:id', async (req, res) => {
  try {
    await prisma.log.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*path', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
