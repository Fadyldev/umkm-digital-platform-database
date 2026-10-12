import { Router, Request, Response } from 'express';
import { memoryStore, pool, saveLocalStore } from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/businesses
 * List semua bisnis yang aktif (memudahkan discovery dan demo multi-tenant)
 */
router.get('/businesses', async (req: Request, res: Response) => {
  try {
    if (pool) {
      try {
        const result = await pool.query(
          'SELECT id, name, slug, description, logo_url, phone, address FROM businesses WHERE is_active = true ORDER BY name ASC'
        );
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn('DB error fetching businesses:', err);
      }
    }

    const list = memoryStore.businesses
      .filter((b) => b.is_active)
      .map(({ id, name, slug, description, logo_url, phone, address }) => ({
        id,
        name,
        slug,
        description,
        logo_url,
        phone,
        address,
      }));

    return res.json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil daftar bisnis.' });
  }
});

/**
 * GET /api/business/:slug
 * Mengambil data publik bisnis berdasarkan slug (lengkap dengan settings, kategori, dan produk aktif)
 */
router.get('/business/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    let business: any = null;
    let settings: any = null;
    let categories: any[] = [];
    let products: any[] = [];

    if (pool) {
      try {
        const bRes = await pool.query('SELECT * FROM businesses WHERE slug = $1 AND is_active = true LIMIT 1', [slug]);
        if (bRes.rows.length > 0) {
          business = bRes.rows[0];
          const sRes = await pool.query('SELECT * FROM settings WHERE business_id = $1 LIMIT 1', [business.id]);
          settings = sRes.rows[0] || null;

          const cRes = await pool.query(
            'SELECT * FROM categories WHERE business_id = $1 AND is_active = true ORDER BY display_order ASC, name ASC',
            [business.id]
          );
          categories = cRes.rows;

          const pRes = await pool.query(
            'SELECT * FROM products WHERE business_id = $1 AND is_available = true ORDER BY display_order ASC, name ASC',
            [business.id]
          );
          products = pRes.rows;
        }
      } catch (err) {
        console.warn('DB error fetching business by slug:', err);
      }
    }

    if (!business) {
      business = memoryStore.businesses.find((b) => b.slug === slug && b.is_active);
      if (business) {
        settings = memoryStore.settings.find((s) => s.business_id === business.id) || null;
        categories = memoryStore.categories
          .filter((c) => c.business_id === business.id && c.is_active)
          .sort((a, b) => a.display_order - b.display_order);
        products = memoryStore.products
          .filter((p) => p.business_id === business.id && p.is_available)
          .sort((a, b) => a.display_order - b.display_order);
      }
    }

    if (!business) {
      return res.status(404).json({
        success: false,
        message: `Bisnis dengan URL '${slug}' tidak ditemukan atau sedang nonaktif.`,
      });
    }

    return res.json({
      success: true,
      data: {
        business,
        settings,
        categories,
        products,
      },
    });
  } catch (error) {
    console.error('Error fetching business by slug:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data katalog bisnis.' });
  }
});

/**
 * PUT /api/admin/business
 * Update profil bisnis (hanya pemilik/admin bisnis bersangkutan)
 */
router.put('/admin/business', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const {
      name,
      description,
      phone,
      whatsapp,
      address,
      google_maps_url,
      opening_hours,
      logo_url,
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nama bisnis tidak boleh kosong.' });
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
            description || '',
            phone || '',
            whatsapp || '',
            address || '',
            google_maps_url || '',
            typeof opening_hours === 'object' ? JSON.stringify(opening_hours) : opening_hours,
            logo_url || null,
            businessId,
          ]
        );

        if (updateRes.rows.length > 0) {
          return res.json({
            success: true,
            message: 'Profil bisnis berhasil diperbarui.',
            data: updateRes.rows[0],
          });
        }
      } catch (err) {
        console.warn('DB error updating business:', err);
      }
    }

    const bIndex = memoryStore.businesses.findIndex((b) => b.id === businessId);
    if (bIndex === -1) {
      return res.status(404).json({ success: false, message: 'Bisnis tidak ditemukan.' });
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
      updated_at: new Date().toISOString(),
    };
    saveLocalStore();

    return res.json({
      success: true,
      message: 'Profil bisnis berhasil diperbarui.',
      data: memoryStore.businesses[bIndex],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui profil bisnis.' });
  }
});

export default router;
