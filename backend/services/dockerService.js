const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const util = require('util');

const execPromise = util.promisify(exec);

class DockerService {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'verifexpad');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Compiles and runs Verifex code in a Docker container
   * @param {string} code - The Verifex source code
   * @returns {Promise<Object>} - Compilation and execution results
   */
  async compileAndRun(code) {
    // Create a unique session directory
    const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const sessionDir = path.join(this.tempDir, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    
    try {
      // Write the code to a file
      const sourceFilePath = path.join(sessionDir, 'program.vfx');
      fs.writeFileSync(sourceFilePath, code);

      // Ensure proper permissions for generated files
      fs.chmodSync(sessionDir, 0o777);
      fs.chmodSync(sourceFilePath, 0o666);
      
      // Set resource limits
      const memoryLimit = process.env.DOCKER_MEMORY_LIMIT || '256m';
      const cpuLimit = process.env.DOCKER_CPU_LIMIT || '0.5';
      const timeout = process.env.DOCKER_TIMEOUT || '10';
      
      // Run the Docker container for code execution only
      const dockerCommand = `docker run --rm \
        --memory=${memoryLimit} \
        --cpus=${cpuLimit} \
        --network=none \
        -v "${sessionDir}:/tmp/code" \
        --name verifex-${sessionId} \
        --workdir=/tmp/code \
        --user verifexuser \
        verifex-compiler \
        program.vfx`;
      
      try {
        const { stdout, stderr } = await execPromise(dockerCommand, { timeout: parseInt(timeout) * 1000 });
        
        return {
          success: true,
          output: stdout,
          error: stderr || null
        };
      } catch (execError) {
        // Check if this is a timeout error
        if (execError.killed && execError.signal === 'SIGTERM') {
          return {
            success: false,
            error: 'Execution timed out',
            output: execError.stdout || ''
          };
        }
        
        // For compilation errors, we still want to return any output
        return {
          success: false,
          error: execError.stderr || execError.message,
          output: execError.stdout || ''
        };
      }
    } catch (error) {
      console.error('Docker service error:', error);
      return {
        success: false,
        error: 'Internal server error',
        output: ''
      };
    } finally {
      // Clean up the session directory
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    }
  }
  
  /**
   * Simulates compilation and execution for development when Docker is not available
   * @param {string} code - The Verifex source code
   * @returns {Promise<Object>} - Simulated results
   */
  async simulateCompileAndRun(code) {
    return new Promise((resolve) => {
      // More sophisticated simulation with better error checking
      setTimeout(() => {
        // Check for some basic syntax
        let success = true;
        let error = null;
        let output = '';

        // Basic syntax checks
        if (!code.includes('fn main()')) {
          success = false;
          error = 'Error: No main function found';
        } else if (code.includes('// ERROR')) {
          success = false;
          error = 'Error: Syntax error in code';
        } else {
          // Look for common Verifex errors
          if (code.includes('mut') && !code.match(/mut\s+\w+\s*:/)) {
            success = false;
            error = 'Error: Mutable variable declarations require a type annotation';
          } else if (code.match(/\w+\s*=\s*\w+\s*\+\s*".*"/)) {
            success = false;
            error = 'Error: Cannot add numeric and string types';
          } else if (code.match(/if\s+[^{]+\s*[^{]/)) {
            success = false;
            error = 'Error: Missing block after if condition';
          } else {
            // Simulate successful execution
            if (code.includes('io.print')) {
              // Extract the print statements to simulate output
              const printRegex = /io\.print\s*\(\s*"([^"]*)"\s*\)/g;
              let match;
              while ((match = printRegex.exec(code)) !== null) {
                output += match[1] + '\n';
              }
            } else {
              output = 'Program executed successfully with no output.';
            }
          }
        }

        resolve({
          success,
          error,
          output
        });
      }, 1000); // Simulate processing time
    });
  }
}

module.exports = new DockerService();