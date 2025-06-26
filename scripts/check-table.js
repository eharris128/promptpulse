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
  
  // Check if environmental columns exist
  const hasEnergyWh = result.some(col => col.name === 'energy_wh');
  const hasCo2 = result.some(col => col.name === 'co2_emissions_g');
  const hasTree = result.some(col => col.name === 'tree_equivalent');
  
  console.log('\nEnvironmental columns status:');
  console.log(`  energy_wh: ${hasEnergyWh ? '✓ EXISTS' : '✗ MISSING'}`);
  console.log(`  co2_emissions_g: ${hasCo2 ? '✓ EXISTS' : '✗ MISSING'}`);
  console.log(`  tree_equivalent: ${hasTree ? '✓ EXISTS' : '✗ MISSING'}`);
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await db.close();
}