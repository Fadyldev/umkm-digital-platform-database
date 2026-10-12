import { Router, Request, Response } from 'express';
import { memoryStore, pool, saveLocalStore } from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

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
 * GET /api/business/:businessId/products
 * Ambil daftar produk untuk suatu bisnis
 */
router.get('/business/:businessId/products', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;
    const { category, available_only } = req.query;

    if (pool) {
      try {
        let sql = 'SELECT * FROM products WHERE business_id = $1';
        const params: any[] = [businessId];

        if (category) {
          params.push(category);
          sql += ` AND category_id = $${params.length}`;
        }

        if (available_only === 'true') {
          sql += ' AND is_available = true';
        }

        sql += ' ORDER BY display_order ASC, name ASC';

        const result = await pool.query(sql, params);
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn('DB error fetching products:', err);
      }
    }

    let prods = memoryStore.products.filter((p) => p.business_id === businessId);

    if (category) {
      prods = prods.filter((p) => p.category_id === category);
    }
    if (available_only === 'true') {
      prods = prods.filter((p) => p.is_available);
    }

    prods.sort((a, b) => a.display_order - b.display_order);

    return res.json({ success: true, data: prods });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat produk.' });
  }
});

/**
 * POST /api/admin/products
 * Tambah produk baru (wajib businessId milik user login)
 */
router.post('/admin/products', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const {
      name,
      description,
      price,
      stock,
      category_id,
      image_url,
      is_available,
      display_order,
    } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nama produk wajib diisi.' });
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Harga harus berupa angka dan minimal 0.' });
    }

    const numStock = stock !== undefined ? Number(stock) : 0;
    const slug = slugify(name) + '-' + Date.now().toString().slice(-4);

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
            description || '',
            numPrice,
            numStock,
            image_url || null,
            is_available !== undefined ? Boolean(is_available) : true,
            Number(display_order) || 0,
          ]
        );

        return res.status(201).json({
          success: true,
          message: 'Produk berhasil ditambahkan.',
          data: insertRes.rows[0],
        });
      } catch (err: any) {
        console.warn('DB error inserting product:', err);
      }
    }

    const newProd = {
      id: `prod-${Date.now()}`,
      business_id: businessId,
      category_id: category_id || null,
      name: name.trim(),
      slug,
      description: description || '',
      price: numPrice,
      stock: numStock,
      image_url: image_url || 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
      is_available: is_available !== undefined ? Boolean(is_available) : true,
      display_order: Number(display_order) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    memoryStore.products.push(newProd);
    saveLocalStore();

    return res.status(201).json({
      success: true,
      message: 'Produk berhasil ditambahkan.',
      data: newProd,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menambahkan produk.' });
  }
});

/**
 * PUT /api/admin/products/:id
 * Edit produk (memastikan milik bisnis user login)
 */
router.put('/admin/products/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { id } = req.params;
    const {
      name,
      description,
      price,
      stock,
      category_id,
      image_url,
      is_available,
      display_order,
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
            description !== undefined ? description : null,
            price !== undefined ? Number(price) : null,
            stock !== undefined ? Number(stock) : null,
            category_id !== undefined ? category_id : null,
            image_url !== undefined ? image_url : null,
            is_available !== undefined ? Boolean(is_available) : null,
            display_order !== undefined ? Number(display_order) : null,
            id,
            businessId,
          ]
        );

        if (updateRes.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Produk tidak ditemukan atau bukan milik bisnis Anda.',
          });
        }

        return res.json({
          success: true,
          message: 'Produk berhasil diperbarui.',
          data: updateRes.rows[0],
        });
      } catch (err) {
        console.warn('DB error updating product:', err);
      }
    }

    const prodIndex = memoryStore.products.findIndex(
      (p) => p.id === id && p.business_id === businessId
    );

    if (prodIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan atau bukan milik bisnis Anda.',
      });
    }

    memoryStore.products[prodIndex] = {
      ...memoryStore.products[prodIndex],
      name: name ? name.trim() : memoryStore.products[prodIndex].name,
      description: description !== undefined ? description : memoryStore.products[prodIndex].description,
      price: price !== undefined ? Number(price) : memoryStore.products[prodIndex].price,
      stock: stock !== undefined ? Number(stock) : memoryStore.products[prodIndex].stock,
      category_id: category_id !== undefined ? category_id : memoryStore.products[prodIndex].category_id,
      image_url: image_url !== undefined ? image_url : memoryStore.products[prodIndex].image_url,
      is_available: is_available !== undefined ? Boolean(is_available) : memoryStore.products[prodIndex].is_available,
      display_order: display_order !== undefined ? Number(display_order) : memoryStore.products[prodIndex].display_order,
      updated_at: new Date().toISOString(),
    };
    saveLocalStore();

    return res.json({
      success: true,
      message: 'Produk berhasil diperbarui.',
      data: memoryStore.products[prodIndex],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui produk.' });
  }
});

/**
 * DELETE /api/admin/products/:id
 * Hapus produk
 */
router.delete('/admin/products/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { id } = req.params;

    if (pool) {
      try {
        const deleteRes = await pool.query(
          'DELETE FROM products WHERE id = $1 AND business_id = $2 RETURNING id',
          [id, businessId]
        );
        if (deleteRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
        }
        return res.json({ success: true, message: 'Produk berhasil dihapus.' });
      } catch (err) {
        console.warn('DB error deleting product:', err);
      }
    }

    const prodIndex = memoryStore.products.findIndex(
      (p) => p.id === id && p.business_id === businessId
    );

    if (prodIndex === -1) {
      return res.status(404).json({ success: false, message: 'Produk tidak ditemukan.' });
    }

    memoryStore.products.splice(prodIndex, 1);
    saveLocalStore();
    return res.json({ success: true, message: 'Produk berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus produk.' });
  }
});

export default router;
