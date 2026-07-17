const fs = require('fs');

const content = fs.readFileSync('src/features/settings/SettingsView.tsx', 'utf8');

const lines = content.split('\n');
let level = 0;
const stack = [];

lines.forEach((line, index) => {
  const lineNum = index + 1;
  
  // Strip out comments
  let cleanLine = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  cleanLine = cleanLine.replace(/\/\/.*$/, '');
  
  const regex = /<div(?:\s+[^>]*[^\/])?>|<\/div>/g;
  let match;
  
  while ((match = regex.exec(cleanLine)) !== null) {
    if (match[0].startsWith('</')) {
      level--;
      if (stack.length === 0) {
        console.log(`[LEVEL ${level}] EXTRA CLOSING </div> at line ${lineNum}`);
      } else {
        const last = stack.pop();
        console.log(`[LEVEL ${level}] Closed <div> from line ${last} at line ${lineNum}`);
      }
    } else {
      level++;
      stack.push(lineNum);
      console.log(`[LEVEL ${level}] Opened <div> at line ${lineNum}`);
    }
  }
});


