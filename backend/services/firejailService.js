const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const compilerManager = require('./compilerManager');

const RUN_ROOT = '/run';
const SOURCE_FILENAME = 'Program.vx';
const ASSEMBLY_FILENAME = 'Program.dll';
const RUNTIME_CONFIG_FILENAME = 'Program.runtimeconfig.json';
const DOTNET_BINARY_NAME = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';

const FIREJAIL_PATH = process.env.FIREJAIL_PATH || 'firejail';
const FIREJAIL_EXTRA_ARGS = parseArgString(process.env.FIREJAIL_EXTRA_ARGS || '');
const SANDBOX_TIMEOUT_MS = Number.parseInt(process.env.SANDBOX_TIMEOUT_MS || '', 10) || 10000;
const SANDBOX_TIMEOUT_SECONDS = Math.max(1, Math.ceil(SANDBOX_TIMEOUT_MS / 1000));
const SANDBOX_KILL_AFTER_SECONDS = 2;

async function compileAndRun(code) {
  const runId = generateRunId();
  const runDir = path.join(RUN_ROOT, runId);
  const outputParts = [];

  await prepareRunDirectory(runDir);

  try {
    await compilerManager.ensureCompilerReady();
    const compilerPaths = compilerManager.getCompilerPaths();

    const { compileOutput } = await compileUserCode(code, runDir, compilerPaths);
    outputParts.push(compileOutput);

    const sandboxOutput = await runSandboxedAssembly(runDir, compilerPaths);
    outputParts.push(sandboxOutput);

    return {
      success: true,
      output: formatOutput(outputParts),
      error: null
    };
  } catch (error) {
    if (error.stdout || error.stderr) {
      outputParts.push(error.stdout, error.stderr);
    }
    if (error.details) {
      outputParts.push(error.details);
    }

    let message = error.message || 'Failed to compile or run code';
    if (error instanceof CommandError && error.exitCode === 124) {
      message = `Sandbox timed out after ${SANDBOX_TIMEOUT_SECONDS}s`;
    }

    return {
      success: false,
      error: message,
      output: formatOutput(outputParts)
    };
  } finally {
    await cleanupRunDirectory(runDir);
  }
}

async function simulateCompileAndRun(code) {
  const preview = code.split('\n').slice(0, 5).join('\n');
  return {
    success: true,
    error: null,
    output: [
      'Simulation mode: Firejail disabled.',
      'No compilation or execution was performed.',
      preview && '---',
      preview
    ]
      .filter(Boolean)
      .join('\n')
  };
}

async function compileUserCode(code, runDir, compilerPaths) {
  const sourcePath = path.join(runDir, SOURCE_FILENAME);
  await fsp.writeFile(sourcePath, code, 'utf8');

  const env = {
    ...process.env,
    VERIFEXPAD_SKIP_EXECUTION: '1'
  };

  const dotnetBinary = getDotnetBinary(compilerPaths);
  if (dotnetBinary && compilerPaths.dotnetRoot) {
    env.PATH = `${compilerPaths.dotnetRoot}:${process.env.PATH || ''}`;
    env.DOTNET_ROOT = compilerPaths.dotnetRoot;
  }

  const command = compilerPaths.selfContained ? compilerPaths.entryPoint : dotnetBinary || DOTNET_BINARY_NAME;
  const args = compilerPaths.selfContained
    ? [sourcePath]
    : [compilerPaths.entryPoint, sourcePath];

  const { stdout, stderr } = await runProcess(command, args, {
    cwd: compilerPaths.compilerDir,
    env
  });

  await ensureAssemblyArtifacts(runDir);

  return { compileOutput: formatOutput([stdout, stderr]) };
}

async function runSandboxedAssembly(runDir, compilerPaths) {
  const assemblyPath = path.join(runDir, ASSEMBLY_FILENAME);
  const runtimeConfigPath = path.join(runDir, RUNTIME_CONFIG_FILENAME);

  await assertPathExists(assemblyPath);
  await assertPathExists(runtimeConfigPath);

  const dotnetBinary = getDotnetBinary(compilerPaths) || DOTNET_BINARY_NAME;

  const firejailArgs = [
    '--quiet',
    '--noprofile',
    '--private',
    '--private-tmp',
    '--private-dev',
    '--net=none',
    '--seccomp',
    '--caps.drop=all',
    '--restrict-namespaces',
    `--private-bin=${dotnetBinary}`,
    '--private-etc=localtime,passwd,group,nsswitch.conf',
    `--whitelist=${runDir}`,
    `--read-only=${runDir}`,
    ...FIREJAIL_EXTRA_ARGS
  ];

  const timeoutArgs = [
    '--foreground',
    `--kill-after=${SANDBOX_KILL_AFTER_SECONDS}s`,
    `${SANDBOX_TIMEOUT_SECONDS}s`,
    FIREJAIL_PATH,
    ...firejailArgs,
    dotnetBinary,
    assemblyPath
  ];

  const env = { ...process.env };
  if (compilerPaths.dotnetRoot) {
    env.PATH = `${compilerPaths.dotnetRoot}:${process.env.PATH || ''}`;
    env.DOTNET_ROOT = compilerPaths.dotnetRoot;
  }

  const { stdout, stderr } = await runProcess('timeout', timeoutArgs, { env });
  return formatOutput([stdout, stderr]);
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

function getDotnetBinary(compilerPaths) {
  if (compilerPaths.dotnetRoot) {
    return path.join(compilerPaths.dotnetRoot, DOTNET_BINARY_NAME);
  }
  return null;
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
    // ignore cleanup errors
  }
}

async function assertPathExists(targetPath) {
  try {
    await fsp.access(targetPath, fs.constants.R_OK);
  } catch {
    throw new Error(`Required file missing: ${targetPath}`);
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

function parseArgString(input) {
  if (!input.trim()) {
    return [];
  }

  const args = [];
  const regex = /"([^"]*)"|'([^']*)'|[^\s"']+/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    if (match[1] !== undefined) {
      args.push(match[1]);
    } else if (match[2] !== undefined) {
      args.push(match[2]);
    } else {
      args.push(match[0]);
    }
  }
  return args;
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

    child.on('error', (error) => {
      reject(new CommandError(command, args, null, null, stdout, stderr, error.message));
    });

    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr, code, signal });
      } else {
        reject(new CommandError(command, args, code, signal, stdout, stderr));
      }
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
