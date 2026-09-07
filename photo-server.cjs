require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

const upload = multer({ dest: path.join(__dirname, 'tmp') });

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

const dbUrl = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_IU1aA2QRjyrd@ep-curly-violet-ayos0ij1-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require';
const finalDbUrl = dbUrl.includes('sslmode=') ? dbUrl : dbUrl + (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
console.log('DB URL starts with:', finalDbUrl.substring(0, 40) + '...');
const pool = new Pool({
  connectionString: finalDbUrl,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// Get photo URL by file_id
app.get('/api/photos/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const apiRes = await fetch(`${BASE_URL}/getFile?file_id=${fileId}`);
    const data = await apiRes.json();

    if (!data.ok) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;

    if (req.query.raw === '1') {
      const imgRes = await fetch(fileUrl);
      const contentType = imgRes.headers.get('content-type');
      res.setHeader('Content-Type', contentType || 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      res.send(buffer);
    } else {
      res.json({ ok: true, url: fileUrl });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all cases with photo info
app.get('/api/cases', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pc.*, p.name as province_name, m.name as municipality_name, u.name as officer_name, i.name as institution_name
      FROM person_cases pc
      LEFT JOIN provinces p ON pc.province_id = p.id
      LEFT JOIN municipalities m ON pc.municipality_id = m.id
      LEFT JOIN users u ON pc.officer_id = u.id
      LEFT JOIN institutions i ON pc.institution_id = i.id
      ORDER BY pc.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get case timeline
app.get('/api/cases/:id/timeline', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM case_timeline WHERE case_id = $1 ORDER BY date ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new case
app.post('/api/cases', async (req, res) => {
  try {
    const { name, category, location, clothing, province, municipality, photo_file_id, photo_message_id, visibility, status, date, time } = req.body;

    let provinceId = null;
    if (province) {
      const provRes = await pool.query('SELECT id FROM provinces WHERE name = $1', [province]);
      if (provRes.rows.length > 0) provinceId = provRes.rows[0].id;
    }

    let municipalityId = null;
    if (municipality && provinceId) {
      const munRes = await pool.query('SELECT id FROM municipalities WHERE name = $1 AND province_id = $2', [municipality, provinceId]);
      if (munRes.rows.length > 0) municipalityId = munRes.rows[0].id;
    }

    // Generate reference
    const refCount = await pool.query('SELECT COUNT(*) FROM person_cases');
    const refNum = 500 + parseInt(refCount.rows[0].count);
    const reference = `LZA-2025-${String(refNum).padStart(5, '0')}`;

    const result = await pool.query(
      `INSERT INTO person_cases (reference, name, category, location, clothing, province_id, municipality_id, photo_file_id, photo_message_id, visibility, status, date, time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [reference, name, category, location || null, clothing || null, provinceId, municipalityId, photo_file_id || null, photo_message_id || null, visibility || 'Restrito', status || 'Em falta', date || null, time || null]
    );

    res.json({ ok: true, case: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update a case
app.put('/api/cases/:id', async (req, res) => {
  try {
    const { photo_file_id, photo_message_id, status } = req.body;
    const result = await pool.query(
      `UPDATE person_cases SET photo_file_id = COALESCE($1, photo_file_id), photo_message_id = COALESCE($2, photo_message_id), status = COALESCE($3, status), updated_at = NOW() WHERE id = $4 RETURNING *`,
      [photo_file_id || null, photo_message_id || null, status || null, req.params.id]
    );
    res.json({ ok: true, case: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete a case
app.delete('/api/cases/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM case_timeline WHERE case_id = $1', [req.params.id]);
    await pool.query('DELETE FROM person_cases WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get all provinces
app.get('/api/provinces', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM provinces ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get municipalities by province
app.get('/api/municipalities/:provinceId', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM municipalities WHERE province_id = $1 ORDER BY name', [req.params.provinceId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    const result = await pool.query('SELECT id, name, email, role, province_id, phone FROM users WHERE phone = $1 AND password = $2', [phone, password]);
    if (result.rows.length === 0) {
      return res.json({ ok: false, error: 'Telefone ou senha inválidos.' });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health check
// Stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const municipalities = await pool.query('SELECT COUNT(*) FROM municipalities');
    const totalCases = await pool.query("SELECT COUNT(*) FROM person_cases WHERE status != 'Encerrada'");
    const locatedThisMonth = await pool.query(
      "SELECT COUNT(*) FROM person_cases WHERE status = 'Localizada' AND updated_at >= date_trunc('month', NOW())"
    );
    res.json({
      municipalities: parseInt(municipalities.rows[0].count),
      totalCases: parseInt(totalCases.rows[0].count),
      locatedThisMonth: parseInt(locatedThisMonth.rows[0].count),
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    res.json({ municipalities: 0, totalCases: 0, locatedThisMonth: 0 });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check error:', err.message);
    res.status(500).json({ status: 'error', error: err.message, dbUrlSet: !!process.env.DATABASE_URL });
  }
});

// Upload photo to Telegram
app.post('/api/photos/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No photo provided' });
    }

    const { project, reference } = req.body;
    const caption = `[${project || 'LZA'}] ${reference || ''}`.trim();

    const fileBuffer = fs.readFileSync(req.file.path);

    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    formData.append('caption', caption);
    formData.append('photo', new Blob([fileBuffer], { type: req.file.mimetype }), req.file.originalname);

    const tgRes = await fetch(`${BASE_URL}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });

    const tgData = await tgRes.json();

    fs.unlinkSync(req.file.path);

    if (!tgData.ok) {
      return res.status(500).json({ ok: false, error: tgData.description || 'Telegram upload failed' });
    }

    const fileId = tgData.result.photo[tgData.result.photo.length - 1].file_id;
    const messageId = tgData.result.message_id;

    res.json({ ok: true, file_id: fileId, message_id: messageId });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve built React frontend
const distPath = process.env.FRONTEND_DIR || path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);

  const SERVICE_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    fetch(`${SERVICE_URL}/api/health`).then(r => r.json()).then(d => console.log('[keep-alive] ping ok', d)).catch(e => console.error('[keep-alive] ping failed', e.message));
  }, 10 * 60 * 1000);
  console.log('[keep-alive] self-ping a cada 10 min para evitar sleep no Render');
});
