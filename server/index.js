import app from './app.js';
import https from 'https';
import fs from 'fs';

// CRITICAL: Use the port provided by the environment (Render/Railway) or default to 3000
const PORT = process.env.PORT || 3000;

// --- START SERVER (HTTPS or HTTP) ---

let server;
const keyPath = './key.pem';
const certPath = './cert.pem';

// Check for SSL certs (only for local dev with self-signed certs)
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    // Start HTTPS Server
    try {
        const httpsOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
        server = https.createServer(httpsOptions, app);
        console.log(`\n🔒 HTTPS Enabled.`);
    } catch (err) {
        console.error("❌ Error loading SSL certificates:", err.message);
        console.log("⚠️ Falling back to HTTP...");
        server = app;
    }
} else {
    // Fallback to HTTP (Standard for Render/Vercel behind proxies)
    console.log(`\n⚠️ No SSL certificates found. Starting in HTTP mode.`);
    server = app;
}

server.listen(PORT, '0.0.0.0', () => {
    const protocol = server instanceof https.Server ? 'https' : 'http';
    console.log(`\n🚀 Server running on ${protocol}://0.0.0.0:${PORT}`);
    console.log(`   Backend API accessible at: ${protocol}://0.0.0.0:${PORT}/api`);
});
