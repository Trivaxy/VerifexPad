const express = require('express');
const router = express.Router();
const firejailService = require('../services/firejailService');
const fs = require('fs');
const path = require('path');
const FIREJAIL_DISABLED = process.env.FIREJAIL_DISABLED === 'true';

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
    let result;
    if (FIREJAIL_DISABLED) {
      console.log('Firejail disabled, using simulation mode');
      result = await firejailService.simulateCompileAndRun(code);
    } else {
      try {
        result = await firejailService.compileAndRun(code);
      } catch (sandboxError) {
        console.error('Firejail execution failed:', sandboxError);
        console.log('Falling back to simulation mode');
        result = await firejailService.simulateCompileAndRun(code);
      }
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

module.exports = router;
