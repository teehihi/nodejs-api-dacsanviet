const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../../middleware/auth');
const productAdminController = require('../../controllers/admin/productAdminController');
const { uploadProduct } = require('../../middleware/upload');

// All routes require ADMIN or STAFF role
router.use(authenticateToken);
router.use(requireRole(['ADMIN', 'STAFF']));

// GET /api/admin/products - Get all products
router.get('/', productAdminController.getAllProducts);

// GET /api/admin/products/stats - Get product statistics
router.get('/stats', productAdminController.getProductStats);

// POST /api/admin/products - Create product (with image)
router.post('/', uploadProduct.single('image'), productAdminController.createProduct);

// PUT /api/admin/products/:id - Update product (with image)
router.put('/:id', uploadProduct.single('image'), productAdminController.updateProduct);

// DELETE /api/admin/products/:id - Delete product (soft delete)
router.delete('/:id', productAdminController.deleteProduct);

// PATCH /api/admin/products/:id/toggle-status - Toggle active status
router.patch('/:id/toggle-status', productAdminController.toggleProductStatus);

module.exports = router;
