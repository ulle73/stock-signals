const fs = require('fs');

function fixColors(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace white backgrounds
  content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.[0-9]+\)/g, 'var(--card)');
  content = content.replace(/rgba\(255,\s*252,\s*246,\s*0\.[0-9]+\)/g, 'var(--card)');
  content = content.replace(/rgba\(241,\s*248,\s*244,\s*0\.[0-9]+\)/g, 'var(--card)');
  content = content.replace(/rgba\(255,\s*251,\s*245,\s*0\.[0-9]+\)/g, 'var(--card)');
  content = content.replace(/rgba\(244,\s*249,\s*246,\s*0\.[0-9]+\)/g, 'var(--card)');
  content = content.replace(/rgba\(255,\s*253,\s*248,\s*0\.[0-9]+\)/g, 'var(--card)');
  content = content.replace(/#f8f4ec/g, 'var(--bg-strong)');
  
  // Replace dark lines / borders
  content = content.replace(/rgba\(90,\s*82,\s*68,\s*0\.[0-9]+\)/g, 'var(--line)');
  content = content.replace(/rgba\(45,\s*42,\s*36,\s*0\.[0-9]+\)/g, 'var(--line)');
  
  // Replace background gradients from the original app design that override cards
  content = content.replace(/background:\s*linear-gradient\(180deg,\s*rgba[^)]+\),\s*rgba[^)]+\),\s*var\(--card-strong\);/gs, 'background: var(--hero-bg);');
  content = content.replace(/background:\s*linear-gradient\(180deg,\s*rgba[^;]+;/gs, 'background: var(--hero-bg);');
  
  // Hardcoded chart colors in globals.css
  content = content.replace(/#3d4248/g, 'var(--text)');
  content = content.replace(/#5e6368/g, 'var(--muted)');
  content = content.replace(/#52565a/g, 'var(--text)');
  content = content.replace(/#f2f2f0/g, 'var(--bg-strong)');
  content = content.replace(/#e2e2dd/g, 'var(--line)');
  content = content.replace(/#fafaf8/g, 'var(--card)');
  content = content.replace(/#ecebe6/g, 'var(--line)');
  content = content.replace(/#666b70/g, 'var(--muted)');
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}

fixColors('c:/dev/stock-signals/app/globals.css');
