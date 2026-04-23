const { getActiveFlashSale, getCurrentSlot } = require('../services/flashSaleService');

exports.getFlashSale = async (req, res) => {
  try {
    const sale = await getActiveFlashSale();

    if (!sale) {
      return res.json({
        success: true,
        data: null,
        message: 'Không có flash sale đang diễn ra'
      });
    }

    // Tính thời gian còn lại (ms)
    const remainingMs = new Date(sale.endTime).getTime() - Date.now();

    res.json({
      success: true,
      data: {
        slotHour: sale.slotHour,
        endTime: sale.endTime,
        remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
        products: sale.products
      }
    });
  } catch (error) {
    console.error('Flash sale error:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy flash sale' });
  }
};
