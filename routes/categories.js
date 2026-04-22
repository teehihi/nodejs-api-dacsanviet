const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

const { uploadCategory } = require('../middleware/upload');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Public routes
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/products', categoryController.getCategoryProducts);

// Admin routes (Protected)
router.post('/', authenticateToken, requireRole(['ADMIN']), uploadCategory.single('image'), categoryController.createCategory);
router.put('/:id', authenticateToken, requireRole(['ADMIN']), uploadCategory.single('image'), categoryController.updateCategory);
router.delete('/:id', authenticateToken, requireRole(['ADMIN']), categoryController.deleteCategory);
router.post('/:id/add-product', authenticateToken, requireRole(['ADMIN']), categoryController.addProductToCategory);

module.exports = router;
