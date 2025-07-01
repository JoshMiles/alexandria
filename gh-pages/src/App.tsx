import { useEffect, useState } from 'react';

// Define OSKey type
type OSKey = 'win' | 'mac_x64' | 'mac_arm64' | 'linux_deb' | 'linux_rpm';

const GITHUB_API = 'https://api.github.com/repos/JoshMiles/alexandria/releases/latest';

const OS_NAMES: Record<OSKey, string> = {
  win: 'Windows',
  mac_x64: 'macOS (Intel)',
  mac_arm64: 'macOS (Apple)',
  linux_deb: 'Linux (DEB)',
  linux_rpm: 'Linux (RPM)',
};

const getOS = () => {
  const ua = window.navigator.userAgent;
  if (/Windows/i.test(ua)) return 'win';
  if (/Macintosh|Mac OS X/i.test(ua)) {
    // Try to detect Apple Silicon
    // @ts-ignore
    if (navigator.userAgentData?.platform === 'macOS' && navigator.userAgentData?.architecture === 'arm64') return 'mac_arm64';
    // Fallback: let user choose
    return 'mac_x64';
  }
  if (/Linux/i.test(ua)) return 'linux_deb';
  return 'win';
};

const assetForOS = (assets: any[], os: OSKey) => {
  switch (os) {
    case 'win':
      return assets.find(a => a.name.endsWith('.exe'));
    case 'mac_x64':
      return assets.find(a => /darwin-x64.*\.zip$/.test(a.name));
    case 'mac_arm64':
      return assets.find(a => /darwin-arm64.*\.zip$/.test(a.name));
    case 'linux_deb':
      return assets.find(a => a.name.endsWith('.deb'));
    case 'linux_rpm':
      return assets.find(a => a.name.endsWith('.rpm'));
    default:
      return undefined;
  }
};

const allAssetLinks = (assets: any[]): Record<OSKey, any> => ({
  win: assets.find(a => a.name.endsWith('.exe')),
  mac_x64: assets.find(a => /darwin-x64.*\.zip$/.test(a.name)),
  mac_arm64: assets.find(a => /darwin-arm64.*\.zip$/.test(a.name)),
  linux_deb: assets.find(a => a.name.endsWith('.deb')),
  linux_rpm: assets.find(a => a.name.endsWith('.rpm')),
});

const accent = '#a052e2';
const background = '#121212';
const logoColor = '#b18fff';
const font = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', sans-serif`;

export default function App() {
  const [assets, setAssets] = useState<any[]>([]);
  const [os] = useState<OSKey>(getOS());
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('');

  useEffect(() => {
    fetch(GITHUB_API)
      .then(r => r.json())
      .then(data => {
        setAssets(data.assets || []);
        setVersion(data.tag_name || '');
        setLoading(false);
      });
  }, []);

  const asset = assetForOS(assets, os);
  const links = allAssetLinks(assets);

  return (
    <div style={{
      minHeight: '100vh',
      background,
      color: 'white',
      fontFamily: font,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      <div style={{
        background: 'radial-gradient(ellipse at 60% 40%, #8a2be2 0%, #23272f 80%)',
        borderRadius: 24,
        padding: '2.5rem 2.5rem 2rem 2.5rem',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        maxWidth: 420,
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '2.2rem',
          color: logoColor,
          fontWeight: 700,
          marginBottom: 8,
          textShadow: '0 0 16px #a052e2, 0 0 4px #fff',
          letterSpacing: 1,
          animation: 'logoGlow 2s ease-in-out infinite alternate',
        }}>
          Alexandria
        </div>
        <div style={{ color: '#bdb8d7', fontSize: '1.1rem', marginBottom: 24 }}>
          A modern desktop app for searching and downloading books from LibGen.
        </div>
        {loading ? (
          <div style={{ color: accent, margin: '2rem 0' }}>Loading latest release...</div>
        ) : asset ? (
          <a
            href={asset.browser_download_url}
            style={{
              display: 'inline-block',
              background: accent,
              color: 'white',
              fontWeight: 600,
              fontSize: '1.2rem',
              padding: '1rem 2.5rem',
              borderRadius: 12,
              boxShadow: '0 2px 16px 0 rgba(160,82,226,0.15)',
              textDecoration: 'none',
              margin: '1.5rem 0 0.5rem 0',
              transition: 'background 0.2s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = '#8a2be2')}
            onMouseOut={e => (e.currentTarget.style.background = accent)}
            download
          >
            Download for {OS_NAMES[os]}
          </a>
        ) : (
          <div style={{ color: '#ffb3b3', margin: '2rem 0' }}>
            No download available for your OS.<br />
            Please select another platform below.
          </div>
        )}
        <div style={{ marginTop: 24, color: '#bdb8d7', fontSize: '0.98rem' }}>
          {version && <span>Latest version: <b>{version}</b></span>}
        </div>
        <div style={{ marginTop: 24, fontSize: '0.98rem', color: '#bdb8d7' }}>
          Other platforms:<br />
          {Object.entries(OS_NAMES).map(([key, label]) =>
            key !== os && links[key as OSKey] ? (
              <a
                key={key}
                href={links[key as OSKey].browser_download_url}
                style={{
                  color: accent,
                  margin: '0 0.5rem',
                  textDecoration: 'underline',
                  fontWeight: 500,
                }}
                download
              >
                {label}
              </a>
            ) : null
          )}
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        @keyframes logoGlow {
          0% { text-shadow: 0 0 16px #a052e2, 0 0 4px #fff; }
          100% { text-shadow: 0 0 32px #a052e2, 0 0 8px #fff; }
        }
        body { background: #121212; }
      `}</style>
    </div>
  );
}
