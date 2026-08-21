try {
  const dotenv = require('dotenv');
  // Load root .env if present
  try {
    const r1 = dotenv.config();
    console.log('dotenv root load:', !!(r1 && r1.parsed));
  } catch (e) { console.error('dotenv root load error', e && e.message); }
  // Also load src/server/.env if user placed server secrets there
  try {
    const r2 = dotenv.config({ path: require('path').join(__dirname, 'src', 'server', '.env') });
    console.log('dotenv src/server load:', !!(r2 && r2.parsed));
  } catch (e) { console.error('dotenv src/server load error', e && e.message); }
} catch (e) {
  // dotenv not installed — continue
}

// Log presence of key (masked) to help debug env loading
try {
  const key = process.env.GEMINI_API_KEY || process.env.GEMINY_API_KEY || null;
  if (key) {
    const masked = key.slice(0, 4) + '...' + key.slice(-4);
    console.log('GEMINI_API_KEY present (masked):', masked);
  } else {
    console.log('GEMINI_API_KEY not present in process.env');
  }
} catch (e) {}
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const apiRouter = require('./src/server/routes/api');

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'src', 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));

const clientDist = path.join(__dirname, 'dist');

(async () => {
  if (fs.existsSync(clientDist)) {
    // Production / static build mode
    app.use('/api', apiRouter);
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    // Development mode: use Vite's middleware so Express serves the dev client and API from the same port
    try {
      const { createServer: createViteServer } = await import('vite');
      app.use('/api', apiRouter);
      const vite = await createViteServer({
        server: { middlewareMode: 'ssr' },
        appType: 'custom'
      });
      app.use(vite.middlewares);

      app.use('*', async (req, res) => {
        try {
          const url = req.originalUrl;
          let template = fs.readFileSync(path.resolve('index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e);
          console.error(e);
          res.status(500).end(e.message);
        }
      });
    } catch (err) {
      console.error('Failed to start Vite dev middleware:', err);
      app.use('/api', apiRouter);
    }
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
})();
