const request = require('supertest');
const fs = require('fs');

jest.mock('../services/podmanService', () => ({
  compileAndRun: jest.fn(),
  simulateCompileAndRun: jest.fn()
}));

jest.mock('../services/database', () => ({
  logCompilation: jest.fn()
}));

jest.mock('../services/compilerManager', () => ({
  rebuildCompiler: jest.fn()
}));

const buildApp = () => {
  jest.resetModules();
  process.env.SANDBOX_DISABLED = 'true';
  const { createApp } = require('../app');
  return createApp();
};

const getMocks = () => ({
  podmanService: require('../services/podmanService'),
  database: require('../services/database'),
  compilerManager: require('../services/compilerManager')
});

describe('VerifexPad API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/compile returns success via simulation', async () => {
    const app = buildApp();
    const { podmanService, database } = getMocks();
    podmanService.simulateCompileAndRun.mockResolvedValue({
      success: true,
      output: 'ok',
      error: ''
    });

    const response = await request(app)
      .post('/api/compile')
      .send({ code: 'fn main() { print("hi"); }' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      output: 'ok',
      error: ''
    });
    expect(podmanService.simulateCompileAndRun).toHaveBeenCalledTimes(1);
    expect(database.logCompilation).toHaveBeenCalledWith(
      'fn main() { print("hi"); }',
      'ok',
      true
    );
  });

  test('POST /api/compile rejects missing code', async () => {
    const app = buildApp();
    const { database } = getMocks();

    const response = await request(app)
      .post('/api/compile')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(database.logCompilation).not.toHaveBeenCalled();
  });

  test('POST /api/compile rejects oversized code', async () => {
    const app = buildApp();
    const largeCode = 'a'.repeat(10001);

    const response = await request(app)
      .post('/api/compile')
      .send({ code: largeCode });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test('GET /api/reference returns content', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/reference');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(typeof response.body.content).toBe('string');
    expect(response.body.content.length).toBeGreaterThan(0);
  });

  test('GET /api/reference handles read failures', async () => {
    const app = buildApp();
    const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('fail');
    });

    const response = await request(app).get('/api/reference');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);

    readSpy.mockRestore();
  });

  test('GET /api/health returns ok', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('POST /api/webhook/github triggers rebuild on valid payload', async () => {
    const app = buildApp();
    const { compilerManager } = getMocks();
    compilerManager.rebuildCompiler.mockResolvedValue();

    const payload = {
      repository: { url: 'https://api.github.com/repos/Trivaxy/Verifex' },
      ref: 'refs/heads/master'
    };

    const response = await request(app)
      .post('/api/webhook/github')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(202);
    expect(compilerManager.rebuildCompiler).toHaveBeenCalledTimes(1);
  });

  test('POST /api/webhook/github ignores wrong repo', async () => {
    const app = buildApp();
    const { compilerManager } = getMocks();

    const payload = {
      repository: { url: 'https://api.github.com/repos/Other/Repo' },
      ref: 'refs/heads/master'
    };

    const response = await request(app)
      .post('/api/webhook/github')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect(compilerManager.rebuildCompiler).not.toHaveBeenCalled();
  });

  test('POST /api/webhook/github ignores wrong branch', async () => {
    const app = buildApp();
    const { compilerManager } = getMocks();

    const payload = {
      repository: { url: 'https://api.github.com/repos/Trivaxy/Verifex' },
      ref: 'refs/heads/feature-x'
    };

    const response = await request(app)
      .post('/api/webhook/github')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect(compilerManager.rebuildCompiler).not.toHaveBeenCalled();
  });
});
