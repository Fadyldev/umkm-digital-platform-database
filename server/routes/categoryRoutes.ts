import { Router, Request, Response } from 'express';
import { memoryStore, pool, saveLocalStore } from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * Helper generate slug sederhana
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * GET /api/business/:businessId/categories
 * Ambil semua kategori untuk bisnis tertentu
 */
router.get('/business/:businessId/categories', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;

    if (pool) {
      try {
        const result = await pool.query(
          'SELECT * FROM categories WHERE business_id = $1 ORDER BY display_order ASC, name ASC',
          [businessId]
        );
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn('DB error fetching categories:', err);
      }
    }

    const cats = memoryStore.categories
      .filter((c) => c.business_id === businessId)
      .sort((a, b) => a.display_order - b.display_order);

    return res.json({ success: true, data: cats });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat kategori.' });
  }
});

/**
 * POST /api/admin/categories
 * Tambah kategori baru oleh admin (terisolasi pada businessId milik user)
 */
router.post('/admin/categories', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { name, description, display_order, is_active, image_url } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi.' });
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
            description || '',
            Number(display_order) || 0,
            is_active !== undefined ? Boolean(is_active) : true,
            image_url || null,
          ]
        );
        return res.status(201).json({
          success: true,
          message: 'Kategori berhasil ditambahkan.',
          data: insertRes.rows[0],
        });
      } catch (err: any) {
        if (err.code === '23505') {
          return res.status(400).json({
            success: false,
            message: 'Kategori dengan nama atau slug serupa sudah ada di bisnis Anda.',
          });
        }
        console.warn('DB error creating category:', err);
      }
    }

    // Fallback store
    const newCategory = {
      id: `cat-${Date.now()}`,
      business_id: businessId,
      name: name.trim(),
      slug,
      description: description || '',
      image_url: image_url || null,
      display_order: Number(display_order) || 0,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryStore.categories.push(newCategory);
    saveLocalStore();

    return res.status(201).json({
      success: true,
      message: 'Kategori berhasil ditambahkan.',
      data: newCategory,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan kategori.' });
  }
});

/**
 * PUT /api/admin/categories/:id
 * Edit kategori (memastikan milik bisnis user yang login)
 */
router.put('/admin/categories/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
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
            description !== undefined ? description : null,
            display_order !== undefined ? Number(display_order) : null,
            is_active !== undefined ? Boolean(is_active) : null,
            image_url !== undefined ? image_url : null,
            id,
            businessId,
          ]
        );

        if (updateRes.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Kategori tidak ditemukan atau Anda tidak berhak mengubahnya.',
          });
        }

        return res.json({
          success: true,
          message: 'Kategori berhasil diperbarui.',
          data: updateRes.rows[0],
        });
      } catch (err) {
        console.warn('DB error updating category:', err);
      }
    }

    const catIndex = memoryStore.categories.findIndex(
      (c) => c.id === id && c.business_id === businessId
    );

    if (catIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan atau bukan milik bisnis Anda.',
      });
    }

    memoryStore.categories[catIndex] = {
      ...memoryStore.categories[catIndex],
      name: name ? name.trim() : memoryStore.categories[catIndex].name,
      description: description !== undefined ? description : memoryStore.categories[catIndex].description,
      image_url: image_url !== undefined ? image_url : memoryStore.categories[catIndex].image_url,
      display_order: display_order !== undefined ? Number(display_order) : memoryStore.categories[catIndex].display_order,
      is_active: is_active !== undefined ? Boolean(is_active) : memoryStore.categories[catIndex].is_active,
      updated_at: new Date().toISOString(),
    };
    saveLocalStore();

    return res.json({
      success: true,
      message: 'Kategori berhasil diperbarui.',
      data: memoryStore.categories[catIndex],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui kategori.' });
  }
});

/**
 * DELETE /api/admin/categories/:id
 * Hapus kategori
 */
router.delete('/admin/categories/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { id } = req.params;

    if (pool) {
      try {
        const deleteRes = await pool.query(
          'DELETE FROM categories WHERE id = $1 AND business_id = $2 RETURNING id',
          [id, businessId]
        );
        if (deleteRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
        }
        return res.json({ success: true, message: 'Kategori berhasil dihapus.' });
      } catch (err) {
        console.warn('DB error deleting category:', err);
      }
    }

    const catIndex = memoryStore.categories.findIndex(
      (c) => c.id === id && c.business_id === businessId
    );

    if (catIndex === -1) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan.' });
    }

    memoryStore.categories.splice(catIndex, 1);
    saveLocalStore();
    return res.json({ success: true, message: 'Kategori berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus kategori.' });
  }
});

export default router;
