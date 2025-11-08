const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const compilerManager = require('./compilerManager');

const RUN_ROOT = path.join(process.cwd(), 'run');
const SOURCE_FILENAME = 'Program.vx';
const ASSEMBLY_FILENAME = 'Program.dll';
const RUNTIME_CONFIG_FILENAME = 'Program.runtimeconfig.json';
const DOTNET_BINARY_NAME = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';

const FIREJAIL_PATH = process.env.FIREJAIL_PATH || 'firejail';
const FIREJAIL_EXTRA_ARGS = parseArgString(process.env.FIREJAIL_EXTRA_ARGS || '');
const SANDBOX_TIMEOUT_MS = Number.parseInt(process.env.SANDBOX_TIMEOUT_MS || '', 10) || 10000;
const SANDBOX_TIMEOUT_SECONDS = Math.max(1, Math.ceil(SANDBOX_TIMEOUT_MS / 1000));
const SANDBOX_KILL_AFTER_SECONDS = 2;
const COMPILER_TIMEOUT_SECONDS = 10;
const COMPILER_KILL_AFTER_SECONDS = 2;

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
    if (error.timedOut) {
      message = `Compiler timed out after ${COMPILER_TIMEOUT_SECONDS}s`;
    } else if (error instanceof CommandError && error.exitCode === 124) {
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

  const dotnetBinary = locateDotnetBinary(compilerPaths);
  const env = buildCompilerEnv(runDir, compilerPaths);

  const { stdout, stderr } = await runCompilerWithTimeout(
    compilerPaths,
    dotnetBinary,
    sourcePath,
    runDir,
    env
  );

  await ensureAssemblyArtifacts(runDir);
  await ensureRuntimeConfig(runDir);

  return { compileOutput: formatOutput([stdout, stderr]) };
}

async function runSandboxedAssembly(runDir, compilerPaths) {
  const assemblyPath = path.join(runDir, ASSEMBLY_FILENAME);
  const runtimeConfigPath = path.join(runDir, RUNTIME_CONFIG_FILENAME);

  await assertPathExists(assemblyPath);
  await assertPathExists(runtimeConfigPath);

  const dotnetBinary = process.env.DOTNET_BINARY_PATH || DOTNET_BINARY_NAME;
  const dotnetCommandName = path.basename(dotnetBinary);

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
    `--private-bin=${dotnetCommandName}`,
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

async function ensureRuntimeConfig(runDir) {
  const runtimeConfigPath = path.join(runDir, RUNTIME_CONFIG_FILENAME);
  if (await pathExists(runtimeConfigPath)) {
    return;
  }

  throw new Error('Runtime config not found');
}

async function runCompilerWithTimeout(compilerPaths, dotnetBinary, sourcePath, runDir, env) {
  const command = compilerPaths.selfContained ? compilerPaths.entryPoint : dotnetBinary;
  const args = compilerPaths.selfContained
    ? [sourcePath]
    : [compilerPaths.entryPoint, sourcePath];

  return runProcess(command, args, {
    cwd: runDir,
    env,
    timeoutMs: COMPILER_TIMEOUT_SECONDS * 1000,
    killAfterMs: COMPILER_KILL_AFTER_SECONDS * 1000
  });
}

function buildCompilerEnv(runDir, compilerPaths) {
  const pathEntries = [runDir];

  if (compilerPaths.dotnetRoot) {
    pathEntries.push(compilerPaths.dotnetRoot);
  }

  if (process.env.PATH) {
    pathEntries.push(process.env.PATH);
  }

  const env = {
    ...process.env,
    PATH: pathEntries.join(path.delimiter)
  };

  if (compilerPaths.dotnetRoot) {
    env.DOTNET_ROOT = compilerPaths.dotnetRoot;
  }

  return env;
}

function locateDotnetBinary(compilerPaths) {
  if (process.env.DOTNET_BINARY_PATH) {
    return process.env.DOTNET_BINARY_PATH;
  }

  const searchPaths = (process.env.PATH || '').split(path.delimiter);
  for (const entry of searchPaths) {
    if (!entry) {
      continue;
    }
    const candidate = path.join(entry, DOTNET_BINARY_NAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (compilerPaths.dotnetRoot) {
    const candidate = path.join(compilerPaths.dotnetRoot, DOTNET_BINARY_NAME);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to locate "${DOTNET_BINARY_NAME}" on PATH. Install the .NET runtime or set DOTNET_BINARY_PATH.`
  );
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
    let timedOut = false;
    let timeoutTimer = null;
    let killTimer = null;

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

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        killTimer = setTimeout(() => {
          child.kill('SIGKILL');
        }, options.killAfterMs || 2000);
      }, options.timeoutMs);
    }

    child.on('error', (error) => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }
      reject(new CommandError(command, args, null, null, stdout, stderr, error.message));
    });

    child.on('close', (code, signal) => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
      }
      if (killTimer) {
        clearTimeout(killTimer);
      }

      if (timedOut) {
        const timeoutError = new CommandError(
          command,
          args,
          null,
          signal,
          stdout,
          stderr,
          `Process timed out after ${options.timeoutMs}ms`
        );
        timeoutError.timedOut = true;
        reject(timeoutError);
        return;
      }

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
