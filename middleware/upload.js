const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage configuration for Product images
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/products';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter (images only - temporarily allowing all for debugging)
const fileFilter = (req, file, cb) => {
    console.log('🖼️ Multer filtering file:', file.originalname, 'mimetype:', file.mimetype);
    // Allow all to debug if mimetype from Flutter is weird
    cb(null, true);
};

const uploadProduct = multer({
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

module.exports = {
    uploadProduct
};
