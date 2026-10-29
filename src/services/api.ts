import { Business, Category, Product, Order, Setting, User, DashboardStats } from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('umkm_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function safeJson(res: Response, fallbackMsg: string): Promise<any> {
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error('Server backend sedang memuat atau belum terhubung ke database. Cek DATABASE_URL di Environment Variables Vercel.');
    }
    throw new Error(fallbackMsg);
  }
  if (!res.ok) {
    throw new Error(data?.message || fallbackMsg);
  }
  return data;
}

/**
 * Kompresi gambar otomatis di sisi browser (Client-Side Canvas Compression)
 */
async function compressImageFile(file: File, maxWidth = 1000, quality = 0.8): Promise<File> {
  if (!file || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const compressedFile = new File([blob], cleanName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile.size < file.size ? compressedFile : file);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

export const api = {
  // -------------------------------------------------------------
  // PUBLIC ENDPOINTS
  // -------------------------------------------------------------
  async getBusinesses(): Promise<Business[]> {
    const res = await fetch(`${API_BASE}/businesses`);
    const json = await safeJson(res, 'Gagal mengambil daftar bisnis');
    return json.data || [];
  },

  async getPublicBusiness(slug: string): Promise<{
    business: Business;
    settings: Setting | null;
    categories: Category[];
    products: Product[];
  }> {
    const res = await fetch(`${API_BASE}/business/${slug}`);
    const json = await safeJson(res, 'Bisnis tidak ditemukan atau menu belum aktif');
    return json.data;
  },

  async createOrder(orderPayload: {
    business_id: string;
    customer_name: string;
    customer_phone: string;
    customer_note?: string;
    order_type: 'dine_in' | 'take_away' | 'delivery';
    table_number?: string;
    payment_method: string;
    items: Array<{
      product_id: string;
      quantity: number;
      item_note?: string;
    }>;
  }): Promise<Order> {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    const json = await safeJson(res, 'Gagal memproses pesanan');
    return json.data;
  },

  // -------------------------------------------------------------
  // AUTH ENDPOINTS
  // -------------------------------------------------------------
  async login(email: string, password: string): Promise<{ token: string; user: User; business: Business }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await safeJson(res, 'Gagal login. Periksa email dan password.');

    localStorage.setItem('umkm_auth_token', json.data.token);
    return json.data;
  },

  async getMe(): Promise<{ user: User; business: Business }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    const json = await safeJson(res, 'Sesi tidak valid');
    return json.data;
  },

  logout() {
    localStorage.removeItem('umkm_auth_token');
  },

  async resetInitialAccount(): Promise<{ email: string; defaultPassword: string }> {
    const res = await fetch(`${API_BASE}/auth/setup-initial-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: true }),
    });
    const json = await safeJson(res, 'Gagal mereset akun awal');
    return json.data;
  },

  async updateProfile(payload: {
    full_name: string;
    email: string;
    phone?: string;
  }): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res, 'Gagal memperbarui profil pemilik');
    return json.data;
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    });
    const json = await safeJson(res, 'Gagal mengubah password');
    return {
      success: json?.success ?? true,
      message: json?.message || json?.data?.message || 'Password berhasil diperbarui.',
    };
  },

  async setupInitialAccount(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/setup-initial-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await safeJson(res, 'Gagal menyiapkan akun awal');
    return json;
  },

  // -------------------------------------------------------------
  // ADMIN DASHBOARD & BUSINESS
  // -------------------------------------------------------------
  async getDashboard(): Promise<DashboardStats> {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { ...getAuthHeader() },
    });
    const json = await safeJson(res, 'Gagal memuat dashboard');
    return json.data;
  },

  async updateBusiness(data: Partial<Business>): Promise<Business> {
    const res = await fetch(`${API_BASE}/admin/business`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res, 'Gagal memperbarui bisnis');
    return json.data;
  },

  // -------------------------------------------------------------
  // CATEGORIES & PRODUCTS FETCH
  // -------------------------------------------------------------
  async getCategories(businessId: string): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/business/${businessId}/categories`);
    const json = await safeJson(res, 'Gagal memuat kategori');
    return json.data;
  },

  async getProducts(businessId: string): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/business/${businessId}/products`);
    const json = await safeJson(res, 'Gagal memuat produk');
    return json.data;
  },

  // -------------------------------------------------------------
  // ADMIN CATEGORIES
  // -------------------------------------------------------------
  async createCategory(data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${API_BASE}/admin/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res, 'Gagal menambahkan kategori');
    return json.data;
  },

  async updateCategory(id: string, data: Partial<Category>): Promise<Category> {
    const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res, 'Gagal memperbarui kategori');
    return json.data;
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/categories/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    await safeJson(res, 'Gagal menghapus kategori');
  },

  // -------------------------------------------------------------
  // ADMIN PRODUCTS
  // -------------------------------------------------------------
  async createProduct(data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_BASE}/admin/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res, 'Gagal menambahkan produk');
    return json.data;
  },

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const res = await fetch(`${API_BASE}/admin/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res, 'Gagal memperbarui produk');
    return json.data;
  },

  async deleteProduct(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/admin/products/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    await safeJson(res, 'Gagal menghapus produk');
  },

  // -------------------------------------------------------------
  // ADMIN FILE UPLOADS
  // -------------------------------------------------------------
  async uploadProductImage(file: File): Promise<string> {
    const optimizedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);

    const res = await fetch(`${API_BASE}/admin/upload/product`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    const json = await safeJson(res, 'Gagal mengunggah foto produk');
    return json.data.url;
  },

  async uploadCategoryImage(file: File): Promise<string> {
    const optimizedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);

    const res = await fetch(`${API_BASE}/admin/upload/category`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    const json = await safeJson(res, 'Gagal mengunggah foto kategori');
    return json.data.url;
  },

  async uploadLogoImage(file: File): Promise<string> {
    const optimizedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);

    const res = await fetch(`${API_BASE}/admin/upload/logo`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    const json = await safeJson(res, 'Gagal mengunggah logo');
    return json.data.url;
  },

  async uploadQrisImage(file: File): Promise<string> {
    const optimizedFile = await compressImageFile(file);
    const formData = new FormData();
    formData.append('file', optimizedFile);

    const res = await fetch(`${API_BASE}/admin/upload/qris`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    const json = await safeJson(res, 'Gagal mengunggah gambar QRIS');
    return json.data.url;
  },

  // -------------------------------------------------------------
  // ADMIN ORDERS
  // -------------------------------------------------------------
  async getOrders(status?: string): Promise<Order[]> {
    const url = status ? `${API_BASE}/admin/orders?status=${status}` : `${API_BASE}/admin/orders`;
    const res = await fetch(url, {
      headers: { ...getAuthHeader() },
    });
    const json = await safeJson(res, 'Gagal memuat pesanan');
    return json.data;
  },

  async getOrderDetail(id: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}`, {
      headers: { ...getAuthHeader() },
    });
    const json = await safeJson(res, 'Gagal memuat detail pesanan');
    return json.data;
  },

  async updateOrderStatus(id: string, status?: string, payment_status?: string): Promise<Order> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ status, payment_status }),
    });
    const json = await safeJson(res, 'Gagal memperbarui status');
    return json.data;
  },

  async deleteOrder(id: string): Promise<string> {
    const res = await fetch(`${API_BASE}/admin/orders/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    const json = await safeJson(res, 'Gagal menghapus pesanan');
    return json.message;
  },

  async clearOrders(mode: 'completed' | 'all' = 'completed'): Promise<string> {
    const res = await fetch(`${API_BASE}/admin/orders/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ mode }),
    });
    const json = await safeJson(res, 'Gagal membersihkan riwayat pesanan');
    return json.message;
  },

  // -------------------------------------------------------------
  // ADMIN SETTINGS
  // -------------------------------------------------------------
  async updateSettings(data: Partial<Setting>): Promise<Setting> {
    const res = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    const json = await safeJson(res, 'Gagal memperbarui pengaturan');
    return json.data;
  },
};