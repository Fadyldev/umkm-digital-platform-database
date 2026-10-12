import { Router, Request, Response } from 'express';
import { memoryStore, pool, Order, OrderItem, saveLocalOrders } from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * POST /api/orders
 * Customer membuat pesanan publik.
 * KEAMANAN KRUSIAL:
 * Express menghitung ulang total harga berdasarkan data asli di database.
 * Total harga & harga per item dari frontend TIDAK DIPERCAYAI.
 */
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const {
      business_id,
      customer_name,
      customer_phone,
      customer_note,
      order_type = 'dine_in',
      table_number,
      payment_method = 'cash',
      items,
    } = req.body;

    if (!business_id) {
      return res.status(400).json({ success: false, message: 'ID Bisnis wajib ditentukan.' });
    }

    if (!customer_name || customer_name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi.' });
    }

    if (!customer_phone || customer_phone.trim() === '') {
      return res.status(400).json({ success: false, message: 'Nomor WhatsApp/Telepon pelanggan wajib diisi.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Keranjang belanja tidak boleh kosong.' });
    }

    // 1. Validasi produk & hitung ulang total secara otoritatif di server
    let computedTotal = 0;
    const validatedItems: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      price: number;
      subtotal: number;
      item_note: string;
    }> = [];

    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const item of items) {
          const qty = Math.max(1, Number(item.quantity) || 1);
          const pRes = await client.query(
            'SELECT id, name, price, is_available, stock FROM products WHERE id = $1 AND business_id = $2',
            [item.product_id, business_id]
          );

          if (pRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              message: `Produk dengan ID ${item.product_id} tidak ditemukan pada bisnis ini.`,
            });
          }

          const dbProd = pRes.rows[0];
          if (!dbProd.is_available) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              message: `Mohon maaf, produk '${dbProd.name}' sedang tidak tersedia.`,
            });
          }

          const actualPrice = Number(dbProd.price);
          const itemSubtotal = actualPrice * qty;
          computedTotal += itemSubtotal;

          validatedItems.push({
            product_id: dbProd.id,
            product_name: dbProd.name,
            quantity: qty,
            price: actualPrice,
            subtotal: itemSubtotal,
            item_note: item.item_note || '',
          });
        }

        const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        let orderInsertRes;
        try {
          orderInsertRes = await client.query(
            `INSERT INTO orders 
             (order_number, business_id, customer_name, customer_phone, customer_note, order_type, table_number, total_amount, status, payment_status, payment_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'unpaid', $9)
             RETURNING *`,
            [
              orderNumber,
              business_id,
              customer_name.trim(),
              customer_phone.trim(),
              customer_note || '',
              order_type,
              table_number || null,
              computedTotal,
              payment_method,
            ]
          );
        } catch (insertColErr: any) {
          // Self-healing: jika kolom customer_note atau kolom lainnya belum ada di skema PostgreSQL lama
          if (insertColErr.message?.includes('customer_note') || insertColErr.code === '42703') {
            console.warn('⚠️ Mendeteksi kolom belum lengkap pada tabel orders, menjalankan auto-patch kolom...');
            await client.query(`
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_note TEXT;
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) DEFAULT 'dine_in';
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_number VARCHAR(20);
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0;
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
              ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30) DEFAULT 'cash';
            `);
            orderInsertRes = await client.query(
              `INSERT INTO orders 
               (order_number, business_id, customer_name, customer_phone, customer_note, order_type, table_number, total_amount, status, payment_status, payment_method)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'unpaid', $9)
               RETURNING *`,
              [
                orderNumber,
                business_id,
                customer_name.trim(),
                customer_phone.trim(),
                customer_note || '',
                order_type,
                table_number || null,
                computedTotal,
                payment_method,
              ]
            );
          } else {
            throw insertColErr;
          }
        }

        const createdOrder = orderInsertRes.rows[0];

        // Masukkan item ke order_items dengan self-healing
        for (const vi of validatedItems) {
          try {
            await client.query(
              `INSERT INTO order_items 
               (order_id, product_id, product_name, quantity, price, subtotal, item_note)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                createdOrder.id,
                vi.product_id,
                vi.product_name,
                vi.quantity,
                vi.price,
                vi.subtotal,
                vi.item_note,
              ]
            );
          } catch (itemColErr: any) {
            if (
              itemColErr.message?.includes('item_note') ||
              itemColErr.message?.includes('product_price') ||
              itemColErr.code === '42703' ||
              itemColErr.code === '23502'
            ) {
              await client.query(`
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_note TEXT;
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0;
                ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) DEFAULT 0;
                DO $$
                BEGIN
                  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='product_price') THEN
                    ALTER TABLE order_items ALTER COLUMN product_price DROP NOT NULL;
                    ALTER TABLE order_items ALTER COLUMN product_price SET DEFAULT 0;
                  END IF;
                END $$;
              `);
              await client.query(
                `INSERT INTO order_items 
                 (order_id, product_id, product_name, quantity, price, subtotal, item_note)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  createdOrder.id,
                  vi.product_id,
                  vi.product_name,
                  vi.quantity,
                  vi.price,
                  vi.subtotal,
                  vi.item_note,
                ]
              );
            } else {
              throw itemColErr;
            }
          }
        }

        await client.query('COMMIT');

        // Simpan juga ke cache lokal agar selalu sinkron
        memoryStore.orders.unshift({
          ...createdOrder,
          items: validatedItems,
        });
        saveLocalOrders();

        return res.status(201).json({
          success: true,
          message: 'Pesanan Anda berhasil dikirim!',
          data: {
            ...createdOrder,
            items: validatedItems,
          },
        });
      } catch (dbErr: any) {
        await client.query('ROLLBACK');
        console.error('DB transaction error creating order:', dbErr);
        // Fallback: jangan tolak pesanan customer jika ada issue database sekunder
        console.warn('⚠️ Mengalihkan penyimpanan pesanan ke cache lokal terisolasi agar transaksi pelanggan tidak gagal.');
      } finally {
        client.release();
      }
    }

    // Fallback store processing
    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const dbProd = memoryStore.products.find(
        (p) => p.id === item.product_id && p.business_id === business_id
      );

      if (!dbProd) {
        return res.status(400).json({
          success: false,
          message: `Produk tidak ditemukan pada bisnis ini.`,
        });
      }

      if (!dbProd.is_available) {
        return res.status(400).json({
          success: false,
          message: `Produk '${dbProd.name}' sedang tidak tersedia.`,
        });
      }

      const actualPrice = dbProd.price;
      const subtotal = actualPrice * qty;
      computedTotal += subtotal;

      validatedItems.push({
        product_id: dbProd.id,
        product_name: dbProd.name,
        quantity: qty,
        price: actualPrice,
        subtotal,
        item_note: item.item_note || '',
      });
    }

    const orderId = `ord-${Date.now()}`;
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      business_id,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_note: customer_note || '',
      order_type,
      table_number: table_number || undefined,
      total_amount: computedTotal,
      status: 'pending',
      payment_status: 'unpaid',
      payment_method,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: validatedItems.map((vi, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        order_id: orderId,
        product_id: vi.product_id,
        product_name: vi.product_name,
        quantity: vi.quantity,
        price: vi.price,
        subtotal: vi.subtotal,
        item_note: vi.item_note,
        created_at: new Date().toISOString(),
      })),
    };

    memoryStore.orders.unshift(newOrder);
    saveLocalOrders();

    return res.status(201).json({
      success: true,
      message: 'Pesanan Anda berhasil dikirim!',
      data: newOrder,
    });
  } catch (error: any) {
    console.error('Error in POST /api/orders:', error);
    return res.status(500).json({ success: false, message: 'Gagal memproses pesanan.' });
  }
});

/**
 * GET /api/public/orders/:id
 * Cek status pesanan secara publik (untuk pelacakan verifikasi pembayaran pelanggan)
 */
router.get('/public/orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (pool) {
      try {
        const orderRes = await pool.query(
          `SELECT o.*, 
            COALESCE(json_agg(
              json_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'price', oi.price,
                'subtotal', oi.subtotal,
                'item_note', oi.item_note
              )
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.id = $1 OR o.order_number = $1
          GROUP BY o.id`,
          [id]
        );
        if (orderRes.rows.length > 0) {
          return res.json({ success: true, data: orderRes.rows[0] });
        }
      } catch (dbErr) {
        console.warn('DB error in public get order, checking memory store:', dbErr);
      }
    }

    const order = memoryStore.orders.find((o) => o.id === id || o.order_number === id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }
    return res.json({ success: true, data: order });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal mengecek pesanan.' });
  }
});

/**
 * POST /api/public/orders/:id/confirm-payment
 * Pelanggan mengonfirmasi sudah melakukan pembayaran QRIS di web
 */
router.post('/public/orders/:id/confirm-payment', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();

    if (pool) {
      try {
        await pool.query(
          `UPDATE orders 
           SET updated_at = $1 
           WHERE id = $2 OR order_number = $2`,
          [now, id]
        );
      } catch (dbErr) {
        console.warn('DB error in confirm payment:', dbErr);
      }
    }

    const order = memoryStore.orders.find((o) => o.id === id || o.order_number === id);
    if (order) {
      order.updated_at = now;
      saveLocalOrders();
      return res.json({ success: true, message: 'Konfirmasi pembayaran berhasil dicatat!', data: order });
    }
    return res.json({ success: true, message: 'Konfirmasi pembayaran berhasil dicatat!' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Gagal konfirmasi pembayaran.' });
  }
});

/**
 * GET /api/admin/orders
 * Ambil daftar pesanan untuk bisnis yang sedang login
 */
router.get('/admin/orders', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { status } = req.query;

    if (pool) {
      try {
        let sql = `
          SELECT o.*, 
            COALESCE(json_agg(
              json_build_object(
                'id', oi.id,
                'product_name', oi.product_name,
                'quantity', oi.quantity,
                'price', oi.price,
                'subtotal', oi.subtotal,
                'item_note', oi.item_note
              )
            ) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.business_id = $1
        `;
        const params: any[] = [businessId];

        if (status) {
          params.push(status);
          sql += ` AND o.status = $${params.length}`;
        }

        sql += ' GROUP BY o.id ORDER BY o.created_at DESC';

        const result = await pool.query(sql, params);
        return res.json({ success: true, data: result.rows });
      } catch (err) {
        console.warn('DB error fetching orders:', err);
      }
    }

    let ords = memoryStore.orders.filter((o) => o.business_id === businessId);
    if (status) {
      ords = ords.filter((o) => o.status === status);
    }

    return res.json({ success: true, data: ords });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat daftar pesanan.' });
  }
});

/**
 * GET /api/admin/orders/:id
 * Detail pesanan beserta item-item transaksinya
 */
router.get('/admin/orders/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { id } = req.params;

    if (pool) {
      try {
        const orderRes = await pool.query(
          'SELECT * FROM orders WHERE id = $1 AND business_id = $2',
          [id, businessId]
        );
        if (orderRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
        }

        const itemsRes = await pool.query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [id]
        );

        return res.json({
          success: true,
          data: {
            ...orderRes.rows[0],
            items: itemsRes.rows,
          },
        });
      } catch (err) {
        console.warn('DB error fetching order by id:', err);
      }
    }

    const order = memoryStore.orders.find(
      (o) => o.id === id && o.business_id === businessId
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat detail pesanan.' });
  }
});

/**
 * PUT /api/admin/orders/:id/status
 * Ubah status pesanan dan/atau status pembayaran
 */
router.put('/admin/orders/:id/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { id } = req.params;
    const { status, payment_status } = req.body;

    if (pool) {
      try {
        const updateRes = await pool.query(
          `UPDATE orders
           SET status = COALESCE($1, status),
               payment_status = COALESCE($2, payment_status),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 AND business_id = $4
           RETURNING *`,
          [status || null, payment_status || null, id, businessId]
        );

        if (updateRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
        }

        return res.json({
          success: true,
          message: 'Status pesanan berhasil diperbarui.',
          data: updateRes.rows[0],
        });
      } catch (err) {
        console.warn('DB error updating order status:', err);
      }
    }

    const ordIndex = memoryStore.orders.findIndex(
      (o) => o.id === id && o.business_id === businessId
    );

    if (ordIndex === -1) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    memoryStore.orders[ordIndex] = {
      ...memoryStore.orders[ordIndex],
      status: status || memoryStore.orders[ordIndex].status,
      payment_status: payment_status || memoryStore.orders[ordIndex].payment_status,
      updated_at: new Date().toISOString(),
    };
    saveLocalOrders();

    return res.json({
      success: true,
      message: 'Status pesanan berhasil diperbarui.',
      data: memoryStore.orders[ordIndex],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status pesanan.' });
  }
});

/**
 * DELETE /api/admin/orders/:id
 * Hapus pesanan satuan (misal pesanan testing, batal, atau salah input)
 */
router.delete('/admin/orders/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { id } = req.params;

    if (pool) {
      try {
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [id]);
        const delRes = await pool.query(
          'DELETE FROM orders WHERE id = $1 AND business_id = $2 RETURNING id, order_number',
          [id, businessId]
        );
        if (delRes.rows.length === 0) {
          return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
        }
        return res.json({
          success: true,
          message: `Pesanan #${delRes.rows[0].order_number} berhasil dihapus.`,
        });
      } catch (err) {
        console.warn('DB error deleting order:', err);
      }
    }

    const ordIndex = memoryStore.orders.findIndex(
      (o) => o.id === id && o.business_id === businessId
    );

    if (ordIndex === -1) {
      return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
    }

    const deletedOrder = memoryStore.orders.splice(ordIndex, 1)[0];
    saveLocalOrders();
    return res.json({
      success: true,
      message: `Pesanan #${deletedOrder.order_number} berhasil dihapus.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal menghapus pesanan.' });
  }
});

/**
 * POST /api/admin/orders/clear
 * Bersihkan riwayat pesanan (mode: 'completed' untuk pesanan selesai/batal saja, atau 'all' untuk reset total)
 */
router.post('/admin/orders/clear', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const { mode } = req.body; // 'completed' | 'all'

    if (pool) {
      try {
        if (mode === 'completed') {
          await pool.query(
            `DELETE FROM order_items WHERE order_id IN (
               SELECT id FROM orders WHERE business_id = $1 AND status IN ('completed', 'cancelled')
             )`,
            [businessId]
          );
          const delRes = await pool.query(
            `DELETE FROM orders WHERE business_id = $1 AND status IN ('completed', 'cancelled')`,
            [businessId]
          );
          return res.json({
            success: true,
            message: `${delRes.rowCount || 0} pesanan riwayat (selesai/batal) berhasil dibersihkan.`,
          });
        } else {
          await pool.query(
            `DELETE FROM order_items WHERE order_id IN (
               SELECT id FROM orders WHERE business_id = $1
             )`,
            [businessId]
          );
          const delRes = await pool.query(
            `DELETE FROM orders WHERE business_id = $1`,
            [businessId]
          );
          return res.json({
            success: true,
            message: `Seluruh riwayat pesanan (${delRes.rowCount || 0} pesanan) berhasil direset bersih.`,
          });
        }
      } catch (err) {
        console.warn('DB error clearing orders:', err);
      }
    }

    let deletedCount = 0;
    if (mode === 'completed') {
      const initialLen = memoryStore.orders.length;
      memoryStore.orders = memoryStore.orders.filter(
        (o) => !(o.business_id === businessId && (o.status === 'completed' || o.status === 'cancelled'))
      );
      deletedCount = initialLen - memoryStore.orders.length;
      saveLocalOrders();
      return res.json({
        success: true,
        message: `${deletedCount} pesanan selesai/batal berhasil dibersihkan.`,
      });
    } else {
      const initialLen = memoryStore.orders.length;
      memoryStore.orders = memoryStore.orders.filter((o) => o.business_id !== businessId);
      deletedCount = initialLen - memoryStore.orders.length;
      saveLocalOrders();
      return res.json({
        success: true,
        message: `Seluruh riwayat pesanan (${deletedCount} pesanan) berhasil direset bersih.`,
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal membersihkan riwayat pesanan.' });
  }
});

export default router;
