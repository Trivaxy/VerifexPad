const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhooks');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(bodyParser.json());

  app.use('/api', apiRoutes);
  app.use('/api/webhook', webhookRoutes);

  app.get('/', (req, res) => {
    res.json({ message: 'VerifexPad API Server' });
  });

  return app;
}

module.exports = { createApp };
