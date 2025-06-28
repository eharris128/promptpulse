import fs from 'fs';

const usersSql = fs.readFileSync('./migrations/002_create_users_table.sql', 'utf8');

console.log('=== RAW SQL ===');
console.log(usersSql);

console.log('\n=== SPLIT BY SEMICOLON ===');
const statements = usersSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

statements.forEach((stmt, i) => {
  console.log(`\n--- Statement ${i + 1} ---`);
  console.log(stmt);
});