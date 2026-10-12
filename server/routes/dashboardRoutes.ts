import { Router, Request, Response } from 'express';
import { memoryStore, pool } from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/admin/dashboard
 * Ringkasan statistik untuk dashboard admin toko bersangkutan
 */
router.get('/admin/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;

    if (pool) {
      try {
        const prodCountRes = await pool.query(
          'SELECT COUNT(*) as count FROM products WHERE business_id = $1',
          [businessId]
        );
        const catCountRes = await pool.query(
          'SELECT COUNT(*) as count FROM categories WHERE business_id = $1',
          [businessId]
        );
        const orderStatsRes = await pool.query(
          `SELECT 
             COUNT(*) as total_orders,
             COALESCE(SUM(CASE WHEN payment_status = 'paid' OR status = 'completed' THEN total_amount ELSE 0 END), 0) as total_revenue,
             COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
             COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END) as today_orders,
             COALESCE(SUM(CASE WHEN (payment_status = 'paid' OR status = 'completed') AND DATE(created_at) = CURRENT_DATE THEN total_amount ELSE 0 END), 0) as today_revenue
           FROM orders WHERE business_id = $1`,
          [businessId]
        );
        const recentOrdersRes = await pool.query(
          `SELECT id, order_number, customer_name, customer_phone, customer_note, order_type, table_number, payment_method, total_amount, status, payment_status, created_at
           FROM orders WHERE business_id = $1
           ORDER BY created_at DESC LIMIT 5`,
          [businessId]
        );

        return res.json({
          success: true,
          data: {
            total_products: parseInt(prodCountRes.rows[0]?.count || '0', 10),
            total_categories: parseInt(catCountRes.rows[0]?.count || '0', 10),
            total_orders: parseInt(orderStatsRes.rows[0]?.total_orders || '0', 10),
            pending_orders: parseInt(orderStatsRes.rows[0]?.pending_orders || '0', 10),
            total_revenue: parseFloat(orderStatsRes.rows[0]?.total_revenue || '0'),
            today_orders: parseInt(orderStatsRes.rows[0]?.today_orders || '0', 10),
            today_revenue: parseFloat(orderStatsRes.rows[0]?.today_revenue || '0'),
            recent_orders: recentOrdersRes.rows,
          },
        });
      } catch (err) {
        console.warn('DB error fetching dashboard stats:', err);
      }
    }

    const prods = memoryStore.products.filter((p) => p.business_id === businessId);
    const cats = memoryStore.categories.filter((c) => c.business_id === businessId);
    const ords = memoryStore.orders.filter((o) => o.business_id === businessId);

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrdersList = ords.filter(
      (o) => o.created_at && o.created_at.slice(0, 10) === todayStr
    );
    const todayRevenue = todayOrdersList
      .filter((o) => o.payment_status === 'paid' || o.status === 'completed')
      .reduce((sum, o) => sum + o.total_amount, 0);

    const totalRevenue = ords
      .filter((o) => o.payment_status === 'paid' || o.status === 'completed')
      .reduce((sum, o) => sum + o.total_amount, 0);

    const pendingCount = ords.filter((o) => o.status === 'pending').length;

    const recentOrders = [...ords]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    return res.json({
      success: true,
      data: {
        total_products: prods.length,
        total_categories: cats.length,
        total_orders: ords.length,
        pending_orders: pendingCount,
        total_revenue: totalRevenue,
        today_orders: todayOrdersList.length,
        today_revenue: todayRevenue,
        recent_orders: recentOrders,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memuat statistik dashboard.' });
  }
});

export default router;
