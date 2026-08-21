const fs = require('fs');
const path = require('path');

function rmDir(dir) {
  const full = path.resolve(dir);
  if (!fs.existsSync(full)) {
    console.log('Not found:', full);
    return;
  }
  try {
    fs.rmSync(full, { recursive: true, force: true });
    console.log('Removed:', full);
  } catch (err) {
    console.error('Failed to remove:', full, err.message);
    // try rename as fallback
    try {
      const alt = full + '-archive-' + Date.now();
      fs.renameSync(full, alt);
      console.log('Renamed to:', alt);
    } catch (err2) {
      console.error('Also failed to rename:', err2.message);
    }
  }
}

rmDir('client');
rmDir('server');

console.log('Cleanup script finished. If directories remained, they may be locked by other processes.');
