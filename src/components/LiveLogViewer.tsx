import React, { useEffect, useRef, useState } from 'react';

const LOG_LEVELS = ['ALL', 'INFO', 'WARN', 'ERROR', 'VERBOSE', 'DEBUG'];

type LogEntry = {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
};

const LiveLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    window.electron.getLatestLog().then((text: string) => {
      if (!mounted) return;
      // Parse JSONL log file
      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed: LogEntry[] = [];
      for (const line of lines) {
        try {
          parsed.push(JSON.parse(line));
        } catch {}
      }
      setLogs(parsed);
    });
    // TypeScript: window.electron.onLogUpdate is not typed for structured logs, so cast to any
    const electronAny = window.electron as any;
    const handleLogUpdate = (entry: LogEntry) => {
      setLogs((prev: LogEntry[]) => [...prev, entry]);
    };
    electronAny.onLogUpdate(handleLogUpdate);
    return () => {
      mounted = false;
      electronAny.offLogUpdate && electronAny.offLogUpdate(handleLogUpdate);
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filtered = logs.filter(entry => {
    const matchesLevel = level === 'ALL' || entry.level === level;
    const matchesSearch = !search ||
      entry.message.toLowerCase().includes(search.toLowerCase()) ||
      (entry.meta && JSON.stringify(entry.meta).toLowerCase().includes(search.toLowerCase()));
    return matchesLevel && matchesSearch;
  });

  const handleClear = () => setLogs([]);
  const handleCopy = () => navigator.clipboard.writeText(filtered.map(e => formatLogLine(e)).join('\n'));

  function formatLogLine(entry: LogEntry) {
    let line = `[${entry.timestamp}] [${entry.level}] ${entry.message}`;
    if (entry.meta && Object.keys(entry.meta).length > 0) {
      line += ' ' + JSON.stringify(entry.meta);
    }
    return line;
  }

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
        {filtered.length > 0 ? filtered.map(formatLogLine).join('\n') : 'No log data.'}
      </div>
    </div>
  );
};

export default LiveLogViewer; 