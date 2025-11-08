const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const compilerManager = require('./compilerManager');

const RUN_ROOT = path.join(process.cwd(), 'run');
const SOURCE_FILENAME = 'Program.vx';
const ASSEMBLY_FILENAME = 'Program.dll';
const RUNTIME_CONFIG_FILENAME = 'Program.runtimeconfig.json';
const DOTNET_BINARY_NAME = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';
const DOTNET_ROOT = path.join(os.homedir(), '.dotnet');
const DOTNET_HOST_PATH = path.join(DOTNET_ROOT, DOTNET_BINARY_NAME);

const BWRAP_BINARY = process.env.BWRAP_PATH || 'bwrap';
const TIMEOUT_BINARY = process.env.TIMEOUT_PATH || 'timeout';
const COMPILE_TIMEOUT_SECONDS = 5;
const RUN_TIMEOUT_SECONDS = 10;
const KILL_AFTER_SECONDS = 1;

async function compileAndRun(code) {
  const runId = generateRunId();
  const sessionDir = path.join(RUN_ROOT, runId);
  const outputParts = [];

  await prepareRunDirectory(sessionDir);

  try {
    await compilerManager.ensureCompilerReady();
    await assertPathExists(DOTNET_ROOT);
    await assertPathExists(DOTNET_HOST_PATH);

    const compilerPaths = compilerManager.getCompilerPaths();

    const compileOutput = await compileUserCodeInSandbox({
      code,
      sessionDir,
      compilerPaths,
      runId
    });
    outputParts.push(compileOutput);

    await ensureAssemblyArtifacts(sessionDir);
    await ensureRuntimeConfig(sessionDir);

    const runOutput = await runAssemblyInSandbox({
      sessionDir,
      runId
    });
    outputParts.push(runOutput);

    return {
      success: true,
      error: null,
      output: formatOutput(outputParts)
    };
  } catch (error) {
    if (error.stdout) {
      outputParts.push(error.stdout);
    }
    if (error.stderr) {
      outputParts.push(error.stderr);
    }
    if (error.details) {
      outputParts.push(error.details);
    }

    return {
      success: false,
      error: describeError(error),
      output: formatOutput(outputParts)
    };
  } finally {
    await cleanupRunDirectory(sessionDir);
  }
}

async function simulateCompileAndRun(code) {
  const preview = code.split('\n').slice(0, 5).join('\n');
  return {
    success: true,
    error: null,
    output: [
      'Simulation mode: sandbox disabled.',
      'No compilation or execution was performed.',
      preview && '---',
      preview
    ]
      .filter(Boolean)
      .join('\n')
  };
}

async function compileUserCodeInSandbox({ code, sessionDir, compilerPaths, runId }) {
  const sourcePath = path.join(sessionDir, SOURCE_FILENAME);
  await fsp.writeFile(sourcePath, code, 'utf8');

  const env = buildSandboxEnv(runId, sessionDir);
  const timeoutArgs = buildCompileTimeoutArgs(sessionDir, compilerPaths);

  try {
    const { stdout, stderr } = await runProcess(TIMEOUT_BINARY, timeoutArgs, { env });
    return formatOutput([stdout, stderr]);
  } catch (error) {
    error.phase = 'compile';
    throw error;
  }
}

async function runAssemblyInSandbox({ sessionDir, runId }) {
  const env = buildSandboxEnv(runId, sessionDir);
  const timeoutArgs = buildRunTimeoutArgs(sessionDir);

  try {
    const { stdout, stderr } = await runProcess(TIMEOUT_BINARY, timeoutArgs, { env });
    return formatOutput([stdout, stderr]);
  } catch (error) {
    error.phase = 'run';
    throw error;
  }
}

function buildCompileTimeoutArgs(sessionDir, compilerPaths) {
  const compilerInvocation = buildCompilerInvocation(compilerPaths);
  const bwrapArgs = [
    '--unshare-all',
    '--new-session',
    '--die-with-parent',
    '--tmpfs',
    '/tmp',
    '--bind',
    sessionDir,
    '/work',
    '--ro-bind',
    DOTNET_ROOT,
    '/dotnet',
    '--ro-bind',
    compilerPaths.compilerDir,
    '/compiler',
    '--clearenv',
    '--setenv',
    'PATH',
    '/dotnet',
    '--setenv',
    'HOME',
    '/nonexistent',
    '--chdir',
    '/work',
    compilerInvocation.command,
    ...compilerInvocation.args
  ];

  return [
    '--signal=KILL',
    `--kill-after=${KILL_AFTER_SECONDS}s`,
    `${COMPILE_TIMEOUT_SECONDS}s`,
    BWRAP_BINARY,
    ...bwrapArgs
  ];
}

function buildRunTimeoutArgs(sessionDir) {
  const bwrapArgs = [
    '--unshare-all',
    '--new-session',
    '--die-with-parent',
    '--tmpfs',
    '/tmp',
    '--ro-bind',
    sessionDir,
    '/',
    '--dir',
    '/dotnet',
    '--ro-bind',
    DOTNET_ROOT,
    '/dotnet',
    '--clearenv',
    '--setenv',
    'PATH',
    '/dotnet',
    '--setenv',
    'HOME',
    '/nonexistent',
    '--chdir',
    '/',
    '/dotnet/dotnet',
    `/${ASSEMBLY_FILENAME}`
  ];

  return [
    '--signal=KILL',
    `--kill-after=${KILL_AFTER_SECONDS}s`,
    `${RUN_TIMEOUT_SECONDS}s`,
    BWRAP_BINARY,
    ...bwrapArgs
  ];
}

function buildCompilerInvocation(compilerPaths) {
  const relativeEntry = path.relative(compilerPaths.compilerDir, compilerPaths.entryPoint);

  if (relativeEntry.startsWith('..')) {
    throw new Error('Compiler entry point must be inside the compiler directory');
  }

  const sandboxEntry = path.posix.join('/compiler', toPosixPath(relativeEntry));
  const sourceArg = path.posix.join('/work', SOURCE_FILENAME);

  if (compilerPaths.selfContained) {
    return {
      command: sandboxEntry,
      args: [sourceArg]
    };
  }

  return {
    command: '/dotnet/dotnet',
    args: [sandboxEntry, sourceArg]
  };
}

function buildSandboxEnv(runId, sessionDir) {
  return {
    ...process.env,
    RUNID: runId,
    SESSION_DIR: sessionDir,
    DOTNET: DOTNET_HOST_PATH
  };
}

async function prepareRunDirectory(runDir) {
  await fsp.mkdir(runDir, { recursive: true, mode: 0o700 });
  try {
    await fsp.chmod(runDir, 0o700);
  } catch {
    // chmod best-effort
  }
}

async function cleanupRunDirectory(runDir) {
  try {
    await fsp.rm(runDir, { recursive: true, force: true });
  } catch {
    // cleanup best-effort
  }
}

async function ensureAssemblyArtifacts(runDir) {
  const dllPath = path.join(runDir, ASSEMBLY_FILENAME);
  if (await pathExists(dllPath)) {
    return;
  }

  const exePath = path.join(runDir, 'Program.exe');
  if (await pathExists(exePath)) {
    await fsp.rename(exePath, dllPath);
    return;
  }

  throw new Error('Compiled assembly not found');
}

async function ensureRuntimeConfig(runDir) {
  const runtimeConfigPath = path.join(runDir, RUNTIME_CONFIG_FILENAME);
  if (await pathExists(runtimeConfigPath)) {
    return;
  }

  throw new Error('Runtime config not found');
}

async function assertPathExists(targetPath) {
  await fsp.access(targetPath, fs.constants.R_OK);
}

async function pathExists(targetPath) {
  try {
    await fsp.access(targetPath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function describeError(error) {
  if (error.phase === 'compile' && error.exitCode === 124) {
    return `Compile sandbox timed out after ${COMPILE_TIMEOUT_SECONDS}s`;
  }

  if (error.phase === 'run' && error.exitCode === 124) {
    return `Program timed out after ${RUN_TIMEOUT_SECONDS}s`;
  }

  if (error.phase === 'compile') {
    return error.message || 'Compilation failed';
  }

  if (error.phase === 'run') {
    return error.message || 'Program execution failed';
  }

  return error.message || 'Failed to compile or run code';
}

function generateRunId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function formatOutput(chunks) {
  return chunks
    .filter((chunk) => typeof chunk === 'string' && chunk.trim().length > 0)
    .join('\n')
    .trim();
}

function toPosixPath(value) {
  return value.split(path.sep).join(path.posix.sep);
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || undefined,
      env: options.env || process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (spawnError) => {
      reject(new CommandError(command, args, null, null, stdout, stderr, spawnError.message));
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr, code, signal });
        return;
      }

      reject(new CommandError(command, args, code, signal, stdout, stderr));
    });
  });
}

class CommandError extends Error {
  constructor(command, args, code, signal, stdout, stderr, details) {
    super(
      code === null
        ? `Failed to run "${command}"`
        : `Command "${command} ${args.join(' ')}" exited with code ${code}`
    );
    this.exitCode = code;
    this.signal = signal;
    this.stdout = stdout;
    this.stderr = stderr;
    this.details = details;
  }
}

module.exports = {
  compileAndRun,
  simulateCompileAndRun
};
