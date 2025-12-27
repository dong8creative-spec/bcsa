// Simple HTTP server for static files
// This solves the file:// protocol issue with Daum Postcode service
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the project root
app.use(express.static(__dirname));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'HTTP server is running' });
});

app.listen(PORT, () => {
  console.log(`\n✅ HTTP Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${__dirname}`);
  console.log(`\n🌐 Open your browser and navigate to:`);
  console.log(`   http://localhost:${PORT}/index.html\n`);
});

