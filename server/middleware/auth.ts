import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'umkm-platform-super-secret-jwt-key-2026';

export interface AuthUserPayload {
  userId: string;
  businessId: string;
  role: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Middleware untuk memverifikasi JWT Token pada header Authorization: Bearer <token>
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi tidak ditemukan. Silakan login terlebih dahulu.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: 'Sesi login tidak valid atau telah kedaluwarsa. Silakan login kembali.',
    });
  }
}

/**
 * Middleware untuk memastikan role user memiliki izin (owner / admin)
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.',
      });
    }

    next();
  };
}

/**
 * Middleware Tenant Guard:
 * Memastikan bahwa business_id yang ingin diakses benar-benar milik user yang sedang login.
 * Mencegah admin Bisnis A mengakses atau mengubah data Bisnis B.
 */
export function enforceTenantIsolation(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  // Jika superadmin (SaaS platform level), boleh lewati tenant check
  if (req.user.role === 'superadmin') {
    return next();
  }

  // Jika route menyertakan target businessId pada params atau query atau body
  const targetBusinessId = req.params.businessId || req.body.business_id;

  if (targetBusinessId && targetBusinessId !== req.user.businessId) {
    return res.status(403).json({
      success: false,
      message: 'Pelanggaran isolasi tenant: Anda tidak memiliki akses ke data bisnis lain.',
    });
  }

  next();
}
