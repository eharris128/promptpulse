import 'dotenv/config';
import { Database } from '@sqlitecloud/drivers';

const DATABASE_URL = process.env.DATABASE_URL;
const db = new Database(DATABASE_URL);

try {
  console.log('Adding missing energy_wh column...');
  
  // Add the missing energy_wh column to usage_data table
  await db.exec('ALTER TABLE usage_data ADD COLUMN energy_wh DECIMAL(10,6)');
  console.log('✓ Added energy_wh column to usage_data table');
  
  // Also add environmental columns to other tables if they're missing
  try {
    await db.exec('ALTER TABLE daily_usage ADD COLUMN total_energy_wh DECIMAL(10,6) DEFAULT 0');
    console.log('✓ Added total_energy_wh column to daily_usage table');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('  daily_usage already has total_energy_wh column');
    } else {
      throw error;
    }
  }
  
  try {
    await db.exec('ALTER TABLE session_usage ADD COLUMN total_energy_wh DECIMAL(10,6) DEFAULT 0');
    console.log('✓ Added total_energy_wh column to session_usage table');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('  session_usage already has total_energy_wh column');
    } else {
      throw error;
    }
  }
  
  console.log('\n✓ All missing environmental columns have been added');
  
} catch (error) {
  if (error.message.includes('duplicate column')) {
    console.log('✓ energy_wh column already exists');
  } else {
    console.error('Error:', error.message);
    process.exit(1);
  }
} finally {
  await db.close();
}