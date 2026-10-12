import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { uploadMiddleware } from '../middleware/upload';
import { uploadToSupabaseStorage } from '../services/supabaseStorage';

const router = Router();

/**
 * POST /api/admin/upload/product
 * Upload foto produk ke Supabase Storage (bucket: business-assets)
 */
router.post(
  '/admin/upload/product',
  authenticateToken,
  uploadMiddleware.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'File gambar wajib dipilih (format JPEG, PNG, WebP, max 5MB).',
        });
      }

      const businessId = req.user!.businessId;
      const imageUrl = await uploadToSupabaseStorage('products', businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      });

      return res.json({
        success: true,
        message: 'Foto produk berhasil diunggah ke Supabase Storage.',
        data: {
          url: imageUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error: any) {
      console.error('Error in upload product:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Gagal mengunggah foto produk.',
      });
    }
  }
);

/**
 * POST /api/admin/upload/logo
 * Upload logo bisnis ke Supabase Storage (bucket: business-assets)
 */
router.post(
  '/admin/upload/logo',
  authenticateToken,
  uploadMiddleware.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'File gambar logo wajib dipilih (format JPEG, PNG, WebP, max 5MB).',
        });
      }

      const businessId = req.user!.businessId;
      const logoUrl = await uploadToSupabaseStorage('logos', businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      });

      return res.json({
        success: true,
        message: 'Logo bisnis berhasil diunggah ke Supabase Storage.',
        data: {
          url: logoUrl,
          filename: req.file.originalname,
          size: req.file.size,
        },
      });
    } catch (error: any) {
      console.error('Error in upload logo:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Gagal mengunggah logo bisnis.',
      });
    }
  }
);

/**
 * POST /api/admin/upload/category
 * Upload foto kategori ke Supabase Storage (bucket: business-assets)
 */
router.post(
  '/admin/upload/category',
  authenticateToken,
  uploadMiddleware.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'File gambar kategori wajib dipilih (format JPEG, PNG, WebP, max 5MB).',
        });
      }

      const businessId = req.user!.businessId;
      const categoryImageUrl = await uploadToSupabaseStorage('categories', businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      });

      return res.json({
        success: true,
        message: 'Foto kategori berhasil diunggah ke Supabase Storage.',
        data: {
          url: categoryImageUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error: any) {
      console.error('Error in upload category:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Gagal mengunggah foto kategori.',
      });
    }
  }
);

/**
 * POST /api/admin/upload/qris
 * Upload foto barcode QRIS toko ke Supabase Storage
 */
router.post(
  '/admin/upload/qris',
  authenticateToken,
  uploadMiddleware.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'File gambar QRIS wajib dipilih (format JPEG, PNG, WebP, max 5MB).',
        });
      }

      const businessId = req.user!.businessId;
      const qrisImageUrl = await uploadToSupabaseStorage('qris', businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      });

      return res.json({
        success: true,
        message: 'Foto QRIS toko berhasil diunggah.',
        data: {
          url: qrisImageUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
      });
    } catch (error: any) {
      console.error('Error in upload QRIS:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Gagal mengunggah gambar QRIS.',
      });
    }
  }
);

export default router;
