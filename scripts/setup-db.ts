import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function runSetup() {
  console.log('\n======================================================');
  console.log('🛠️  UMKM DIGITAL PLATFORM - DATABASE SETUP WIZARD');
  console.log('======================================================\n');

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ Error: Variabel DATABASE_URL tidak ditemukan di file .env');
    console.log('\n💡 Cara membuat file .env:');
    console.log('1. Salin file .env.example menjadi .env');
    console.log('2. Buka file .env dan isi DATABASE_URL dengan connection string Supabase kamu.');
    process.exit(1);
  }

  if (connectionString.includes('your-db-password')) {
    console.error('❌ Error: DATABASE_URL masih menggunakan placeholder "your-db-password"!');
    console.log('\n💡 Buka file .env dan ganti "your-db-password" dengan password asli database Supabase kamu.');
    process.exit(1);
  }

  console.log('📡 Mencoba menyambungkan ke PostgreSQL Supabase...');

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Berhasil terhubung ke server database!\n');

    // 1. Eksekusi Schema
    console.log('📦 1/2 Membuat skema tabel (schema.sql)...');
    const schemaCandidates = [
      path.resolve(process.cwd(), 'database', 'schema.sql'),
      path.resolve(process.cwd(), 'schema.sql'),
    ];
    const schemaPath = schemaCandidates.find((f) => fs.existsSync(f));

    if (!schemaPath) {
      throw new Error('File database/schema.sql tidak ditemukan!');
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);
    console.log('   ✅ Skema tabel berhasil dipasang (businesses, users, products, orders, dll)!\n');

    // 2. Eksekusi Seeds
    console.log('🌱 2/2 Memasukkan data awal demo Warkop Nusantara (seeds.sql)...');
    const seedsCandidates = [
      path.resolve(process.cwd(), 'database', 'seeds.sql'),
      path.resolve(process.cwd(), 'seeds.sql'),
    ];
    const seedsPath = seedsCandidates.find((f) => fs.existsSync(f));

    if (!seedsPath) {
      throw new Error('File database/seeds.sql tidak ditemukan!');
    }

    const seedsSql = fs.readFileSync(seedsPath, 'utf8');
    await client.query(seedsSql);
    console.log('   ✅ Data demo produk & akun berhasil dimasukkan!\n');

    client.release();
    await pool.end();

    console.log('======================================================');
    console.log('🎉 SETUP DATABASE SUKSES 100%!');
    console.log('======================================================');
    console.log('Sekarang kamu bisa jalankan web dengan perintah:');
    console.log('   npm run dev\n');
    console.log('Kredensial Login Admin:');
    console.log('   Email   : owner.warkop@example.com');
    console.log('   Password: Rahasia123!\n');
    console.log('Katalog Customer:');
    console.log('   http://localhost:3000/warkop-nusantara\n');
  } catch (err: any) {
    console.error('\n❌ KONEKSI DATABASE GAGAL:', err.message);
    console.log('\n💡 TIPS MENGATASI:');
    console.log('1. Pastikan password di DATABASE_URL adalah password database Supabase yang kamu masukkan saat buat project.');
    console.log('2. Jika password kamu mengandung simbol (@, #, $, %, dll), harus di-encode URL:');
    console.log('   Contoh: jika password "kopi@123", tulis "kopi%40123"');
    console.log('3. Jika error ETIMEDOUT / ENOTFOUND (karena provider internet tidak support IPv6):');
    console.log('   Buka Supabase -> Project Settings -> Database -> Connection string -> URI.');
    console.log('   Pilih mode "Transaction" atau "Session" (host: aws-0-[region].pooler.supabase.com port 6543/5432).');
    console.log('======================================================\n');
    process.exit(1);
  }
}

runSetup();
