import multer from 'multer';

// Menggunakan memory storage agar buffer dapat langsung dikirim ke Supabase Storage SDK
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maksimal 5 MB sesuai instruksi
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Harap gunakan format JPEG, PNG, atau WebP.'));
    }
  },
});
