-- ====================================================================
-- UMKM DIGITAL PLATFORM - SEED DEMO DATA (WARKOP NUSANTARA)
-- Data awal untuk toko tunggal (Jual Putus / 1 Toko Mandiri)
-- ====================================================================

-- 1. DATA AWAL AMAN (Non-destruktif, tidak menghapus data yang sudah ada)
-- Menggunakan ON CONFLICT DO NOTHING agar akun/password/pesanan yang sudah diubah tidak tertimpa

-- 2. INSERT BUSINESSES
-- Definisikan UUID tetap agar referensi foreign key mudah diuji
INSERT INTO businesses (id, name, slug, description, phone, whatsapp, address, google_maps_url, logo_url)
VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Warkop Nusantara',
    'warkop-nusantara',
    'Tempat nongkrong santai dengan racikan kopi susu otentik dan camilan warkop nusantara.',
    '081234567890',
    '6281234567890',
    'Jl. Anggrek No. 12, Kebayoran Baru, Jakarta Selatan',
    'https://maps.google.com/?q=-6.2088,106.8456',
    'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=300&q=80'
)
ON CONFLICT (id) DO NOTHING;

-- 3. INSERT USERS (ADMIN & OWNER)
-- Catatan: password_hash adalah contoh bcrypt hash untuk string "Rahasia123!"
INSERT INTO users (id, business_id, full_name, email, password_hash, role, phone)
VALUES
(
    'u1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Budi Santoso',
    'owner.warkop@example.com',
    '$2b$10$s47964VDTB.ecr/5vBO31eKr8CSv3UEVoeQuj1fdvrtZewOCzK666',
    'owner',
    '081234567890'
)
ON CONFLICT (id) DO NOTHING;

-- 4. INSERT SETTINGS (PENGATURAN TEMA DINAMIS)
-- Warkop Nusantara memakai tema warm coffee
INSERT INTO settings (
    business_id, theme_preset, primary_color, secondary_color, background_color, text_color, 
    button_style, card_style, font_family, announcement
)
VALUES
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'amber_warm',
    '#78350f',      -- amber-900 (nuansa kopi)
    '#d97706',      -- amber-600
    '#fffbeb',      -- amber-50 (latar hangat)
    '#1f2937',      -- gray-800
    'rounded',
    'shadow',
    'Inter',
    '☕ Nikmati diskon 15% untuk paket Kopi Susu + Camilan Warkop!'
)
ON CONFLICT (business_id) DO NOTHING;

-- 5. INSERT CATEGORIES
-- Kategori Warkop Nusantara
INSERT INTO categories (id, business_id, name, slug, description, display_order)
VALUES
(
    'c1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Kopi & Signature Drink',
    'kopi-signature-drink',
    'Seduhan robusta tubruk, espresso susu aren, dan racikan kopi khas warkop.',
    1
),
(
    'c1111112-9c0b-4ef8-bb6d-6bb9bd380112',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Minuman Segar Non-Kopi',
    'minuman-segar-non-kopi',
    'Pelepas dahaga: teh melati jumbo, es jeruk peras murni, dan es cokelat.',
    2
)
ON CONFLICT (id) DO NOTHING;

-- 6. INSERT PRODUCTS
-- Produk Warkop Nusantara
INSERT INTO products (
    id, business_id, category_id, name, slug, description, price, stock, image_url, is_available
)
VALUES
(
    'p1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'Kopi Susu Gula Aren',
    'kopi-susu-gula-aren',
    'Espresso robusta lokal dipadu susu creamy dan gula aren murni khas nusantara.',
    18000.00,
    100,
    'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
    true
),
(
    'p1111112-9c0b-4ef8-bb6d-6bb9bd380112',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c1111112-9c0b-4ef8-bb6d-6bb9bd380112',
    'Es Teh Manis Jumbo',
    'es-teh-manis-jumbo',
    'Seduhan teh melati wangi khas warkop dengan es batu melimpah.',
    6000.00,
    250,
    'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=600&q=80',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 7. INSERT SAMPLE ORDERS & ORDER_ITEMS
INSERT INTO orders (
    id, order_number, business_id, customer_name, customer_phone, customer_note, 
    order_type, table_number, total_amount, status, payment_status, payment_method
)
VALUES
(
    'o1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'ORD-WARKOP-20261005-001',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Dimas Aditya',
    '081211112222',
    'Kopinya less sugar ya mas',
    'dine_in',
    'Meja 04',
    42000.00,
    'processing',
    'paid',
    'qris'
)
ON CONFLICT (id) DO NOTHING;

-- Item Pesanan
INSERT INTO order_items (id, order_id, product_id, product_name, quantity, price, subtotal, item_note)
VALUES
(
    'i1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'o1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'p1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'Kopi Susu Gula Aren',
    2,
    18000.00,
    36000.00,
    'Less sugar 50%'
),
(
    'i1111112-9c0b-4ef8-bb6d-6bb9bd380112',
    'o1111111-9c0b-4ef8-bb6d-6bb9bd380111',
    'p1111112-9c0b-4ef8-bb6d-6bb9bd380112',
    'Es Teh Manis Jumbo',
    1,
    6000.00,
    6000.00,
    'Es dipisah'
)
ON CONFLICT (id) DO NOTHING;

