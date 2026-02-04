const { pool } = require('./config/database');
const Product = require('./models/Product');

async function testProductAPI() {
  try {
    console.log('🧪 Testing Product API methods...');
    
    // Test findAll
    console.log('1. Testing findAll...');
    const products = await Product.findAll({ limit: 5, offset: 0 });
    console.log('✅ findAll works! Products:', products.length);
    if (products.length > 0) {
      console.log('📦 First product:', {
        id: products[0].id,
        name: products[0].name,
        price: products[0].price,
        category: products[0].category
      });
    }
    
    // Test count
    console.log('2. Testing count...');
    const count = await Product.count({});
    console.log('✅ count works! Total:', count);
    
    // Test findById
    console.log('3. Testing findById...');
    const product = await Product.findById(1);
    console.log('✅ findById works!', product ? 'Found' : 'Not found');
    
    // Test getAllCategories
    console.log('4. Testing getAllCategories...');
    const categories = await Product.getAllCategories();
    console.log('✅ getAllCategories works! Categories:', categories.length);
    console.log('📂 Categories:', categories.slice(0, 5));
    
    // Test search
    console.log('5. Testing search...');
    const searchResults = await Product.findAll({ q: 'bánh', limit: 3 });
    console.log('✅ Search works! Results:', searchResults.length);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testProductAPI();