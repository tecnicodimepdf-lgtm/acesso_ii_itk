import fs from 'fs';
const c = fs.readFileSync('src/server/syncService.ts', 'utf-8');
const lines = c.split('\\n');
console.log('Line 10:', JSON.stringify(lines[9]));
console.log('Line 11:', JSON.stringify(lines[10]));
