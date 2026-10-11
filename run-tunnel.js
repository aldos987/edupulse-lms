const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
const logFile = path.join(__dirname, 'tunnel.log');
const urlFile = path.join(__dirname, 'public-url.txt');

// Ensure server.js is running
const http = require('http');

function checkServer(callback) {
  const req = http.get('http://127.0.0.1:3000/api/health', (res) => {
    callback(true);
  });
  req.on('error', () => {
    callback(false);
  });
}

function startLmsServer() {
  console.log('⚡ Server LMS lokal belum aktif. Menjalankan server.js...');
  const srv = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    detached: false
  });
  srv.on('error', (err) => {
    console.error('Gagal menjalankan server.js:', err);
  });
}

checkServer((running) => {
  if (!running) {
    startLmsServer();
  } else {
    console.log('✅ Server LMS lokal terdeteksi aktif pada port 3000.');
  }

  setTimeout(startTunnel, 1500);
});

function startTunnel() {
  console.log('🚀 Memulai Cloudflare Secure Tunnel untuk EduPulse LMS...');

  const child = spawn(cloudflaredPath, [
    'tunnel',
    '--protocol', 'http2',
    '--url', 'http://127.0.0.1:3000',
    '--no-autoupdate'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

let publicUrl = null;

function handleLine(line) {
  fs.appendFileSync(logFile, line + '\n');
  const match = line.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/i);
  if (match && !publicUrl) {
    publicUrl = match[0];
    fs.writeFileSync(urlFile, publicUrl);
    console.log('\n============================================================');
    console.log('🎉 LINK HOSTING LMS BERHASIL AKTIF & SIAP DIBAGIKAN KE SISWA!');
    console.log(`🌐 URL PUBLIK: ${publicUrl}`);
    console.log('============================================================');
    console.log('Siswa dapat mengakses link ini langsung dari HP / Laptop di rumah.');
    console.log('Data tugas dan absensi akan otomatis tersimpan dan sinkron ke Google Sheets!\n');
  }
}

child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach(handleLine);
});

child.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  lines.forEach(handleLine);
});

child.on('exit', (code) => {
  console.log(`Cloudflare Tunnel berhenti dengan kode: ${code}`);
});

process.on('SIGINT', () => {
  child.kill();
  process.exit();
});
}
