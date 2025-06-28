import fs from 'fs';

const usersSql = fs.readFileSync('./migrations/002_create_users_table.sql', 'utf8');

console.log('=== MIGRATION SCRIPT PARSING LOGIC ===');

// Replicate exact logic from migrate.js
const statements = usersSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Total statements after filtering: ${statements.length}`);

statements.forEach((stmt, i) => {
  console.log(`\n--- Statement ${i + 1} (length: ${stmt.length}) ---`);
  if (stmt.toLowerCase().includes('create table')) {
    console.log('*** THIS IS THE CREATE TABLE STATEMENT ***');
  }
  console.log(stmt.substring(0, 200) + (stmt.length > 200 ? '...' : ''));
});

// Check what the first few characters are before splitting
console.log('\n=== FIRST 500 CHARS OF RAW SQL ===');
console.log(usersSql.substring(0, 500));

console.log('\n=== SPLIT RESULTS (first 3) ===');
const rawSplit = usersSql.split(';');
rawSplit.slice(0, 3).forEach((part, i) => {
  console.log(`\n--- Raw part ${i + 1} ---`);
  console.log(part);
});