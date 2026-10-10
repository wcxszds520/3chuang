const express = require('express');
const cors = require('cors');
const responseMiddleware = require('./middleware/response');
const errorHandler = require('./middleware/errorHandler');

// Explicit launcher/test settings take precedence over optional local defaults.
// In particular an isolated demonstration must never select the production DB.
require('dotenv').config({ override: false });

// CRITICAL FIX: Log configured AI model for verification
console.log('========================================');
console.log(' API Model Configured:', process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || 'Not Set');
console.log('========================================');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(responseMiddleware);

app.use('/api', routes);

app.use((req, res) => {
  res.error('API endpoint not found', 404);
});

app.use(errorHandler);

let server;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`Server started successfully on port: ${PORT}`);
  });
}

module.exports = { app, server };
