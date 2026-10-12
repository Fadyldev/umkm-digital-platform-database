-- ====================================================================
-- UMKM DIGITAL PLATFORM - POSTGRESQL DATABASE SCHEMA
-- Multi-Tenant Architecture for Warkop, Cafe, Warung Makan, & Toko UMKM
-- ====================================================================

-- 1. EXTENSIONS
-- pgcrypto menyediakan gen_random_uuid() untuk UUID v4
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TRIGGER FUNCTION FOR updated_at
CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 3. TABLE DEFINITIONS
-- ====================================================================

-- --------------------------------------------------------------------
-- TABLE: businesses
-- Menyimpan identitas toko/bisnis (Tenant Level).
-- Setiap data produk, kategori, dan pesanan akan mengacu ke business_id.
-- --------------------------------------------------------------------
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
    opening_hours JSONB DEFAULT '{"monday":{"open":"08:00","close":"22:00","is_closed":false},"tuesday":{"open":"08:00","close":"22:00","is_closed":false},"wednesday":{"open":"08:00","close":"22:00","is_closed":false},"thursday":{"open":"08:00","close":"22:00","is_closed":false},"friday":{"open":"08:00","close":"22:00","is_closed":false},"saturday":{"open":"08:00","close":"23:00","is_closed":false},"sunday":{"open":"08:00","close":"23:00","is_closed":false}}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_business_slug_format CHECK (slug ~* '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

-- --------------------------------------------------------------------
-- TABLE: users
-- Pengguna admin atau pemilik bisnis.
-- Password disimpan dalam bentuk hash (bcrypt/argon2), BUKAN plaintext.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'staff', 'superadmin')),
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- TABLE: settings
-- Pengaturan dinamis dan tema tampilan katalog bisnis (1-to-1 dengan businesses).
-- Menghilangkan hardcoded theme pada aplikasi front-end.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
    theme_preset VARCHAR(50) NOT NULL DEFAULT 'coffee_warm',
    primary_color VARCHAR(20) NOT NULL DEFAULT '#78350f',
    secondary_color VARCHAR(20) NOT NULL DEFAULT '#b45309',
    background_color VARCHAR(20) NOT NULL DEFAULT '#fffbeb',
    text_color VARCHAR(20) NOT NULL DEFAULT '#1f2937',
    button_style VARCHAR(20) NOT NULL DEFAULT 'rounded' CHECK (button_style IN ('square', 'rounded', 'pill')),
    card_style VARCHAR(20) NOT NULL DEFAULT 'shadow' CHECK (card_style IN ('flat', 'bordered', 'shadow', 'elevated')),
    font_family VARCHAR(50) NOT NULL DEFAULT 'Inter',
    is_ordering_enabled BOOLEAN NOT NULL DEFAULT true,
    announcement TEXT,
    currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rp',
    custom_css TEXT,
    additional_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- TABLE: categories
-- Kategori produk yang dikelompokkan per bisnis (Multi-Tenant).
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Slug kategori unik untuk tiap bisnis (Bisnis A dan B boleh punya slug 'makanan', tapi Bisnis A tidak boleh punya 2 slug 'makanan')
    CONSTRAINT uq_categories_business_slug UNIQUE (business_id, slug)
);

-- --------------------------------------------------------------------
-- TABLE: products
-- Produk yang dijual oleh tiap bisnis.
-- Foto disimpan di Supabase Storage, field hanya menyimpan path/URL.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Slug produk unik per bisnis
    CONSTRAINT uq_products_business_slug UNIQUE (business_id, slug)
);

-- --------------------------------------------------------------------
-- TABLE: orders
-- Pesanan yang masuk dari customer ke bisnis tertentu.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_note TEXT,
    order_type VARCHAR(20) NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'take_away', 'delivery')),
    table_number VARCHAR(20),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'qris', 'transfer', 'ewallet')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- --------------------------------------------------------------------
-- TABLE: order_items
-- Detail produk dalam sebuah pesanan.
-- Menyimpan snapshot 'price' dan 'subtotal' agar data historis akuntansi tidak berubah
-- jika suatu hari harga produk di katalog dinaikkan atau diturunkan.
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(150) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    item_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 4. PERFORMANCE & TENANT ISOLATION INDEXES
-- Index ini krusial untuk mencegah kebocoran data antar tenant (business_id)
-- dan mempercepat query katalog maupun dashboard admin.
-- ====================================================================

-- Index Bisnis
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_is_active ON businesses(is_active);

-- Index Users
CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Index Categories
CREATE INDEX IF NOT EXISTS idx_categories_business_id ON categories(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_business_active ON categories(business_id, is_active);

-- Index Products (Tenant Isolation + Search + Filter Kategori)
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_business_category ON products(business_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_business_available ON products(business_id, is_available);
CREATE INDEX IF NOT EXISTS idx_products_business_created ON products(business_id, created_at DESC);

-- Index Orders (Filter Dashboard per bisnis dan status)
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id);
CREATE INDEX IF NOT EXISTS idx_orders_business_status ON orders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_business_created ON orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- Index Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- ====================================================================
-- 5. AUTOMATIC updated_at TRIGGERS
-- ====================================================================
DROP TRIGGER IF EXISTS trg_businesses_updated_at ON businesses;
CREATE TRIGGER trg_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
