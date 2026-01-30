require('dotenv').config();
const fs = require('fs');
const https = require('https');
const compilerManager = require('./services/compilerManager');
const { createApp } = require('./app');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 3001;
const TLS_PORT = process.env.TLS_PORT || 443;
const TLS_CERT_PATH = process.env.TLS_CERT_PATH;
const TLS_KEY_PATH = process.env.TLS_KEY_PATH;

const app = createApp();

const startHttpServer = () => {
  app.listen(PORT, HOST, () => {
    console.log(`VerifexPad backend HTTP server running on port ${PORT}`);
  });
};

async function startServer() {
  try {
    await compilerManager.ensureCompilerReady();
  } catch (error) {
    console.error('Failed to prepare Verifex compiler:', error);
    process.exit(1);
  }

  const hasTlsConfig = TLS_CERT_PATH && TLS_KEY_PATH;

  if (hasTlsConfig) {
    try {
      const httpsOptions = {
        cert: fs.readFileSync(TLS_CERT_PATH),
        key: fs.readFileSync(TLS_KEY_PATH)
      };

      https.createServer(httpsOptions, app).listen(TLS_PORT, HOST, () => {
        console.log(`VerifexPad backend HTTPS server running on port ${TLS_PORT}`);
      });
    } catch (error) {
      console.error('Failed to start HTTPS server. Falling back to HTTP.', error);
      startHttpServer();
    }
  } else {
    console.warn('TLS_CERT_PATH and TLS_KEY_PATH not set. Starting HTTP server only.');
    startHttpServer();
  }
}

startServer();

module.exports = { createApp };
