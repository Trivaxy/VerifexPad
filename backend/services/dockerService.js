const { exec, spawn } = require('child_process');
const util = require('util');
const crypto = require('crypto');
const path = require('path');

const execPromise = util.promisify(exec);

const DEFAULT_CONTAINER_NAME = process.env.VERIFEX_CONTAINER_NAME || 'verifexpad-compiler';
const DEFAULT_IMAGE_NAME = process.env.VERIFEX_COMPILER_IMAGE || 'verifex-compiler';
const DEFAULT_WORKDIR = process.env.VERIFEX_CONTAINER_WORKDIR || '/tmp/verifexpad';
const DEFAULT_TIMEOUT = parseInt(process.env.DOCKER_TIMEOUT || '10', 10) * 1000;
const DEFAULT_MEMORY_LIMIT = process.env.DOCKER_MEMORY_LIMIT || '256m';
const DEFAULT_CPU_LIMIT = process.env.DOCKER_CPU_LIMIT || '0.5';
const DISABLE_NETWORK = process.env.DOCKER_DISABLE_NETWORK !== 'false';

function escapeForDoubleQuotes(command) {
  return command.replace(/(["$`\\])/g, '\\$1');
}

class DockerService {
  constructor() {
    this.containerName = DEFAULT_CONTAINER_NAME;
    this.imageName = DEFAULT_IMAGE_NAME;
    this.workdir = DEFAULT_WORKDIR;
    this.timeout = DEFAULT_TIMEOUT;
    this.memoryLimit = DEFAULT_MEMORY_LIMIT;
    this.cpuLimit = DEFAULT_CPU_LIMIT;
    this.disableNetwork = DISABLE_NETWORK;
    this._ensureContainerPromise = null;
  }

  /**
   * Compiles and runs Verifex code by executing the compiler inside a persistent Docker container.
   * @param {string} code - Verifex source code provided by the client.
   * @returns {Promise<{success: boolean, output: string, error: string|null}>}
   */
  async compileAndRun(code) {
    try {
      await this.ensureCompilerContainer();

      const sessionId = crypto.randomBytes(8).toString('hex');
      const sessionDir = path.posix.join(this.workdir, `session-${sessionId}`);
      const sourceFile = path.posix.join(sessionDir, 'program.vfx');

      await this.execInContainer(`mkdir -p '${sessionDir}'`);
      await this.writeFileInContainer(sourceFile, code);

      try {
        const { stdout, stderr } = await this.execInContainer(
          `cd '${sessionDir}' && dotnet /app/publish/Verifex.dll program.vfx`,
          { captureOutput: true }
        );

        return {
          success: true,
          output: stdout,
          error: stderr ? stderr : null
        };
      } catch (execError) {
        if (execError.killed && execError.signal === 'SIGTERM') {
          return {
            success: false,
            error: 'Execution timed out',
            output: execError.stdout || ''
          };
        }

        return {
          success: false,
          error: execError.stderr || execError.message,
          output: execError.stdout || ''
        };
      } finally {
        await this.execInContainer(`rm -rf '${sessionDir}'`).catch(() => {});
      }
    } catch (error) {
      console.error('Docker service error:', error);
      return {
        success: false,
        error: 'Internal server error',
        output: ''
      };
    }
  }

  /**
   * Simulates compilation when Docker is unavailable (development fallback).
   * @param {string} code
   * @returns {Promise<{success: boolean, output: string, error: string|null}>}
   */
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

  async ensureCompilerContainer() {
    if (this._ensureContainerPromise) {
      return this._ensureContainerPromise;
    }

    this._ensureContainerPromise = this._ensureContainerInternal();

    try {
      await this._ensureContainerPromise;
    } finally {
      this._ensureContainerPromise = null;
    }
  }

  async _ensureContainerInternal() {
    const isRunning = await this.isContainerRunning();
    if (isRunning) {
      return;
    }

    await execPromise(`docker rm -f ${this.containerName}`).catch(() => {});

    const runCommand = [
      'docker',
      'run',
      '-d',
      '--rm',
      '--name',
      this.containerName,
    ];

    if (this.memoryLimit) {
      runCommand.push('--memory', this.memoryLimit);
    }

    if (this.cpuLimit) {
      runCommand.push('--cpus', this.cpuLimit);
    }

    if (this.disableNetwork) {
      runCommand.push('--network', 'none');
    }

    runCommand.push('--workdir', this.workdir);
    runCommand.push('--entrypoint', 'tail');
    runCommand.push(this.imageName, '-f', '/dev/null');

    await execPromise(runCommand.join(' '));
    await this.execInContainer(`mkdir -p '${this.workdir}'`);
  }

  async isContainerRunning() {
    try {
      const { stdout } = await execPromise(`docker inspect -f "{{.State.Running}}" ${this.containerName}`);
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  async execInContainer(command, options = {}) {
    const escapedCommand = escapeForDoubleQuotes(command);
    const execOptions = {
      timeout: this.timeout,
      maxBuffer: 2 * 1024 * 1024,
      ...options.execOptions
    };

    if (options.captureOutput) {
      return execPromise(
        `docker exec ${this.containerName} sh -c "${escapedCommand}"`,
        execOptions
      );
    }

    return execPromise(
      `docker exec ${this.containerName} sh -c "${escapedCommand}"`,
      execOptions
    );
  }

  async writeFileInContainer(filePath, contents) {
    const escapedFilePath = filePath.replace(/'/g, "'\\''");
    await new Promise((resolve, reject) => {
      const child = spawn(
        'docker',
        ['exec', '-i', this.containerName, 'sh', '-c', `cat > '${escapedFilePath}'`],
        { stdio: ['pipe', 'ignore', 'pipe'] }
      );

      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });

      child.on('error', reject);

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(stderr.trim() || 'Failed to write code inside container'));
        }
      });

      child.stdin.end(contents);
    });
  }
}

module.exports = new DockerService();
