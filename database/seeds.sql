-- 1. BERSIHKAN DATA LAMA AGAR TIDAK BERCAMPUR
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM settings;
DELETE FROM users WHERE business_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' OR business_id = 'b1010101-9c0b-4ef8-bb6d-6bb9bd380001';
DELETE FROM businesses WHERE slug = 'warkop-nusantara' OR id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- 2. INSERT BUSINESS (KAVARNA COFFEE BAR & KITCHEN)
INSERT INTO businesses (id, name, slug, description, phone, whatsapp, address, google_maps_url, logo_url)
VALUES
(
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Kavarna Coffee Bar & Kitchen',
    'kavarna-coffee',
    'Specialty coffee bar, signature mocktails, and kitchen comfort food. Suasana nyaman 2 lantai untuk nongkrong, kerja, dan santai.',
    '081226002000',
    '6281226002000',
    'Jl. Veteran No. 51, Jetis, Kec. Sukoharjo, Kabupaten Sukoharjo, Jawa Tengah 57511',
    'https://maps.google.com/?q=Kavarna+Coffee+Bar+Kitchen+Sukoharjo',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=400&q=80'
)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    address = EXCLUDED.address;

-- 3. INSERT USERS (ADMIN & OWNER KAVARNA)
INSERT INTO users (id, business_id, full_name, email, password_hash, role, phone)
VALUES
(
    'd1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Fajar (Owner Kavarna)',
    'owner.warkop@example.com',
    '$2b$10$s47964VDTB.ecr/5vBO31eKr8CSv3UEVoeQuj1fdvrtZewOCzK666',
    'owner',
    '081226002000'
)
ON CONFLICT (id) DO UPDATE SET business_id = EXCLUDED.business_id;

-- 4. INSERT SETTINGS (TEMA GELAP MIDNIGHT NEON)
INSERT INTO settings (
    id, business_id, theme_preset, primary_color, secondary_color, background_color, text_color, 
    button_style, card_style, font_family, announcement
)
VALUES
(
    'e1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'midnight_neon',
    '#d97706',      -- amber gold
    '#b45309',      -- dark amber
    '#0d0d0f',      -- midnight dark
    '#f4f4f5',      -- zinc-100 clean text
    'rounded',
    'shadow',
    'Plus Jakarta Sans',
    '✨ Selamat Datang di Kavarna Coffee! Pesan dari meja Anda tanpa perlu antre ke kasir.'
)
ON CONFLICT (business_id) DO UPDATE SET 
    theme_preset = EXCLUDED.theme_preset,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    background_color = EXCLUDED.background_color,
    text_color = EXCLUDED.text_color,
    announcement = EXCLUDED.announcement;

-- 5. INSERT 6 KATEGORI MENU KAVARNA
INSERT INTO categories (id, business_id, name, slug, description, display_order)
VALUES
(
    'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Signature Coffee',
    'signature-coffee',
    'Kopi racikan khas Kavarna dengan resep otentik & bahan premium.',
    1
),
(
    'c1000002-9c0b-4ef8-bb6d-6bb9bd380002',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Signature Mocktails & Refreshers',
    'signature-mocktails',
    'Sensasi kesegaran buah asli, sparkling soda, dan aroma rempah eksotis.',
    2
),
(
    'c1000003-9c0b-4ef8-bb6d-6bb9bd380003',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Classic Espresso',
    'classic-espresso',
    'Seduhan espresso murni, americano, latte, dan cappuccino dari biji kopi pilihan.',
    3
),
(
    'c1000004-9c0b-4ef8-bb6d-6bb9bd380004',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Sweet Series & Artisan Tea',
    'sweet-series-artisan-tea',
    'Pilihan non-kopi creamy matcha, red velvet, cokelat murni & artisan tea.',
    4
),
(
    'c1000005-9c0b-4ef8-bb6d-6bb9bd380005',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Kitchen & Main Courses',
    'kitchen-main-courses',
    'Butter rice katsu, pasta italia, sapo tahu, dan nasi goreng racikan koki Kavarna.',
    5
),
(
    'c1000006-9c0b-4ef8-bb6d-6bb9bd380006',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'Bites & Sharing Platters',
    'bites-sharing-platters',
    'Platter komplit, cheesy nachos, fries, bruschetta & camilan nongkrong.',
    6
)
ON CONFLICT (id) DO NOTHING;

-- 6. INSERT PRODUK MENU KAVARNA
INSERT INTO products (
    id, business_id, category_id, name, slug, description, price, stock, image_url, is_available, display_order
)
VALUES
(
    'f1000001-9c0b-4ef8-bb6d-6bb9bd380001',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
    'Kopi Susu Veteran',
    'kopi-susu-veteran',
    'Signature terlaris Kavarna! Fresh milk, espresso blend, aren organik, cream lembut & evaporasi gurih.',
    30000.00,
    100,
    'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
    true,
    1
),
(
    'f1000002-9c0b-4ef8-bb6d-6bb9bd380002',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
    'Butterscotch Sea Salt Latte',
    'butterscotch-sea-salt-latte',
    'Espresso pekat berpadu sirup butterscotch wangi dan lapisan sea salt cold foam creamy gurih seimbang.',
    36000.00,
    80,
    'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=600&q=80',
    true,
    2
),
(
    'f1000003-9c0b-4ef8-bb6d-6bb9bd380003',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'c1000001-9c0b-4ef8-bb6d-6bb9bd380001',
    'Nutella Latte',
    'nutella-latte',
    'Nutella hazelnut cocoa murni, espresso shot Kavarna, fresh milk, dan whipped cream lembut.',
    31000.00,
    60,
    'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',
    true,
    3
),
(
    'f1000004-9c0b-4ef8-bb6d-6bb9bd380004',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'c1000002-9c0b-4ef8-bb6d-6bb9bd380002',
    'Lucky Berrys Mocktail',
    'lucky-berrys',
    'Mocktail signature Kavarna berisikan buah stroberi segar, blueberry reduction, sparkling soda, dan mint.',
    35000.00,
    75,
    'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=600&q=80',
    true,
    4
),
(
    'f1000005-9c0b-4ef8-bb6d-6bb9bd380005',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'c1000005-9c0b-4ef8-bb6d-6bb9bd380005',
    'Butter Rice Chicken Katsu',
    'butter-rice-chicken-katsu',
    'Nasi butter wangi mentega gurih disajikan dengan fillet dada ayam katsu renyah keemasan & saus kavarna.',
    36000.00,
    50,
    'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80',
    true,
    5
),
(
    'f1000006-9c0b-4ef8-bb6d-6bb9bd380006',
    'b1010101-9c0b-4ef8-bb6d-6bb9bd380001',
    'c1000006-9c0b-4ef8-bb6d-6bb9bd380006',
    'Kavarna Platter (Porsi Sharing)',
    'kavarna-platter',
    'Menu sharing terlengkap! French fries, chicken strips, cheesy nachos, sosis bakar, dan crispy enoki.',
    46000.00,
    60,
    'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=600&q=80',
    true,
    6
)
ON CONFLICT (id) DO NOTHING;