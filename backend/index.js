require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api', apiRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({ message: 'VerifexPad API Server' });
});

// Start server
app.listen(PORT, () => {
  console.log(`VerifexPad backend server running on port ${PORT}`);
});