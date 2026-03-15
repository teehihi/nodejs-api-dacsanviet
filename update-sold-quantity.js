const { pool } = require('./config/database');

async function updateSoldQuantity() {
  console.log('Updating sold_quantity for demo data...');
  
  try {
    // Update some products with sold quantities for demo
    const updates = [
      { id: 1, sold_quantity: 150 },
      { id: 2, sold_quantity: 89 },
      { id: 3, sold_quantity: 234 },
      { id: 4, sold_quantity: 67 },
      { id: 6, sold_quantity: 123 },
      { id: 7, sold_quantity: 45 },
      { id: 8, sold_quantity: 178 },
    ];

    for (const update of updates) {
      await pool.execute(
        'UPDATE products SET sold_quantity = ? WHERE id = ?',
        [update.sold_quantity, update.id]
      );
      console.log(`✅ Updated product ${update.id} with sold_quantity: ${update.sold_quantity}`);
    }

    console.log('\n🎉 All sold quantities updated successfully!');
    
    // Test the results
    const [rows] = await pool.execute(
      'SELECT id, name, sold_quantity FROM products WHERE sold_quantity > 0 ORDER BY sold_quantity DESC'
    );
    
    console.log('\n📊 Products with sold quantities:');
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}: ${row.sold_quantity} sold`);
    });
    
  } catch (error) {
    console.error('❌ Error updating sold quantities:', error);
  } finally {
    process.exit(0);
  }
}

updateSoldQuantity();