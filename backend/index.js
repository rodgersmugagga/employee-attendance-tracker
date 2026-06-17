const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const { Parser } = require('json2csv');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

const parseLimit = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const listLogSelect = {
  id: true,
  userId: true,
  userName: true,
  date: true,
  timeIn: true,
  timeOut: true,
  status: true,
  isOutOfBounds: true,
  createdAt: true
};

const getAdminLogSelect = (includePhotos) => includePhotos
  ? { ...listLogSelect, photo: true, outPhoto: true }
  : listLogSelect;

// Security headers
app.use(helmet());

// CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Compress responses to reduce bytes over mobile networks
app.use(compression());

// Serve static files from the React app
const distPath = path.join(__dirname, '../dist');
// Set cache control for common static assets to leverage client-side caching
app.use((req, res, next) => {
  if (req.path.startsWith('/assets') || req.path.startsWith('/models') || req.path.match(/\.(js|css|png|jpg|jpeg|svg|webp|json)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  next();
});
app.use(express.static(distPath, { maxAge: 0 }));

// Auth Routes (Simplified for initial version)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.password === password) { // In production, use bcrypt
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role, faceDescriptor: user.faceDescriptor });
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
    const limit = parseLimit(req.query.limit, 30, 100);
    const logs = await prisma.log.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: listLogSelect
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/logs', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 100, 500);
    const includePhotos = req.query.includePhotos === '1';
    const logs = await prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: getAdminLogSelect(includePhotos)
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/punch-in', async (req, res) => {
  const { userId, userName, date, timeIn, status, lat, lng, photo, isOutOfBounds } = req.body;
  try {
    const newLog = await prisma.log.create({
      data: { userId, userName, date, timeIn, status, lat, lng, photo, isOutOfBounds: !!isOutOfBounds }
    });
    res.json(newLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/punch-out', async (req, res) => {
  const { logId, timeOut, outLat, outLng, outPhoto } = req.body;
  try {
    const updatedLog = await prisma.log.update({
      where: { id: logId },
      data: { timeOut, outLat, outLng, outPhoto }
    });
    res.json(updatedLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/export', async (req, res) => {
  try {
    const logs = await prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        userName: true,
        date: true,
        timeIn: true,
        timeOut: true,
        status: true
      }
    });

    const fields = ['userName', 'date', 'timeIn', 'timeOut', 'status'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(logs);

    res.header('Content-Type', 'text/csv');
    res.attachment(`attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
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

app.get('/api/memos', async (req, res) => {
  try {
    const memos = await prisma.memo.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    });
    res.json(memos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memos', async (req, res) => {
  const { content, author } = req.body;
  try {
    const newMemo = await prisma.memo.create({
      data: { content, author }
    });
    res.json(newMemo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/memos/:id', async (req, res) => {
  try {
    await prisma.memo.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:userId/face', async (req, res) => {
  const { faceDescriptor } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.userId },
      data: { faceDescriptor }
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*path', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
