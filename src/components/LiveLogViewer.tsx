import React, { useEffect, useRef, useState } from 'react';

const LOG_LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR'];

const LiveLogViewer: React.FC = () => {
  const [log, setLog] = useState('');
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    window.electron.getLatestLog().then((text) => {
      if (mounted) setLog(text);
    });
    const handleLogUpdate = (line: string) => {
      setLog((prev) => prev + (prev.endsWith('\n') ? '' : '\n') + line);
    };
    window.electron.onLogUpdate(handleLogUpdate);
    return () => {
      mounted = false;
      window.electron.offLogUpdate && window.electron.offLogUpdate(handleLogUpdate);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log, autoScroll]);

  const lines = log.split(/\r?\n/).filter(Boolean);
  const filtered = lines.filter(line => {
    const matchesLevel = level === 'ALL' || line.includes(`[${level}]`);
    const matchesSearch = !search || line.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleClear = () => setLog('');
  const handleCopy = () => navigator.clipboard.writeText(filtered.join('\n'));

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 120, borderRadius: 6, border: '1px solid var(--border)', padding: '6px 10px', fontFamily: 'inherit', fontSize: 13 }}
        />
        <select value={level} onChange={e => setLevel(e.target.value)} style={{ borderRadius: 6, border: '1px solid var(--border)', padding: '6px 10px', fontSize: 13 }}>
          {LOG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={handleClear} style={{ borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}>Clear</button>
        <button onClick={handleCopy} style={{ borderRadius: 6, border: 'none', background: 'var(--accent)', color: '#fff', padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}>Copy</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 500 }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ marginRight: 4 }} />
          Auto-scroll
        </label>
      </div>
      <div ref={logRef} style={{
        width: '100%',
        minHeight: 120,
        maxHeight: 320,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: 13,
        background: '#18181c',
        color: '#e0e0e0',
        borderRadius: 8,
        border: '1.5px solid var(--border)',
        boxShadow: '0 2px 8px #0002',
        padding: 16,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        marginBottom: 8,
      }}>
        {filtered.length > 0 ? filtered.join('\n') : 'No log data.'}
      </div>
    </div>
  );
};

export default LiveLogViewer; 