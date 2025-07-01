const fs = require('fs');
const https = require('https');

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const ref = process.env.GITHUB_REF;
const tag = ref.split('/').pop();

const apiUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
const headers = {
  'User-Agent': 'node.js',
  'Authorization': `token ${token}`,
};

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function findAsset(assets, pattern) {
  const regex = new RegExp(pattern);
  const asset = assets.find(a => regex.test(a.name));
  return asset ? asset.browser_download_url : '';
}

(async () => {
  const release = await get(apiUrl);
  const assets = release.assets || [];

  const WIN_URL = findAsset(assets, '\\.(exe)$');
  const MAC_X64_ZIP_URL = findAsset(assets, 'darwin-x64.*\\.zip$');
  const MAC_ARM64_ZIP_URL = findAsset(assets, 'darwin-arm64.*\\.zip$');
  const MAC_X64_PKG_URL = findAsset(assets, 'darwin-x64.*\\.pkg$');
  const MAC_ARM64_PKG_URL = findAsset(assets, 'darwin-arm64.*\\.pkg$');
  const DEB_URL = findAsset(assets, '\\.(deb)$');
  const RPM_URL = findAsset(assets, '\\.(rpm)$');

  const newTable = `
| Platform         | Installer/ZIP Link |
|------------------|-------------------|
| Windows          | [Download EXE](${WIN_URL}) |
| macOS (Intel)    | [Download ZIP](${MAC_X64_ZIP_URL}) / [Download PKG](${MAC_X64_PKG_URL}) |
| macOS (Apple)    | [Download ZIP](${MAC_ARM64_ZIP_URL}) / [Download PKG](${MAC_ARM64_PKG_URL}) |
| Linux (DEB)      | [Download DEB](${DEB_URL}) |
| Linux (RPM)      | [Download RPM](${RPM_URL}) |
`;

  const readme = fs.readFileSync('README.md', 'utf-8');
  const pattern = /(\| *Platform *\| *Installer\/ZIP Link *\|[\r\n]+\|[-| ]+\|[\r\n]+)(\|.*\|.*\|[\r\n]+)*/i;
  let updated;
  if (pattern.test(readme)) {
    updated = readme.replace(pattern, `$1${newTable}\n`);
  } else {
    updated = readme + '\n' + newTable + '\n';
  }
  fs.writeFileSync('README.md', updated, 'utf-8');
})(); 