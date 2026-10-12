import bcrypt from 'bcryptjs';
import { pool, memoryStore } from '../database/db';

/**
 * Memastikan minimal satu akun owner/admin tersedia di database PostgreSQL.
 * Jika tabel users kosong, fungsi ini akan membuat akun awal secara otomatis:
 * - Email: owner.warkop@example.com
 * - Password awal: Rahasia123! (langsung di-hash menggunakan bcrypt, BUKAN plaintext)
 * - Role: owner
 */
export async function ensureInitialAdminUser(forceReset = false): Promise<{ created: boolean; email: string; reset?: boolean }> {
  const initialEmail = 'owner.warkop@example.com';
  const initialPasswordRaw = 'Rahasia123!';

  if (pool) {
    try {
      // 1. Cek apakah sudah ada akun user di database
      const checkUserRes = await pool.query('SELECT COUNT(*) as count FROM users');
      const userCount = parseInt(checkUserRes.rows[0]?.count || '0', 10);

      const checkOwnerRes = await pool.query(
        'SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [initialEmail]
      );

      // Jika user sudah ada dan akun initial email juga sudah ada
      if (userCount > 0 && checkOwnerRes.rows.length > 0) {
        const currentHash = checkOwnerRes.rows[0]?.password_hash;
        const dummyCorruptHash = '$2a$12$e868dK7V3fV2pWw5m4UHQOY3zH61c9yT7b0Kq8yQ1aD6q0I6F7NlK';
        
        // Periksa apakah hash lama rusak (dari dummy seed) atau diminta reset paksa
        if (forceReset || currentHash === dummyCorruptHash || !currentHash) {
          const validHash = await bcrypt.hash(initialPasswordRaw, 10);
          await pool.query(
            'UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)',
            [validHash, initialEmail]
          );
          console.log(`🔑 Berhasil memulihkan password valid (${initialPasswordRaw}) untuk ${initialEmail} di PostgreSQL!`);
          return { created: false, email: initialEmail, reset: true };
        }
        return { created: false, email: initialEmail };
      }

      // 2. Pastikan ada minimal 1 bisnis di tabel businesses
      let businessId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      const bizRes = await pool.query(
        "SELECT id FROM businesses WHERE slug = 'warkop-nusantara' LIMIT 1"
      );

      if (bizRes.rows.length > 0) {
        businessId = bizRes.rows[0].id;
      } else {
        const anyBizRes = await pool.query('SELECT id FROM businesses LIMIT 1');
        if (anyBizRes.rows.length > 0) {
          businessId = anyBizRes.rows[0].id;
        } else {
          // Buat bisnis awal jika belum ada sama sekali
          const newBiz = await pool.query(
            `INSERT INTO businesses (id, name, slug, description, phone, whatsapp, address, logo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [
              businessId,
              'Warkop Nusantara',
              'warkop-nusantara',
              'Tempat nongkrong santai dengan racikan kopi susu otentik dan camilan warkop nusantara.',
              '081234567890',
              '6281234567890',
              'Jl. Merdeka No. 12, Jakarta Selatan',
              'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=300&q=80',
            ]
          );
          businessId = newBiz.rows[0].id;

          // Buat settings untuk bisnis ini jika belum ada
          await pool.query(
            `INSERT INTO settings (business_id, theme_preset, primary_color, secondary_color, background_color, text_color)
             VALUES ($1, 'amber_warm', '#78350f', '#d97706', '#fffbeb', '#1f2937')
             ON CONFLICT (business_id) DO NOTHING`,
            [businessId]
          );
        }
      }

      // 3. Hash password menggunakan bcrypt dengan salt rounds = 10
      const passwordHash = await bcrypt.hash(initialPasswordRaw, 10);

      // 4. Masukkan user awal ke tabel users
      if (checkOwnerRes.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (business_id, full_name, email, password_hash, role, phone, is_active)
           VALUES ($1, $2, $3, $4, 'owner', '081234567890', true)
           ON CONFLICT (email) DO NOTHING`,
          [
            businessId,
            'Budi Santoso (Owner)',
            initialEmail,
            passwordHash,
          ]
        );
        console.log(`✅ Akun awal owner berhasil diinisialisasi di PostgreSQL: ${initialEmail}`);
        return { created: true, email: initialEmail };
      }

      return { created: false, email: initialEmail };
    } catch (err: any) {
      console.warn('⚠️ Gagal menjalankan pemeriksaan akun awal di PostgreSQL:', err.message);
    }
  }

  // Jika pool PostgreSQL belum aktif, pastikan di memoryStore akun sudah ada
  const existingInMemory = memoryStore.users.find(
    (u) => u.email.toLowerCase() === initialEmail.toLowerCase()
  );

  if (!existingInMemory) {
    const passwordHash = await bcrypt.hash(initialPasswordRaw, 10);
    memoryStore.users.push({
      id: 'u1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      full_name: 'Budi Santoso (Owner)',
      email: initialEmail,
      password_hash: passwordHash,
      role: 'owner',
      phone: '081234567890',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { created: true, email: initialEmail };
  } else if (forceReset) {
    const passwordHash = await bcrypt.hash(initialPasswordRaw, 10);
    existingInMemory.password_hash = passwordHash;
    existingInMemory.updated_at = new Date().toISOString();
    return { created: false, email: initialEmail, reset: true };
  }

  return { created: false, email: initialEmail };
}
