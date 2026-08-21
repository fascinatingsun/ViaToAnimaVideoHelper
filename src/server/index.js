require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const apiRouter = require('./routes/api');

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Static serve uploads
app.use('/uploads', express.static(uploadsDir));

// Serve built client from src/client/dist when present
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use('/api', apiRouter);
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.use('/api', apiRouter);
}

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing server or set PORT to another value.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});
