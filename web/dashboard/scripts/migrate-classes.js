const fs = require('fs');
const path = require('path');

const dirs = [
  'd:/mc-status/web/dashboard',
  'd:/mc-status/web/dashboard/tower'
];

function processFile(file) {
  if (!file.endsWith('.js')) return;
  let code = fs.readFileSync(file, 'utf8');
  let original = code;
  
  // Replace class="...tower-..."
  code = code.replace(/class="([^"]*)"/g, (match, classes) => {
      return `class="${classes.replace(/tower-/g, 'wt-')}"`;
  });
  code = code.replace(/class='([^']*)'/g, (match, classes) => {
      return `class='${classes.replace(/tower-/g, 'wt-')}'`;
  });
  
  // Replace classList.add/remove/toggle('tower-...')
  code = code.replace(/classList\.([a-zA-Z]+)\(['"]tower-([^'"]*)['"]/g, "classList.$1('wt-$2'");
  
  // Replace querySelector('.tower-...')
  code = code.replace(/querySelector\(['"]\.tower-([^'"]*)['"]/g, "querySelector('.wt-$1'");
  code = code.replace(/querySelectorAll\(['"]\.tower-([^'"]*)['"]/g, "querySelectorAll('.wt-$1'");

  // Also replace some specific CSS selectors inside strings
  code = code.replace(/['"]\.tower-([^'"]*)['"]/g, (match, p1) => {
      // Don't replace if it's an ID like '#tower-'
      if (match.includes('#')) return match;
      return match.replace('.tower-', '.wt-');
  });

  if (code !== original) {
    fs.writeFileSync(file, code);
    console.log('Updated ' + file);
  }
}

dirs.forEach(d => {
  const files = fs.readdirSync(d);
  files.forEach(f => {
    processFile(path.join(d, f));
  });
});
