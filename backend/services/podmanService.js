const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const compilerManager = require('./compilerManager');

const PODMAN_PATH = process.env.PODMAN_PATH || 'podman';
const PODMAN_IMAGE = process.env.PODMAN_IMAGE || 'mcr.microsoft.com/dotnet/runtime:9.0';
const PODMAN_EXTRA_ARGS = parseArgs(process.env.PODMAN_EXTRA_ARGS || '');
const SANDBOX_TIMEOUT_MS = parseTimeout(process.env.SANDBOX_TIMEOUT_MS);
const PODMAN_MEMORY_LIMIT = process.env.PODMAN_MEMORY_LIMIT || '512m';
const PODMAN_PIDS_LIMIT = process.env.PODMAN_PIDS_LIMIT || '64';
const RUN_ROOT = path.join(process.cwd(), 'run');
const SOURCE_FILENAME = 'Program.vx';
const ASSEMBLY_FILENAME = 'Program.dll';
const RUNTIME_CONFIG_FILENAME = 'Program.runtimeconfig.json';
const ALT_ASSEMBLY_FILENAME = 'Program.exe';

async function compileAndRun(code) {
  await compilerManager.ensureCompilerReady();
  await ensureRunRoot();

  const runId = randomUUID();
  const jobDir = path.join(RUN_ROOT, runId);
  await fsp.mkdir(jobDir, { recursive: true });
  await ensureWritable(jobDir);

  const sourcePath = path.join(jobDir, SOURCE_FILENAME);
  await fsp.writeFile(sourcePath, code, 'utf8');

  const deadline = Date.now() + SANDBOX_TIMEOUT_MS;

  try {
    await runInsidePodman(jobDir, ['dotnet', '/compiler/Verifex.dll', '/sandbox/Program.vx'], remaining(deadline));
    await ensureAssemblyArtifacts(jobDir);
    await ensureRuntimeConfig(jobDir);
    const runResult = await runInsidePodman(jobDir, ['dotnet', '/sandbox/Program.dll'], remaining(deadline));

    return {
      success: true,
      output: runResult.stdout.trim(),
      error: ''
    };
  } catch (error) {
    return {
      success: false,
      output: (error.stdout || '').trim(),
      error: (error.stderr || error.message || 'Sandbox execution failed').trim()
    };
  } finally {
    await cleanupJobDir(jobDir);
  }
}

async function simulateCompileAndRun(code) {
  return {
    success: true,
    output: `Simulation mode active. Received program (${code.length} bytes).`,
    error: ''
  };
}

async function ensureRunRoot() {
  await fsp.mkdir(RUN_ROOT, { recursive: true });
  await ensureWritable(RUN_ROOT);
}

function remaining(deadline) {
  const delta = deadline - Date.now();
  if (delta <= 0) {
    const timeoutError = new Error('Sandbox timeout exceeded before execution.');
    timeoutError.stderr = 'Sandbox timeout exceeded before execution.';
    throw timeoutError;
  }
  return delta;
}

async function runInsidePodman(jobDir, containerArgs, timeoutMs) {
  const { compilerDir } = compilerManager.getCompilerPaths();
  const args = buildPodmanArgs(compilerDir, jobDir, containerArgs);
  return runWithTimeout(PODMAN_PATH, args, timeoutMs);
}

function buildPodmanArgs(compilerDir, jobDir, containerArgs) {
  const args = [
    'run',
    '--rm',
    '--network',
    'none',
    '--ipc',
    'none',
    '--pids-limit',
    PODMAN_PIDS_LIMIT,
    '--memory',
    PODMAN_MEMORY_LIMIT,
    '--security-opt',
    'no-new-privileges',
    '--cap-drop',
    'ALL',
    '--read-only',
    '--tmpfs',
    '/tmp:rw,nodev,nosuid,noexec,size=64M',
    '--tmpfs',
    '/run:rw,nodev,nosuid,noexec,size=16M',
    '--volume',
    `${path.resolve(compilerDir)}:/compiler:ro`,
    '--volume',
    `${path.resolve(jobDir)}:/sandbox:rw`,
    '--workdir',
    '/sandbox',
    '--user',
    '65534:65534',
    '--env',
    'DOTNET_NOLOGO=1'
  ];

  if (PODMAN_EXTRA_ARGS.length > 0) {
    args.push(...PODMAN_EXTRA_ARGS);
  }

  args.push(PODMAN_IMAGE, ...containerArgs);
  return args;
}

function runWithTimeout(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);

      if (timedOut) {
        const timeoutError = new Error(`Sandbox timeout after ${timeoutMs} ms`);
        timeoutError.stdout = stdout;
        timeoutError.stderr = stderr;
        return reject(timeoutError);
      }

      if (signal) {
        const signalError = new Error(`Sandbox terminated via signal: ${signal}`);
        signalError.stdout = stdout;
        signalError.stderr = stderr;
        return reject(signalError);
      }

      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const err = new Error(`Sandbox exited with code ${code}`);
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

async function ensureAssemblyArtifacts(jobDir) {
  const dllPath = path.join(jobDir, ASSEMBLY_FILENAME);
  if (await pathExists(dllPath)) {
    return dllPath;
  }

  const exePath = path.join(jobDir, ALT_ASSEMBLY_FILENAME);
  if (await pathExists(exePath)) {
    await fsp.rename(exePath, dllPath);
    return dllPath;
  }

  throw new Error('Compiled assembly not found');
}

async function ensureRuntimeConfig(jobDir) {
  const configPath = path.join(jobDir, RUNTIME_CONFIG_FILENAME);
  if (await pathExists(configPath)) {
    return configPath;
  }

  throw new Error('Runtime config not found');
}

async function cleanupJobDir(jobDir) {
  try {
    await fsp.rm(jobDir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureWritable(targetPath) {
  try {
    await fsp.chmod(targetPath, 0o777);
  } catch {
    // chmod best-effort (rootless podman just needs world-writable)
  }
}

function parseTimeout(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return 10000;
}

function parseArgs(raw) {
  const tokens = raw
    .match(/(?:[^\s"]+|"[^"]*")+/g);

  if (!tokens) {
    return [];
  }

  return tokens.map((token) => {
    if (token.startsWith('"') && token.endsWith('"')) {
      return token.slice(1, -1);
    }
    return token;
  });
}

module.exports = {
  compileAndRun,
  simulateCompileAndRun
};
