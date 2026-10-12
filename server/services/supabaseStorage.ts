import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET_NAME = 'business-assets';

// Supabase client disetup HANYA di backend dengan Service Role Key
// Kunci ini tidak pernah diekspos ke browser / React.
const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Upload file buffer ke Supabase Storage (bucket: business-assets)
 * Format folder: products/[businessId]/[filename] atau logos/[businessId]/[filename]
 */
export async function uploadToSupabaseStorage(
  folder: 'products' | 'logos' | 'categories' | 'qris',
  businessId: string,
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }
): Promise<string> {
  const fileExt = file.originalname.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `${folder}/${businessId}/${cleanFileName}`;

  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        console.error('Supabase Storage upload error:', error.message);
        // Fallback ke data URL jika bucket belum dibuat
        return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      }

      // Ambil Public URL
      const { data: publicUrlData } = supabaseAdmin.storage
        .from(BUCKET_NAME)
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Error uploading to Supabase Storage:', err);
      return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }
  }

  // Jika SUPABASE_URL belum diisi pada .env di laptop lokal pengguna,
  // simpan gambar secara langsung sebagai base64 Data URL sehingga gambar yang diupload
  // langsung tampil dan tersimpan dengan sempurna di database lokal maupun preview!
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}
