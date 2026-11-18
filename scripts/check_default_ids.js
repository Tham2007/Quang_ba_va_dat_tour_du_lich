const fs = require('fs');
const content = fs.readFileSync('Frontend/assets/js/models/data.js', 'utf8');
const ids = [];
const regex = /id:\s*["']([^"']+)["']/g;
let m;
while ((m = regex.exec(content.slice(0, 50000))) !== null) {
  ids.push(m[1]);
}
console.log('Found IDs in data.js:', ids.slice(0, 25));
