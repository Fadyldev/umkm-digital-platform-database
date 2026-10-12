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
  opening_hours: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  business_id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'superadmin';
  phone?: string;
  is_active: boolean;
}

export interface PaymentConfig {
  qris_enabled?: boolean;
  qris_merchant_name?: string;
  qris_nmid?: string;
  qris_image_url?: string;
  bank_transfer_enabled?: boolean;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  ewallet_enabled?: boolean;
  ewallet_name?: string;
  ewallet_number?: string;
  ewallet_holder?: string;
  cash_enabled?: boolean;
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
  additional_config?: {
    payment_config?: PaymentConfig;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
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
  id?: string;
  order_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  item_note?: string;
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

export interface CartItem {
  product: Product;
  quantity: number;
  note: string;
}

export interface DashboardStats {
  total_products: number;
  total_categories: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  today_orders?: number;
  today_revenue?: number;
  recent_orders: Order[];
}
