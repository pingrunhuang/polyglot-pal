import app from './api/index.js';
import https from 'https';
import fs from 'fs';

const PORT = 3000;

// --- START SERVER (HTTPS or HTTP) ---

let server;
const keyPath = './key.pem';
const certPath = './cert.pem';

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
    // Fallback to HTTP
    console.log(`\n⚠️ No SSL certificates found (key.pem, cert.pem). Starting in HTTP mode.`);
    console.log(`   To enable HTTPS (required for Vercel/Remote):`);
    console.log(`   Run: openssl req -nodes -new -x509 -keyout key.pem -out cert.pem -days 365 -subj "/CN=localhost"`);
    server = app;
}

server.listen(PORT, '0.0.0.0', () => {
    const protocol = server instanceof https.Server ? 'https' : 'http';
    console.log(`\n🚀 Server running on ${protocol}://localhost:${PORT}`);
    console.log(`   Backend API accessible at: ${protocol}://localhost:${PORT}/api`);
});
