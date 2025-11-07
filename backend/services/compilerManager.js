const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');

const COMPILER_REPO =
  process.env.VERIFEX_COMPILER_REPO || 'https://github.com/Trivaxy/Verifex.git';
const VERIFEX_VERSION = process.env.VERIFEX_VERSION || 'master';
const Z3_DOWNLOAD_URL =
  process.env.Z3_DOWNLOAD_URL ||
  'https://github.com/Z3Prover/z3/releases/download/z3-4.12.2/z3-4.12.2-x64-glibc-2.31.zip';
const DEFAULT_RUNTIME_ID =
  process.env.VERIFEX_RUNTIME_ID || 'linux-x64';
const EXECUTABLE_NAME =
  process.env.VERIFEX_BINARY_NAME ||
  (DEFAULT_RUNTIME_ID.toLowerCase().startsWith('win') ? 'Verifex.exe' : 'Verifex');

const compilerDir = path.join(process.cwd(), 'compiler');
const buildDir = path.join(compilerDir, '.build');
const SINGLE_FILE_ARTIFACTS = [EXECUTABLE_NAME, 'libz3.so'];
const FRAMEWORK_DEPENDENT_ARTIFACTS = [
  'Verifex.dll',
  'Verifex.runtimeconfig.json',
  'libz3.so'
];

let ensurePromise = null;

async function ensureCompilerReady() {
  if (!ensurePromise) {
    ensurePromise = internalEnsure().finally(() => {
      ensurePromise = null;
    });
  }

  return ensurePromise;
}

async function internalEnsure() {
  if (await isCompilerReady()) {
    return;
  }

  console.log('[compiler] Missing artifacts. Bootstrapping Verifex compiler…');
  await bootstrapCompiler();
  console.log('[compiler] Compiler ready.');
}

async function artifactsExist(artifacts) {
  try {
    await Promise.all(
      artifacts.map((name) =>
        fsp.access(path.join(compilerDir, name), fs.constants.R_OK)
      )
    );
    return true;
  } catch {
    return false;
  }
}

async function isCompilerReady() {
  if (await artifactsExist(SINGLE_FILE_ARTIFACTS)) {
    return true;
  }
  return artifactsExist(FRAMEWORK_DEPENDENT_ARTIFACTS);
}

async function bootstrapCompiler() {
  await fsp.rm(compilerDir, { recursive: true, force: true });
  await fsp.mkdir(compilerDir, { recursive: true });
  await fsp.rm(buildDir, { recursive: true, force: true });
  await fsp.mkdir(buildDir, { recursive: true });

  const repoDir = path.join(buildDir, 'Verifex');
  await run('git', ['clone', '--branch', VERIFEX_VERSION, '--depth', '1', COMPILER_REPO, repoDir]);

  const csprojPath = path.join(repoDir, 'Verifex', 'Verifex.csproj');
  await run('dotnet', [
    'publish',
    csprojPath,
    '-c',
    'Release',
    '-r',
    DEFAULT_RUNTIME_ID,
    '--self-contained',
    'true',
    '-p:PublishSingleFile=true',
    '-o',
    compilerDir
  ]);

  await installZ3();

  await fsp.rm(buildDir, { recursive: true, force: true });
}

async function installZ3() {
  const zipPath = path.join(buildDir, 'z3.zip');
  await run('wget', [Z3_DOWNLOAD_URL, '-O', zipPath]);
  await run('unzip', ['-o', zipPath, '-d', buildDir]);

  const extractedDirName = 'z3-4.12.2-x64-glibc-2.31';
  const extractedDir = path.join(buildDir, extractedDirName);
  const libPath = path.join(extractedDir, 'bin', 'libz3.so');

  await fsp.copyFile(libPath, path.join(compilerDir, 'libz3.so'));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[compiler] ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      cwd: options.cwd || undefined,
      stdio: 'inherit',
      shell: false
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Command "${command} ${args.join(' ')}" exited with code ${code}`
          )
        );
      }
    });
  });
}

function getCompilerPaths() {
  const singleBinaryPath = path.join(compilerDir, EXECUTABLE_NAME);
  if (fs.existsSync(singleBinaryPath)) {
    return {
      compilerDir,
      entryPoint: singleBinaryPath,
      selfContained: true
    };
  }

  return {
    compilerDir,
    entryPoint: path.join(compilerDir, 'Verifex.dll'),
    selfContained: false
  };
}

module.exports = {
  ensureCompilerReady,
  getCompilerPaths
};
