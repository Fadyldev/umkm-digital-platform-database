import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

import fs from 'fs';
import path from 'path';

const connectionString = 
  process.env.DATABASE_URL || 
  process.env.POSTGRES_URL || 
  process.env.POSTGRES_PRISMA_URL || 
  process.env.POSTGRES_URL_NON_POOLING;

export let pool: Pool | null = null;
export let isPostgresConnected = false;

export async function initDatabase(): Promise<boolean> {
  const connStr = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRES_PRISMA_URL || 
    process.env.POSTGRES_URL_NON_POOLING;

  if (!connStr || connStr.includes('your-db-password') || connStr.trim() === '') {
    console.info('ℹ️ Mode In-Memory: DATABASE_URL / POSTGRES_URL belum diisi dengan kredensial database asli.');
    pool = null;
    isPostgresConnected = false;
    return false;
  }

  try {
    // Analisis awal string koneksi untuk membantu deteksi typo atau simbol khusus
    const atMatches = connStr.match(/@/g);
    if (atMatches && atMatches.length > 1) {
      console.warn(`⚠️ Perhatian: Ditemukan ${atMatches.length} tanda '@' di DATABASE_URL. Jika password mengandung '@', wajib ganti dengan '%40'.`);
    }

    const candidatePool = new Pool({
      connectionString: connStr,
      ssl: {
        rejectUnauthorized: false, // Diperlukan untuk cloud Supabase & PostgreSQL SSL
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3500,
    });

    candidatePool.on('error', (err) => {
      console.warn('⚠️ PostgreSQL idle connection notice:', err.message);
    });

    // Coba koneksi ke PostgreSQL
    const client = await candidatePool.connect();

    try {
      await client.query('SELECT 1');
      pool = candidatePool;
      isPostgresConnected = true;
      console.log('✅ Berhasil terhubung ke database PostgreSQL Supabase!');

      // Cek apakah tabel businesses sudah ada
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'businesses'
        );
      `);

      const tablesExist = tableCheck.rows[0]?.exists;

      if (!tablesExist) {
        console.log('📦 Skema database belum ditemukan. Menjalankan migrasi otomatis...');
        const schemaCandidates = [
          path.resolve(process.cwd(), 'database', 'schema.sql'),
          path.resolve(process.cwd(), 'schema.sql'),
        ];
        const schemaFile = schemaCandidates.find((f) => fs.existsSync(f));

        if (schemaFile) {
          const schemaSql = fs.readFileSync(schemaFile, 'utf-8');
          await client.query(schemaSql);
          console.log('✅ Skema tabel database berhasil dibuat dari file schema.sql!');
        } else {
          // Fallback schema jika file schema.sql tidak dibundel pada environment Vercel serverless
          await client.query(`
            CREATE EXTENSION IF NOT EXISTS "pgcrypto";

            CREATE TABLE IF NOT EXISTS businesses (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR(150) NOT NULL,
              slug VARCHAR(100) NOT NULL UNIQUE,
              description TEXT,
              logo_url TEXT,
              banner_url TEXT,
              phone VARCHAR(20),
              whatsapp VARCHAR(20),
              address TEXT,
              google_maps_url TEXT,
              opening_hours JSONB,
              is_active BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
              full_name VARCHAR(100) NOT NULL,
              email VARCHAR(255) NOT NULL UNIQUE,
              password_hash VARCHAR(255) NOT NULL,
              role VARCHAR(20) NOT NULL DEFAULT 'admin',
              phone VARCHAR(20),
              is_active BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS settings (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
              theme_preset VARCHAR(50) NOT NULL DEFAULT 'amber_warm',
              primary_color VARCHAR(20) NOT NULL DEFAULT '#78350f',
              secondary_color VARCHAR(20) NOT NULL DEFAULT '#d97706',
              background_color VARCHAR(20) NOT NULL DEFAULT '#fffbeb',
              text_color VARCHAR(20) NOT NULL DEFAULT '#1f2937',
              button_style VARCHAR(20) NOT NULL DEFAULT 'rounded',
              card_style VARCHAR(20) NOT NULL DEFAULT 'shadow',
              font_family VARCHAR(50) NOT NULL DEFAULT 'Inter',
              is_ordering_enabled BOOLEAN NOT NULL DEFAULT true,
              announcement TEXT,
              currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rp',
              additional_config JSONB DEFAULT '{}'::jsonb,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS categories (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
              name VARCHAR(100) NOT NULL,
              slug VARCHAR(100) NOT NULL,
              description TEXT,
              display_order INT NOT NULL DEFAULT 0,
              is_active BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS products (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
              category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
              name VARCHAR(150) NOT NULL,
              slug VARCHAR(100) NOT NULL,
              description TEXT,
              price NUMERIC(12, 2) NOT NULL DEFAULT 0,
              stock INT NOT NULL DEFAULT 0,
              image_url TEXT,
              is_available BOOLEAN NOT NULL DEFAULT true,
              display_order INT NOT NULL DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
          `);
          console.log('✅ Skema tabel database (businesses, products, orders, dll) berhasil dibuat di Supabase!');
        }

        console.log('🌱 Menjalankan seeding data awal Warkop & produk...');
        const seedsCandidates = [
          path.resolve(process.cwd(), 'database', 'seeds.sql'),
          path.resolve(process.cwd(), 'seeds.sql'),
        ];
        const seedsFile = seedsCandidates.find((f) => fs.existsSync(f));

        if (seedsFile) {
          const seedsSql = fs.readFileSync(seedsFile, 'utf-8');
          await client.query(seedsSql);
          console.log('✅ Data demo Warkop Nusantara berhasil di-seed dari file!');
        } else {
          // Fallback initial demo tenant data jika file seeds.sql tidak terbaca di Vercel
          await client.query(`
            INSERT INTO businesses (id, name, slug, description, phone, whatsapp, address, google_maps_url, logo_url)
            VALUES (
              'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              'Warkop Nusantara',
              'warkop-nusantara',
              'Tempat nongkrong santai dengan racikan kopi susu otentik dan camilan warkop nusantara.',
              '081234567890',
              '6281234567890',
              'Jl. Merdeka No. 12, Jakarta Selatan',
              'https://maps.google.com/?q=-6.2088,106.8456',
              'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=300&q=80'
            )
            ON CONFLICT (id) DO NOTHING;

            INSERT INTO settings (business_id, theme_preset, primary_color, secondary_color, background_color, text_color, button_style, card_style, font_family, announcement)
            VALUES (
              'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
              'amber_warm',
              '#78350f',
              '#d97706',
              '#fffbeb',
              '#1f2937',
              'rounded',
              'shadow',
              'Inter',
              '☕ Nikmati diskon 15% untuk paket Kopi Susu + Camilan Warkop!'
            )
            ON CONFLICT (business_id) DO NOTHING;
          `);
          console.log('✅ Data demo Warkop Nusantara berhasil di-seed ke Supabase!');
        }
      } else {
        console.log('📋 Tabel database Supabase sudah ada.');
      }

      // Selalu jalankan verifikasi kolom (Auto-Migrate) untuk memperbaiki skema lama jika ada kolom yang kurang
      await runDatabaseMigrations(client);

      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    pool = null;
    isPostgresConnected = false;
    console.error('❌ Gagal terhubung ke database PostgreSQL Supabase:', err.message);
    if (err.message && err.message.includes('ENOTFOUND base')) {
      console.warn(`
🔍 DETEKSI KESALAHAN 'ENOTFOUND base':
Host terbaca hanya sebagai "base" (bukan domain lengkap Supabase).
Penyebab utama:
1. Password kamu mengandung simbol '@'. Karena format URL memakai '@' pemisah host, ganti simbol '@' pada password menjadi '%40'.
2. Atau ada typo / spasi pada bagian "...supabase.com" (misal: "supa base.com" atau "...@base").
3. Pastikan string koneksi utuh satu baris tanpa terpotong.`);
    }
    console.info(`
========================================================================
💡 PANDUAN MENGATASI ERROR DATABASE SUPABASE:
1. Pastikan password di DATABASE_URL adalah password database Supabase kamu.
2. Jika password kamu mengandung karakter khusus (@, #, $, %, &, +), kamu harus melakukan URL-encode:
   Contoh: '@' menjadi '%40', '#' menjadi '%23'
3. Jika menggunakan jaringan WiFi/kartu perdana lokal yang belum mendukung IPv6:
   Gunakan connection pooler port 6543 atau 5432:
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
4. Server tetap berjalan normal dalam mode in-memory agar web tidak crash!
========================================================================
`);
    return false;
  }
}

/**
 * Memastikan semua kolom penting (seperti customer_note di tabel orders) tersedia
 * bahkan jika tabel sudah pernah dibuat sebelumnya dengan struktur lama.
 */
export async function runDatabaseMigrations(client: any): Promise<void> {
  try {
    // 1. Ekstensi pgcrypto
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // 2. Skema & Kolom Orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_number VARCHAR(50) NOT NULL UNIQUE,
        business_id UUID NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_note TEXT,
        order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in',
        table_number VARCHAR(20),
        total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
        payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_note TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'cash';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    `);

    // 3. Skema & Kolom Order Items
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL,
        product_id UUID,
        product_name VARCHAR(150) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        price NUMERIC(12, 2) NOT NULL DEFAULT 0,
        subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
        item_note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_note TEXT;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) DEFAULT 0;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(150);
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='product_price') THEN
          ALTER TABLE order_items ALTER COLUMN product_price DROP NOT NULL;
          ALTER TABLE order_items ALTER COLUMN product_price SET DEFAULT 0;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='subtotal') THEN
          ALTER TABLE orders ALTER COLUMN subtotal DROP NOT NULL;
          ALTER TABLE orders ALTER COLUMN subtotal SET DEFAULT 0;
        END IF;
      END $$;
    `);

    // 4. Skema & Kolom Users
    await client.query(`
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);

    // 5. Skema & Kolom Businesses
    await client.query(`
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS opening_hours JSONB;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);

    // 6. Skema & Kolom Products, Categories, Settings
    await client.query(`
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
      ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE IF EXISTS settings ADD COLUMN IF NOT EXISTS theme_preset VARCHAR(50) DEFAULT 'coffee_warm';
      ALTER TABLE IF EXISTS settings ADD COLUMN IF NOT EXISTS announcement TEXT;
      ALTER TABLE IF EXISTS settings ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT 'Rp';
    `);

    console.log('📋 Verifikasi skema Supabase: Kolom "customer_note" & seluruh tabel siap digunakan!');
  } catch (migErr: any) {
    console.warn('⚠️ Catatan sinkronisasi kolom tabel database:', migErr.message);
  }
}

const isVercel = Boolean(process.env.VERCEL);
export const LOCAL_STORE_PATH = isVercel ? path.join('/tmp', 'local_storage_data.json') : path.resolve(process.cwd(), 'local_storage_data.json');
export const LOCAL_ORDERS_PATH = isVercel ? path.join('/tmp', 'local_orders_storage.json') : path.resolve(process.cwd(), 'local_orders_storage.json');

export function saveLocalStore() {
  try {
    const data = {
      businesses: memoryStore.businesses,
      users: memoryStore.users,
      settings: memoryStore.settings,
      categories: memoryStore.categories,
      products: memoryStore.products,
      orders: memoryStore.orders,
    };
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    // Simpan juga ke file orders terpisah untuk backwards compatibility
    fs.writeFileSync(LOCAL_ORDERS_PATH, JSON.stringify(memoryStore.orders, null, 2), 'utf-8');
  } catch (err) {
    console.warn('⚠️ Gagal menyimpan cache data lokal:', err);
  }
}

export function loadLocalStore() {
  try {
    const defaultDataPath = path.resolve(process.cwd(), 'local_storage_data.json');
    const storePathToRead = fs.existsSync(LOCAL_STORE_PATH) 
      ? LOCAL_STORE_PATH 
      : (fs.existsSync(defaultDataPath) ? defaultDataPath : null);

    if (storePathToRead && fs.existsSync(storePathToRead)) {
      const dataStr = fs.readFileSync(storePathToRead, 'utf-8');
      const data = JSON.parse(dataStr);
      if (data) {
        if (Array.isArray(data.users)) {
          memoryStore.users = data.users;
        }
        if (Array.isArray(data.orders)) {
          memoryStore.orders = data.orders;
        }
        if (Array.isArray(data.products)) {
          memoryStore.products = data.products;
        }
        if (Array.isArray(data.categories)) {
          memoryStore.categories = data.categories;
        }
        if (Array.isArray(data.settings)) {
          memoryStore.settings = data.settings;
        }
        if (Array.isArray(data.businesses)) {
          memoryStore.businesses = data.businesses;
        }
        console.log(`📦 Berhasil memuat data lokal ter-update (akun/password, produk, pesanan) dari disk (${memoryStore.products.length} produk, ${memoryStore.orders.length} pesanan).`);
        return;
      }
    }

    // Fallback jika file lama local_orders_storage.json yang ada
    if (fs.existsSync(LOCAL_ORDERS_PATH)) {
      const ordStr = fs.readFileSync(LOCAL_ORDERS_PATH, 'utf-8');
      const orders = JSON.parse(ordStr);
      if (Array.isArray(orders)) {
        memoryStore.orders = orders;
        console.log(`📦 Berhasil memuat ${orders.length} pesanan dari local_orders_storage.json.`);
      }
    }
  } catch (err) {
    console.warn('⚠️ Gagal membaca cache data lokal:', err);
  }
}

export const saveLocalOrders = saveLocalStore;
export const loadLocalOrders = loadLocalStore;

initDatabase().catch((e) => {
  console.warn('Initial db init check notice:', e.message);
});

// -------------------------------------------------------------
// IN-MEMORY SEED DATA & FALLBACK STORE
// Berisi data awal terstruktur yang identik dengan schema.sql & seeds.sql
// -------------------------------------------------------------
export interface Business {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  phone: string;
  whatsapp: string;
  address: string;
  google_maps_url: string;
  opening_hours: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  business_id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: 'owner' | 'admin' | 'staff' | 'superadmin';
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: string;
  business_id: string;
  theme_preset: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  button_style: 'square' | 'rounded' | 'pill';
  card_style: 'flat' | 'bordered' | 'shadow' | 'elevated';
  font_family: string;
  is_ordering_enabled: boolean;
  announcement?: string;
  additional_config?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  image_url: string;
  is_available: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  item_note?: string;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  business_id: string;
  customer_name: string;
  customer_phone: string;
  customer_note?: string;
  order_type: 'dine_in' | 'take_away' | 'delivery';
  table_number?: string;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_method: 'cash' | 'qris' | 'transfer' | 'ewallet';
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

// In-Memory Database State
const hash123 = bcrypt.hashSync('Rahasia123!', 10);

export const memoryStore = {
  businesses: [
    {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Warkop Nusantara',
      slug: 'warkop-nusantara',
      description: 'Pusat nongkrong kopi robusta tubruk, kopi susu gula aren, dan cemilan warkop nusantara.',
      logo_url: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=300&q=80',
      phone: '081234567890',
      whatsapp: '6281234567890',
      address: 'Jl. Merdeka No. 12, Jakarta Selatan',
      google_maps_url: 'https://maps.google.com/?q=-6.2088,106.8456',
      opening_hours: {
        senin_jumat: '08:00 - 23:00 WIB',
        sabtu_minggu: '08:00 - 01:00 WIB',
        catatan: 'Buka Setiap Hari',
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as Business[],

  users: [
    {
      id: 'u1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      full_name: 'Budi Santoso',
      email: 'owner.warkop@example.com',
      password_hash: hash123,
      role: 'owner',
      phone: '081234567890',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as User[],

  settings: [
    {
      id: 's1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      theme_preset: 'amber_warm',
      primary_color: '#78350f',
      secondary_color: '#d97706',
      background_color: '#fffbeb',
      text_color: '#1f2937',
      button_style: 'rounded',
      card_style: 'shadow',
      font_family: 'Inter',
      is_ordering_enabled: true,
      announcement: '☕ Nikmati diskon 15% untuk paket Kopi Susu + Camilan Warkop!',
      additional_config: {
        payment_config: {
          qris_enabled: true,
          qris_merchant_name: 'Warkop Nusantara',
          qris_nmid: 'ID1020261928374',
          cash_enabled: true,
        },
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as Setting[],

  categories: [
    {
      id: 'c1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Kopi & Signature Drink',
      slug: 'kopi-signature-drink',
      description: 'Seduhan robusta tubruk, espresso susu aren, dan racikan kopi khas warkop.',
      image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&q=80',
      display_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1111112-9c0b-4ef8-bb6d-6bb9bd380112',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Minuman Segar Non-Kopi',
      slug: 'minuman-segar-non-kopi',
      description: 'Pelepas dahaga: teh melati jumbo, es jeruk peras murni, dan es cokelat.',
      image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',
      display_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1111113-9c0b-4ef8-bb6d-6bb9bd380113',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Mie & Makanan Utama',
      slug: 'mie-makanan-utama',
      description: 'Indomie dok-dok kuah kental, mie goreng spesial kornet, dan nasi warkop.',
      image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
      display_order: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1111114-9c0b-4ef8-bb6d-6bb9bd380114',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Roti Bakar & Camilan',
      slug: 'roti-bakar-camilan',
      description: 'Roti bakar meses keju tebal, pisang crispy aren, dan gorengan hangat.',
      image_url: 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?auto=format&fit=crop&w=400&q=80',
      display_order: 4,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1111115-9c0b-4ef8-bb6d-6bb9bd380115',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      name: 'Paket Hemat Nongkrong',
      slug: 'paket-hemat-nongkrong',
      description: 'Kombinasi ngopi santai + camilan hemat untuk nemenin obrolan malam.',
      image_url: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=400&q=80',
      display_order: 5,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as Category[],

  products: [
    // 1. Kategori: Kopi & Signature Drink
    {
      id: 'p1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      name: 'Kopi Susu Gula Aren',
      slug: 'kopi-susu-gula-aren',
      description: 'Espresso robusta pilihan berpadu gurihnya susu kental dan manis aren murni.',
      price: 18000,
      stock: 80,
      image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111112-9c0b-4ef8-bb6d-6bb9bd380112',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      name: 'Kopi Tubruk Robusta Lampung',
      slug: 'kopi-tubruk-robusta',
      description: 'Seduhan biji kopi robusta sangrai tradisional, aroma pekat dan rasa pahit mantap.',
      price: 10000,
      stock: 120,
      image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111113-9c0b-4ef8-bb6d-6bb9bd380113',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      name: 'Kopi Tarik Tradisional',
      slug: 'kopi-tarik-tradisional',
      description: 'Kopi hitam diseduh susu manis ditarik berbusa lembut khas kedai peranakan.',
      price: 16000,
      stock: 65,
      image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },

    // 2. Kategori: Minuman Segar Non-Kopi
    {
      id: 'p1111121-9c0b-4ef8-bb6d-6bb9bd380121',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111112-9c0b-4ef8-bb6d-6bb9bd380112',
      name: 'Es Teh Manis Jumbo',
      slug: 'es-teh-manis-jumbo',
      description: 'Racikan seduhan daun teh melati wangi dengan es batu melimpah porsi jumbo.',
      price: 6000,
      stock: 250,
      image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111122-9c0b-4ef8-bb6d-6bb9bd380122',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111112-9c0b-4ef8-bb6d-6bb9bd380112',
      name: 'Es Jeruk Peras Murni',
      slug: 'es-jeruk-peras-murni',
      description: 'Perasan jeruk asli segar tanpa pengawet dengan es batu pelepas dahaga.',
      price: 12000,
      stock: 90,
      image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111123-9c0b-4ef8-bb6d-6bb9bd380123',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111112-9c0b-4ef8-bb6d-6bb9bd380112',
      name: 'Es Cokelat Warkop Creamy',
      slug: 'es-cokelat-warkop',
      description: 'Cokelat bubuk pekat dipadu susu kental manis gurih, nikmat diseruput dingin.',
      price: 15000,
      stock: 70,
      image_url: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },

    // 3. Kategori: Mie & Makanan Utama
    {
      id: 'p1111131-9c0b-4ef8-bb6d-6bb9bd380131',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111113-9c0b-4ef8-bb6d-6bb9bd380113',
      name: 'Indomie Goreng Dok-dok Telur Kornet',
      slug: 'indomie-dokdok-telur-kornet',
      description: 'Indomie kuah kental tumis bumbu bawang cabai, telur orak-arik dan topping kornet gurih.',
      price: 20000,
      stock: 60,
      image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111132-9c0b-4ef8-bb6d-6bb9bd380132',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111113-9c0b-4ef8-bb6d-6bb9bd380113',
      name: 'Nasi Goreng Spesial Warkop',
      slug: 'nasi-goreng-spesial-warkop',
      description: 'Nasi goreng bumbu racik istimewa dengan telur ceplok mata sapi dan kerupuk renyah.',
      price: 24000,
      stock: 45,
      image_url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111133-9c0b-4ef8-bb6d-6bb9bd380133',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111113-9c0b-4ef8-bb6d-6bb9bd380113',
      name: 'Mie Nyemek Pedas Gurih',
      slug: 'mie-nyemek-pedas',
      description: 'Mie rebus bumbu rempah dengan sawi hijau, suwiran ayam, dan kuah kental medok.',
      price: 18000,
      stock: 50,
      image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },

    // 4. Kategori: Roti Bakar & Camilan
    {
      id: 'p1111141-9c0b-4ef8-bb6d-6bb9bd380141',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111114-9c0b-4ef8-bb6d-6bb9bd380141',
      name: 'Roti Bakar Cokelat Keju Tebal',
      slug: 'roti-bakar-cokelat-keju',
      description: 'Roti panggang mentega wangi bertabur meses cokelat pekat dan keju parut gurih melimpah.',
      price: 16000,
      stock: 40,
      image_url: 'https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111142-9c0b-4ef8-bb6d-6bb9bd380142',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111114-9c0b-4ef8-bb6d-6bb9bd380141',
      name: 'Pisang Goreng Crispy Gula Aren',
      slug: 'pisang-goreng-crispy',
      description: 'Pisang kepok manis digoreng tepung renyah dengan siraman kental gula aren murni.',
      price: 15000,
      stock: 35,
      image_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111143-9c0b-4ef8-bb6d-6bb9bd380143',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111114-9c0b-4ef8-bb6d-6bb9bd380141',
      name: 'Kentang Goreng Bumbu BBQ',
      slug: 'kentang-goreng-bbq',
      description: 'Potongan french fries renyah keemasan ditaburi bumbu gurih dan saus sambal cocol.',
      price: 14000,
      stock: 50,
      image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111144-9c0b-4ef8-bb6d-6bb9bd380144',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111114-9c0b-4ef8-bb6d-6bb9bd380141',
      name: 'Tempe Mendoan Hangat Sambal Kecap',
      slug: 'tempe-mendoan-hangat',
      description: 'Tempe kedelai tipis lembut digoreng setengah matang dengan bumbu daun bawang & sambal kecap pedas.',
      price: 12000,
      stock: 60,
      image_url: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 4,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111145-9c0b-4ef8-bb6d-6bb9bd380145',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111114-9c0b-4ef8-bb6d-6bb9bd380141',
      name: 'Cireng Crispy Bumbu Rujak',
      slug: 'cireng-crispy-rujak',
      description: 'Cemilan aci goreng kenyal renyah di luar, dicocol bumbu rujak pedas manis asam segar.',
      price: 13000,
      stock: 45,
      image_url: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },

    // 5. Kategori: Paket Hemat Nongkrong
    {
      id: 'p1111151-9c0b-4ef8-bb6d-6bb9bd380151',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111115-9c0b-4ef8-bb6d-6bb9bd380115',
      name: 'Paket Ngopi Santai (Kopi + Roti)',
      slug: 'paket-ngopi-santai',
      description: 'Kombinasi 1x Kopi Susu Gula Aren + 1x Roti Bakar Cokelat Keju (Hemat Rp 4.000).',
      price: 30000,
      stock: 30,
      image_url: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111152-9c0b-4ef8-bb6d-6bb9bd380152',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111115-9c0b-4ef8-bb6d-6bb9bd380115',
      name: 'Paket Kenyang Warkop (Mie + Es Teh)',
      slug: 'paket-kenyang-warkop',
      description: '1x Indomie Dok-dok Telur Kornet + 1x Es Teh Manis Jumbo (Hemat Rp 3.000).',
      price: 23000,
      stock: 40,
      image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'p1111153-9c0b-4ef8-bb6d-6bb9bd380153',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'c1111115-9c0b-4ef8-bb6d-6bb9bd380115',
      name: 'Paket Mabar Begadang (Kopi + Kentang + Cireng)',
      slug: 'paket-mabar-begadang',
      description: '1x Kopi Susu Aren + 1x Kentang BBQ + 1x Cireng Rujak porsi sharing bareng teman.',
      price: 39000,
      stock: 25,
      image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as Product[],

  orders: [
    {
      id: 'o1111111-9c0b-4ef8-bb6d-6bb9bd380111',
      order_number: 'ORD-WARKOP-001',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      customer_name: 'Dimas Aditya',
      customer_phone: '081211112222',
      customer_note: 'Kopi less sugar ya mas',
      order_type: 'dine_in',
      table_number: 'Meja 05',
      total_amount: 42000,
      status: 'pending',
      payment_status: 'paid',
      payment_method: 'qris',
      created_at: new Date(Date.now() - 600000).toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          id: 'i1111111-9c0b-4ef8-bb6d-6bb9bd380111',
          order_id: 'o1111111-9c0b-4ef8-bb6d-6bb9bd380111',
          product_id: 'p1111111-9c0b-4ef8-bb6d-6bb9bd380111',
          product_name: 'Kopi Susu Gula Aren',
          quantity: 2,
          price: 18000,
          subtotal: 36000,
          item_note: 'Less sugar 50%',
          created_at: new Date().toISOString(),
        },
        {
          id: 'i1111112-9c0b-4ef8-bb6d-6bb9bd380112',
          order_id: 'o1111111-9c0b-4ef8-bb6d-6bb9bd380111',
          product_id: 'p1111112-9c0b-4ef8-bb6d-6bb9bd380112',
          product_name: 'Es Teh Manis Jumbo',
          quantity: 1,
          price: 6000,
          subtotal: 6000,
          item_note: '',
          created_at: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'o1111112-9c0b-4ef8-bb6d-6bb9bd380112',
      order_number: 'ORD-WARKOP-002',
      business_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      customer_name: 'Rian Pratama',
      customer_phone: '085799998888',
      customer_note: 'Indomie pedas sedang',
      order_type: 'dine_in',
      table_number: 'Meja 02',
      total_amount: 36000,
      status: 'processing',
      payment_status: 'paid',
      payment_method: 'cash',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          id: 'i1111113-9c0b-4ef8-bb6d-6bb9bd380113',
          order_id: 'o1111112-9c0b-4ef8-bb6d-6bb9bd380112',
          product_id: 'p1111131-9c0b-4ef8-bb6d-6bb9bd380131',
          product_name: 'Indomie Goreng Dok-dok Telur Kornet',
          quantity: 1,
          price: 20000,
          subtotal: 20000,
          item_note: 'Pedas sedang',
          created_at: new Date().toISOString(),
        },
        {
          id: 'i1111114-9c0b-4ef8-bb6d-6bb9bd380114',
          order_id: 'o1111112-9c0b-4ef8-bb6d-6bb9bd380112',
          product_id: 'p1111141-9c0b-4ef8-bb6d-6bb9bd380141',
          product_name: 'Roti Bakar Cokelat Keju Tebal',
          quantity: 1,
          price: 16000,
          subtotal: 16000,
          item_note: '',
          created_at: new Date().toISOString(),
        },
      ],
    },
  ] as Order[],

  order_items: [] as OrderItem[],
};

// Segera muat data yang tersimpan di disk (jika ada file penyimpanan lokal)
loadLocalStore();

// Jika file local_storage_data.json belum pernah dibuat, buat file pertama kali agar data selalu awet
try {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    saveLocalStore();
  }
} catch (e) {
  console.warn('Init store save notice:', e);
}

/**
 * Eksekusi parameterized query SQL jika terhubung ke Supabase PostgreSQL.
 */
export async function executeSqlQuery(text: string, params: any[] = []) {
  if (isPostgresConnected && pool) {
    const client = await pool.connect();
    try {
      const res = await client.query(text, params);
      return res.rows;
    } finally {
      client.release();
    }
  }
  return null;
}
