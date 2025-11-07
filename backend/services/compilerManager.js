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
const DOTNET_RUNTIME_URL =
  process.env.DOTNET_RUNTIME_URL ||
  'https://dotnetcli.azureedge.net/dotnet/Runtime/9.0.0/dotnet-runtime-9.0.0-linux-x64.tar.gz';
const OUTPUT_PATCH_MARKER = '// VerifexPad output forwarding patch';
const DEFAULT_RUNTIME_ID =
  process.env.VERIFEX_RUNTIME_ID || 'linux-x64';
const EXECUTABLE_NAME =
  process.env.VERIFEX_BINARY_NAME ||
  (DEFAULT_RUNTIME_ID.toLowerCase().startsWith('win') ? 'Verifex.exe' : 'Verifex');
const SHOULD_BUNDLE_DOTNET =
  process.env.VERIFEX_BUNDLE_DOTNET_RUNTIME !== 'false' &&
  process.platform === 'linux';
const COMPILER_SCHEMA_VERSION = '4';
const VERSION_FILENAME = '.verifexpad-version';
const DOTNET_DIRNAME = 'dotnet';
const DOTNET_BINARY_NAME = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';

const compilerDir = path.join(process.cwd(), 'compiler');
const buildDir = path.join(compilerDir, '.build');
const dotnetRelativeBinary = path.join(DOTNET_DIRNAME, DOTNET_BINARY_NAME);
const dotnetFxrPath = path.join(DOTNET_DIRNAME, 'host', 'fxr');
const dotnetRequiredPaths =
  SHOULD_BUNDLE_DOTNET ? [dotnetRelativeBinary, dotnetFxrPath] : [];
const SINGLE_FILE_ARTIFACTS = [
  EXECUTABLE_NAME,
  'libz3.so',
  ...dotnetRequiredPaths,
  VERSION_FILENAME
];
const FRAMEWORK_DEPENDENT_ARTIFACTS = [
  'Verifex.dll',
  'Verifex.runtimeconfig.json',
  'libz3.so',
  ...dotnetRequiredPaths,
  VERSION_FILENAME
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
  // Require version sentinel to match
  try {
    const versionPath = path.join(compilerDir, VERSION_FILENAME);
    const version = (await fsp.readFile(versionPath, 'utf8')).trim();
    if (version !== COMPILER_SCHEMA_VERSION) {
      return false;
    }
  } catch {
    return false;
  }

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
  await patchUpstreamCompiler(repoDir);

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
  if (SHOULD_BUNDLE_DOTNET) {
    await installDotnetRuntime();
  }
  await fsp.writeFile(
    path.join(compilerDir, VERSION_FILENAME),
    COMPILER_SCHEMA_VERSION,
    'utf8'
  );

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

async function installDotnetRuntime() {
  const tarPath = path.join(buildDir, 'dotnet-runtime.tar.gz');
  await run('wget', [DOTNET_RUNTIME_URL, '-O', tarPath]);

  const dotnetRoot = path.join(compilerDir, DOTNET_DIRNAME);
  await fsp.rm(dotnetRoot, { recursive: true, force: true });
  await fsp.mkdir(dotnetRoot, { recursive: true });
  await run('tar', ['-xzf', tarPath, '-C', dotnetRoot]);
 
  const dotnetBinary = path.join(dotnetRoot, DOTNET_BINARY_NAME);
  await fsp.chmod(dotnetBinary, 0o755);
  await fsp.access(path.join(dotnetRoot, 'host', 'fxr'), fs.constants.R_OK);
}

async function patchUpstreamCompiler(repoDir) {
  const programPath = path.join(repoDir, 'Verifex', 'Program.cs');
  let contents = await fsp.readFile(programPath, 'utf8');

  if (contents.includes(OUTPUT_PATCH_MARKER)) {
    return;
  }

  const needle =
    '    Console.WriteLine("----------------------------");';

  if (!contents.includes(needle)) {
    throw new Error('Unable to locate output patch insertion point');
  }

  const replacement = [
    '    process.WaitForExit();',
    '    process.CancelOutputRead();',
    '    process.CancelErrorRead();',
    `    ${OUTPUT_PATCH_MARKER}`,
    '',
    needle
  ].join('\n');

  const updated = contents.replace(needle, replacement);

  if (updated === contents) {
    throw new Error('Failed to apply output forwarding patch');
  }

  await fsp.writeFile(programPath, updated, 'utf8');
  console.log('[compiler] Applied Verifex output forwarding patch.');
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
  const dotnetRoot = SHOULD_BUNDLE_DOTNET
    ? path.join(compilerDir, DOTNET_DIRNAME)
    : null;

  if (fs.existsSync(singleBinaryPath)) {
    return {
      compilerDir,
      entryPoint: singleBinaryPath,
      selfContained: true,
      dotnetRoot
    };
  }

  return {
    compilerDir,
    entryPoint: path.join(compilerDir, 'Verifex.dll'),
    selfContained: false,
    dotnetRoot
  };
}

module.exports = {
  ensureCompilerReady,
  getCompilerPaths
};
