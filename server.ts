import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Auto-respawn with tsx if executed via plain `node server.ts`
const hasTsx = process.execArgv.some((arg) => arg.includes('tsx')) || process.env.TSX_ACTIVE === 'true';

if (!hasTsx) {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    {
      stdio: 'inherit',
      env: { ...process.env, TSX_ACTIVE: 'true' },
    }
  );
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  runServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

async function runServer() {
  const { default: express } = await import('express');
  const { default: http } = await import('http');
  const { default: cors } = await import('cors');
  const { default: path } = await import('path');
  const { default: dotenv } = await import('dotenv');

  const [
    { default: authRoutes },
    { default: businessRoutes },
    { default: categoryRoutes },
    { default: productRoutes },
    { default: orderRoutes },
    { default: settingRoutes },
    { default: uploadRoutes },
    { default: dashboardRoutes },
    { ensureInitialAdminUser },
    { initDatabase },
  ] = await Promise.all([
    import('./server/routes/authRoutes'),
    import('./server/routes/businessRoutes'),
    import('./server/routes/categoryRoutes'),
    import('./server/routes/productRoutes'),
    import('./server/routes/orderRoutes'),
    import('./server/routes/settingRoutes'),
    import('./server/routes/uploadRoutes'),
    import('./server/routes/dashboardRoutes'),
    import('./server/services/initAuth'),
    import('./server/database/db'),
  ]);

  dotenv.config();

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Inisialisasi koneksi database & skema tabel PostgreSQL
  try {
    await initDatabase();
    await ensureInitialAdminUser();
  } catch (dbInitErr: any) {
    console.warn('Startup database initialization notice:', dbInitErr?.message || dbInitErr);
  }

  // Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Health Check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'UMKM Digital Platform API',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount REST API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', businessRoutes);
  app.use('/api', categoryRoutes);
  app.use('/api', productRoutes);
  app.use('/api', orderRoutes);
  app.use('/api', settingRoutes);
  app.use('/api', uploadRoutes);
  app.use('/api', dashboardRoutes);

  // Error Handling Middleware untuk Upload atau Bad Request
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err && err.message) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  });

  // Frontend Integration (Vite Middleware in Dev, Static in Prod)
  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('⚡ Vite dev server middleware mounted');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${PORT} already in use, exiting cleanly for supervisor restart...`);
      process.exit(1);
    } else {
      console.error('[Server error]:', err);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 UMKM Digital Platform running at http://localhost:${PORT}`);
  });
}
