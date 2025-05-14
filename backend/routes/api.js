const express = require('express');
const router = express.Router();
const dockerService = require('../services/dockerService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Temp directory for code execution
const TEMP_DIR = path.join(os.tmpdir(), 'verifexpad');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Compile and run Verifex code
 * @route POST /api/compile
 * @param {string} code - The Verifex source code to compile and run
 * @returns {Object} success, output, and error information
 */
router.post('/compile', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, error: 'No code provided' });
  }

  try {
    // For development, check if Docker is actually available
    const isDockerAvailable = await checkDockerAvailability();

    let result;
    if (isDockerAvailable) {
      try {
        result = await dockerService.compileAndRun(code);
      } catch (dockerError) {
        console.error('Docker execution failed:', dockerError);
        // Fallback to simulation only if Docker execution fails
        console.log('Docker execution failed, using simulation mode');
        result = await dockerService.simulateCompileAndRun(code);
      }
    } else {
      // Fallback to simulation for development
      console.log('Docker not available, using simulation mode');
      result = await dockerService.simulateCompileAndRun(code);
    }

    res.json(result);
  } catch (error) {
    console.error('Error during compilation:', error);

    res.status(500).json({
      success: false,
      error: 'Server error during compilation',
      output: error.toString()
    });
  }
});

/**
 * Get Verifex language reference
 * @route GET /api/reference
 * @returns {Object} content - The markdown content of the language reference
 */
router.get('/reference', (req, res) => {
  try {
    const referenceFilePath = path.join(__dirname, '..', 'reference.md');
    const content = fs.readFileSync(referenceFilePath, 'utf8');

    res.json({
      success: true,
      content: content
    });
  } catch (error) {
    console.error('Error serving reference document:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to load language reference',
      content: ''
    });
  }
});

/**
 * Health check endpoint
 * @route GET /api/health
 * @returns {Object} status information
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Check if Docker is available on the system
 * @returns {Promise<boolean>} Whether Docker is available
 */
async function checkDockerAvailability() {
  try {
    await require('util').promisify(require('child_process').exec)('docker --version');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = router;