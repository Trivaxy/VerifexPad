# VerifexPad

VerifexPad is an online playground for the Verifex programming language, allowing users to write, compile, and execute Verifex code directly in their browser.

## Project Structure

- **Frontend**: React application with Monaco Editor for code editing (runs natively, no Docker)
- **Backend**: Express.js API server for handling code compilation requests (runs natively, no Docker)
- **Compiler**: Dockerized Verifex compiler for secure code execution (only component using Docker)

## Setup

### Prerequisites

- Node.js (v18+)
- .NET 9.0 SDK (for building the Verifex compiler)
- Docker (required only for secure code execution)

### Building the Verifex Compiler Container

```bash
# From the VerifexPad directory
docker-compose build verifex-compiler
```

### Frontend Setup

```bash
cd VerifexPad/frontend
npm install
npm start
```

The frontend will run on [http://localhost:3000](http://localhost:3000)

### Backend Setup

```bash
cd VerifexPad/backend
npm install
npm run dev
```

The backend will run on [http://localhost:3001](http://localhost:3001)

## Architecture

### Security Model

- **Frontend & Backend**: Run natively for development convenience
- **Code Execution**: All user code runs inside a highly restricted Docker container with:
  - Read-only filesystem
  - Limited CPU and memory resources
  - No network access
  - Non-root user execution
  - Execution timeouts

This approach balances developer experience with security for user code execution.

## Development Notes

### Using Without Docker for Code Execution

If Docker is not available in your environment, the backend will automatically fall back to simulation mode. This allows you to test the UI and API without needing to build the Docker container.

### Running on Windows WSL

When running in WSL, you may encounter file system permission issues when installing npm dependencies. In those cases:

1. Try running in Windows terminal directly
2. Or create a fresh install in a different directory
3. Or use `--no-bin-links` flag with npm install

### Manual Testing

To manually test the API without the frontend:

```bash
curl -X POST http://localhost:3001/api/compile \
  -H "Content-Type: application/json" \
  -d '{"code":"fn main() { io.print(\"Hello, Verifex!\"); }"}'
```

## Future Enhancements

- Custom syntax highlighting for Verifex language
- Saving and sharing code snippets
- User accounts and saved programs
- More example programs and tutorials