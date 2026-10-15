import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Store,
  Palette,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Check,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Lock,
  Printer,
  QrCode,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  Volume2,
  VolumeX,
  CreditCard,
  Building,
  Smartphone,
  Banknote,
} from 'lucide-react';
import QRCode from 'qrcode';
import { User, Business, Category, Product, Order, Setting, DashboardStats, PaymentConfig } from '../types';
import { api } from '../services/api';
import { ReceiptModal } from '../components/ReceiptModal';
import { TableQRManager } from '../components/TableQRManager';
import { InstallPrompt, InstallButtonBadge } from '../components/InstallPrompt';
import { RevenueChart } from '../components/RevenueChart';
interface AdminDashboardProps {
  currentUser: User;
  currentBusiness: Business;
  onLogout: () => void;
  onViewPublicCatalog: () => void;
}

type TabType = 'overview' | 'products' | 'categories' | 'orders' | 'tables' | 'payments' | 'business' | 'appearance' | 'account';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  currentBusiness,
  onLogout,
  onViewPublicCatalog,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [business, setBusiness] = useState<Business>(currentBusiness);
  const [settings, setSettings] = useState<Setting | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Struk Kasir Modal State
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // User Profile States
  const [userProfile, setUserProfile] = useState<User>(currentUser);
  const [profileForm, setProfileForm] = useState({
    full_name: currentUser.full_name,
    email: currentUser.email,
    phone: currentUser.phone || '',
  });
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('');
  const [profileErrorMessage, setProfileErrorMessage] = useState('');

  // Password Management States
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('');
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');

  // Payment & QRIS Settings State
  const [paymentForm, setPaymentForm] = useState<PaymentConfig>({
    qris_enabled: true,
    qris_merchant_name: 'Warkop Nusantara',
    qris_nmid: 'ID1020261928374',
    qris_image_url: '',
    cash_enabled: true,
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [selectedQrisFile, setSelectedQrisFile] = useState<File | null>(null);
  const [isUploadingQris, setIsUploadingQris] = useState(false);
  const [qrisPreviewUrl, setQrisPreviewUrl] = useState<string>('');

  // Modal States
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    category_id: '',
    is_available: true,
    display_order: 0,
    image_url: '',
  });
  const [selectedProductFile, setSelectedProductFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    display_order: 0,
    is_active: true,
    image_url: '',
  });
  const [selectedCategoryFile, setSelectedCategoryFile] = useState<File | null>(null);
  const [isUploadingCategoryImage, setIsUploadingCategoryImage] = useState(false);

  // Order Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Logo file upload
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('admin_order_sound') !== 'false';
  });

  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const ordersCountRef = React.useRef<number>(-1);
  const knownOrderIdsRef = React.useRef<Set<string>>(new Set());

  // Inisialisasi AudioContext dengan dukungan browser modern
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  };

  // Sintesis bunyi bel pesanan baru 'Ting-Ting' (Web Audio API jernih & nyaring)
  const playOrderChime = () => {
    if (!isSoundEnabled) return;
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;

      const now = audioCtx.currentTime;

      // Nada 1: 880 Hz (A5) - bell ding
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Nada 2: 1318.5 Hz (E6) - higher chime harmony
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, now + 0.12);
      gain2.gain.setValueAtTime(0.4, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);
    } catch (e) {
      console.warn('Audio chime notice:', e);
    }
  };

  // Buka suspensi audio saat admin pertama kali klik di dashboard
  useEffect(() => {
    const handleFirstUserGesture = () => {
      getAudioContext();
    };
    window.addEventListener('click', handleFirstUserGesture, { once: true });
    window.addEventListener('keydown', handleFirstUserGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstUserGesture);
      window.removeEventListener('keydown', handleFirstUserGesture);
    };
  }, []);

  const toggleSound = () => {
    const next = !isSoundEnabled;
    setIsSoundEnabled(next);
    localStorage.setItem('admin_order_sound', String(next));
    if (next) {
      setTimeout(() => playOrderChime(), 50);
      showNotify('success', '🔔 Suara bel notifikasi pesanan diaktifkan (Ting-Ting).');
    } else {
      showNotify('error', '🔕 Suara bel notifikasi pesanan dibisukan.');
    }
  };

  useEffect(() => {
    loadAllAdminData();
    // Auto polling real-time setiap 4 detik (gaperlu refresh layar)
    const timer = setInterval(() => {
      loadAllAdminData(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [business.id]);

  const showNotify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadAllAdminData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setIsLoading(true);
      }
      const [statsData, prodsData, catsData, ordsData, pubData] = await Promise.all([
        api.getDashboard(),
        api.getProducts(business.id),
        api.getCategories(business.id),
        api.getOrders(),
        api.getPublicBusiness(business.slug),
      ]);

      // Deteksi notifikasi jika ada pesanan baru masuk
      if (ordersCountRef.current !== -1) {
        // Cek apakah ada pesanan yang id-nya belum ada di knownOrderIdsRef
        const newlyAddedOrders = ordsData.filter((o) => !knownOrderIdsRef.current.has(o.id));
        if (newlyAddedOrders.length > 0) {
          const newest = newlyAddedOrders[0];
          playOrderChime();
          showNotify(
            'success',
            `🔔 Pesanan Baru Masuk! #${newest?.order_number || ''} (${newest?.table_number || 'Take Away'}) - Total: ${formatRupiah(newest?.total_amount || 0)}`
          );
        }
      }

      // Update daftar order id yang sudah diketahui
      const newKnownIds = new Set<string>();
      ordsData.forEach((o) => newKnownIds.add(o.id));
      knownOrderIdsRef.current = newKnownIds;
      ordersCountRef.current = ordsData.length;

      setStats(statsData);
      setProducts(prodsData);
      setCategories(catsData);
      setOrders(ordsData);
      setSettings(pubData.settings);
    } catch (err: any) {
      if (!isBackground) {
        showNotify('error', err.message || 'Gagal memuat data admin.');
      }
    } finally {
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // ------------------------------------------------------------------
  // PRODUCT ACTIONS
  // ------------------------------------------------------------------
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setSelectedProductFile(null);
    setProductForm({
      name: '',
      description: '',
      price: 0,
      stock: 50,
      category_id: categories[0]?.id || '',
      is_available: true,
      display_order: products.length + 1,
      image_url: '',
    });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setSelectedProductFile(null);
    setProductForm({
      name: prod.name,
      description: prod.description || '',
      price: prod.price,
      stock: prod.stock,
      category_id: prod.category_id || '',
      is_available: prod.is_available,
      display_order: prod.display_order,
      image_url: prod.image_url || '',
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUploadingImage(true);
      let finalImageUrl = productForm.image_url;

      // Jika admin memilih file foto dari komputer, upload ke Supabase Storage via Express
      if (selectedProductFile) {
        finalImageUrl = await api.uploadProductImage(selectedProductFile);
      }

      const payload = {
        ...productForm,
        image_url: finalImageUrl,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        category_id: productForm.category_id || null,
      };

      if (editingProduct) {
        await api.updateProduct(editingProduct.id, payload);
        showNotify('success', 'Produk berhasil diperbarui.');
      } else {
        await api.createProduct(payload);
        showNotify('success', 'Produk baru berhasil ditambahkan.');
      }

      setIsProductModalOpen(false);
      loadAllAdminData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan produk.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Yakin ingin menghapus produk "${name}"?`)) return;
    try {
      await api.deleteProduct(id);
      showNotify('success', 'Produk berhasil dihapus.');
      loadAllAdminData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menghapus produk.');
    }
  };

  // ------------------------------------------------------------------
  // CATEGORY ACTIONS
  // ------------------------------------------------------------------
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setSelectedCategoryFile(null);
    setCategoryForm({
      name: '',
      description: '',
      display_order: categories.length + 1,
      is_active: true,
      image_url: '',
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setSelectedCategoryFile(null);
    setCategoryForm({
      name: cat.name,
      description: cat.description || '',
      display_order: cat.display_order,
      is_active: cat.is_active,
      image_url: cat.image_url || '',
    });
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalImageUrl = categoryForm.image_url;
      if (selectedCategoryFile) {
        setIsUploadingCategoryImage(true);
        finalImageUrl = await api.uploadCategoryImage(selectedCategoryFile);
      }

      const payload = {
        ...categoryForm,
        image_url: finalImageUrl,
      };

      if (editingCategory) {
        await api.updateCategory(editingCategory.id, payload);
        showNotify('success', 'Kategori berhasil diperbarui.');
      } else {
        await api.createCategory(payload);
        showNotify('success', 'Kategori berhasil ditambahkan.');
      }
      setIsCategoryModalOpen(false);
      setSelectedCategoryFile(null);
      loadAllAdminData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan kategori.');
    } finally {
      setIsUploadingCategoryImage(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Hapus kategori "${name}"? Produk yang terkait akan dipindahkan ke tanpa kategori.`)) return;
    try {
      await api.deleteCategory(id);
      showNotify('success', 'Kategori berhasil dihapus.');
      loadAllAdminData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menghapus kategori.');
    }
  };

  // ------------------------------------------------------------------
  // ORDER ACTIONS
  // ------------------------------------------------------------------
  const handleUpdateOrderStatus = async (orderId: string, status?: string, payment_status?: string) => {
    try {
      const updated = await api.updateOrderStatus(orderId, status, payment_status);
      showNotify('success', `Status pesanan #${updated.order_number} diperbarui.`);
      loadAllAdminData();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(updated);
      }
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal memperbarui status pesanan.');
    }
  };

  const handleDeleteOrder = async (orderId: string, orderNumber: string) => {
    if (!confirm(`Hapus pesanan #${orderNumber}? Data yang dihapus tidak dapat dikembalikan.`)) return;
    try {
      await api.deleteOrder(orderId);
      showNotify('success', `Pesanan #${orderNumber} berhasil dihapus.`);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(null);
      }
      loadAllAdminData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menghapus pesanan.');
    }
  };

  const handleClearOrders = async (mode: 'completed' | 'all') => {
    const confirmMsg =
      mode === 'completed'
        ? 'Bersihkan semua pesanan yang statusnya sudah Selesai atau Dibatalkan? Pesanan yang masih pending/proses akan tetap aman.'
        : 'PERHATIAN: Anda akan me-reset dan menghapus SEMUA riwayat pesanan. Tindakan ini cocok saat tutup buku kasir harian atau membersihkan pesanan uji coba. Lanjutkan?';
    if (!confirm(confirmMsg)) return;

    try {
      const msg = await api.clearOrders(mode);
      showNotify('success', msg);
      setSelectedOrder(null);
      loadAllAdminData();
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal membersihkan riwayat pesanan.');
    }
  };

  // ------------------------------------------------------------------
  // BUSINESS PROFILE ACTIONS
  // ------------------------------------------------------------------
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let finalLogoUrl = business.logo_url;
      if (selectedLogoFile) {
        setIsUploadingLogo(true);
        finalLogoUrl = await api.uploadLogoImage(selectedLogoFile);
      }

      const updated = await api.updateBusiness({
        ...business,
        logo_url: finalLogoUrl,
      });

      setBusiness(updated);
      setSelectedLogoFile(null);
      showNotify('success', 'Profil bisnis berhasil disimpan.');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal memperbarui profil bisnis.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // ------------------------------------------------------------------
  // THEME & SETTINGS ACTIONS
  // ------------------------------------------------------------------
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      showNotify('success', 'Pengaturan tema & tampilan berhasil disimpan.');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan pengaturan tema.');
    }
  };

  useEffect(() => {
    if (settings?.additional_config?.payment_config) {
      setPaymentForm(settings.additional_config.payment_config);
    }
  }, [settings]);

  useEffect(() => {
    const merchant = (paymentForm.qris_merchant_name || business.name || 'Warkop Nusantara').toUpperCase();
    const nmid = paymentForm.qris_nmid || 'ID1020261928374';
    const qrisString = `00020101021226600016ID.CO.QRIS.WWW011893600998102938470215${nmid}52045812530336054005802ID59${merchant.length < 10 ? '0' + merchant.length : merchant.length}${merchant}6007JAKARTA6304`;

    QRCode.toDataURL(qrisString, {
      width: 260,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => setQrisPreviewUrl(url))
      .catch(() => {});
  }, [paymentForm.qris_merchant_name, paymentForm.qris_nmid, business.name]);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      setIsSubmittingPayment(true);
      let finalQrisUrl = paymentForm.qris_image_url;

      if (selectedQrisFile) {
        setIsUploadingQris(true);
        finalQrisUrl = await api.uploadQrisImage(selectedQrisFile);
      }

      const updatedPaymentForm: PaymentConfig = {
        ...paymentForm,
        qris_image_url: finalQrisUrl,
      };

      const updated: Setting = {
        ...settings,
        additional_config: {
          ...(settings.additional_config || {}),
          payment_config: updatedPaymentForm,
        },
      };
      const res = await api.updateSettings(updated);
      setSettings(res);
      setPaymentForm(updatedPaymentForm);
      setSelectedQrisFile(null);
      showNotify('success', 'Pengaturan QRIS toko berhasil disimpan!');
    } catch (err: any) {
      showNotify('error', err.message || 'Gagal menyimpan pengaturan pembayaran.');
    } finally {
      setIsSubmittingPayment(false);
      setIsUploadingQris(false);
    }
  };

  const applyThemePreset = (presetKey: string) => {
    if (!settings) return;
    if (presetKey === 'amber_warm') {
      setSettings({
        ...settings,
        theme_preset: 'amber_warm',
        primary_color: '#78350f',
        secondary_color: '#d97706',
        background_color: '#fffbeb',
        text_color: '#1f2937',
        button_style: 'rounded',
        card_style: 'shadow',
        font_family: 'Inter',
      });
    } else if (presetKey === 'emerald_fresh') {
      setSettings({
        ...settings,
        theme_preset: 'emerald_fresh',
        primary_color: '#047857',
        secondary_color: '#059669',
        background_color: '#f0fdf4',
        text_color: '#064e3b',
        button_style: 'pill',
        card_style: 'bordered',
        font_family: 'Plus Jakarta Sans',
      });
    } else if (presetKey === 'midnight_neon') {
      setSettings({
        ...settings,
        theme_preset: 'midnight_neon',
        primary_color: '#18181b',
        secondary_color: '#f59e0b',
        background_color: '#fafafa',
        text_color: '#18181b',
        button_style: 'rounded',
        card_style: 'elevated',
        font_family: 'Inter',
      });
    } else if (presetKey === 'retro_vintage') {
      setSettings({
        ...settings,
        theme_preset: 'retro_vintage',
        primary_color: '#991b1b',
        secondary_color: '#ea580c',
        background_color: '#fff7ed',
        text_color: '#450a0a',
        button_style: 'rounded',
        card_style: 'shadow',
        font_family: 'Merriweather',
      });
    } else if (presetKey === 'sunset_coffee') {
      setSettings({
        ...settings,
        theme_preset: 'sunset_coffee',
        primary_color: '#c2410c',
        secondary_color: '#f97316',
        background_color: '#fff7ed',
        text_color: '#431407',
        button_style: 'pill',
        card_style: 'shadow',
        font_family: 'Plus Jakarta Sans',
      });
    } else if (presetKey === 'slate_modern') {
      setSettings({
        ...settings,
        theme_preset: 'slate_modern',
        primary_color: '#0f172a',
        secondary_color: '#2563eb',
        background_color: '#f8fafc',
        text_color: '#0f172a',
        button_style: 'square',
        card_style: 'bordered',
        font_family: 'Inter',
      });
    } else if (presetKey === 'pastel_blossom') {
      setSettings({
        ...settings,
        theme_preset: 'pastel_blossom',
        primary_color: '#831843',
        secondary_color: '#db2777',
        background_color: '#fdf2f8',
        text_color: '#500724',
        button_style: 'pill',
        card_style: 'elevated',
        font_family: 'Inter',
      });
    } else if (presetKey === 'ocean_breeze') {
      setSettings({
        ...settings,
        theme_preset: 'ocean_breeze',
        primary_color: '#0e7490',
        secondary_color: '#06b6d4',
        background_color: '#ecfeff',
        text_color: '#164e63',
        button_style: 'rounded',
        card_style: 'shadow',
        font_family: 'Plus Jakarta Sans',
      });
    }
  };

  // ------------------------------------------------------------------
  // ACCOUNT & PROFILE ACTIONS
  // ------------------------------------------------------------------
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccessMessage('');
    setProfileErrorMessage('');

    if (!profileForm.full_name.trim()) {
      setProfileErrorMessage('Nama lengkap pemilik/admin wajib diisi.');
      return;
    }

    if (!profileForm.email.trim()) {
      setProfileErrorMessage('Alamat email wajib diisi.');
      return;
    }

    try {
      setIsSubmittingProfile(true);
      const updated = await api.updateProfile(profileForm);
      setUserProfile(updated);
      setProfileSuccessMessage('Profil pemilik berhasil diperbarui!');
      showNotify('success', 'Profil pemilik bisnis berhasil disimpan.');
    } catch (err: any) {
      setProfileErrorMessage(err.message || 'Gagal memperbarui profil pemilik.');
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMessage('');
    setPasswordErrorMessage('');

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordErrorMessage('Semua bidang password wajib diisi.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordErrorMessage('Password baru minimal harus 8 karakter.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordErrorMessage('Password baru dan konfirmasi password tidak cocok.');
      return;
    }

    if (passwordForm.newPassword === passwordForm.currentPassword) {
      setPasswordErrorMessage('Password baru tidak boleh sama dengan password saat ini.');
      return;
    }

    try {
      setIsSubmittingPassword(true);
      const res = await api.changePassword(passwordForm);
      setPasswordSuccessMessage(res.message || 'Password berhasil diperbarui.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotify('success', 'Password akun Anda berhasil diganti.');
    } catch (err: any) {
      setPasswordErrorMessage(err.message || 'Gagal mengubah password.');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col md:flex-row text-neutral-800">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-neutral-900 text-neutral-300 flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 bg-amber-600 text-white rounded-lg flex items-center justify-center font-bold text-xs">
                {business.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white truncate">{business.name}</h2>
              <span className="text-[10px] text-neutral-400 capitalize">{currentUser.role} Dashboard</span>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-3 space-y-1 flex-1">
          {[
            { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
            { id: 'products', label: 'Kelola Produk', icon: Package, count: products.length },
            { id: 'categories', label: 'Kelola Kategori', icon: Layers, count: categories.length },
            { id: 'orders', label: 'Kelola Pesanan', icon: ShoppingBag, count: stats?.pending_orders ? `${stats.pending_orders} baru` : undefined },
            { id: 'tables', label: 'QR Meja (1-10)', icon: QrCode },
            { id: 'payments', label: 'Metode Bayar & QRIS', icon: CreditCard },
            { id: 'business', label: 'Profil Bisnis', icon: Store },
            { id: 'appearance', label: 'Tampilan & Tema', icon: Palette },
            { id: 'account', label: 'Pengaturan Akun', icon: KeyRound },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-neutral-800 space-y-2">
          <button
            onClick={onViewPublicCatalog}
            className="w-full py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            Buka Katalog Publik
          </button>
          <button
            onClick={onLogout}
            className="w-full py-2 px-3 text-rose-400 hover:bg-rose-950/40 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar (Logout)
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header Bar */}
        <header className="bg-white border-b border-neutral-200 px-6 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold text-neutral-900 capitalize">
              {activeTab === 'overview' && 'Ringkasan Usaha'}
              {activeTab === 'products' && 'Kelola Produk & Stok'}
              {activeTab === 'categories' && 'Kelola Kategori Menu'}
              {activeTab === 'orders' && 'Daftar Pesanan Pelanggan'}
              {activeTab === 'tables' && 'Generator QR Code Meja (Dine-In)'}
              {activeTab === 'payments' && 'Pengaturan Metode Pembayaran & QRIS'}
              {activeTab === 'business' && 'Pengaturan Profil Bisnis'}
              {activeTab === 'appearance' && 'Kustomisasi Tema & Tampilan Toko'}
              {activeTab === 'account' && 'Pengaturan Akun & Ganti Password'}
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Login sebagai: <span className="font-semibold text-neutral-700">{currentUser.full_name}</span> ({currentUser.email})
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Tombol Install Aplikasi Kasir / Admin */}
            <InstallButtonBadge />

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync (4s)
            </div>

            {/* Tombol Kontrol Bel Suara Pesanan */}
            <button
              onClick={toggleSound}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                isSoundEnabled
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-500 border-neutral-300'
              }`}
              title={isSoundEnabled ? 'Suara Bel Aktif (Klik untuk matikan)' : 'Suara Bel Mati (Klik untuk aktifkan)'}
            >
              {isSoundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-amber-700 animate-bounce" />
                  <span>Bel Aktif (Ting!)</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Bel Mati</span>
                </>
              )}
            </button>

            {/* Tombol Kembali ke Buku Menu Toko */}
            <button
              onClick={onViewPublicCatalog}
              className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              title="Buka tampilan katalog buku menu seperti yang dilihat pelanggan"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buka Menu Toko</span>
              <span className="sm:hidden">Menu</span>
            </button>

            <button
              onClick={() => loadAllAdminData(false)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Perbarui data sekarang secara manual"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </header>

        {/* Global Toast Notification */}
        {notification && (
          <div className="px-6 pt-4">
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 shadow-xs ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-6 flex-1">
          {/* ========================================================= */}
          {/* TAB 1: OVERVIEW / RINGKASAN */}
          {/* ========================================================= */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
                  <span className="text-xs text-emerald-800 font-bold block flex items-center gap-1">
                    💰 Omzet Hari Ini
                  </span>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {formatRupiah(stats.today_revenue || 0)}
                  </div>
                  <span className="text-[11px] text-emerald-800/80 mt-1 block font-medium">
                    {stats.today_orders || 0} pesanan hari ini
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
                  <span className="text-xs text-neutral-400 font-medium block">Total Akumulasi Omzet</span>
                  <div className="text-2xl font-black text-neutral-900 mt-1">
                    {formatRupiah(stats.total_revenue)}
                  </div>
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    {stats.total_orders} total riwayat pesanan
                  </span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
                  <span className="text-xs text-neutral-400 font-medium block">Pesanan Menunggu</span>
                  <div className="text-2xl font-black text-amber-600 mt-1">{stats.pending_orders}</div>
                  <span className="text-[11px] text-amber-700 mt-1 block">Perlu diproses segera</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-xs">
                  <span className="text-xs text-neutral-400 font-medium block">Total Produk Aktif</span>
                  <div className="text-2xl font-black text-neutral-900 mt-1">{stats.total_products}</div>
                  <span className="text-[11px] text-neutral-500 mt-1 block">Dalam {stats.total_categories} kategori</span>
                </div>
              </div>
                 {/* Grafik Pemasukan Mingguan & Bulanan */}
              <RevenueChart orders={orders} />
              {/* Pesanan Terbaru */}
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Pesanan Masuk Terbaru</h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Pantau transaksi masuk atau bersihkan riwayat pesanan
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleClearOrders('completed')}
                      className="px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition cursor-pointer"
                      title="Bersihkan pesanan yang sudah berstatus selesai atau dibatalkan"
                    >
                      Bersihkan Riwayat Selesai
                    </button>
                    <button
                      onClick={() => setActiveTab('orders')}
                      className="px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
                    >
                      Kelola Semua &rarr;
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                      <tr>
                        <th className="p-3">No. Pesanan</th>
                        <th className="p-3">Pelanggan</th>
                        <th className="p-3">Meja / Layanan</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Pembayaran</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {stats.recent_orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-neutral-400">
                            Belum ada pesanan masuk.
                          </td>
                        </tr>
                      ) : (
                        stats.recent_orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-neutral-50/70">
                            <td className="p-3 font-mono font-bold text-neutral-800">{ord.order_number}</td>
                            <td className="p-3 font-medium text-neutral-800">
                              <span className="font-bold block">{ord.customer_name}</span>
                              {ord.customer_phone && <span className="text-[10px] text-neutral-400 block">{ord.customer_phone}</span>}
                            </td>
                            <td className="p-3">
                              {ord.order_type === 'dine_in' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  🪑 {ord.table_number || 'Dine-In'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-700 capitalize">
                                  {ord.order_type === 'take_away' ? '🥡 Take Away' : '🛵 Delivery'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-extrabold text-neutral-900">{formatRupiah(ord.total_amount)}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  ord.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : ord.status === 'cancelled'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {ord.status}
                              </span>
                            </td>
                            <td className="p-3 capitalize">{ord.payment_status}</td>
                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => setReceiptOrder(ord)}
                                className="text-neutral-600 hover:text-neutral-900 font-semibold inline-flex items-center gap-0.5 px-2 py-1 rounded hover:bg-neutral-100 cursor-pointer"
                                title="Cetak Struk Kasir"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Struk
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedOrder(ord);
                                  setActiveTab('orders');
                                }}
                                className="text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50 cursor-pointer"
                              >
                                Detail
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(ord.id, ord.order_number)}
                                className="text-neutral-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer inline-flex items-center"
                                title="Hapus pesanan ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: KELOLA PRODUK */}
          {/* ========================================================= */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500 font-medium">
                  Menampilkan {products.length} produk untuk bisnis Anda.
                </span>
                <button
                  onClick={handleOpenAddProduct}
                  className="py-2 px-3.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-900/10 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Produk Baru
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                      <tr>
                        <th className="p-3">Foto</th>
                        <th className="p-3">Nama Produk</th>
                        <th className="p-3">Kategori</th>
                        <th className="p-3">Harga</th>
                        <th className="p-3">Stok</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {products.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-neutral-400">
                            Belum ada produk. Klik tombol di atas untuk menambah menu.
                          </td>
                        </tr>
                      ) : (
                        products.map((p) => {
                          const catName = categories.find((c) => c.id === p.category_id)?.name || 'Tanpa Kategori';
                          return (
                            <tr key={p.id} className="hover:bg-neutral-50/70">
                              <td className="p-3">
                                {p.image_url ? (
                                  <img
                                    src={p.image_url}
                                    alt={p.name}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=150&q=80';
                                    }}
                                    className="w-10 h-10 object-cover rounded-lg border border-neutral-200"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400">
                                    <Package className="w-5 h-5" />
                                  </div>
                                )}
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-neutral-800 block">{p.name}</span>
                                <span className="text-[11px] text-neutral-400 truncate max-w-xs block">
                                  {p.description || '-'}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className="bg-neutral-100 px-2 py-0.5 rounded text-[11px] text-neutral-700">
                                  {catName}
                                </span>
                              </td>
                              <td className="p-3 font-extrabold text-neutral-900">{formatRupiah(p.price)}</td>
                              <td className="p-3 font-semibold">{p.stock}</td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.is_available ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {p.is_available ? 'Tersedia' : 'Habis'}
                                </span>
                              </td>
                              <td className="p-3 text-right space-x-2">
                                <button
                                  onClick={() => handleOpenEditProduct(p)}
                                  className="p-1 text-neutral-600 hover:text-amber-800 transition"
                                  title="Edit Produk & Ganti Foto"
                                >
                                  <Pencil className="w-4 h-4 inline" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id, p.name)}
                                  className="p-1 text-neutral-400 hover:text-rose-600 transition"
                                  title="Hapus Produk"
                                >
                                  <Trash2 className="w-4 h-4 inline" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: KELOLA KATEGORI */}
          {/* ========================================================= */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-neutral-500 font-medium">
                  {categories.length} kategori terdaftar.
                </span>
                <button
                  onClick={handleOpenAddCategory}
                  className="py-2 px-3.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-900/10 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Kategori
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                    <tr>
                      <th className="p-3">Foto</th>
                      <th className="p-3">Urutan</th>
                      <th className="p-3">Nama Kategori</th>
                      <th className="p-3">Slug</th>
                      <th className="p-3">Deskripsi</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-neutral-400">
                          Belum ada kategori.
                        </td>
                      </tr>
                    ) : (
                      categories.map((c) => (
                        <tr key={c.id} className="hover:bg-neutral-50/70">
                          <td className="p-3">
                            {c.image_url ? (
                              <img
                                src={c.image_url}
                                alt={c.name}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=150&q=80';
                                }}
                                className="w-10 h-10 object-cover rounded-lg border border-neutral-200"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400">
                                <Layers className="w-5 h-5" />
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-neutral-500">{c.display_order}</td>
                          <td className="p-3 font-bold text-neutral-800">{c.name}</td>
                          <td className="p-3 font-mono text-neutral-500">{c.slug}</td>
                          <td className="p-3 text-neutral-500">{c.description || '-'}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-200 text-neutral-600'
                              }`}
                            >
                              {c.is_active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditCategory(c)}
                              className="p-1 text-neutral-600 hover:text-amber-800 transition cursor-pointer"
                              title="Edit Kategori & Ganti Foto"
                            >
                              <Pencil className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(c.id, c.name)}
                              className="p-1 text-neutral-400 hover:text-rose-600 transition cursor-pointer"
                              title="Hapus Kategori"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: KELOLA PESANAN */}
          {/* ========================================================= */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Semua Pesanan Masuk ({orders.length})</h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Kelola status, cetak struk thermal, atau bersihkan pesanan lama
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleClearOrders('completed')}
                      disabled={orders.filter((o) => o.status === 'completed' || o.status === 'cancelled').length === 0}
                      className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Hapus semua pesanan yang berstatus selesai atau dibatalkan"
                    >
                      Bersihkan Riwayat Selesai
                    </button>
                    <button
                      onClick={() => handleClearOrders('all')}
                      disabled={orders.length === 0}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Reset dan hapus seluruh pesanan (cocok untuk tutup kasir hari ini / reset uji coba)"
                    >
                      Reset Semua Pesanan
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                      <tr>
                        <th className="p-3">No. Pesanan</th>
                        <th className="p-3">Pelanggan & WA</th>
                        <th className="p-3">Layanan & Meja</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Status Pesanan</th>
                        <th className="p-3">Pembayaran</th>
                        <th className="p-3 text-right">Kelola Status & Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-neutral-400">
                            Belum ada riwayat pesanan.
                          </td>
                        </tr>
                      ) : (
                        orders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-neutral-50/70">
                            <td className="p-3 font-mono font-bold text-neutral-900">
                              <button
                                onClick={() => setSelectedOrder(ord)}
                                className="text-blue-600 hover:underline"
                              >
                                {ord.order_number}
                              </button>
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-neutral-800 block">{ord.customer_name}</span>
                              <span className="text-[11px] text-neutral-400 block">{ord.customer_phone}</span>
                            </td>
                            <td className="p-3">
                              {ord.order_type === 'dine_in' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                                  🪑 {ord.table_number || 'Dine In'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-700 capitalize">
                                  {ord.order_type === 'take_away' ? '🥡 Take Away' : '🛵 Delivery'}
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-extrabold text-neutral-900">{formatRupiah(ord.total_amount)}</td>
                            <td className="p-3">
                              <select
                                value={ord.status}
                                onChange={(e) => handleUpdateOrderStatus(ord.id, e.target.value)}
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                  ord.status === 'completed'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : ord.status === 'processing'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300'
                                    : ord.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}
                              >
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="processing">Processing</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <select
                                value={ord.payment_status}
                                onChange={(e) => handleUpdateOrderStatus(ord.id, undefined, e.target.value)}
                                className={`text-[11px] font-bold px-2 py-1 rounded-lg border focus:outline-none cursor-pointer ${
                                  ord.payment_status === 'paid'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-neutral-100 text-neutral-700 border-neutral-300'
                                }`}
                              >
                                <option value="unpaid">Unpaid</option>
                                <option value="paid">Paid (Lunas)</option>
                                <option value="refunded">Refunded</option>
                              </select>
                            </td>
                            <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                              <button
                                onClick={() => setReceiptOrder(ord)}
                                className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                                title="Cetak Struk Kasir Thermal"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Cetak
                              </button>
                              <button
                                onClick={() => setSelectedOrder(ord)}
                                className="px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                              >
                                Rincian
                              </button>
                              <button
                                onClick={() => handleDeleteOrder(ord.id, ord.order_number)}
                                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer inline-flex items-center"
                                title="Hapus pesanan ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: GENERATOR QR CODE MEJA (DINE-IN) */}
          {/* ========================================================= */}
          {activeTab === 'tables' && (
            <TableQRManager business={business} />
          )}

          {/* ========================================================= */}
          {/* TAB 5: PROFIL BISNIS */}
          {/* ========================================================= */}
          {activeTab === 'business' && (
            <div className="max-w-2xl bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
              <h3 className="text-sm font-bold text-neutral-900 mb-4">Informasi Bisnis & Kontak</h3>
              <form onSubmit={handleSaveBusiness} className="space-y-4 text-xs">
                {/* Logo Upload */}
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Logo Bisnis</label>
                  <div className="flex items-center gap-4">
                    {business.logo_url && (
                      <img
                        src={business.logo_url}
                        alt="Logo"
                        className="w-16 h-16 rounded-xl object-cover border border-neutral-200"
                      />
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setSelectedLogoFile(e.target.files?.[0] || null)}
                        className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
                      />
                      <p className="text-[11px] text-neutral-400 mt-1">
                        Format didukung: JPEG, PNG, WebP (Maks. 5MB). Otomatis diunggah ke Supabase Storage bucket <code>business-assets</code>.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Nama Bisnis *</label>
                  <input
                    type="text"
                    required
                    value={business.name}
                    onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Deskripsi Singkat</label>
                  <textarea
                    rows={2}
                    value={business.description || ''}
                    onChange={(e) => setBusiness({ ...business, description: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Nomor Telepon</label>
                    <input
                      type="text"
                      value={business.phone || ''}
                      onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">WhatsApp Penjual *</label>
                    <input
                      type="text"
                      required
                      placeholder="6281234567890"
                      value={business.whatsapp || ''}
                      onChange={(e) => setBusiness({ ...business, whatsapp: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Alamat Fisik</label>
                  <textarea
                    rows={2}
                    value={business.address || ''}
                    onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Google Maps URL</label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/..."
                    value={business.google_maps_url || ''}
                    onChange={(e) => setBusiness({ ...business, google_maps_url: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Jam Operasional */}
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-800" />
                    <h4 className="font-bold text-xs text-amber-950 uppercase tracking-wider">
                      Jadwal Jam Operasional Toko
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1 text-[11px]">
                        Senin - Jumat (Hari Kerja)
                      </label>
                      <input
                        type="text"
                        placeholder="08:00 - 23:00 WIB"
                        value={
                          typeof business.opening_hours === 'object' && business.opening_hours !== null
                            ? (business.opening_hours as any).senin_jumat || ''
                            : typeof business.opening_hours === 'string'
                            ? business.opening_hours
                            : ''
                        }
                        onChange={(e) => {
                          const current =
                            typeof business.opening_hours === 'object' && business.opening_hours !== null
                              ? { ...business.opening_hours }
                              : {};
                          current.senin_jumat = e.target.value;
                          setBusiness({ ...business, opening_hours: current });
                        }}
                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1 text-[11px]">
                        Sabtu - Minggu (Akhir Pekan)
                      </label>
                      <input
                        type="text"
                        placeholder="08:00 - 01:00 WIB"
                        value={
                          typeof business.opening_hours === 'object' && business.opening_hours !== null
                            ? (business.opening_hours as any).sabtu_minggu || ''
                            : ''
                        }
                        onChange={(e) => {
                          const current =
                            typeof business.opening_hours === 'object' && business.opening_hours !== null
                              ? { ...business.opening_hours }
                              : {};
                          current.sabtu_minggu = e.target.value;
                          setBusiness({ ...business, opening_hours: current });
                        }}
                        className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1 text-[11px]">
                      Catatan / Keterangan Operasional
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Buka Setiap Hari (Libur Nasional Tetap Buka)"
                      value={
                        typeof business.opening_hours === 'object' && business.opening_hours !== null
                          ? (business.opening_hours as any).catatan || ''
                          : ''
                      }
                      onChange={(e) => {
                        const current =
                          typeof business.opening_hours === 'object' && business.opening_hours !== null
                            ? { ...business.opening_hours }
                            : {};
                        current.catatan = e.target.value;
                        setBusiness({ ...business, opening_hours: current });
                      }}
                      className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUploadingLogo}
                  className="py-2.5 px-5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold flex items-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  {isUploadingLogo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengunggah Logo...
                    </>
                  ) : (
                    'Simpan Profil Bisnis'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: PENGATURAN TEMA & TAMPILAN */}
          {/* ========================================================= */}
          {activeTab === 'appearance' && settings && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Form Settings */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs text-xs space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 mb-2">Tema & Warna Dinamis</h3>
                <p className="text-neutral-500 text-[11px]">
                  Nilai tema disimpan di tabel <code>settings</code> PostgreSQL dan dimuat dinamis oleh aplikasi frontend.
                </p>

                {/* Preset Themes */}
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1.5">Pilih Tema Preset</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'amber_warm', name: 'Warkop Kayu', color: '#78350f' },
                      { id: 'emerald_fresh', name: 'Emerald Cafe', color: '#047857' },
                      { id: 'midnight_neon', name: 'Midnight Neon', color: '#18181b' },
                      { id: 'retro_vintage', name: 'Retro Vintage', color: '#991b1b' },
                      { id: 'sunset_coffee', name: 'Sunset Coffee', color: '#c2410c' },
                      { id: 'slate_modern', name: 'Slate Modern', color: '#0f172a' },
                      { id: 'pastel_blossom', name: 'Pastel Blossom', color: '#831843' },
                      { id: 'ocean_breeze', name: 'Ocean Breeze', color: '#0e7490' },
                    ].map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => applyThemePreset(pr.id)}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition cursor-pointer ${
                          settings.theme_preset === pr.id
                            ? 'border-amber-600 bg-amber-50 font-bold ring-2 ring-amber-500/20'
                            : 'border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow-2xs" style={{ backgroundColor: pr.color }} />
                        <span className="text-[11px] truncate">{pr.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Warna Utama (Primary)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.primary_color}
                          onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-neutral-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={settings.primary_color}
                          onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Warna Sekunder</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.secondary_color}
                          onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-neutral-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={settings.secondary_color}
                          onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Warna Background</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.background_color}
                          onChange={(e) => setSettings({ ...settings, background_color: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-neutral-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={settings.background_color}
                          onChange={(e) => setSettings({ ...settings, background_color: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Warna Teks</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={settings.text_color}
                          onChange={(e) => setSettings({ ...settings, text_color: e.target.value })}
                          className="w-8 h-8 rounded-lg border border-neutral-300 cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={settings.text_color}
                          onChange={(e) => setSettings({ ...settings, text_color: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-300 rounded-lg font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Gaya Tombol (Button)</label>
                      <select
                        value={settings.button_style}
                        onChange={(e) => setSettings({ ...settings, button_style: e.target.value as any })}
                        className="w-full px-2.5 py-2 bg-neutral-50 border border-neutral-300 rounded-xl"
                      >
                        <option value="square">Square (Kotak)</option>
                        <option value="rounded">Rounded (Sedang)</option>
                        <option value="pill">Pill (Lonjong)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">Gaya Kartu (Card)</label>
                      <select
                        value={settings.card_style}
                        onChange={(e) => setSettings({ ...settings, card_style: e.target.value as any })}
                        className="w-full px-2.5 py-2 bg-neutral-50 border border-neutral-300 rounded-xl"
                      >
                        <option value="flat">Flat (Rata)</option>
                        <option value="bordered">Bordered (Garis tepi)</option>
                        <option value="shadow">Shadow (Bayangan lembut)</option>
                        <option value="elevated">Elevated (Menonjol)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">Teks Pengumuman Banner (Header Toko)</label>
                    <input
                      type="text"
                      placeholder="Contoh: Diskon 20% khusus pesanan dine-in!"
                      value={settings.announcement || ''}
                      onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.is_ordering_enabled}
                        onChange={(e) => setSettings({ ...settings, is_ordering_enabled: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-800"
                      />
                      <span className="font-semibold text-neutral-800">
                        Aktifkan Fitur Pemesanan Online (Keranjang & Checkout)
                      </span>
                    </label>
                    <span className="text-[11px] text-neutral-400 block ml-6">
                      Jika dinonaktifkan, katalog hanya akan berfungsi sebagai buku menu digital tanpa tombol checkout.
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold flex items-center gap-2 shadow-md transition cursor-pointer"
                  >
                    Simpan Pengaturan Tampilan
                  </button>
                </form>
              </div>

              {/* Live Preview Card */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs text-xs space-y-4">
                <h3 className="text-sm font-bold text-neutral-900">Pratinjau Langsung (Live Preview)</h3>
                <p className="text-[11px] text-neutral-500">
                  Berikut tampilan komponen kartu menu berdasarkan warna dan gaya yang Anda pilih saat ini:
                </p>

                <div
                  className="p-5 rounded-2xl border transition-all"
                  style={{
                    backgroundColor: settings.background_color,
                    color: settings.text_color,
                  }}
                >
                  <div
                    className={`max-w-xs mx-auto p-4 transition-all ${
                      settings.card_style === 'bordered'
                        ? 'border border-neutral-200 bg-white'
                        : settings.card_style === 'elevated'
                        ? 'shadow-xl bg-white border border-neutral-100'
                        : settings.card_style === 'flat'
                        ? 'bg-neutral-100 border-none'
                        : 'shadow-md bg-white border border-neutral-100'
                    } ${
                      settings.button_style === 'pill'
                        ? 'rounded-3xl'
                        : settings.button_style === 'square'
                        ? 'rounded-none'
                        : 'rounded-xl'
                    }`}
                  >
                    <div className="w-full h-24 bg-neutral-200 rounded-lg flex items-center justify-center text-neutral-400 mb-3">
                      <Package className="w-8 h-8" />
                    </div>
                    <h4 className="font-bold text-sm text-neutral-900">Menu Spesial Contoh</h4>
                    <p className="text-neutral-500 text-[11px] mt-0.5">Deskripsi rasa gurih dan otentik.</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-extrabold text-neutral-900 text-sm">Rp 25.000</span>
                      <button
                        type="button"
                        style={{ backgroundColor: settings.primary_color }}
                        className={`px-3 py-1.5 text-white font-bold text-[11px] transition shadow-xs ${
                          settings.button_style === 'pill'
                            ? 'rounded-full'
                            : settings.button_style === 'square'
                            ? 'rounded-none'
                            : 'rounded-lg'
                        }`}
                      >
                        Pesan
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: METODE PEMBAYARAN & QRIS */}
          {/* ========================================================= */}
          {activeTab === 'payments' && (
            <div className="max-w-5xl space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
                  <div>
                    <h3 className="text-base font-extrabold text-neutral-900 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-800" />
                      Pengaturan Metode Pembayaran & QRIS
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">
                      Atur barcode QRIS toko, nomor rekening bank, dan nomor e-wallet yang tampil pada halaman checkout buku menu pelanggan.
                    </p>
                  </div>
                  <span className="text-xs bg-amber-50 text-amber-900 font-bold px-3 py-1.5 rounded-xl border border-amber-200 self-start sm:self-auto">
                    Multi-Payment Aktif
                  </span>
                </div>

                <form onSubmit={handleSavePaymentSettings} className="pt-5 space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* KOLOM KIRI: FORM PENGATURAN */}
                    <div className="lg:col-span-7 space-y-5 text-xs">
                      {/* 1. KARTU PENGATURAN QRIS */}
                      <div className="p-4 bg-red-50/40 rounded-2xl border border-red-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-red-600 text-white rounded-lg">
                              <QrCode className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-neutral-900 block text-xs">QRIS (Standar Pembayaran Nasional)</span>
                              <span className="text-[10px] text-neutral-500">Mendukung GoPay, OVO, DANA, BCA, Mandiri, BRI, dll</span>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={paymentForm.qris_enabled}
                              onChange={(e) => setPaymentForm({ ...paymentForm, qris_enabled: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                          </label>
                        </div>

                        {paymentForm.qris_enabled && (
                          <div className="space-y-3 pt-2 border-t border-red-200/60">
                            <div>
                              <label className="block font-semibold text-neutral-700 mb-1">Nama Merchant / Toko di QRIS *</label>
                              <input
                                type="text"
                                required
                                placeholder="Contoh: Warkop Nusantara"
                                value={paymentForm.qris_merchant_name}
                                onChange={(e) => setPaymentForm({ ...paymentForm, qris_merchant_name: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-neutral-700 mb-1">NMID (National Merchant ID)</label>
                              <input
                                type="text"
                                placeholder="Contoh: ID1020261928374"
                                value={paymentForm.qris_nmid}
                                onChange={(e) => setPaymentForm({ ...paymentForm, qris_nmid: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
                              />
                            </div>

                            {/* Upload Foto QRIS Langsung dari Galeri HP / Komputer */}
                            <div className="space-y-2">
                              <label className="block font-bold text-neutral-800 text-xs">
                                Foto / Gambar Barcode QRIS Toko
                              </label>

                              {/* Dropzone Box Upload Foto */}
                              <div className="p-4 bg-gradient-to-b from-red-50/40 to-white rounded-2xl border-2 border-dashed border-red-300 hover:border-red-500 transition">
                                <div className="flex flex-col items-center text-center gap-2">
                                  {(selectedQrisFile || paymentForm.qris_image_url) ? (
                                    <div className="flex flex-col items-center gap-3 w-full">
                                      <div className="relative p-2 bg-white rounded-2xl shadow-md border border-neutral-200">
                                        <img
                                          src={
                                            selectedQrisFile
                                              ? URL.createObjectURL(selectedQrisFile)
                                              : paymentForm.qris_image_url
                                          }
                                          alt="Preview QRIS Terpasang"
                                          className="w-32 h-32 object-contain rounded-xl"
                                        />
                                        <div className="absolute -top-2 -right-2 bg-emerald-600 text-white rounded-full p-1 shadow">
                                          <Check className="w-3.5 h-3.5" />
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-xs font-bold text-neutral-800 block">
                                          {selectedQrisFile ? selectedQrisFile.name : 'Foto QRIS Toko Aktif'}
                                        </span>
                                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold inline-block">
                                          {selectedQrisFile ? '✓ Foto Baru Siap Disimpan' : '✓ Sedang Ditampilkan ke Pelanggan'}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 pt-1">
                                        <label className="py-1.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold cursor-pointer border border-neutral-300 transition">
                                          <span>Ganti Foto Lain</span>
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={(e) => setSelectedQrisFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedQrisFile(null);
                                            setPaymentForm({ ...paymentForm, qris_image_url: '' });
                                          }}
                                          className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold cursor-pointer border border-rose-200 transition"
                                        >
                                          Hapus Foto
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                                        <Upload className="w-6 h-6" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-bold text-neutral-900">
                                          Upload Foto QRIS Toko Anda
                                        </p>
                                        <p className="text-[11px] text-neutral-500 mt-0.5">
                                          Pilih foto / screenshot barcode QRIS dari galeri HP atau folder laptop
                                        </p>
                                      </div>
                                      <label className="mt-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-red-600/20 transition flex items-center gap-1.5">
                                        <Upload className="w-3.5 h-3.5" />
                                        <span>Pilih Foto QRIS (JPG, PNG, WebP)</span>
                                        <input
                                          type="file"
                                          accept="image/jpeg,image/png,image/webp"
                                          onChange={(e) => setSelectedQrisFile(e.target.files?.[0] || null)}
                                          className="hidden"
                                        />
                                      </label>
                                      <p className="text-[10px] text-neutral-400 mt-1">
                                        💡 Jika tidak ada foto, web akan otomatis membuatkan kode QR digital sendiri menggunakan NMID di atas.
                                      </p>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. KARTU BAYAR TUNAI */}
                      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-neutral-700 text-white rounded-lg">
                            <Banknote className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 block text-xs">Tunai di Kasir</span>
                            <span className="text-[10px] text-neutral-500">Pelanggan membayar langsung dengan uang tunai saat disajikan / ke kasir</span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={paymentForm.cash_enabled}
                            onChange={(e) => setPaymentForm({ ...paymentForm, cash_enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-800"></div>
                        </label>
                      </div>

                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={isSubmittingPayment || isUploadingQris}
                          className="w-full py-3 px-5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 transition cursor-pointer disabled:opacity-50 text-xs"
                        >
                          {isSubmittingPayment || isUploadingQris ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {isUploadingQris ? 'Mengunggah Foto QRIS...' : 'Menyimpan Pengaturan...'}
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Simpan Pengaturan Pembayaran
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* KOLOM KANAN: LIVE PREVIEW QRIS */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs">
                        <h4 className="font-bold text-neutral-800 mb-3 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-amber-800" />
                          Live Preview QRIS Toko
                        </h4>

                        <div className="p-4 bg-white rounded-2xl border-2 border-red-500/40 shadow-sm space-y-3">
                          {/* Top QRIS Banner */}
                          <div className="flex items-center justify-between border-b border-red-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded tracking-wider">
                                QRIS
                              </span>
                              <div>
                                <span className="font-bold text-neutral-900 block text-[11px] uppercase truncate max-w-[140px]">
                                  {paymentForm.qris_merchant_name || business.name}
                                </span>
                                <span className="text-[9px] font-mono text-neutral-400">
                                  {paymentForm.qris_nmid || 'ID1020261928374'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">
                              Aktif
                            </span>
                          </div>

                          {/* Preview Barcode */}
                          <div className="flex flex-col items-center justify-center p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                            {(selectedQrisFile || paymentForm.qris_image_url || qrisPreviewUrl) ? (
                              <img
                                src={
                                  selectedQrisFile
                                    ? URL.createObjectURL(selectedQrisFile)
                                    : paymentForm.qris_image_url || qrisPreviewUrl
                                }
                                alt="Preview QRIS"
                                className="w-40 h-40 object-contain rounded-lg"
                              />
                            ) : (
                              <div className="w-40 h-40 flex items-center justify-center bg-neutral-200 rounded-lg">
                                <QrCode className="w-12 h-12 text-neutral-400" />
                              </div>
                            )}
                            <div className="mt-2 text-center">
                              <span className="text-[10px] text-neutral-400 block">Contoh Scan Nominal:</span>
                              <span className="text-xs font-black text-neutral-900 font-mono">Rp 35.000</span>
                            </div>
                          </div>

                          <div className="text-[10px] text-neutral-500 text-center leading-tight">
                            Barcode ini langsung muncul di keranjang pelanggan saat mereka memilih metode pembayaran <strong>QRIS</strong>.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: PENGATURAN AKUN & GANTI PASSWORD */}
          {/* ========================================================= */}
          {activeTab === 'account' && (
            <div className="max-w-3xl space-y-6">
              {/* Form Edit Profil Pemilik (Owner Profile) */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center font-bold text-base shadow-inner">
                      {userProfile.full_name ? userProfile.full_name.slice(0, 2).toUpperCase() : 'OW'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-neutral-900">{userProfile.full_name}</h3>
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-extrabold rounded-full uppercase tracking-wider border border-amber-300">
                          {userProfile.role}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">{userProfile.email}</p>
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 self-start sm:self-auto">
                    <CheckCircle className="w-4 h-4 text-emerald-600" /> Akun Terverifikasi
                  </div>
                </div>

                <div className="pt-4">
                  <h4 className="text-sm font-bold text-neutral-900 mb-1">Ubah Data Pemilik Toko</h4>
                  <p className="text-xs text-neutral-500 mb-4">
                    Perbarui nama pemilik dan alamat email untuk keperluan login serta administrasi toko Anda.
                  </p>

                  {profileSuccessMessage && (
                    <div className="p-3 mb-4 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{profileSuccessMessage}</span>
                    </div>
                  )}

                  {profileErrorMessage && (
                    <div className="p-3 mb-4 rounded-xl text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{profileErrorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Nama Lengkap Pemilik (Owner) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Fadil Anugrah"
                        value={profileForm.full_name}
                        onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                        className="w-full max-w-md px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Alamat Email Login *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="Contoh: owner.warkop@email.com"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        className="w-full max-w-md px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800 font-medium"
                      />
                      <p className="text-[10px] text-neutral-400 mt-1">
                        Email ini yang digunakan untuk login ke Admin Dashboard bersama password Anda.
                      </p>
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-700 mb-1">
                        Nomor Handphone / WhatsApp Pemilik
                      </label>
                      <input
                        type="tel"
                        placeholder="Contoh: 081234567890"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full max-w-md px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-neutral-800 font-medium"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmittingProfile}
                        className="py-2.5 px-5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold flex items-center gap-2 shadow-md transition cursor-pointer text-xs disabled:opacity-50"
                      >
                        {isSubmittingProfile ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Menyimpan Profil...
                          </>
                        ) : (
                          'Simpan Perubahan Profil Pemilik'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Ganti Password Form */}
              <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-2 bg-neutral-100 text-neutral-800 rounded-xl">
                    <KeyRound className="w-5 h-5 text-amber-800" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Ganti Password Akun</h3>
                    <p className="text-[11px] text-neutral-500">
                      Perbarui kata sandi Anda secara berkala untuk menjaga keamanan data usaha Anda.
                    </p>
                  </div>
                </div>

                <div className="p-3 my-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    Operasi penggantian password diproses dan dienkripsi secara aman oleh Express backend menggunakan <strong>bcrypt hashing</strong>. Password plaintext tidak pernah disimpan di database atau diekspos ke frontend.
                  </div>
                </div>

                {passwordSuccessMessage && (
                  <div className="p-3 mb-4 rounded-xl text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{passwordSuccessMessage}</span>
                  </div>
                )}

                {passwordErrorMessage && (
                  <div className="p-3 mb-4 rounded-xl text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{passwordErrorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4 text-xs mt-4">
                  {/* Password Saat Ini */}
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Password Saat Ini *
                    </label>
                    <div className="relative max-w-md">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        required
                        placeholder="Masukkan password Anda sekarang"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 pr-10 text-neutral-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title={showCurrentPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Baru */}
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Password Baru *
                    </label>
                    <div className="relative max-w-md">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        placeholder="Minimal 8 karakter"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 pr-10 text-neutral-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title={showNewPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Konfirmasi Password Baru */}
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1">
                      Konfirmasi Password Baru *
                    </label>
                    <div className="relative max-w-md">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        placeholder="Ulangi password baru Anda"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 pr-10 text-neutral-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title={showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Validation Indicators */}
                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 max-w-md space-y-1.5 text-[11px]">
                    <span className="font-semibold text-neutral-600 block mb-1">Kriteria Keamanan:</span>
                    <div className={`flex items-center gap-1.5 ${passwordForm.newPassword.length >= 8 ? 'text-emerald-600 font-semibold' : 'text-neutral-400'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Minimal 8 karakter</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordForm.newPassword && passwordForm.currentPassword && passwordForm.newPassword !== passwordForm.currentPassword ? 'text-emerald-600 font-semibold' : 'text-neutral-400'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Berbeda dari password saat ini</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${passwordForm.newPassword && passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword ? 'text-emerald-600 font-semibold' : 'text-neutral-400'}`}>
                      <Check className="w-3.5 h-3.5" />
                      <span>Password baru dan konfirmasi cocok</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingPassword}
                      className="py-2.5 px-6 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold flex items-center gap-2 shadow-md shadow-amber-900/10 transition cursor-pointer text-xs disabled:opacity-50"
                    >
                      {isSubmittingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memproses Penggantian Password...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          Simpan Password Baru
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* MODAL: TAMBAH / EDIT PRODUK DENGAN UPLOAD FOTO KE SUPABASE */}
      {/* ========================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-neutral-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-neutral-900 mb-1">
              {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h3>
            <p className="text-xs text-neutral-500 mb-4">
              Foto produk akan diunggah melalui Express ke Supabase Storage bucket <code>business-assets</code>.
            </p>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              {/* File Upload Foto */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Foto Produk *</label>
                <div className="flex items-center gap-3">
                  {(selectedProductFile || productForm.image_url) && (
                    <img
                      src={
                        selectedProductFile
                          ? URL.createObjectURL(selectedProductFile)
                          : productForm.image_url
                      }
                      alt="Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-neutral-200 shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setSelectedProductFile(e.target.files?.[0] || null)}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400 mt-1">
                      Format: JPEG, PNG, WebP (Maksimal 5MB).
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nama Produk *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kopi Susu Gula Aren"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Kategori Menu</label>
                <select
                  value={productForm.category_id}
                  onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Harga (Rp) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={500}
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">Stok Tersedia</label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Deskripsi Produk</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan bahan atau keistimewaan rasa..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.is_available}
                    onChange={(e) => setProductForm({ ...productForm, is_available: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-800"
                  />
                  <span className="font-semibold text-neutral-700">Status Tersedia untuk Dipesan</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingImage}
                  className="px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  {isUploadingImage ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mengunggah Foto...
                    </>
                  ) : (
                    'Simpan Produk'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: TAMBAH / EDIT KATEGORI */}
      {/* ========================================================= */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative text-neutral-800">
            <h3 className="text-base font-bold text-neutral-900 mb-3">
              {editingCategory ? 'Edit Kategori' : 'Tambah Kategori'}
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              {/* Foto Kategori (Upload File Langsung) */}
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Foto Kategori (Upload File Gambar)
                </label>
                <div className="flex items-center gap-3">
                  {(selectedCategoryFile || categoryForm.image_url) && (
                    <img
                      src={
                        selectedCategoryFile
                          ? URL.createObjectURL(selectedCategoryFile)
                          : categoryForm.image_url
                      }
                      alt="Preview Kategori"
                      className="w-12 h-12 rounded-xl object-cover border border-neutral-200 shrink-0"
                    />
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setSelectedCategoryFile(e.target.files?.[0] || null)}
                      className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200 cursor-pointer"
                    />
                    <p className="text-[10px] text-neutral-400 mt-0.5">
                      Pilih foto dari perangkat (JPG, PNG, WebP maks 5MB)
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Nama Kategori *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Minuman Segar"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">Urutan Tampilan</label>
                <input
                  type="number"
                  value={categoryForm.display_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, display_order: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3.5 py-1.5 text-neutral-600 hover:bg-neutral-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUploadingCategoryImage}
                  className="px-4 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploadingCategoryImage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Mengunggah...
                    </>
                  ) : (
                    'Simpan Kategori'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DETAIL PESANAN & ITEM TRANSAKSI */}
      {/* ========================================================= */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-neutral-800 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-neutral-900">Detail Pesanan</h3>
            <p className="text-xs font-mono text-neutral-500">{selectedOrder.order_number}</p>

            <div className="mt-4 p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-neutral-500">Nama Pelanggan:</span>
                <span className="font-semibold text-neutral-800">{selectedOrder.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">WhatsApp:</span>
                <span className="font-semibold text-neutral-800">{selectedOrder.customer_phone}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Layanan & Meja:</span>
                <span className="font-black text-xs px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg">
                  {selectedOrder.order_type === 'dine_in'
                    ? `🪑 ${selectedOrder.table_number || 'Dine-In'}`
                    : (selectedOrder.order_type === 'take_away' ? '🥡 Take Away' : '🛵 Delivery')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Metode Bayar:</span>
                <span className="font-semibold uppercase text-neutral-800">{selectedOrder.payment_method}</span>
              </div>
              {selectedOrder.customer_note && (
                <div className="pt-1 text-neutral-600 border-t border-neutral-200">
                  <span className="font-semibold">Catatan:</span> {selectedOrder.customer_note}
                </div>
              )}
            </div>

            {/* Item-item pesanan */}
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-bold text-neutral-700">Daftar Item:</h4>
              {(selectedOrder.items || []).map((it, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs p-2 bg-neutral-50 rounded-lg">
                  <div>
                    <span className="font-semibold text-neutral-800 block">
                      {it.quantity}x {it.product_name}
                    </span>
                    {it.item_note && <span className="text-[11px] text-neutral-500 italic block">Note: {it.item_note}</span>}
                  </div>
                  <span className="font-bold text-neutral-900">{formatRupiah(it.subtotal)}</span>
                </div>
              ))}

              <div className="flex justify-between items-center pt-3 border-t border-neutral-200 text-sm font-extrabold text-neutral-900">
                <span>Total Transaksi</span>
                <span className="text-emerald-600">{formatRupiah(selectedOrder.total_amount)}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReceiptOrder(selectedOrder)}
                  className="py-2 px-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Struk
                </button>
                <button
                  onClick={() => handleDeleteOrder(selectedOrder.id, selectedOrder.order_number)}
                  className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  title="Hapus pesanan ini secara permanen"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="py-2 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cetak Struk Kasir Thermal */}
      <ReceiptModal
        order={receiptOrder}
        business={business}
        onClose={() => setReceiptOrder(null)}
      />

      {/* PWA Floating Install Prompt Khusus Admin */}
      <InstallPrompt />
    </div>
  );
};
