import { Pool } from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

import fs from 'fs';
import path from 'path';

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
    const atMatches = connStr.match(/@/g);
    if (atMatches && atMatches.length > 1) {
      console.warn(`⚠️ Perhatian: Ditemukan ${atMatches.length} tanda '@' di DATABASE_URL. Jika password mengandung '@', wajib ganti dengan '%40'.`);
    }

    const candidatePool = new Pool({
      connectionString: connStr,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });

    candidatePool.on('error', (err) => {
      console.warn('⚠️ PostgreSQL idle connection notice:', err.message);
    });

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
        }

        const seedsCandidates = [
          path.resolve(process.cwd(), 'database', 'seeds.sql'),
          path.resolve(process.cwd(), 'seeds.sql'),
        ];
        const seedsFile = seedsCandidates.find((f) => fs.existsSync(f));

        if (seedsFile) {
          const seedsSql = fs.readFileSync(seedsFile, 'utf-8');
          await client.query(seedsSql);
          console.log('✅ Data demo Kavarna berhasil di-seed dari file seeds.sql!');
        }
      } else {
        console.log('📋 Tabel database Supabase sudah ada.');
      }

      // Selalu jalankan verifikasi kolom (Auto-Migrate)
      await runDatabaseMigrations(client);

      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    pool = null;
    isPostgresConnected = false;
    console.error('❌ Gagal terhubung ke database PostgreSQL Supabase:', err.message);
    return false;
  }
}

/**
 * Memastikan semua kolom penting tersedia di Supabase
 */
export async function runDatabaseMigrations(client: any): Promise<void> {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    // Skema & Kolom Orders
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

    // Skema & Kolom Order Items
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

    // Kolom Users, Businesses, Products, Categories, Settings
    await client.query(`
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS opening_hours JSONB;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS stock INT DEFAULT 0;
      ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS image_url TEXT;

      ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
      ALTER TABLE IF EXISTS categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

      ALTER TABLE IF EXISTS settings ADD COLUMN IF NOT EXISTS theme_preset VARCHAR(50) DEFAULT 'midnight_neon';
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
        if (Array.isArray(data.users)) memoryStore.users = data.users;
        if (Array.isArray(data.orders)) memoryStore.orders = data.orders;
        if (Array.isArray(data.products)) memoryStore.products = data.products;
        if (Array.isArray(data.categories)) memoryStore.categories = data.categories;
        if (Array.isArray(data.settings)) memoryStore.settings = data.settings;
        if (Array.isArray(data.businesses)) memoryStore.businesses = data.businesses;
        return;
      }
    }

    if (fs.existsSync(LOCAL_ORDERS_PATH)) {
      const ordStr = fs.readFileSync(LOCAL_ORDERS_PATH, 'utf-8');
      const orders = JSON.parse(ordStr);
      if (Array.isArray(orders)) {
        memoryStore.orders = orders;
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
// INTERFACES
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

// -------------------------------------------------------------
// IN-MEMORY / FALLBACK STORE (KAVARNA COFFEE BAR & KITCHEN)
// -------------------------------------------------------------
const defaultHash = bcrypt.hashSync('Rahasia123!', 10);
const KAVARNA_BUSINESS_ID = 'b1010101-9c0b-4ef8-bb6d-6bb9bd380001';

export const memoryStore = {
  businesses: [
    {
      id: KAVARNA_BUSINESS_ID,
      name: 'Kavarna Coffee Bar & Kitchen',
      slug: 'kavarna-coffee',
      description: 'Specialty coffee bar, signature mocktails, and kitchen comfort food. Suasana nyaman 2 lantai untuk nongkrong, kerja, dan santai.',
      logo_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80',
      phone: '081226002000',
      whatsapp: '6281226002000',
      address: 'Jl. Veteran No. 51, Jetis, Kec. Sukoharjo, Kabupaten Sukoharjo, Jawa Tengah 57511',
      google_maps_url: 'https://maps.google.com/?q=Kavarna+Coffee+Bar+Kitchen+Sukoharjo',
      opening_hours: {
        senin_kamis: '10:00 - 23:00 WIB',
        jumat_minggu: '10:00 - 00:00 WIB',
        catatan: 'Buka Setiap Hari • Lantai 1 & Lantai 2',
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as Business[],

  users: [
    {
      id: 'd1010101-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      full_name: 'Fajar (Owner Kavarna)',
      email: 'owner.warkop@example.com',
      password_hash: defaultHash,
      role: 'owner',
      phone: '081226002000',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as User[],

  settings: [
    {
      id: 'e1010101-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      theme_preset: 'midnight_neon',
      primary_color: '#d97706',
      secondary_color: '#b45309',
      background_color: '#0d0d0f',
      text_color: '#f4f4f5',
      button_style: 'rounded',
      card_style: 'shadow',
      font_family: 'Plus Jakarta Sans',
      is_ordering_enabled: true,
      announcement: '✨ Selamat Datang di Kavarna Coffee! Pesan dari meja Anda tanpa perlu antre ke kasir.',
      additional_config: {
        payment_config: {
          qris_enabled: true,
          qris_merchant_name: 'Kavarna Coffee Bar & Kitchen',
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
      id: 'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      name: 'Signature Coffee',
      slug: 'signature-coffee',
      description: 'Kopi racikan khas Kavarna dengan resep otentik & bahan premium.',
      image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&q=80',
      display_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1000002-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      name: 'Signature Mocktails',
      slug: 'signature-mocktails',
      description: 'Sensasi kesegaran buah asli, sparkling soda, dan aroma rempah eksotis.',
      image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80',
      display_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1000003-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      name: 'Classic Espresso',
      slug: 'classic-espresso',
      description: 'Seduhan espresso murni, americano, latte, dan cappuccino dari biji kopi pilihan.',
      image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80',
      display_order: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1000004-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      name: 'Artisan Tea & Sweet Series',
      slug: 'sweet-series-artisan-tea',
      description: 'Pilihan non-kopi creamy matcha, red velvet, cokelat murni & artisan tea.',
      image_url: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80',
      display_order: 4,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1000005-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      name: 'Kitchen & Main Courses',
      slug: 'kitchen-main-courses',
      description: 'Butter rice katsu, pasta italia, sapo tahu, dan nasi goreng racikan koki Kavarna.',
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      display_order: 5,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'c1000006-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      name: 'Snacks & Finger Food',
      slug: 'snacks-finger-food',
      description: 'Platter cemilan renyah untuk teman ngobrol santai bareng teman & kolega.',
      image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=400&q=80',
      display_order: 6,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as Category[],

  products: [
    {
      id: 'f1000001-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      category_id: 'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
      name: 'Kopi Susu Veteran',
      slug: 'kopi-susu-veteran',
      description: 'Signature terlaris Kavarna! Fresh milk, espresso blend, aren organik & cream lembut.',
      price: 30000,
      stock: 100,
      image_url: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'f1000002-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      category_id: 'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
      name: 'Butterscotch Sea Salt Latte',
      slug: 'butterscotch-sea-salt-latte',
      description: 'Espresso pekat berpadu butterscotch wangi dan sea salt cold foam creamy gurih.',
      price: 36000,
      stock: 80,
      image_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'f1000003-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      category_id: 'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
      name: 'Nutella Latte',
      slug: 'nutella-latte',
      description: 'Nutella hazelnut cocoa murni, espresso shot Kavarna, fresh milk & whipped cream.',
      price: 31000,
      stock: 60,
      image_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'f1000004-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      category_id: 'c1000002-9c0b-4ef8-bb6d-6bb9bd380001',
      name: 'Lucky Berrys Mocktail',
      slug: 'lucky-berrys',
      description: 'Mocktail stroberi segar, blueberry reduction, sparkling soda & mint.',
      price: 35000,
      stock: 75,
      image_url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'f1000005-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      category_id: 'c1000005-9c0b-4ef8-bb6d-6bb9bd380001',
      name: 'Chicken Katsu Butter Rice',
      slug: 'chicken-katsu-butter-rice',
      description: 'Nasi mentega gurih harum disajikan dengan chicken katsu renyah & saus BBQ/Curry khas Kavarna.',
      price: 38000,
      stock: 50,
      image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'f1000006-9c0b-4ef8-bb6d-6bb9bd380001',
      business_id: KAVARNA_BUSINESS_ID,
      category_id: 'c1000006-9c0b-4ef8-bb6d-6bb9bd380001',
      name: 'Kavarna Snack Platter',
      slug: 'kavarna-snack-platter',
      description: 'Kombinasi kentang crinkle, sosis cocktail panggang, nugget crispy, dan saus keju cocolan.',
      price: 35000,
      stock: 65,
      image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
      is_available: true,
      display_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ] as Product[],

  orders: [] as Order[],
  order_items: [] as OrderItem[],
};

loadLocalStore();

try {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    saveLocalStore();
  }
} catch (e) {
  console.warn('Init store save notice:', e);
}

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