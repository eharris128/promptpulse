import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

const DATABASE_URL = process.env.DATABASE_URL;
const db = new Database(DATABASE_URL);

try {
  console.log('Checking usage_data table structure...');
  const result = await db.sql`PRAGMA table_info(usage_data)`;
  console.log('usage_data columns:');
  result.forEach(col => {
    console.log(`  ${col.name}: ${col.type}`);
  });
  
  console.log('\nChecking for any remaining issues...');
  
  // Check for basic required columns
  const requiredColumns = ['machine_id', 'user_id', 'total_tokens', 'total_cost'];
  const missingColumns = requiredColumns.filter(col => 
    !result.some(tableCol => tableCol.name === col)
  );
  
  if (missingColumns.length > 0) {
    console.log('❌ Missing required columns:', missingColumns);
  } else {
    console.log('✅ All required columns present');
  }
  
  // Check total record count
  const countResult = await db.sql`SELECT COUNT(*) as count FROM usage_data`;
  console.log(`\nTotal records in usage_data: ${countResult[0].count}`);
  
} catch (error) {
  console.error('Error checking table:', error);
} finally {
  await db.close();
}