// server/api.ts
import express from "express";
import cors from "cors";
import dotenv3 from "dotenv";

// server/routes/authRoutes.ts
import { Router } from "express";
import bcrypt3 from "bcryptjs";
import jwt2 from "jsonwebtoken";

// server/database/db.ts
import { Pool } from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
dotenv.config();
var connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;
var pool = null;
var isPostgresConnected = false;
async function initDatabase() {
  const connStr = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (!connStr || connStr.includes("your-db-password") || connStr.trim() === "") {
    console.info("\u2139\uFE0F Mode In-Memory: DATABASE_URL / POSTGRES_URL belum diisi dengan kredensial database asli.");
    pool = null;
    isPostgresConnected = false;
    return false;
  }
  try {
    const atMatches = connStr.match(/@/g);
    if (atMatches && atMatches.length > 1) {
      console.warn(`\u26A0\uFE0F Perhatian: Ditemukan ${atMatches.length} tanda '@' di DATABASE_URL. Jika password mengandung '@', wajib ganti dengan '%40'.`);
    }
    const candidatePool = new Pool({
      connectionString: connStr,
      ssl: {
        rejectUnauthorized: false
        // Diperlukan untuk cloud Supabase & PostgreSQL SSL
      },
      max: 10,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 3500
    });
    candidatePool.on("error", (err) => {
      console.warn("\u26A0\uFE0F PostgreSQL idle connection notice:", err.message);
    });
    const client = await candidatePool.connect();
    try {
      await client.query("SELECT 1");
      pool = candidatePool;
      isPostgresConnected = true;
      console.log("\u2705 Berhasil terhubung ke database PostgreSQL Supabase!");
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'businesses'
        );
      `);
      const tablesExist = tableCheck.rows[0]?.exists;
      if (!tablesExist) {
        console.log("\u{1F4E6} Skema database belum ditemukan. Menjalankan migrasi otomatis...");
        const schemaCandidates = [
          path.resolve(process.cwd(), "database", "schema.sql"),
          path.resolve(process.cwd(), "schema.sql")
        ];
        const schemaFile = schemaCandidates.find((f) => fs.existsSync(f));
        if (schemaFile) {
          const schemaSql = fs.readFileSync(schemaFile, "utf-8");
          await client.query(schemaSql);
          console.log("\u2705 Skema tabel database berhasil dibuat dari file schema.sql!");
        } else {
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
          console.log("\u2705 Skema tabel database (businesses, products, orders, dll) berhasil dibuat di Supabase!");
        }
        console.log("\u{1F331} Menjalankan seeding data awal Warkop & produk...");
        const seedsCandidates = [
          path.resolve(process.cwd(), "database", "seeds.sql"),
          path.resolve(process.cwd(), "seeds.sql")
        ];
        const seedsFile = seedsCandidates.find((f) => fs.existsSync(f));
        if (seedsFile) {
          const seedsSql = fs.readFileSync(seedsFile, "utf-8");
          await client.query(seedsSql);
          console.log("\u2705 Data demo Warkop Nusantara berhasil di-seed dari file!");
        } else {
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
              '\u2615 Nikmati diskon 15% untuk paket Kopi Susu + Camilan Warkop!'
            )
            ON CONFLICT (business_id) DO NOTHING;
          `);
          console.log("\u2705 Data demo Warkop Nusantara berhasil di-seed ke Supabase!");
        }
      } else {
        console.log("\u{1F4CB} Tabel database Supabase sudah ada.");
      }
      await runDatabaseMigrations(client);
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    pool = null;
    isPostgresConnected = false;
    console.error("\u274C Gagal terhubung ke database PostgreSQL Supabase:", err.message);
    if (err.message && err.message.includes("ENOTFOUND base")) {
      console.warn(`
\u{1F50D} DETEKSI KESALAHAN 'ENOTFOUND base':
Host terbaca hanya sebagai "base" (bukan domain lengkap Supabase).
Penyebab utama:
1. Password kamu mengandung simbol '@'. Karena format URL memakai '@' pemisah host, ganti simbol '@' pada password menjadi '%40'.
2. Atau ada typo / spasi pada bagian "...supabase.com" (misal: "supa base.com" atau "...@base").
3. Pastikan string koneksi utuh satu baris tanpa terpotong.`);
    }
    console.info(`
========================================================================
\u{1F4A1} PANDUAN MENGATASI ERROR DATABASE SUPABASE:
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
async function runDatabaseMigrations(client) {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
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
    await client.query(`
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';
      ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
    await client.query(`
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS banner_url TEXT;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS opening_hours JSONB;
      ALTER TABLE IF EXISTS businesses ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
    `);
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
    console.log('\u{1F4CB} Verifikasi skema Supabase: Kolom "customer_note" & seluruh tabel siap digunakan!');
  } catch (migErr) {
    console.warn("\u26A0\uFE0F Catatan sinkronisasi kolom tabel database:", migErr.message);
  }
}
var isVercel = Boolean(process.env.VERCEL);
var LOCAL_STORE_PATH = isVercel ? path.join("/tmp", "local_storage_data.json") : path.resolve(process.cwd(), "local_storage_data.json");
var LOCAL_ORDERS_PATH = isVercel ? path.join("/tmp", "local_orders_storage.json") : path.resolve(process.cwd(), "local_orders_storage.json");
function saveLocalStore() {
  try {
    const data = {
      businesses: memoryStore.businesses,
      users: memoryStore.users,
      settings: memoryStore.settings,
      categories: memoryStore.categories,
      products: memoryStore.products,
      orders: memoryStore.orders
    };
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
    fs.writeFileSync(LOCAL_ORDERS_PATH, JSON.stringify(memoryStore.orders, null, 2), "utf-8");
  } catch (err) {
    console.warn("\u26A0\uFE0F Gagal menyimpan cache data lokal:", err);
  }
}
function loadLocalStore() {
  try {
    const defaultDataPath = path.resolve(process.cwd(), "local_storage_data.json");
    const storePathToRead = fs.existsSync(LOCAL_STORE_PATH) ? LOCAL_STORE_PATH : fs.existsSync(defaultDataPath) ? defaultDataPath : null;
    if (storePathToRead && fs.existsSync(storePathToRead)) {
      const dataStr = fs.readFileSync(storePathToRead, "utf-8");
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
        console.log(`\u{1F4E6} Berhasil memuat data lokal ter-update (akun/password, produk, pesanan) dari disk (${memoryStore.products.length} produk, ${memoryStore.orders.length} pesanan).`);
        return;
      }
    }
    if (fs.existsSync(LOCAL_ORDERS_PATH)) {
      const ordStr = fs.readFileSync(LOCAL_ORDERS_PATH, "utf-8");
      const orders = JSON.parse(ordStr);
      if (Array.isArray(orders)) {
        memoryStore.orders = orders;
        console.log(`\u{1F4E6} Berhasil memuat ${orders.length} pesanan dari local_orders_storage.json.`);
      }
    }
  } catch (err) {
    console.warn("\u26A0\uFE0F Gagal membaca cache data lokal:", err);
  }
}
var saveLocalOrders = saveLocalStore;
initDatabase().catch((e) => {
  console.warn("Initial db init check notice:", e.message);
});
var hash123 = bcrypt.hashSync("Rahasia123!", 10);
var memoryStore = {
  businesses: [
    {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Warkop Nusantara",
      slug: "warkop-nusantara",
      description: "Pusat nongkrong kopi robusta tubruk, kopi susu gula aren, dan cemilan warkop nusantara.",
      logo_url: "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=300&q=80",
      phone: "081234567890",
      whatsapp: "6281234567890",
      address: "Jl. Merdeka No. 12, Jakarta Selatan",
      google_maps_url: "https://maps.google.com/?q=-6.2088,106.8456",
      opening_hours: {
        senin_jumat: "08:00 - 23:00 WIB",
        sabtu_minggu: "08:00 - 01:00 WIB",
        catatan: "Buka Setiap Hari"
      },
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  users: [
    {
      id: "u1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      full_name: "Budi Santoso",
      email: "owner.warkop@example.com",
      password_hash: hash123,
      role: "owner",
      phone: "081234567890",
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  settings: [
    {
      id: "s1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      theme_preset: "amber_warm",
      primary_color: "#78350f",
      secondary_color: "#d97706",
      background_color: "#fffbeb",
      text_color: "#1f2937",
      button_style: "rounded",
      card_style: "shadow",
      font_family: "Inter",
      is_ordering_enabled: true,
      announcement: "\u2615 Nikmati diskon 15% untuk paket Kopi Susu + Camilan Warkop!",
      additional_config: {
        payment_config: {
          qris_enabled: true,
          qris_merchant_name: "Warkop Nusantara",
          qris_nmid: "ID1020261928374",
          cash_enabled: true
        }
      },
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  categories: [
    {
      id: "c1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Kopi & Signature Drink",
      slug: "kopi-signature-drink",
      description: "Seduhan robusta tubruk, espresso susu aren, dan racikan kopi khas warkop.",
      image_url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=400&q=80",
      display_order: 1,
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "c1111112-9c0b-4ef8-bb6d-6bb9bd380112",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Minuman Segar Non-Kopi",
      slug: "minuman-segar-non-kopi",
      description: "Pelepas dahaga: teh melati jumbo, es jeruk peras murni, dan es cokelat.",
      image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=400&q=80",
      display_order: 2,
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "c1111113-9c0b-4ef8-bb6d-6bb9bd380113",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Mie & Makanan Utama",
      slug: "mie-makanan-utama",
      description: "Indomie dok-dok kuah kental, mie goreng spesial kornet, dan nasi warkop.",
      image_url: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80",
      display_order: 3,
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "c1111114-9c0b-4ef8-bb6d-6bb9bd380114",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Roti Bakar & Camilan",
      slug: "roti-bakar-camilan",
      description: "Roti bakar meses keju tebal, pisang crispy aren, dan gorengan hangat.",
      image_url: "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?auto=format&fit=crop&w=400&q=80",
      display_order: 4,
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "c1111115-9c0b-4ef8-bb6d-6bb9bd380115",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Paket Hemat Nongkrong",
      slug: "paket-hemat-nongkrong",
      description: "Kombinasi ngopi santai + camilan hemat untuk nemenin obrolan malam.",
      image_url: "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=400&q=80",
      display_order: 5,
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  products: [
    // 1. Kategori: Kopi & Signature Drink
    {
      id: "p1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      name: "Kopi Susu Gula Aren",
      slug: "kopi-susu-gula-aren",
      description: "Espresso robusta pilihan berpadu gurihnya susu kental dan manis aren murni.",
      price: 18e3,
      stock: 80,
      image_url: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111112-9c0b-4ef8-bb6d-6bb9bd380112",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      name: "Kopi Tubruk Robusta Lampung",
      slug: "kopi-tubruk-robusta",
      description: "Seduhan biji kopi robusta sangrai tradisional, aroma pekat dan rasa pahit mantap.",
      price: 1e4,
      stock: 120,
      image_url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 2,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111113-9c0b-4ef8-bb6d-6bb9bd380113",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      name: "Kopi Tarik Tradisional",
      slug: "kopi-tarik-tradisional",
      description: "Kopi hitam diseduh susu manis ditarik berbusa lembut khas kedai peranakan.",
      price: 16e3,
      stock: 65,
      image_url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 3,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    // 2. Kategori: Minuman Segar Non-Kopi
    {
      id: "p1111121-9c0b-4ef8-bb6d-6bb9bd380121",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111112-9c0b-4ef8-bb6d-6bb9bd380112",
      name: "Es Teh Manis Jumbo",
      slug: "es-teh-manis-jumbo",
      description: "Racikan seduhan daun teh melati wangi dengan es batu melimpah porsi jumbo.",
      price: 6e3,
      stock: 250,
      image_url: "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111122-9c0b-4ef8-bb6d-6bb9bd380122",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111112-9c0b-4ef8-bb6d-6bb9bd380112",
      name: "Es Jeruk Peras Murni",
      slug: "es-jeruk-peras-murni",
      description: "Perasan jeruk asli segar tanpa pengawet dengan es batu pelepas dahaga.",
      price: 12e3,
      stock: 90,
      image_url: "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 2,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111123-9c0b-4ef8-bb6d-6bb9bd380123",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111112-9c0b-4ef8-bb6d-6bb9bd380112",
      name: "Es Cokelat Warkop Creamy",
      slug: "es-cokelat-warkop",
      description: "Cokelat bubuk pekat dipadu susu kental manis gurih, nikmat diseruput dingin.",
      price: 15e3,
      stock: 70,
      image_url: "https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 3,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    // 3. Kategori: Mie & Makanan Utama
    {
      id: "p1111131-9c0b-4ef8-bb6d-6bb9bd380131",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111113-9c0b-4ef8-bb6d-6bb9bd380113",
      name: "Indomie Goreng Dok-dok Telur Kornet",
      slug: "indomie-dokdok-telur-kornet",
      description: "Indomie kuah kental tumis bumbu bawang cabai, telur orak-arik dan topping kornet gurih.",
      price: 2e4,
      stock: 60,
      image_url: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111132-9c0b-4ef8-bb6d-6bb9bd380132",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111113-9c0b-4ef8-bb6d-6bb9bd380113",
      name: "Nasi Goreng Spesial Warkop",
      slug: "nasi-goreng-spesial-warkop",
      description: "Nasi goreng bumbu racik istimewa dengan telur ceplok mata sapi dan kerupuk renyah.",
      price: 24e3,
      stock: 45,
      image_url: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 2,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111133-9c0b-4ef8-bb6d-6bb9bd380133",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111113-9c0b-4ef8-bb6d-6bb9bd380113",
      name: "Mie Nyemek Pedas Gurih",
      slug: "mie-nyemek-pedas",
      description: "Mie rebus bumbu rempah dengan sawi hijau, suwiran ayam, dan kuah kental medok.",
      price: 18e3,
      stock: 50,
      image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 3,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    // 4. Kategori: Roti Bakar & Camilan
    {
      id: "p1111141-9c0b-4ef8-bb6d-6bb9bd380141",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111114-9c0b-4ef8-bb6d-6bb9bd380141",
      name: "Roti Bakar Cokelat Keju Tebal",
      slug: "roti-bakar-cokelat-keju",
      description: "Roti panggang mentega wangi bertabur meses cokelat pekat dan keju parut gurih melimpah.",
      price: 16e3,
      stock: 40,
      image_url: "https://images.unsplash.com/photo-1584776296944-ab6fb57b0bdd?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111142-9c0b-4ef8-bb6d-6bb9bd380142",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111114-9c0b-4ef8-bb6d-6bb9bd380141",
      name: "Pisang Goreng Crispy Gula Aren",
      slug: "pisang-goreng-crispy",
      description: "Pisang kepok manis digoreng tepung renyah dengan siraman kental gula aren murni.",
      price: 15e3,
      stock: 35,
      image_url: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 2,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111143-9c0b-4ef8-bb6d-6bb9bd380143",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111114-9c0b-4ef8-bb6d-6bb9bd380141",
      name: "Kentang Goreng Bumbu BBQ",
      slug: "kentang-goreng-bbq",
      description: "Potongan french fries renyah keemasan ditaburi bumbu gurih dan saus sambal cocol.",
      price: 14e3,
      stock: 50,
      image_url: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 3,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111144-9c0b-4ef8-bb6d-6bb9bd380144",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111114-9c0b-4ef8-bb6d-6bb9bd380141",
      name: "Tempe Mendoan Hangat Sambal Kecap",
      slug: "tempe-mendoan-hangat",
      description: "Tempe kedelai tipis lembut digoreng setengah matang dengan bumbu daun bawang & sambal kecap pedas.",
      price: 12e3,
      stock: 60,
      image_url: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 4,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111145-9c0b-4ef8-bb6d-6bb9bd380145",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111114-9c0b-4ef8-bb6d-6bb9bd380141",
      name: "Cireng Crispy Bumbu Rujak",
      slug: "cireng-crispy-rujak",
      description: "Cemilan aci goreng kenyal renyah di luar, dicocol bumbu rujak pedas manis asam segar.",
      price: 13e3,
      stock: 45,
      image_url: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 5,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    // 5. Kategori: Paket Hemat Nongkrong
    {
      id: "p1111151-9c0b-4ef8-bb6d-6bb9bd380151",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111115-9c0b-4ef8-bb6d-6bb9bd380115",
      name: "Paket Ngopi Santai (Kopi + Roti)",
      slug: "paket-ngopi-santai",
      description: "Kombinasi 1x Kopi Susu Gula Aren + 1x Roti Bakar Cokelat Keju (Hemat Rp 4.000).",
      price: 3e4,
      stock: 30,
      image_url: "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 1,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111152-9c0b-4ef8-bb6d-6bb9bd380152",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111115-9c0b-4ef8-bb6d-6bb9bd380115",
      name: "Paket Kenyang Warkop (Mie + Es Teh)",
      slug: "paket-kenyang-warkop",
      description: "1x Indomie Dok-dok Telur Kornet + 1x Es Teh Manis Jumbo (Hemat Rp 3.000).",
      price: 23e3,
      stock: 40,
      image_url: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 2,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    },
    {
      id: "p1111153-9c0b-4ef8-bb6d-6bb9bd380153",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      category_id: "c1111115-9c0b-4ef8-bb6d-6bb9bd380115",
      name: "Paket Mabar Begadang (Kopi + Kentang + Cireng)",
      slug: "paket-mabar-begadang",
      description: "1x Kopi Susu Aren + 1x Kentang BBQ + 1x Cireng Rujak porsi sharing bareng teman.",
      price: 39e3,
      stock: 25,
      image_url: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80",
      is_available: true,
      display_order: 3,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  orders: [
    {
      id: "o1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      order_number: "ORD-WARKOP-001",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      customer_name: "Dimas Aditya",
      customer_phone: "081211112222",
      customer_note: "Kopi less sugar ya mas",
      order_type: "dine_in",
      table_number: "Meja 05",
      total_amount: 42e3,
      status: "pending",
      payment_status: "paid",
      payment_method: "qris",
      created_at: new Date(Date.now() - 6e5).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      items: [
        {
          id: "i1111111-9c0b-4ef8-bb6d-6bb9bd380111",
          order_id: "o1111111-9c0b-4ef8-bb6d-6bb9bd380111",
          product_id: "p1111111-9c0b-4ef8-bb6d-6bb9bd380111",
          product_name: "Kopi Susu Gula Aren",
          quantity: 2,
          price: 18e3,
          subtotal: 36e3,
          item_note: "Less sugar 50%",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "i1111112-9c0b-4ef8-bb6d-6bb9bd380112",
          order_id: "o1111111-9c0b-4ef8-bb6d-6bb9bd380111",
          product_id: "p1111112-9c0b-4ef8-bb6d-6bb9bd380112",
          product_name: "Es Teh Manis Jumbo",
          quantity: 1,
          price: 6e3,
          subtotal: 6e3,
          item_note: "",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]
    },
    {
      id: "o1111112-9c0b-4ef8-bb6d-6bb9bd380112",
      order_number: "ORD-WARKOP-002",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      customer_name: "Rian Pratama",
      customer_phone: "085799998888",
      customer_note: "Indomie pedas sedang",
      order_type: "dine_in",
      table_number: "Meja 02",
      total_amount: 36e3,
      status: "processing",
      payment_status: "paid",
      payment_method: "cash",
      created_at: new Date(Date.now() - 36e5).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      items: [
        {
          id: "i1111113-9c0b-4ef8-bb6d-6bb9bd380113",
          order_id: "o1111112-9c0b-4ef8-bb6d-6bb9bd380112",
          product_id: "p1111131-9c0b-4ef8-bb6d-6bb9bd380131",
          product_name: "Indomie Goreng Dok-dok Telur Kornet",
          quantity: 1,
          price: 2e4,
          subtotal: 2e4,
          item_note: "Pedas sedang",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        },
        {
          id: "i1111114-9c0b-4ef8-bb6d-6bb9bd380114",
          order_id: "o1111112-9c0b-4ef8-bb6d-6bb9bd380112",
          product_id: "p1111141-9c0b-4ef8-bb6d-6bb9bd380141",
          product_name: "Roti Bakar Cokelat Keju Tebal",
          quantity: 1,
          price: 16e3,
          subtotal: 16e3,
          item_note: "",
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]
    }
  ],
  order_items: []
};
loadLocalStore();
try {
  if (!fs.existsSync(LOCAL_STORE_PATH)) {
    saveLocalStore();
  }
} catch (e) {
  console.warn("Init store save notice:", e);
}

// server/middleware/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "umkm-platform-super-secret-jwt-key-2026";
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Akses ditolak: Token autentikasi tidak ditemukan. Silakan login terlebih dahulu."
    });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: "Sesi login tidak valid atau telah kedaluwarsa. Silakan login kembali."
    });
  }
}

// server/services/initAuth.ts
import bcrypt2 from "bcryptjs";
async function ensureInitialAdminUser(forceReset = false) {
  const initialEmail = "owner.warkop@example.com";
  const initialPasswordRaw = "Rahasia123!";
  if (pool) {
    try {
      const checkUserRes = await pool.query("SELECT COUNT(*) as count FROM users");
      const userCount = parseInt(checkUserRes.rows[0]?.count || "0", 10);
      const checkOwnerRes = await pool.query(
        "SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [initialEmail]
      );
      if (userCount > 0 && checkOwnerRes.rows.length > 0) {
        const currentHash = checkOwnerRes.rows[0]?.password_hash;
        const dummyCorruptHash = "$2a$12$e868dK7V3fV2pWw5m4UHQOY3zH61c9yT7b0Kq8yQ1aD6q0I6F7NlK";
        if (forceReset || currentHash === dummyCorruptHash || !currentHash) {
          const validHash = await bcrypt2.hash(initialPasswordRaw, 10);
          await pool.query(
            "UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)",
            [validHash, initialEmail]
          );
          console.log(`\u{1F511} Berhasil memulihkan password valid (${initialPasswordRaw}) untuk ${initialEmail} di PostgreSQL!`);
          return { created: false, email: initialEmail, reset: true };
        }
        return { created: false, email: initialEmail };
      }
      let businessId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const bizRes = await pool.query(
        "SELECT id FROM businesses WHERE slug = 'warkop-nusantara' LIMIT 1"
      );
      if (bizRes.rows.length > 0) {
        businessId = bizRes.rows[0].id;
      } else {
        const anyBizRes = await pool.query("SELECT id FROM businesses LIMIT 1");
        if (anyBizRes.rows.length > 0) {
          businessId = anyBizRes.rows[0].id;
        } else {
          const newBiz = await pool.query(
            `INSERT INTO businesses (id, name, slug, description, phone, whatsapp, address, logo_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [
              businessId,
              "Warkop Nusantara",
              "warkop-nusantara",
              "Tempat nongkrong santai dengan racikan kopi susu otentik dan camilan warkop nusantara.",
              "081234567890",
              "6281234567890",
              "Jl. Merdeka No. 12, Jakarta Selatan",
              "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=300&q=80"
            ]
          );
          businessId = newBiz.rows[0].id;
          await pool.query(
            `INSERT INTO settings (business_id, theme_preset, primary_color, secondary_color, background_color, text_color)
             VALUES ($1, 'amber_warm', '#78350f', '#d97706', '#fffbeb', '#1f2937')
             ON CONFLICT (business_id) DO NOTHING`,
            [businessId]
          );
        }
      }
      const passwordHash = await bcrypt2.hash(initialPasswordRaw, 10);
      if (checkOwnerRes.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (business_id, full_name, email, password_hash, role, phone, is_active)
           VALUES ($1, $2, $3, $4, 'owner', '081234567890', true)
           ON CONFLICT (email) DO NOTHING`,
          [
            businessId,
            "Budi Santoso (Owner)",
            initialEmail,
            passwordHash
          ]
        );
        console.log(`\u2705 Akun awal owner berhasil diinisialisasi di PostgreSQL: ${initialEmail}`);
        return { created: true, email: initialEmail };
      }
      return { created: false, email: initialEmail };
    } catch (err) {
      console.warn("\u26A0\uFE0F Gagal menjalankan pemeriksaan akun awal di PostgreSQL:", err.message);
    }
  }
  const existingInMemory = memoryStore.users.find(
    (u) => u.email.toLowerCase() === initialEmail.toLowerCase()
  );
  if (!existingInMemory) {
    const passwordHash = await bcrypt2.hash(initialPasswordRaw, 10);
    memoryStore.users.push({
      id: "u1111111-9c0b-4ef8-bb6d-6bb9bd380111",
      business_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      full_name: "Budi Santoso (Owner)",
      email: initialEmail,
      password_hash: passwordHash,
      role: "owner",
      phone: "081234567890",
      is_active: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return { created: true, email: initialEmail };
  } else if (forceReset) {
    const passwordHash = await bcrypt2.hash(initialPasswordRaw, 10);
    existingInMemory.password_hash = passwordHash;
    existingInMemory.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    return { created: false, email: initialEmail, reset: true };
  }
  return { created: false, email: initialEmail };
}

// server/routes/authRoutes.ts
var router = Router();
var JWT_SECRET2 = process.env.JWT_SECRET || "umkm-platform-super-secret-jwt-key-2026";
router.post("/setup-initial-account", async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await ensureInitialAdminUser(force);
    return res.json({
      success: true,
      message: result.reset ? "Password akun owner awal berhasil di-reset ke Rahasia123!" : result.created ? "Akun owner awal berhasil dibuat di database." : "Akun owner awal sudah tersedia di database.",
      data: {
        email: result.email,
        created: result.created,
        reset: result.reset,
        defaultPassword: "Rahasia123!"
      }
    });
  } catch (err) {
    console.error("Error in setup-initial-account:", err);
    return res.status(500).json({
      success: false,
      message: "Gagal menginisialisasi akun awal."
    });
  }
});
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { full_name, email, phone } = req.body;
    const userId = req.user.userId;
    if (!full_name || full_name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Nama lengkap pemilik/admin wajib diisi."
      });
    }
    if (!email || email.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Alamat email wajib diisi."
      });
    }
    let updatedUser = null;
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
      } catch (err) {
        console.warn("DB error updating profile:", err);
        if (err.code === "23505") {
          return res.status(400).json({
            success: false,
            message: "Email tersebut sudah terdaftar pada pengguna lain."
          });
        }
      }
    }
    const memUser = memoryStore.users.find((u) => u.id === userId);
    if (memUser) {
      memUser.full_name = full_name.trim();
      memUser.email = email.trim().toLowerCase();
      memUser.phone = phone?.trim() || void 0;
      memUser.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      saveLocalStore();
      const { password_hash, ...safeMem } = memUser;
      if (!updatedUser) updatedUser = safeMem;
    }
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan."
      });
    }
    return res.json({
      success: true,
      message: "Profil pemilik berhasil diperbarui!",
      data: updatedUser
    });
  } catch (error) {
    console.error("Error in PUT /api/auth/profile:", error);
    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui profil."
    });
  }
});
router.put("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.userId;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password saat ini, password baru, dan konfirmasi password wajib diisi."
      });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password baru minimal harus 8 karakter."
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password baru dan konfirmasi password tidak cocok."
      });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Password baru tidak boleh sama dengan password saat ini."
      });
    }
    let user = null;
    if (pool) {
      try {
        const uRes = await pool.query(
          "SELECT id, password_hash, email FROM users WHERE id = $1 LIMIT 1",
          [userId]
        );
        if (uRes.rows.length > 0) {
          user = uRes.rows[0];
        }
      } catch (dbErr) {
        console.warn("DB error fetching user for password change:", dbErr);
      }
    }
    if (!user) {
      user = memoryStore.users.find((u) => u.id === userId);
    }
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan atau sesi sudah tidak valid."
      });
    }
    const isCurrentPasswordValid = await bcrypt3.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Password saat ini yang Anda masukkan salah."
      });
    }
    const newPasswordHash = await bcrypt3.hash(newPassword, 10);
    if (pool) {
      try {
        await pool.query(
          "UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
          [newPasswordHash, userId]
        );
      } catch (updateErr) {
        console.error("DB error updating password:", updateErr);
        return res.status(500).json({
          success: false,
          message: "Gagal memperbarui password di database."
        });
      }
    }
    const memUser = memoryStore.users.find((u) => u.id === userId);
    if (memUser) {
      memUser.password_hash = newPasswordHash;
      memUser.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      saveLocalStore();
    }
    return res.json({
      success: true,
      message: "Password berhasil diperbarui! Silakan gunakan password baru untuk login berikutnya."
    });
  } catch (error) {
    console.error("Error in change-password route:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server saat memproses ganti password."
    });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi."
      });
    }
    let user = null;
    let business = null;
    if (pool) {
      try {
        const userRes = await pool.query(
          "SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND is_active = true LIMIT 1",
          [email.trim()]
        );
        if (userRes.rows.length > 0) {
          user = userRes.rows[0];
          const bizRes = await pool.query("SELECT * FROM businesses WHERE id = $1 LIMIT 1", [user.business_id]);
          business = bizRes.rows[0];
        }
      } catch (dbErr) {
        console.warn("DB error during login query, falling back to memoryStore:", dbErr);
      }
    }
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
        message: "Email atau password yang Anda masukkan salah."
      });
    }
    const isPasswordValid = await bcrypt3.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Email atau password yang Anda masukkan salah."
      });
    }
    const payload = {
      userId: user.id,
      businessId: user.business_id,
      role: user.role,
      email: user.email
    };
    const token = jwt2.sign(payload, JWT_SECRET2, { expiresIn: "7d" });
    const { password_hash, ...safeUser } = user;
    return res.json({
      success: true,
      message: "Login berhasil!",
      data: {
        token,
        user: safeUser,
        business
      }
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada server saat login."
    });
  }
});
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userPayload = req.user;
    let user = null;
    let business = null;
    if (pool) {
      try {
        const uRes = await pool.query(
          "SELECT id, business_id, full_name, email, role, phone, is_active FROM users WHERE id = $1",
          [userPayload.userId]
        );
        user = uRes.rows[0];
        if (user) {
          const bRes = await pool.query("SELECT * FROM businesses WHERE id = $1", [user.business_id]);
          business = bRes.rows[0];
        }
      } catch (err) {
        console.warn("DB error in /me, fallback:", err);
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
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }
    return res.json({
      success: true,
      data: {
        user,
        business
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal mengambil data user." });
  }
});
router.post("/logout", (req, res) => {
  return res.json({
    success: true,
    message: "Logout berhasil. Sesi telah diakhiri."
  });
});
var authRoutes_default = router;

// server/routes/businessRoutes.ts
import { Router as Router2 } from "express";
var router2 = Router2();
router2.get("/businesses", async (req, res) => {
  try {
    if (pool) {
      try {
        const result = await pool.query(
          "SELECT id, name, slug, description, logo_url, phone, address FROM businesses WHERE is_active = true ORDER BY name ASC"
        );
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn("DB error fetching businesses:", err);
      }
    }
    const list = memoryStore.businesses.filter((b) => b.is_active).map(({ id, name, slug, description, logo_url, phone, address }) => ({
      id,
      name,
      slug,
      description,
      logo_url,
      phone,
      address
    }));
    return res.json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal mengambil daftar bisnis." });
  }
});
router2.get("/business/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    let business = null;
    let settings = null;
    let categories = [];
    let products = [];
    if (pool) {
      try {
        const bRes = await pool.query("SELECT * FROM businesses WHERE slug = $1 AND is_active = true LIMIT 1", [slug]);
        if (bRes.rows.length > 0) {
          business = bRes.rows[0];
          const sRes = await pool.query("SELECT * FROM settings WHERE business_id = $1 LIMIT 1", [business.id]);
          settings = sRes.rows[0] || null;
          const cRes = await pool.query(
            "SELECT * FROM categories WHERE business_id = $1 AND is_active = true ORDER BY display_order ASC, name ASC",
            [business.id]
          );
          categories = cRes.rows;
          const pRes = await pool.query(
            "SELECT * FROM products WHERE business_id = $1 AND is_available = true ORDER BY display_order ASC, name ASC",
            [business.id]
          );
          products = pRes.rows;
        }
      } catch (err) {
        console.warn("DB error fetching business by slug:", err);
      }
    }
    if (!business) {
      business = memoryStore.businesses.find((b) => b.slug === slug && b.is_active);
      if (business) {
        settings = memoryStore.settings.find((s) => s.business_id === business.id) || null;
        categories = memoryStore.categories.filter((c) => c.business_id === business.id && c.is_active).sort((a, b) => a.display_order - b.display_order);
        products = memoryStore.products.filter((p) => p.business_id === business.id && p.is_available).sort((a, b) => a.display_order - b.display_order);
      }
    }
    if (!business) {
      return res.status(404).json({
        success: false,
        message: `Bisnis dengan URL '${slug}' tidak ditemukan atau sedang nonaktif.`
      });
    }
    return res.json({
      success: true,
      data: {
        business,
        settings,
        categories,
        products
      }
    });
  } catch (error) {
    console.error("Error fetching business by slug:", error);
    return res.status(500).json({ success: false, message: "Gagal mengambil data katalog bisnis." });
  }
});
router2.put("/admin/business", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const {
      name,
      description,
      phone,
      whatsapp,
      address,
      google_maps_url,
      opening_hours,
      logo_url
    } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Nama bisnis tidak boleh kosong." });
    }
    if (pool) {
      try {
        const updateRes = await pool.query(
          `UPDATE businesses
           SET name = $1, description = $2, phone = $3, whatsapp = $4,
               address = $5, google_maps_url = $6, opening_hours = $7,
               logo_url = COALESCE($8, logo_url), updated_at = CURRENT_TIMESTAMP
           WHERE id = $9
           RETURNING *`,
          [
            name.trim(),
            description || "",
            phone || "",
            whatsapp || "",
            address || "",
            google_maps_url || "",
            typeof opening_hours === "object" ? JSON.stringify(opening_hours) : opening_hours,
            logo_url || null,
            businessId
          ]
        );
        if (updateRes.rows.length > 0) {
          return res.json({
            success: true,
            message: "Profil bisnis berhasil diperbarui.",
            data: updateRes.rows[0]
          });
        }
      } catch (err) {
        console.warn("DB error updating business:", err);
      }
    }
    const bIndex = memoryStore.businesses.findIndex((b) => b.id === businessId);
    if (bIndex === -1) {
      return res.status(404).json({ success: false, message: "Bisnis tidak ditemukan." });
    }
    memoryStore.businesses[bIndex] = {
      ...memoryStore.businesses[bIndex],
      name: name.trim(),
      description: description ?? memoryStore.businesses[bIndex].description,
      phone: phone ?? memoryStore.businesses[bIndex].phone,
      whatsapp: whatsapp ?? memoryStore.businesses[bIndex].whatsapp,
      address: address ?? memoryStore.businesses[bIndex].address,
      google_maps_url: google_maps_url ?? memoryStore.businesses[bIndex].google_maps_url,
      opening_hours: opening_hours ?? memoryStore.businesses[bIndex].opening_hours,
      logo_url: logo_url || memoryStore.businesses[bIndex].logo_url,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveLocalStore();
    return res.json({
      success: true,
      message: "Profil bisnis berhasil diperbarui.",
      data: memoryStore.businesses[bIndex]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memperbarui profil bisnis." });
  }
});
var businessRoutes_default = router2;

// server/routes/categoryRoutes.ts
import { Router as Router3 } from "express";
var router3 = Router3();
function slugify(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-");
}
router3.get("/business/:businessId/categories", async (req, res) => {
  try {
    const { businessId } = req.params;
    if (pool) {
      try {
        const result = await pool.query(
          "SELECT * FROM categories WHERE business_id = $1 ORDER BY display_order ASC, name ASC",
          [businessId]
        );
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn("DB error fetching categories:", err);
      }
    }
    const cats = memoryStore.categories.filter((c) => c.business_id === businessId).sort((a, b) => a.display_order - b.display_order);
    return res.json({ success: true, data: cats });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat kategori." });
  }
});
router3.post("/admin/categories", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { name, description, display_order, is_active, image_url } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Nama kategori wajib diisi." });
    }
    const slug = slugify(name);
    if (pool) {
      try {
        const insertRes = await pool.query(
          `INSERT INTO categories (business_id, name, slug, description, display_order, is_active, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            businessId,
            name.trim(),
            slug,
            description || "",
            Number(display_order) || 0,
            is_active !== void 0 ? Boolean(is_active) : true,
            image_url || null
          ]
        );
        return res.status(201).json({
          success: true,
          message: "Kategori berhasil ditambahkan.",
          data: insertRes.rows[0]
        });
      } catch (err) {
        if (err.code === "23505") {
          return res.status(400).json({
            success: false,
            message: "Kategori dengan nama atau slug serupa sudah ada di bisnis Anda."
          });
        }
        console.warn("DB error creating category:", err);
      }
    }
    const newCategory = {
      id: `cat-${Date.now()}`,
      business_id: businessId,
      name: name.trim(),
      slug,
      description: description || "",
      image_url: image_url || null,
      display_order: Number(display_order) || 0,
      is_active: is_active !== void 0 ? Boolean(is_active) : true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    memoryStore.categories.push(newCategory);
    saveLocalStore();
    return res.status(201).json({
      success: true,
      message: "Kategori berhasil ditambahkan.",
      data: newCategory
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menambahkan kategori." });
  }
});
router3.put("/admin/categories/:id", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    const { name, description, display_order, is_active, image_url } = req.body;
    if (pool) {
      try {
        const updateRes = await pool.query(
          `UPDATE categories
           SET name = COALESCE($1, name),
               description = COALESCE($2, description),
               display_order = COALESCE($3, display_order),
               is_active = COALESCE($4, is_active),
               image_url = COALESCE($5, image_url),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 AND business_id = $7
           RETURNING *`,
          [
            name ? name.trim() : null,
            description !== void 0 ? description : null,
            display_order !== void 0 ? Number(display_order) : null,
            is_active !== void 0 ? Boolean(is_active) : null,
            image_url !== void 0 ? image_url : null,
            id,
            businessId
          ]
        );
        if (updateRes.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Kategori tidak ditemukan atau Anda tidak berhak mengubahnya."
          });
        }
        return res.json({
          success: true,
          message: "Kategori berhasil diperbarui.",
          data: updateRes.rows[0]
        });
      } catch (err) {
        console.warn("DB error updating category:", err);
      }
    }
    const catIndex = memoryStore.categories.findIndex(
      (c) => c.id === id && c.business_id === businessId
    );
    if (catIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Kategori tidak ditemukan atau bukan milik bisnis Anda."
      });
    }
    memoryStore.categories[catIndex] = {
      ...memoryStore.categories[catIndex],
      name: name ? name.trim() : memoryStore.categories[catIndex].name,
      description: description !== void 0 ? description : memoryStore.categories[catIndex].description,
      image_url: image_url !== void 0 ? image_url : memoryStore.categories[catIndex].image_url,
      display_order: display_order !== void 0 ? Number(display_order) : memoryStore.categories[catIndex].display_order,
      is_active: is_active !== void 0 ? Boolean(is_active) : memoryStore.categories[catIndex].is_active,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveLocalStore();
    return res.json({
      success: true,
      message: "Kategori berhasil diperbarui.",
      data: memoryStore.categories[catIndex]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memperbarui kategori." });
  }
});
router3.delete("/admin/categories/:id", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    if (pool) {
      try {
        const deleteRes = await pool.query(
          "DELETE FROM categories WHERE id = $1 AND business_id = $2 RETURNING id",
          [id, businessId]
        );
        if (deleteRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Kategori tidak ditemukan." });
        }
        return res.json({ success: true, message: "Kategori berhasil dihapus." });
      } catch (err) {
        console.warn("DB error deleting category:", err);
      }
    }
    const catIndex = memoryStore.categories.findIndex(
      (c) => c.id === id && c.business_id === businessId
    );
    if (catIndex === -1) {
      return res.status(404).json({ success: false, message: "Kategori tidak ditemukan." });
    }
    memoryStore.categories.splice(catIndex, 1);
    saveLocalStore();
    return res.json({ success: true, message: "Kategori berhasil dihapus." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menghapus kategori." });
  }
});
var categoryRoutes_default = router3;

// server/routes/productRoutes.ts
import { Router as Router4 } from "express";
var router4 = Router4();
function slugify2(text) {
  return text.toString().toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "").replace(/\-\-+/g, "-");
}
router4.get("/business/:businessId/products", async (req, res) => {
  try {
    const { businessId } = req.params;
    const { category, available_only } = req.query;
    if (pool) {
      try {
        let sql = "SELECT * FROM products WHERE business_id = $1";
        const params = [businessId];
        if (category) {
          params.push(category);
          sql += ` AND category_id = $${params.length}`;
        }
        if (available_only === "true") {
          sql += " AND is_available = true";
        }
        sql += " ORDER BY display_order ASC, name ASC";
        const result = await pool.query(sql, params);
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn("DB error fetching products:", err);
      }
    }
    let prods = memoryStore.products.filter((p) => p.business_id === businessId);
    if (category) {
      prods = prods.filter((p) => p.category_id === category);
    }
    if (available_only === "true") {
      prods = prods.filter((p) => p.is_available);
    }
    prods.sort((a, b) => a.display_order - b.display_order);
    return res.json({ success: true, data: prods });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat produk." });
  }
});
router4.post("/admin/products", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const {
      name,
      description,
      price,
      stock,
      category_id,
      image_url,
      is_available,
      display_order
    } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Nama produk wajib diisi." });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: "Harga harus berupa angka dan minimal 0." });
    }
    const numStock = stock !== void 0 ? Number(stock) : 0;
    const slug = slugify2(name) + "-" + Date.now().toString().slice(-4);
    if (pool) {
      try {
        const insertRes = await pool.query(
          `INSERT INTO products 
           (business_id, category_id, name, slug, description, price, stock, image_url, is_available, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            businessId,
            category_id || null,
            name.trim(),
            slug,
            description || "",
            numPrice,
            numStock,
            image_url || null,
            is_available !== void 0 ? Boolean(is_available) : true,
            Number(display_order) || 0
          ]
        );
        return res.status(201).json({
          success: true,
          message: "Produk berhasil ditambahkan.",
          data: insertRes.rows[0]
        });
      } catch (err) {
        console.warn("DB error inserting product:", err);
      }
    }
    const newProd = {
      id: `prod-${Date.now()}`,
      business_id: businessId,
      category_id: category_id || null,
      name: name.trim(),
      slug,
      description: description || "",
      price: numPrice,
      stock: numStock,
      image_url: image_url || "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80",
      is_available: is_available !== void 0 ? Boolean(is_available) : true,
      display_order: Number(display_order) || 0,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    memoryStore.products.push(newProd);
    saveLocalStore();
    return res.status(201).json({
      success: true,
      message: "Produk berhasil ditambahkan.",
      data: newProd
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menambahkan produk." });
  }
});
router4.put("/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    const {
      name,
      description,
      price,
      stock,
      category_id,
      image_url,
      is_available,
      display_order
    } = req.body;
    if (pool) {
      try {
        const updateRes = await pool.query(
          `UPDATE products
           SET name = COALESCE($1, name),
               description = COALESCE($2, description),
               price = COALESCE($3, price),
               stock = COALESCE($4, stock),
               category_id = COALESCE($5, category_id),
               image_url = COALESCE($6, image_url),
               is_available = COALESCE($7, is_available),
               display_order = COALESCE($8, display_order),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $9 AND business_id = $10
           RETURNING *`,
          [
            name ? name.trim() : null,
            description !== void 0 ? description : null,
            price !== void 0 ? Number(price) : null,
            stock !== void 0 ? Number(stock) : null,
            category_id !== void 0 ? category_id : null,
            image_url !== void 0 ? image_url : null,
            is_available !== void 0 ? Boolean(is_available) : null,
            display_order !== void 0 ? Number(display_order) : null,
            id,
            businessId
          ]
        );
        if (updateRes.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Produk tidak ditemukan atau bukan milik bisnis Anda."
          });
        }
        return res.json({
          success: true,
          message: "Produk berhasil diperbarui.",
          data: updateRes.rows[0]
        });
      } catch (err) {
        console.warn("DB error updating product:", err);
      }
    }
    const prodIndex = memoryStore.products.findIndex(
      (p) => p.id === id && p.business_id === businessId
    );
    if (prodIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan atau bukan milik bisnis Anda."
      });
    }
    memoryStore.products[prodIndex] = {
      ...memoryStore.products[prodIndex],
      name: name ? name.trim() : memoryStore.products[prodIndex].name,
      description: description !== void 0 ? description : memoryStore.products[prodIndex].description,
      price: price !== void 0 ? Number(price) : memoryStore.products[prodIndex].price,
      stock: stock !== void 0 ? Number(stock) : memoryStore.products[prodIndex].stock,
      category_id: category_id !== void 0 ? category_id : memoryStore.products[prodIndex].category_id,
      image_url: image_url !== void 0 ? image_url : memoryStore.products[prodIndex].image_url,
      is_available: is_available !== void 0 ? Boolean(is_available) : memoryStore.products[prodIndex].is_available,
      display_order: display_order !== void 0 ? Number(display_order) : memoryStore.products[prodIndex].display_order,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveLocalStore();
    return res.json({
      success: true,
      message: "Produk berhasil diperbarui.",
      data: memoryStore.products[prodIndex]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memperbarui produk." });
  }
});
router4.delete("/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    if (pool) {
      try {
        const deleteRes = await pool.query(
          "DELETE FROM products WHERE id = $1 AND business_id = $2 RETURNING id",
          [id, businessId]
        );
        if (deleteRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
        }
        return res.json({ success: true, message: "Produk berhasil dihapus." });
      } catch (err) {
        console.warn("DB error deleting product:", err);
      }
    }
    const prodIndex = memoryStore.products.findIndex(
      (p) => p.id === id && p.business_id === businessId
    );
    if (prodIndex === -1) {
      return res.status(404).json({ success: false, message: "Produk tidak ditemukan." });
    }
    memoryStore.products.splice(prodIndex, 1);
    saveLocalStore();
    return res.json({ success: true, message: "Produk berhasil dihapus." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menghapus produk." });
  }
});
var productRoutes_default = router4;

// server/routes/orderRoutes.ts
import { Router as Router5 } from "express";
var router5 = Router5();
router5.post("/orders", async (req, res) => {
  try {
    const {
      business_id,
      customer_name,
      customer_phone,
      customer_note,
      order_type = "dine_in",
      table_number,
      payment_method = "cash",
      items
    } = req.body;
    if (!business_id) {
      return res.status(400).json({ success: false, message: "ID Bisnis wajib ditentukan." });
    }
    if (!customer_name || customer_name.trim() === "") {
      return res.status(400).json({ success: false, message: "Nama pelanggan wajib diisi." });
    }
    if (!customer_phone || customer_phone.trim() === "") {
      return res.status(400).json({ success: false, message: "Nomor WhatsApp/Telepon pelanggan wajib diisi." });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Keranjang belanja tidak boleh kosong." });
    }
    let computedTotal = 0;
    const validatedItems = [];
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const item of items) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const pRes = await client.query(
            "SELECT id, name, price, is_available, stock FROM products WHERE id = $1 AND business_id = $2",
            [item.product_id, business_id]
          );
          if (pRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              success: false,
              message: `Produk dengan ID ${item.product_id} tidak ditemukan pada bisnis ini.`
            });
          }
          const dbProd = pRes.rows[0];
          if (!dbProd.is_available) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              success: false,
              message: `Mohon maaf, produk '${dbProd.name}' sedang tidak tersedia.`
            });
          }
          const actualPrice = Number(dbProd.price);
          const itemSubtotal = actualPrice * qty;
          computedTotal += itemSubtotal;
          validatedItems.push({
            product_id: dbProd.id,
            product_name: dbProd.name,
            quantity: qty,
            price: actualPrice,
            subtotal: itemSubtotal,
            item_note: item.item_note || ""
          });
        }
        const orderNumber2 = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        let orderInsertRes;
        try {
          orderInsertRes = await client.query(
            `INSERT INTO orders 
             (order_number, business_id, customer_name, customer_phone, customer_note, order_type, table_number, total_amount, status, payment_status, payment_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'unpaid', $9)
             RETURNING *`,
            [
              orderNumber2,
              business_id,
              customer_name.trim(),
              customer_phone.trim(),
              customer_note || "",
              order_type,
              table_number || null,
              computedTotal,
              payment_method
            ]
          );
        } catch (insertColErr) {
          if (insertColErr.message?.includes("customer_note") || insertColErr.code === "42703") {
            console.warn("\u26A0\uFE0F Mendeteksi kolom belum lengkap pada tabel orders, menjalankan auto-patch kolom...");
            await client.query(`
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_note TEXT;
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in';
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0;
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'cash';
            `);
            orderInsertRes = await client.query(
              `INSERT INTO orders 
               (order_number, business_id, customer_name, customer_phone, customer_note, order_type, table_number, total_amount, status, payment_status, payment_method)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'unpaid', $9)
               RETURNING *`,
              [
                orderNumber2,
                business_id,
                customer_name.trim(),
                customer_phone.trim(),
                customer_note || "",
                order_type,
                table_number || null,
                computedTotal,
                payment_method
              ]
            );
          } else {
            throw insertColErr;
          }
        }
        const createdOrder = orderInsertRes.rows[0];
        for (const vi of validatedItems) {
          try {
            await client.query(
              `INSERT INTO order_items 
               (order_id, product_id, product_name, quantity, price, subtotal, item_note)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                createdOrder.id,
                vi.product_id,
                vi.product_name,
                vi.quantity,
                vi.price,
                vi.subtotal,
                vi.item_note
              ]
            );
          } catch (itemColErr) {
            if (itemColErr.message?.includes("item_note") || itemColErr.message?.includes("product_price") || itemColErr.code === "42703" || itemColErr.code === "23502") {
              await client.query(`
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_note TEXT;
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0;
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) DEFAULT 0;
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='product_price') THEN
                    ALTER TABLE order_items ALTER COLUMN product_price DROP NOT NULL;
                    ALTER TABLE order_items ALTER COLUMN product_price SET DEFAULT 0;
                  END IF;
                END $$;
              `);
              await client.query(
                `INSERT INTO order_items 
                 (order_id, product_id, product_name, quantity, price, subtotal, item_note)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  createdOrder.id,
                  vi.product_id,
                  vi.product_name,
                  vi.quantity,
                  vi.price,
                  vi.subtotal,
                  vi.item_note
                ]
              );
            } else {
              throw itemColErr;
            }
          }
        }
        await client.query("COMMIT");
        memoryStore.orders.unshift({
          ...createdOrder,
          items: validatedItems
        });
        saveLocalOrders();
        return res.status(201).json({
          success: true,
          message: "Pesanan Anda berhasil dikirim!",
          data: {
            ...createdOrder,
            items: validatedItems
          }
        });
      } catch (dbErr) {
        await client.query("ROLLBACK");
        console.error("DB transaction error creating order:", dbErr);
        console.warn("\u26A0\uFE0F Mengalihkan penyimpanan pesanan ke cache lokal terisolasi agar transaksi pelanggan tidak gagal.");
      } finally {
        client.release();
      }
    }
    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const dbProd = memoryStore.products.find(
        (p) => p.id === item.product_id && p.business_id === business_id
      );
      if (!dbProd) {
        return res.status(400).json({
          success: false,
          message: `Produk tidak ditemukan pada bisnis ini.`
        });
      }
      if (!dbProd.is_available) {
        return res.status(400).json({
          success: false,
          message: `Produk '${dbProd.name}' sedang tidak tersedia.`
        });
      }
      const actualPrice = dbProd.price;
      const subtotal = actualPrice * qty;
      computedTotal += subtotal;
      validatedItems.push({
        product_id: dbProd.id,
        product_name: dbProd.name,
        quantity: qty,
        price: actualPrice,
        subtotal,
        item_note: item.item_note || ""
      });
    }
    const orderId = `ord-${Date.now()}`;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder = {
      id: orderId,
      order_number: orderNumber,
      business_id,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_note: customer_note || "",
      order_type,
      table_number: table_number || void 0,
      total_amount: computedTotal,
      status: "pending",
      payment_status: "unpaid",
      payment_method,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString(),
      items: validatedItems.map((vi, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        order_id: orderId,
        product_id: vi.product_id,
        product_name: vi.product_name,
        quantity: vi.quantity,
        price: vi.price,
        subtotal: vi.subtotal,
        item_note: vi.item_note,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      }))
    };
    memoryStore.orders.unshift(newOrder);
    saveLocalOrders();
    return res.status(201).json({
      success: true,
      message: "Pesanan Anda berhasil dikirim!",
      data: newOrder
    });
  } catch (error) {
    console.error("Error in POST /api/orders:", error);
    return res.status(500).json({ success: false, message: "Gagal memproses pesanan." });
  }
});
router5.get("/public/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (pool) {
      try {
        const orderRes = await pool.query(
          `SELECT o.*, 
            COALESCE(json_agg(
              json_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'price', oi.price,
                'subtotal', oi.subtotal,
                'item_note', oi.item_note
              )
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.id = $1 OR o.order_number = $1
          GROUP BY o.id`,
          [id]
        );
        if (orderRes.rows.length > 0) {
          return res.json({ success: true, data: orderRes.rows[0] });
        }
      } catch (dbErr) {
        console.warn("DB error in public get order, checking memory store:", dbErr);
      }
    }
    const order = memoryStore.orders.find((o) => o.id === id || o.order_number === id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
    }
    return res.json({ success: true, data: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal mengecek pesanan." });
  }
});
router5.post("/public/orders/:id/confirm-payment", async (req, res) => {
  try {
    const { id } = req.params;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (pool) {
      try {
        await pool.query(
          `UPDATE orders 
           SET updated_at = $1 
           WHERE id = $2 OR order_number = $2`,
          [now, id]
        );
      } catch (dbErr) {
        console.warn("DB error in confirm payment:", dbErr);
      }
    }
    const order = memoryStore.orders.find((o) => o.id === id || o.order_number === id);
    if (order) {
      order.updated_at = now;
      saveLocalOrders();
      return res.json({ success: true, message: "Konfirmasi pembayaran berhasil dicatat!", data: order });
    }
    return res.json({ success: true, message: "Konfirmasi pembayaran berhasil dicatat!" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Gagal konfirmasi pembayaran." });
  }
});
router5.get("/admin/orders", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { status } = req.query;
    if (pool) {
      try {
        let sql = `
          SELECT o.*, 
            COALESCE(json_agg(
              json_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'price', oi.price,
                'subtotal', oi.subtotal,
                'item_note', oi.item_note
              )
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.business_id = $1
        `;
        const params = [businessId];
        if (status) {
          params.push(status);
          sql += ` AND o.status = $${params.length}`;
        }
        sql += " GROUP BY o.id ORDER BY o.created_at DESC";
        const result = await pool.query(sql, params);
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn("DB error fetching orders:", err);
      }
    }
    let ords = memoryStore.orders.filter((o) => o.business_id === businessId);
    if (status) {
      ords = ords.filter((o) => o.status === status);
    }
    return res.json({ success: true, data: ords });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat daftar pesanan." });
  }
});
router5.get("/admin/orders/:id", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    if (pool) {
      try {
        const orderRes = await pool.query(
          "SELECT * FROM orders WHERE id = $1 AND business_id = $2",
          [id, businessId]
        );
        if (orderRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
        }
        const itemsRes = await pool.query(
          "SELECT * FROM order_items WHERE order_id = $1",
          [id]
        );
        return res.json({
          success: true,
          data: {
            ...orderRes.rows[0],
            items: itemsRes.rows
          }
        });
      } catch (err) {
        console.warn("DB error fetching order by id:", err);
      }
    }
    const order = memoryStore.orders.find(
      (o) => o.id === id && o.business_id === businessId
    );
    if (!order) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
    }
    return res.json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat detail pesanan." });
  }
});
router5.put("/admin/orders/:id/status", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    const { status, payment_status } = req.body;
    if (pool) {
      try {
        const updateRes = await pool.query(
          `UPDATE orders
           SET status = COALESCE($1, status),
               payment_status = COALESCE($2, payment_status),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 AND business_id = $4
           RETURNING *`,
          [status || null, payment_status || null, id, businessId]
        );
        if (updateRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
        }
        return res.json({
          success: true,
          message: "Status pesanan berhasil diperbarui.",
          data: updateRes.rows[0]
        });
      } catch (err) {
        console.warn("DB error updating order status:", err);
      }
    }
    const ordIndex = memoryStore.orders.findIndex(
      (o) => o.id === id && o.business_id === businessId
    );
    if (ordIndex === -1) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
    }
    memoryStore.orders[ordIndex] = {
      ...memoryStore.orders[ordIndex],
      status: status || memoryStore.orders[ordIndex].status,
      payment_status: payment_status || memoryStore.orders[ordIndex].payment_status,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveLocalOrders();
    return res.json({
      success: true,
      message: "Status pesanan berhasil diperbarui.",
      data: memoryStore.orders[ordIndex]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memperbarui status pesanan." });
  }
});
router5.delete("/admin/orders/:id", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { id } = req.params;
    if (pool) {
      try {
        await pool.query("DELETE FROM order_items WHERE order_id = $1", [id]);
        const delRes = await pool.query(
          "DELETE FROM orders WHERE id = $1 AND business_id = $2 RETURNING id, order_number",
          [id, businessId]
        );
        if (delRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
        }
        return res.json({
          success: true,
          message: `Pesanan #${delRes.rows[0].order_number} berhasil dihapus.`
        });
      } catch (err) {
        console.warn("DB error deleting order:", err);
      }
    }
    const ordIndex = memoryStore.orders.findIndex(
      (o) => o.id === id && o.business_id === businessId
    );
    if (ordIndex === -1) {
      return res.status(404).json({ success: false, message: "Pesanan tidak ditemukan." });
    }
    const deletedOrder = memoryStore.orders.splice(ordIndex, 1)[0];
    saveLocalOrders();
    return res.json({
      success: true,
      message: `Pesanan #${deletedOrder.order_number} berhasil dihapus.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal menghapus pesanan." });
  }
});
router5.post("/admin/orders/clear", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const { mode } = req.body;
    if (pool) {
      try {
        if (mode === "completed") {
          await pool.query(
            `DELETE FROM order_items WHERE order_id IN (
               SELECT id FROM orders WHERE business_id = $1 AND status IN ('completed', 'cancelled')
             )`,
            [businessId]
          );
          const delRes = await pool.query(
            `DELETE FROM orders WHERE business_id = $1 AND status IN ('completed', 'cancelled')`,
            [businessId]
          );
          return res.json({
            success: true,
            message: `${delRes.rowCount || 0} pesanan riwayat (selesai/batal) berhasil dibersihkan.`
          });
        } else {
          await pool.query(
            `DELETE FROM order_items WHERE order_id IN (
               SELECT id FROM orders WHERE business_id = $1
             )`,
            [businessId]
          );
          const delRes = await pool.query(
            `DELETE FROM orders WHERE business_id = $1`,
            [businessId]
          );
          return res.json({
            success: true,
            message: `Seluruh riwayat pesanan (${delRes.rowCount || 0} pesanan) berhasil direset bersih.`
          });
        }
      } catch (err) {
        console.warn("DB error clearing orders:", err);
      }
    }
    let deletedCount = 0;
    if (mode === "completed") {
      const initialLen = memoryStore.orders.length;
      memoryStore.orders = memoryStore.orders.filter(
        (o) => !(o.business_id === businessId && (o.status === "completed" || o.status === "cancelled"))
      );
      deletedCount = initialLen - memoryStore.orders.length;
      saveLocalOrders();
      return res.json({
        success: true,
        message: `${deletedCount} pesanan selesai/batal berhasil dibersihkan.`
      });
    } else {
      const initialLen = memoryStore.orders.length;
      memoryStore.orders = memoryStore.orders.filter((o) => o.business_id !== businessId);
      deletedCount = initialLen - memoryStore.orders.length;
      saveLocalOrders();
      return res.json({
        success: true,
        message: `Seluruh riwayat pesanan (${deletedCount} pesanan) berhasil direset bersih.`
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal membersihkan riwayat pesanan." });
  }
});
var orderRoutes_default = router5;

// server/routes/settingRoutes.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.get("/business/:businessId/settings", async (req, res) => {
  try {
    const { businessId } = req.params;
    if (pool) {
      try {
        const result = await pool.query(
          "SELECT * FROM settings WHERE business_id = $1 LIMIT 1",
          [businessId]
        );
        if (result.rows.length > 0) {
          return res.json({ success: true, data: result.rows[0] });
        }
      } catch (err) {
        console.warn("DB error fetching settings:", err);
      }
    }
    const setting = memoryStore.settings.find((s) => s.business_id === businessId);
    if (!setting) {
      return res.status(404).json({ success: false, message: "Pengaturan bisnis belum dibuat." });
    }
    return res.json({ success: true, data: setting });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal mengambil pengaturan bisnis." });
  }
});
router6.put("/admin/settings", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    const {
      theme_preset,
      primary_color,
      secondary_color,
      background_color,
      text_color,
      button_style,
      card_style,
      font_family,
      is_ordering_enabled,
      announcement,
      additional_config
    } = req.body;
    if (pool) {
      try {
        const updateRes = await pool.query(
          `INSERT INTO settings (
             business_id, theme_preset, primary_color, secondary_color, 
             background_color, text_color, button_style, card_style, 
             font_family, is_ordering_enabled, announcement, additional_config
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (business_id) DO UPDATE
           SET theme_preset = EXCLUDED.theme_preset,
               primary_color = EXCLUDED.primary_color,
               secondary_color = EXCLUDED.secondary_color,
               background_color = EXCLUDED.background_color,
               text_color = EXCLUDED.text_color,
               button_style = EXCLUDED.button_style,
               card_style = EXCLUDED.card_style,
               font_family = EXCLUDED.font_family,
               is_ordering_enabled = EXCLUDED.is_ordering_enabled,
               announcement = EXCLUDED.announcement,
               additional_config = EXCLUDED.additional_config,
               updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            businessId,
            theme_preset || "amber_warm",
            primary_color || "#78350f",
            secondary_color || "#d97706",
            background_color || "#fffbeb",
            text_color || "#1f2937",
            button_style || "rounded",
            card_style || "shadow",
            font_family || "Inter",
            is_ordering_enabled !== void 0 ? Boolean(is_ordering_enabled) : true,
            announcement || "",
            typeof additional_config === "object" ? JSON.stringify(additional_config) : "{}"
          ]
        );
        return res.json({
          success: true,
          message: "Pengaturan tema & tampilan berhasil disimpan.",
          data: updateRes.rows[0]
        });
      } catch (err) {
        console.warn("DB error updating settings:", err);
      }
    }
    const sIndex = memoryStore.settings.findIndex((s) => s.business_id === businessId);
    if (sIndex === -1) {
      const newSetting = {
        id: `set-${Date.now()}`,
        business_id: businessId,
        theme_preset: theme_preset || "amber_warm",
        primary_color: primary_color || "#78350f",
        secondary_color: secondary_color || "#d97706",
        background_color: background_color || "#fffbeb",
        text_color: text_color || "#1f2937",
        button_style: button_style || "rounded",
        card_style: card_style || "shadow",
        font_family: font_family || "Inter",
        is_ordering_enabled: is_ordering_enabled !== void 0 ? Boolean(is_ordering_enabled) : true,
        announcement: announcement || "",
        additional_config: additional_config || {},
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      memoryStore.settings.push(newSetting);
      saveLocalStore();
      return res.json({ success: true, message: "Pengaturan tema berhasil disimpan.", data: newSetting });
    }
    memoryStore.settings[sIndex] = {
      ...memoryStore.settings[sIndex],
      theme_preset: theme_preset ?? memoryStore.settings[sIndex].theme_preset,
      primary_color: primary_color ?? memoryStore.settings[sIndex].primary_color,
      secondary_color: secondary_color ?? memoryStore.settings[sIndex].secondary_color,
      background_color: background_color ?? memoryStore.settings[sIndex].background_color,
      text_color: text_color ?? memoryStore.settings[sIndex].text_color,
      button_style: button_style ?? memoryStore.settings[sIndex].button_style,
      card_style: card_style ?? memoryStore.settings[sIndex].card_style,
      font_family: font_family ?? memoryStore.settings[sIndex].font_family,
      is_ordering_enabled: is_ordering_enabled !== void 0 ? Boolean(is_ordering_enabled) : memoryStore.settings[sIndex].is_ordering_enabled,
      announcement: announcement !== void 0 ? announcement : memoryStore.settings[sIndex].announcement,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveLocalStore();
    return res.json({
      success: true,
      message: "Pengaturan tema & tampilan berhasil disimpan.",
      data: memoryStore.settings[sIndex]
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memperbarui pengaturan." });
  }
});
var settingRoutes_default = router6;

// server/routes/uploadRoutes.ts
import { Router as Router7 } from "express";

// server/middleware/upload.ts
import multer from "multer";
var storage = multer.memoryStorage();
var uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
    // Maksimal 5 MB sesuai instruksi
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Format file tidak didukung. Harap gunakan format JPEG, PNG, atau WebP."));
    }
  }
});

// server/services/supabaseStorage.ts
import { createClient } from "@supabase/supabase-js";
import dotenv2 from "dotenv";
dotenv2.config();
var SUPABASE_URL = process.env.SUPABASE_URL || "";
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
var BUCKET_NAME = "business-assets";
var supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
}) : null;
async function uploadToSupabaseStorage(folder, businessId, file) {
  const fileExt = file.originalname.split(".").pop()?.toLowerCase() || "jpg";
  const cleanFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const filePath = `${folder}/${businessId}/${cleanFileName}`;
  if (supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });
      if (error) {
        console.error("Supabase Storage upload error:", error.message);
        return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      }
      const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(data.path);
      return publicUrlData.publicUrl;
    } catch (err) {
      console.error("Error uploading to Supabase Storage:", err);
      return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    }
  }
  return `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
}

// server/routes/uploadRoutes.ts
var router7 = Router7();
router7.post(
  "/admin/upload/product",
  authenticateToken,
  uploadMiddleware.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "File gambar wajib dipilih (format JPEG, PNG, WebP, max 5MB)."
        });
      }
      const businessId = req.user.businessId;
      const imageUrl = await uploadToSupabaseStorage("products", businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      });
      return res.json({
        success: true,
        message: "Foto produk berhasil diunggah ke Supabase Storage.",
        data: {
          url: imageUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error) {
      console.error("Error in upload product:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Gagal mengunggah foto produk."
      });
    }
  }
);
router7.post(
  "/admin/upload/logo",
  authenticateToken,
  uploadMiddleware.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "File gambar logo wajib dipilih (format JPEG, PNG, WebP, max 5MB)."
        });
      }
      const businessId = req.user.businessId;
      const logoUrl = await uploadToSupabaseStorage("logos", businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      });
      return res.json({
        success: true,
        message: "Logo bisnis berhasil diunggah ke Supabase Storage.",
        data: {
          url: logoUrl,
          filename: req.file.originalname,
          size: req.file.size
        }
      });
    } catch (error) {
      console.error("Error in upload logo:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Gagal mengunggah logo bisnis."
      });
    }
  }
);
router7.post(
  "/admin/upload/category",
  authenticateToken,
  uploadMiddleware.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "File gambar kategori wajib dipilih (format JPEG, PNG, WebP, max 5MB)."
        });
      }
      const businessId = req.user.businessId;
      const categoryImageUrl = await uploadToSupabaseStorage("categories", businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      });
      return res.json({
        success: true,
        message: "Foto kategori berhasil diunggah ke Supabase Storage.",
        data: {
          url: categoryImageUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error) {
      console.error("Error in upload category:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Gagal mengunggah foto kategori."
      });
    }
  }
);
router7.post(
  "/admin/upload/qris",
  authenticateToken,
  uploadMiddleware.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "File gambar QRIS wajib dipilih (format JPEG, PNG, WebP, max 5MB)."
        });
      }
      const businessId = req.user.businessId;
      const qrisImageUrl = await uploadToSupabaseStorage("qris", businessId, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype
      });
      return res.json({
        success: true,
        message: "Foto QRIS toko berhasil diunggah.",
        data: {
          url: qrisImageUrl,
          filename: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        }
      });
    } catch (error) {
      console.error("Error in upload QRIS:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Gagal mengunggah gambar QRIS."
      });
    }
  }
);
var uploadRoutes_default = router7;

// server/routes/dashboardRoutes.ts
import { Router as Router8 } from "express";
var router8 = Router8();
router8.get("/admin/dashboard", authenticateToken, async (req, res) => {
  try {
    const businessId = req.user.businessId;
    if (pool) {
      try {
        const prodCountRes = await pool.query(
          "SELECT COUNT(*) as count FROM products WHERE business_id = $1",
          [businessId]
        );
        const catCountRes = await pool.query(
          "SELECT COUNT(*) as count FROM categories WHERE business_id = $1",
          [businessId]
        );
        const orderStatsRes = await pool.query(
          `SELECT 
             COUNT(*) as total_orders,
             COALESCE(SUM(CASE WHEN payment_status = 'paid' OR status = 'completed' THEN total_amount ELSE 0 END), 0) as total_revenue,
             COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
             COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_orders,
             COALESCE(SUM(CASE WHEN (payment_status = 'paid' OR status = 'completed') AND DATE(created_at) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) as today_revenue
           FROM orders WHERE business_id = $1`,
          [businessId]
        );
        const recentOrdersRes = await pool.query(
          `SELECT id, order_number, customer_name, customer_phone, customer_note, order_type, table_number, payment_method, total_amount, status, payment_status, created_at
           FROM orders WHERE business_id = $1
           ORDER BY created_at DESC LIMIT 5`,
          [businessId]
        );
        return res.json({
          success: true,
          data: {
            total_products: parseInt(prodCountRes.rows[0]?.count || "0", 10),
            total_categories: parseInt(catCountRes.rows[0]?.count || "0", 10),
            total_orders: parseInt(orderStatsRes.rows[0]?.total_orders || "0", 10),
            pending_orders: parseInt(orderStatsRes.rows[0]?.pending_orders || "0", 10),
            total_revenue: parseFloat(orderStatsRes.rows[0]?.total_revenue || "0"),
            today_orders: parseInt(orderStatsRes.rows[0]?.today_orders || "0", 10),
            today_revenue: parseFloat(orderStatsRes.rows[0]?.today_revenue || "0"),
            recent_orders: recentOrdersRes.rows
          }
        });
      } catch (err) {
        console.warn("DB error fetching dashboard stats:", err);
      }
    }
    const prods = memoryStore.products.filter((p) => p.business_id === businessId);
    const cats = memoryStore.categories.filter((c) => c.business_id === businessId);
    const ords = memoryStore.orders.filter((o) => o.business_id === businessId);
    const todayStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const todayOrdersList = ords.filter(
      (o) => o.created_at && o.created_at.slice(0, 10) === todayStr
    );
    const todayRevenue = todayOrdersList.filter((o) => o.payment_status === "paid" || o.status === "completed").reduce((sum, o) => sum + o.total_amount, 0);
    const totalRevenue = ords.filter((o) => o.payment_status === "paid" || o.status === "completed").reduce((sum, o) => sum + o.total_amount, 0);
    const pendingCount = ords.filter((o) => o.status === "pending").length;
    const recentOrders = [...ords].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    return res.json({
      success: true,
      data: {
        total_products: prods.length,
        total_categories: cats.length,
        total_orders: ords.length,
        pending_orders: pendingCount,
        total_revenue: totalRevenue,
        today_orders: todayOrdersList.length,
        today_revenue: todayRevenue,
        recent_orders: recentOrders
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Gagal memuat statistik dashboard." });
  }
});
var dashboardRoutes_default = router8;

// server/api.ts
dotenv3.config();
var app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, res, next) => {
  if (req.query && req.query.path) {
    const p = String(req.query.path);
    req.url = p.startsWith("/") ? `/api${p}` : `/api/${p}`;
  } else if (req.headers["x-matched-path"]) {
    const matched = String(req.headers["x-matched-path"]);
    if (matched.startsWith("/api")) {
      req.url = matched;
    }
  }
  next();
});
var isDbInitialized = false;
app.use(async (req, res, next) => {
  if (!isDbInitialized) {
    try {
      await Promise.race([
        initDatabase(),
        new Promise((resolve) => setTimeout(resolve, 3e3))
      ]);
      await ensureInitialAdminUser(false).catch(() => {
      });
    } catch (e) {
      console.warn("Database init notice:", e);
    } finally {
      isDbInitialized = true;
    }
  }
  next();
});
app.get(["/api/health", "/health"], (_req, res) => {
  res.json({ status: "ok", service: "UMKM Platform API", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get(["/api", "/api/", "/"], (_req, res) => {
  res.json({
    status: "ok",
    service: "UMKM Digital Platform Backend API",
    message: "Backend API is running and ready to handle requests.",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.use("/api/auth", authRoutes_default);
app.use("/auth", authRoutes_default);
app.use("/api", businessRoutes_default);
app.use("/", businessRoutes_default);
app.use("/api", categoryRoutes_default);
app.use("/", categoryRoutes_default);
app.use("/api", productRoutes_default);
app.use("/", productRoutes_default);
app.use("/api", orderRoutes_default);
app.use("/", orderRoutes_default);
app.use("/api", settingRoutes_default);
app.use("/", settingRoutes_default);
app.use("/api", uploadRoutes_default);
app.use("/", uploadRoutes_default);
app.use("/api", dashboardRoutes_default);
app.use("/", dashboardRoutes_default);
app.use((err, req, res, next) => {
  console.error("API Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Terjadi kesalahan pada server."
  });
});
var api_default = app;
export {
  api_default as default
};
