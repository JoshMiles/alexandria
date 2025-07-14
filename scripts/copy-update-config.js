const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'app-update.yml');

// Define possible destinations
const destinations = [
  path.join(__dirname, '..', 'out', 'alexandria-win32-x64', 'resources', 'app-update.yml'), // Windows
  path.join(__dirname, '..', 'out', 'Alexandria-darwin-x64', 'Alexandria.app', 'Contents', 'Resources', 'app-update.yml'), // macOS
];

let copied = false;

destinations.forEach(dest => {
  const destDir = path.dirname(dest);
  if (fs.existsSync(destDir)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied app-update.yml to: ${dest}`);
    copied = true;
  } else {
    console.warn(`Destination directory does not exist: ${destDir}`);
  }
});

if (!copied) {
  console.error('app-update.yml was not copied. Please check your build output paths.');
} 