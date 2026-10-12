import { Router, Request, Response } from 'express';
import { memoryStore, pool, saveLocalStore } from '../database/db';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/business/:businessId/settings
 * Ambil data pengaturan & tema bisnis
 */
router.get('/business/:businessId/settings', async (req: Request, res: Response) => {
  try {
    const { businessId } = req.params;

    if (pool) {
      try {
        const result = await pool.query(
          'SELECT * FROM settings WHERE business_id = $1 LIMIT 1',
          [businessId]
        );
        if (result.rows.length > 0) {
          return res.json({ success: true, data: result.rows[0] });
        }
      } catch (err) {
        console.warn('DB error fetching settings:', err);
      }
    }

    const setting = memoryStore.settings.find((s) => s.business_id === businessId);
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Pengaturan bisnis belum dibuat.' });
    }

    return res.json({ success: true, data: setting });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan bisnis.' });
  }
});

/**
 * PUT /api/admin/settings
 * Memperbarui pengaturan tampilan, tema warna, font, dan fitur pemesanan
 */
router.put('/admin/settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const businessId = req.user!.businessId;
    const {
      theme_preset,
      primary_color,
      secondary_color,
      background_color,
      text_color,
      button_style,
      card_style,
      font_family,
      is_ordering_enabled,
      announcement,
      additional_config,
    } = req.body;

    if (pool) {
      try {
        const updateRes = await pool.query(
          `INSERT INTO settings (
             business_id, theme_preset, primary_color, secondary_color, 
             background_color, text_color, button_style, card_style, 
             font_family, is_ordering_enabled, announcement, additional_config
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (business_id) DO UPDATE
           SET theme_preset = EXCLUDED.theme_preset,
               primary_color = EXCLUDED.primary_color,
               secondary_color = EXCLUDED.secondary_color,
               background_color = EXCLUDED.background_color,
               text_color = EXCLUDED.text_color,
               button_style = EXCLUDED.button_style,
               card_style = EXCLUDED.card_style,
               font_family = EXCLUDED.font_family,
               is_ordering_enabled = EXCLUDED.is_ordering_enabled,
               announcement = EXCLUDED.announcement,
               additional_config = EXCLUDED.additional_config,
               updated_at = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            businessId,
            theme_preset || 'amber_warm',
            primary_color || '#78350f',
            secondary_color || '#d97706',
            background_color || '#fffbeb',
            text_color || '#1f2937',
            button_style || 'rounded',
            card_style || 'shadow',
            font_family || 'Inter',
            is_ordering_enabled !== undefined ? Boolean(is_ordering_enabled) : true,
            announcement || '',
            typeof additional_config === 'object' ? JSON.stringify(additional_config) : '{}',
          ]
        );

        return res.json({
          success: true,
          message: 'Pengaturan tema & tampilan berhasil disimpan.',
          data: updateRes.rows[0],
        });
      } catch (err) {
        console.warn('DB error updating settings:', err);
      }
    }

    const sIndex = memoryStore.settings.findIndex((s) => s.business_id === businessId);
    if (sIndex === -1) {
      const newSetting = {
        id: `set-${Date.now()}`,
        business_id: businessId,
        theme_preset: theme_preset || 'amber_warm',
        primary_color: primary_color || '#78350f',
        secondary_color: secondary_color || '#d97706',
        background_color: background_color || '#fffbeb',
        text_color: text_color || '#1f2937',
        button_style: button_style || 'rounded',
        card_style: card_style || 'shadow',
        font_family: font_family || 'Inter',
        is_ordering_enabled: is_ordering_enabled !== undefined ? Boolean(is_ordering_enabled) : true,
        announcement: announcement || '',
        additional_config: additional_config || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      memoryStore.settings.push(newSetting);
      saveLocalStore();
      return res.json({ success: true, message: 'Pengaturan tema berhasil disimpan.', data: newSetting });
    }

    memoryStore.settings[sIndex] = {
      ...memoryStore.settings[sIndex],
      theme_preset: theme_preset ?? memoryStore.settings[sIndex].theme_preset,
      primary_color: primary_color ?? memoryStore.settings[sIndex].primary_color,
      secondary_color: secondary_color ?? memoryStore.settings[sIndex].secondary_color,
      background_color: background_color ?? memoryStore.settings[sIndex].background_color,
      text_color: text_color ?? memoryStore.settings[sIndex].text_color,
      button_style: button_style ?? memoryStore.settings[sIndex].button_style,
      card_style: card_style ?? memoryStore.settings[sIndex].card_style,
      font_family: font_family ?? memoryStore.settings[sIndex].font_family,
      is_ordering_enabled: is_ordering_enabled !== undefined ? Boolean(is_ordering_enabled) : memoryStore.settings[sIndex].is_ordering_enabled,
      announcement: announcement !== undefined ? announcement : memoryStore.settings[sIndex].announcement,
      updated_at: new Date().toISOString(),
    };
    saveLocalStore();

    return res.json({
      success: true,
      message: 'Pengaturan tema & tampilan berhasil disimpan.',
      data: memoryStore.settings[sIndex],
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengaturan.' });
  }
});

export default router;
