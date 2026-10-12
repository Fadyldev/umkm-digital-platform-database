import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import businessRoutes from './routes/businessRoutes';
import categoryRoutes from './routes/categoryRoutes';
import productRoutes from './routes/productRoutes';
import orderRoutes from './routes/orderRoutes';
import settingRoutes from './routes/settingRoutes';
import uploadRoutes from './routes/uploadRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import { initDatabase } from './database/db';
import { ensureInitialAdminUser } from './services/initAuth';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dukung URL rewrite Vercel (baik via /api?path=$1 maupun header x-matched-path)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.query && req.query.path) {
    const p = String(req.query.path);
    req.url = p.startsWith('/') ? `/api${p}` : `/api/${p}`;
  } else if (req.headers['x-matched-path']) {
    const matched = String(req.headers['x-matched-path']);
    if (matched.startsWith('/api')) {
      req.url = matched;
    }
  }
  next();
});

let isDbInitialized = false;
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!isDbInitialized) {
    try {
      await Promise.race([
        initDatabase(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
      await ensureInitialAdminUser(false).catch(() => {});
    } catch (e) {
      console.warn('Database init notice:', e);
    } finally {
      isDbInitialized = true;
    }
  }
  next();
});

// Root & Health check
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'UMKM Platform API', timestamp: new Date().toISOString() });
});

app.get(['/api', '/api/', '/'], (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'UMKM Digital Platform Backend API',
    message: 'Backend API is running and ready to handle requests.',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api', businessRoutes);
app.use('/', businessRoutes);

app.use('/api', categoryRoutes);
app.use('/', categoryRoutes);

app.use('/api', productRoutes);
app.use('/', productRoutes);

app.use('/api', orderRoutes);
app.use('/', orderRoutes);

app.use('/api', settingRoutes);
app.use('/', settingRoutes);

app.use('/api', uploadRoutes);
app.use('/', uploadRoutes);

app.use('/api', dashboardRoutes);
app.use('/', dashboardRoutes);

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Terjadi kesalahan pada server.',
  });
});

export default app;
