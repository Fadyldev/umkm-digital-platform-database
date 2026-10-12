import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { memoryStore, pool, saveLocalStore } from '../database/db';
import { authenticateToken } from '../middleware/auth';
import { ensureInitialAdminUser } from '../services/initAuth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'umkm-platform-super-secret-jwt-key-2026';

/**
 * POST /api/auth/setup-initial-account
 * Memastikan tersedianya akun admin awal jika database baru / belum ada user.
 * Password langsung di-hash dengan bcrypt, tidak ada plaintext.
 */
router.post('/setup-initial-account', async (req: Request, res: Response) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await ensureInitialAdminUser(force);
    return res.json({
      success: true,
      message: result.reset
        ? 'Password akun owner awal berhasil di-reset ke Rahasia123!'
        : result.created
        ? 'Akun owner awal berhasil dibuat di database.'
        : 'Akun owner awal sudah tersedia di database.',
      data: {
        email: result.email,
        created: result.created,
        reset: result.reset,
        defaultPassword: 'Rahasia123!',
      },
    });
  } catch (err: any) {
    console.error('Error in setup-initial-account:', err);
    return res.status(500).json({
      success: false,
      message: 'Gagal menginisialisasi akun awal.',
    });
  }
});

/**
 * PUT /api/auth/profile
 * Memperbarui data profil owner/admin (nama lengkap, email, nomor HP).
 */
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { full_name, email, phone } = req.body;
    const userId = req.user!.userId;

    if (!full_name || full_name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap pemilik/admin wajib diisi.',
      });
    }

    if (!email || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Alamat email wajib diisi.',
      });
    }

    let updatedUser: any = null;

    if (pool) {
      try {
        const uRes = await pool.query(
          `UPDATE users 
           SET full_name = $1, email = $2, phone = $3, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $4
           RETURNING id, business_id, full_name, email, role, phone, is_active, updated_at`,
          [full_name.trim(), email.trim().toLowerCase(), phone?.trim() || null, userId]
        );
        if (uRes.rows.length > 0) {
          updatedUser = uRes.rows[0];
        }
      } catch (err: any) {
        console.warn('DB error updating profile:', err);
        if (err.code === '23505') {
          return res.status(400).json({
            success: false,
            message: 'Email tersebut sudah terdaftar pada pengguna lain.',
          });
        }
      }
    }

    // Update di memoryStore juga
    const memUser = memoryStore.users.find((u) => u.id === userId);
    if (memUser) {
      memUser.full_name = full_name.trim();
      memUser.email = email.trim().toLowerCase();
      memUser.phone = phone?.trim() || undefined;
      memUser.updated_at = new Date().toISOString();
      saveLocalStore();
      const { password_hash, ...safeMem } = memUser;
      if (!updatedUser) updatedUser = safeMem;
    }

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan.',
      });
    }

    return res.json({
      success: true,
      message: 'Profil pemilik berhasil diperbarui!',
      data: updatedUser,
    });
  } catch (error: any) {
    console.error('Error in PUT /api/auth/profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui profil.',
    });
  }
});

/**
 * PUT /api/auth/change-password
 * Mengganti password user yang sedang login via JWT.
 * Memvalidasi password lama, kecocokan konfirmasi, minimal 8 karakter, dan hashing bcrypt.
 */
router.put('/change-password', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user!.userId;

    // 1. Validasi input kelengkapan
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password saat ini, password baru, dan konfirmasi password wajib diisi.',
      });
    }

    // 2. Validasi panjang minimal 8 karakter
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password baru minimal harus 8 karakter.',
      });
    }

    // 3. Validasi konfirmasi password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password baru dan konfirmasi password tidak cocok.',
      });
    }

    // 4. Validasi password baru tidak boleh sama dengan password lama
    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password baru tidak boleh sama dengan password saat ini.',
      });
    }

    let user: any = null;

    // 5. Ambil data user dari PostgreSQL jika pool aktif
    if (pool) {
      try {
        const uRes = await pool.query(
          'SELECT id, password_hash, email FROM users WHERE id = $1 LIMIT 1',
          [userId]
        );
        if (uRes.rows.length > 0) {
          user = uRes.rows[0];
        }
      } catch (dbErr) {
        console.warn('DB error fetching user for password change:', dbErr);
      }
    }

    // Fallback memoryStore jika PostgreSQL tidak aktif atau user belum di DB
    if (!user) {
      user = memoryStore.users.find((u) => u.id === userId);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan atau sesi sudah tidak valid.',
      });
    }

    // 6. Verifikasi password lama dengan bcrypt.compare()
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Password saat ini yang Anda masukkan salah.',
      });
    }

    // 7. Hash password baru dengan bcrypt (salt rounds = 10)
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 8. Update password_hash di database PostgreSQL
    if (pool) {
      try {
        await pool.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newPasswordHash, userId]
        );
      } catch (updateErr: any) {
        console.error('DB error updating password:', updateErr);
        return res.status(500).json({
          success: false,
          message: 'Gagal memperbarui password di database.',
        });
      }
    }

    // Update juga di memoryStore jika ada
    const memUser = memoryStore.users.find((u) => u.id === userId);
    if (memUser) {
      memUser.password_hash = newPasswordHash;
      memUser.updated_at = new Date().toISOString();
      saveLocalStore();
    }

    return res.json({
      success: true,
      message: 'Password berhasil diperbarui! Silakan gunakan password baru untuk login berikutnya.',
    });
  } catch (error: any) {
    console.error('Error in change-password route:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat memproses ganti password.',
    });
  }
});

/**
 * POST /api/auth/login
 * Autentikasi menggunakan email dan password (bcrypt hash)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi.',
      });
    }

    let user: any = null;
    let business: any = null;

    // 1. Cek pada PostgreSQL jika pool aktif
    if (pool) {
      try {
        const userRes = await pool.query(
          'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1',
          [email.trim()]
        );
        if (userRes.rows.length > 0) {
          user = userRes.rows[0];
          const bizRes = await pool.query('SELECT * FROM businesses WHERE id = $1 LIMIT 1', [user.business_id]);
          business = bizRes.rows[0];
        }
      } catch (dbErr) {
        console.warn('DB error during login query, falling back to memoryStore:', dbErr);
      }
    }

    // 2. Fallback to memoryStore
    if (!user) {
      user = memoryStore.users.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.is_active
      );
      if (user) {
        business = memoryStore.businesses.find((b) => b.id === user.business_id);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password yang Anda masukkan salah.',
      });
    }

    // Verifikasi password_hash dengan bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password yang Anda masukkan salah.',
      });
    }

    // Buat JWT Token
    const payload = {
      userId: user.id,
      businessId: user.business_id,
      role: user.role,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    // Jangan kirim password_hash ke response
    const { password_hash, ...safeUser } = user;

    return res.json({
      success: true,
      message: 'Login berhasil!',
      data: {
        token,
        user: safeUser,
        business,
      },
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server saat login.',
    });
  }
});

/**
 * GET /api/auth/me
 * Mengambil profil user & data bisnis yang sedang login
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userPayload = req.user!;
    let user: any = null;
    let business: any = null;

    if (pool) {
      try {
        const uRes = await pool.query(
          'SELECT id, business_id, full_name, email, role, phone, is_active FROM users WHERE id = $1',
          [userPayload.userId]
        );
        user = uRes.rows[0];
        if (user) {
          const bRes = await pool.query('SELECT * FROM businesses WHERE id = $1', [user.business_id]);
          business = bRes.rows[0];
        }
      } catch (err) {
        console.warn('DB error in /me, fallback:', err);
      }
    }

    if (!user) {
      const found = memoryStore.users.find((u) => u.id === userPayload.userId);
      if (found) {
        const { password_hash, ...rest } = found;
        user = rest;
        business = memoryStore.businesses.find((b) => b.id === user.business_id);
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    return res.json({
      success: true,
      data: {
        user,
        business,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil data user.' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Logout berhasil. Sesi telah diakhiri.',
  });
});

export default router;
