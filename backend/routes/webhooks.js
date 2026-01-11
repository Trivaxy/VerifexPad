const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const compilerManager = require('../services/compilerManager');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const WEBHOOK_ENABLED = process.env.WEBHOOK_ENABLED !== 'false';
const COMPILER_REPO =
  process.env.VERIFEX_COMPILER_REPO || 'https://github.com/Trivaxy/Verifex.git';
const VERIFEX_VERSION = process.env.VERIFEX_VERSION || 'master';
const EXPECTED_BRANCH_REF = `refs/heads/${VERIFEX_VERSION}`;

/**
 * Handle GitHub webhook for compiler repository pushes
 * @route POST /api/webhook/github
 * @returns {string} Status message
 */
router.post('/github', async (req, res) => {
  // Check if webhooks are enabled
  if (!WEBHOOK_ENABLED) {
    return res.status(403).send('Webhooks are disabled');
  }

  // Validate content type
  if (!req.is('application/json')) {
    return res.status(400).send('Content-Type must be application/json');
  }

  const payload = req.body;

  // Verify HMAC signature if WEBHOOK_SECRET is configured
  if (WEBHOOK_SECRET) {
    const signature = req.get('X-Hub-Signature-256');
    if (!signature) {
      return res.status(401).send('Missing signature');
    }

    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return res.status(401).send('Invalid signature');
      }
    } catch {
      return res.status(401).send('Invalid signature format');
    }
  }

  // Validate repository
  const repoUrl = payload.repository?.url;
  if (!repoUrl || repoUrl !== COMPILER_REPO) {
    console.log(`[webhook] Ignored push from unrelated repo: ${repoUrl || 'unknown'}`);
    return res.status(200).send('Ignored: not the configured repository');
  }

  // Validate branch
  const branchRef = payload.ref;
  if (branchRef !== EXPECTED_BRANCH_REF) {
    console.log(`[webhook] Ignored push to branch: ${branchRef}`);
    return res.status(200).send(`Ignored: not the configured branch (${VERIFEX_VERSION})`);
  }

  // Trigger async rebuild
  console.log(`[webhook] Received valid push to ${branchRef}, triggering rebuild...`);
  compilerManager.rebuildCompiler().catch(err => {
    console.error('[webhook] Rebuild failed:', err);
  });

  return res.status(202).send('Rebuild triggered');
});

module.exports = router;
