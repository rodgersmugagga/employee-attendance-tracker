const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const multer = require('multer');
const { Parser } = require('json2csv');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const OFFICE_LOCATION = {
  lat: Number.parseFloat(process.env.OFFICE_LAT || '-0.5935307533555609, '),
  lng: Number.parseFloat(process.env.OFFICE_LNG || '30.611884814347622')
};
const OFFICE_RADIUS_METERS = Number.parseInt(process.env.OFFICE_RADIUS_METERS || '100', 10);
const MAX_TRUSTED_ACCURACY_METERS = Number.parseInt(process.env.MAX_TRUSTED_ACCURACY_METERS || '150', 10);
const employeePhotoDir = path.join(__dirname, '../public/employee-photos');
const BLUE_OX_EMAIL_DOMAIN = '@blueox.com';

fs.mkdirSync(employeePhotoDir, { recursive: true });

const employeePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: employeePhotoDir,
    filename: (_req, file, cb) => {
      const safeExtension = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExtension}`);
    }
  }),
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Employee photo must be an image file'));
      return;
    }
    cb(null, true);
  }
});

const parseLimit = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const normalizeBlueOxEmail = (value) => {
  const trimmedValue = String(value || '').trim().toLowerCase();
  if (!trimmedValue) return '';
  const emailName = trimmedValue.includes('@') ? trimmedValue.split('@')[0] : trimmedValue;
  if (!emailName) return '';
  return `${emailName}${BLUE_OX_EMAIL_DOMAIN}`;
};

const listLogSelect = {
  id: true,
  userId: true,
  userName: true,
  date: true,
  timeIn: true,
  timeOut: true,
  status: true,
  lat: true,
  lng: true,
  locationAccuracy: true,
  distanceFromOffice: true,
  locationStatus: true,
  locationCheckedAt: true,
  outLat: true,
  outLng: true,
  outLocationAccuracy: true,
  outDistanceFromOffice: true,
  outLocationStatus: true,
  outLocationCheckedAt: true,
  isOutOfBounds: true,
  createdAt: true
};

const getAdminLogSelect = (includePhotos) => includePhotos
  ? { ...listLogSelect, photo: true, outPhoto: true }
  : listLogSelect;

const adminUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  faceDescriptor: true,
  photoUrl: true,
  createdAt: true,
  _count: {
    select: { logs: true }
  }
};

const toAdminUser = (user) => ({
  ...user,
  faceEnrolled: Boolean(user.faceDescriptor),
  faceDescriptor: undefined
});

const deletePublicFile = (fileUrl) => {
  if (!fileUrl?.startsWith('/employee-photos/')) return;
  fs.rm(path.join(__dirname, '../public', fileUrl), { force: true }, () => {});
};

const toNullableNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const radius = 6371e3;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const deltaLat = (lat2 - lat1) * Math.PI / 180;
  const deltaLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(radius * c);
};

const assessLocation = ({ lat, lng, accuracy }) => {
  const latitude = toNullableNumber(lat);
  const longitude = toNullableNumber(lng);
  const locationAccuracy = toNullableNumber(accuracy);
  const checkedAt = new Date();

  if (latitude === null || longitude === null) {
    return {
      lat: latitude,
      lng: longitude,
      accuracy: locationAccuracy,
      distanceFromOffice: null,
      status: 'unknown',
      checkedAt,
      isOutOfBounds: true
    };
  }

  const distanceFromOffice = calculateDistanceMeters(latitude, longitude, OFFICE_LOCATION.lat, OFFICE_LOCATION.lng);
  const hasPoorAccuracy = locationAccuracy === null || locationAccuracy > MAX_TRUSTED_ACCURACY_METERS;

  if (hasPoorAccuracy) {
    return {
      lat: latitude,
      lng: longitude,
      accuracy: locationAccuracy,
      distanceFromOffice,
      status: 'low_accuracy',
      checkedAt,
      isOutOfBounds: true
    };
  }

  const isOutOfBounds = distanceFromOffice > OFFICE_RADIUS_METERS;
  return {
    lat: latitude,
    lng: longitude,
    accuracy: locationAccuracy,
    distanceFromOffice,
    status: isOutOfBounds ? 'remote' : 'onsite',
    checkedAt,
    isOutOfBounds
  };
};

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
app.use('/employee-photos', express.static(employeePhotoDir));

// Auth Routes (Simplified for initial version)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeBlueOxEmail(email);
  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user && user.password === password) { // In production, use bcrypt
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        faceDescriptor: user.faceDescriptor,
        photoUrl: user.photoUrl
      });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', employeePhotoUpload.single('photo'), async (req, res) => {
  const { name, email, password, role } = req.body;
  const normalizedEmail = normalizeBlueOxEmail(email);
  const photoUrl = req.file ? `/employee-photos/${req.file.filename}` : null;
  try {
    if (!name?.trim() || !normalizedEmail || !password?.trim()) {
      deletePublicFile(photoUrl);
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      deletePublicFile(photoUrl);
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: role || 'employee',
        photoUrl
      },
      select: adminUserSelect
    });
    res.json(toAdminUser(newUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: adminUserSelect
    });
    res.json(users.map(toAdminUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', employeePhotoUpload.single('photo'), async (req, res) => {
  const { name, email, password, role } = req.body;
  const normalizedEmail = normalizeBlueOxEmail(email);
  const photoUrl = req.file ? `/employee-photos/${req.file.filename}` : null;
  try {
    if (!name?.trim() || !normalizedEmail) {
      deletePublicFile(photoUrl);
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id: req.params.id }
      }
    });
    if (existingUser) {
      deletePublicFile(photoUrl);
      return res.status(400).json({ error: 'Another user already has this email' });
    }

    const currentUser = photoUrl
      ? await prisma.user.findUnique({ where: { id: req.params.id }, select: { photoUrl: true } })
      : null;
    const data = {
      name: name.trim(),
      email: normalizedEmail,
      role: role || 'employee'
    };
    if (password?.trim()) data.password = password;
    if (photoUrl) data.photoUrl = photoUrl;

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: adminUserSelect
    });
    if (photoUrl) deletePublicFile(currentUser?.photoUrl);
    res.json(toAdminUser(updatedUser));
  } catch (err) {
    deletePublicFile(photoUrl);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        faceDescriptor: true,
        photoUrl: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:userId/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword?.trim()) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!user) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.userId },
      data: { password: newPassword.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        faceDescriptor: true,
        photoUrl: true
      }
    });

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    const userToDelete = await prisma.user.findUnique({ where: { id: req.params.id } });

    if (!userToDelete) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (userToDelete.role === 'admin' && adminCount <= 1) {
      return res.status(400).json({ error: 'At least one admin account is required' });
    }

    await prisma.$transaction([
      prisma.log.deleteMany({ where: { userId: req.params.id } }),
      prisma.user.delete({ where: { id: req.params.id } })
    ]);
    deletePublicFile(userToDelete.photoUrl);
    res.json({ success: true });
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
  const { userId, userName, date, timeIn, status, lat, lng, accuracy, photo } = req.body;
  const location = assessLocation({ lat, lng, accuracy });
  try {
    const newLog = await prisma.log.create({
      data: {
        userId,
        userName,
        date,
        timeIn,
        status,
        lat: location.lat,
        lng: location.lng,
        locationAccuracy: location.accuracy,
        distanceFromOffice: location.distanceFromOffice,
        locationStatus: location.status,
        locationCheckedAt: location.checkedAt,
        photo,
        isOutOfBounds: location.isOutOfBounds
      }
    });
    res.json(newLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/punch-out', async (req, res) => {
  const { logId, timeOut, outLat, outLng, outAccuracy, outPhoto } = req.body;
  const location = assessLocation({ lat: outLat, lng: outLng, accuracy: outAccuracy });
  try {
    const updatedLog = await prisma.log.update({
      where: { id: logId },
      data: {
        timeOut,
        outLat: location.lat,
        outLng: location.lng,
        outLocationAccuracy: location.accuracy,
        outDistanceFromOffice: location.distanceFromOffice,
        outLocationStatus: location.status,
        outLocationCheckedAt: location.checkedAt,
        outPhoto
      }
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
        status: true,
        locationStatus: true,
        distanceFromOffice: true,
        locationAccuracy: true,
        outLocationStatus: true,
        outDistanceFromOffice: true,
        outLocationAccuracy: true
      }
    });

    const fields = [
      'userName',
      'date',
      'timeIn',
      'timeOut',
      'status',
      'locationStatus',
      'distanceFromOffice',
      'locationAccuracy',
      'outLocationStatus',
      'outDistanceFromOffice',
      'outLocationAccuracy'
    ];
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
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Announcement content is required' });
    }

    const newMemo = await prisma.memo.create({
      data: { content: content.trim(), author }
    });
    res.json(newMemo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/memos/:id', async (req, res) => {
  const { content } = req.body;
  try {
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Announcement content is required' });
    }

    const updatedMemo = await prisma.memo.update({
      where: { id: req.params.id },
      data: { content: content.trim() }
    });
    res.json(updatedMemo);
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
      data: { faceDescriptor },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        faceDescriptor: true,
        photoUrl: true
      }
    });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use((err, _req, res, next) => {
  void next;

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Employee photo must be 2MB or smaller'
      : err.message;
    return res.status(400).json({ error: message });
  }

  if (err.message === 'Employee photo must be an image file') {
    return res.status(400).json({ error: err.message });
  }

  return res.status(500).json({ error: err.message || 'Server error' });
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
