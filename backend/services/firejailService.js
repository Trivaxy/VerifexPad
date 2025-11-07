const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const compilerManager = require('./compilerManager');

const FIREJAIL_CMD = process.env.FIREJAIL_PATH || 'firejail';
const SANDBOX_TIMEOUT_MS = parseInt(
  process.env.SANDBOX_TIMEOUT_MS || '10000',
  10
);

class FirejailService {
  async compileAndRun(code) {
    await compilerManager.ensureCompilerReady();
    const { compilerDir } = compilerManager.getCompilerPaths();
    const sessionsRoot = path.join(compilerDir, 'sessions');
    await fsp.mkdir(sessionsRoot, { recursive: true });

    const sessionDir = await fsp.mkdtemp(
      path.join(sessionsRoot, 'verifexpad-session-')
    );
    const programPath = path.join(sessionDir, 'program.vfx');
    await fsp.writeFile(programPath, code, 'utf8');

    try {
      const result = await this.runInSandbox(programPath);
      return {
        success: true,
        output: result.stdout,
        error: result.stderr ? result.stderr : null
      };
    } catch (error) {
      if (error.type === 'timeout') {
        return {
          success: false,
          error: 'Execution timed out',
          output: error.stdout || ''
        };
      }

      return {
        success: false,
        error: error.stderr || error.message,
        output: error.stdout || ''
      };
    } finally {
      await fsp.rm(sessionDir, { recursive: true, force: true });
    }
  }

  async runInSandbox(programPath) {
    const { compilerDir, entryPoint, selfContained, dotnetRoot } =
      compilerManager.getCompilerPaths();
    
    // Get session directory from program path
    const sessionDir = path.dirname(programPath);
    const sessionName = path.basename(sessionDir);
    
    // With --private=compilerDir, that directory becomes the user's home
    // Paths inside the jail are relative to the new home directory
    const os = require('os');
    const username = os.userInfo().username;
    const jailHomeBase = process.platform === 'win32' ? '/home/' + username : '/home/' + username;
    
    const jailEntryPoint = path.join(jailHomeBase, path.basename(entryPoint));
    const jailDllPath = path.join(jailHomeBase, path.basename(entryPoint));
    const jailProgramPath = path.join(jailHomeBase, 'sessions', sessionName, 'program.vfx');
    const jailDotnetRoot = path.join(jailHomeBase, 'dotnet');
    const jailExtractDir = path.join(jailHomeBase, 'sessions', sessionName, '.net-extract');
    
    const firejailArgs = [
      '--noprofile',
      '--quiet',
      // Network and privilege restrictions
      '--net=none',
      '--caps.drop=all',
      '--nonewprivs',
      '--seccomp',
      // Mount compiler directory as sandboxed home (avoids whitelist issues)
      `--private=${compilerDir}`,
      '--private-dev',
      '--private-tmp',
      '--private-etc=hosts,hostname,resolv.conf',
      // Timeout protection
      `--timeout=00:00:${Math.ceil(SANDBOX_TIMEOUT_MS / 1000).toString().padStart(2, '0')}`,
      // Environment variables
      `--env=LD_LIBRARY_PATH=${jailHomeBase}`,
      `--env=DOTNET_ROOT=${jailDotnetRoot}`,
      `--env=DOTNET_BUNDLE_EXTRACT_BASE_DIR=${jailExtractDir}`,
      `--env=PATH=${jailDotnetRoot}:/usr/local/bin:/usr/bin:/bin`
    ];

    if (process.env.FIREJAIL_EXTRA_ARGS) {
      firejailArgs.push(
        ...process.env.FIREJAIL_EXTRA_ARGS.split(' ').filter(Boolean)
      );
    }

    if (selfContained) {
      firejailArgs.push(jailEntryPoint, jailProgramPath);
    } else {
      firejailArgs.push('dotnet', jailDllPath, jailProgramPath);
    }

    return spawnWithTimeout(FIREJAIL_CMD, firejailArgs, SANDBOX_TIMEOUT_MS);
  }

  async simulateCompileAndRun(code) {
    return new Promise((resolve) => {
      setTimeout(() => {
        let success = true;
        let error = null;
        let output = '';

        if (!code.includes('fn main()')) {
          success = false;
          error = 'Error: No main function found';
        } else if (code.includes('// ERROR')) {
          success = false;
          error = 'Error: Syntax error in code';
        } else if (code.includes('mut') && !code.match(/mut\s+\w+\s*:/)) {
          success = false;
          error = 'Error: Mutable variable declarations require a type annotation';
        } else if (code.match(/\w+\s*=\s*\w+\s*\+\s*".*"/)) {
          success = false;
          error = 'Error: Cannot add numeric and string types';
        } else if (code.match(/if\s+[^{]+\s*[^{]/)) {
          success = false;
          error = 'Error: Missing block after if condition';
        } else {
          const printRegex = /io\.print\s*\(\s*"([^"]*)"\s*\)/g;
          let match;
          while ((match = printRegex.exec(code)) !== null) {
            output += match[1] + '\n';
          }

          if (!output) {
            output = 'Program executed successfully with no output.';
          }
        }

        resolve({ success, error, output });
      }, 750);
    });
  }
}

function spawnWithTimeout(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject({ type: 'timeout', stdout, stderr });
      } else if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Sandbox exited with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

module.exports = new FirejailService();
