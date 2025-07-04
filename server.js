require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const validator = require('validator');

// Config
const PUBLIC_DIR = path.join(__dirname, 'public');
const BLACKLISTED_FILES = ['index.html', 'lapor.html', 'tutorial.html'];
// Simpan laporan di file log (opsional: pakai DB)
const laporanDir = path.join(__dirname, 'db');
if (!fs.existsSync(laporanDir)) {
  fs.mkdirSync(laporanDir);
}
const LAPORAN_LOG = path.join(laporanDir, 'laporan.json');

// Middleware
app.use(express.json());
app.use('/public', express.static(PUBLIC_DIR));

// Multer Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PUBLIC_DIR),
  filename: (req, file, cb) => cb(null, file.originalname)
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.html', '.txt'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`[!] Ekstensi "${ext}" ga boleh, jangan ngeyel!`));
    }
  }
});

// Custom Error Handler untuk Upload
const uploadErrorHandler = (err, req, res, next) => {
  res.status(400)
    .set('Content-Type', 'text/plain')
    .send(err.message);
};

// Routes
app.post('/upload', upload.single('file'), (req, res, next) => {
  if (!req.file) return res.status(400).send('File tidak ditemukan!');

  const filename = req.file.originalname.toLowerCase();
  if (BLACKLISTED_FILES.includes(filename)) {
    fs.unlinkSync(req.file.path);
    return res.status(403).send('Nama file ini diblokir!');
  }

  res.send(`Upload sukses! Akses di: /public/${req.file.filename}`);
}, uploadErrorHandler); // <-- Ini kunci utamanya!

// API UPLOAD
app.get('/api/files', (req, res) => {
  fs.readdir(PUBLIC_DIR, (err, files) => {
    if (err) return res.status(500).send('Gagal membaca file!');
    res.json({ files: files.filter(f => ['.html', '.txt'].includes(path.extname(f))) });
  });
});
//API Lapor
app.post('/api/lapor', express.urlencoded({ extended: false }), (req, res) => {
  let { laporan } = req.body;

  if (!laporan || typeof laporan !== 'string') {
    return res.status(400).json({ error: 'Laporan tidak valid.' });
  }

  // Normalisasi input
  laporan = laporan.trim();

  // Validasi input dengan ketat
  if (
    laporan.length < 5 ||
    laporan.length > 100 ||
    !laporan.startsWith('/') ||
    !laporan.endsWith('.html') ||
    /[<>`"'|;&]/.test(laporan) ||  // Hindari injection
    laporan.includes('..')         // Hindari path traversal
  ) {
    return res.status(400).json({ error: 'Format laporan tidak diizinkan.' });
  }

  // Sanitasi input
  laporan = validator.escape(laporan);

  // Tambahkan ke log file
  const laporanData = {
    waktu: new Date().toISOString(),
    path: laporan,
    ip: req.ip
  };

  // Simpan dengan cara aman (append ke file JSON log)
  let data = [];
  if (fs.existsSync(LAPORAN_LOG)) {
    try {
      data = JSON.parse(fs.readFileSync(LAPORAN_LOG));
    } catch (e) {
      data = [];
    }
  }
  data.push(laporanData);
  fs.writeFileSync(LAPORAN_LOG, JSON.stringify(data, null, 2));

  res.json({ success: true, message: 'Laporan diterima. Terima kasih!' });
});

//Route Halaman Sistem (RHS)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
app.get('/lapor', (req, res) => res.sendFile(path.join(__dirname, 'views', 'lapor.html')));
app.get('/tutorial', (req, res) => res.sendFile(path.join(__dirname, 'views', 'tutorial.html')));

// troll page
app.get('/api', (req, res) => {
  res.type('text/plain').send('mau ngapain sih mas?');
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
