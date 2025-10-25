#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 9090;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  // Default to index.html
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log('🌐 Federation Dashboard');
  console.log('='.repeat(70));
  console.log(`🚀 Dashboard running at http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Features:');
  console.log('  • Real-time federation network visualization');
  console.log('  • Registered location monitoring');
  console.log('  • Shortcode resolution testing');
  console.log('  • Live activity logging');
  console.log('  • Federation health status');
  console.log('');
  console.log('💡 Make sure your wiki instances are running:');
  console.log('  cd ../');
  console.log('  ./start-test-environment.sh --federate');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('='.repeat(70));
});
