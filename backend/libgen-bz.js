const got = require('got').default;
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const LOGS_DIR = logger.LOGS_DIR;
const LOGS_RESPONSES_DIR = logger.LOGS_RESPONSES_DIR;
const pLimit = require('p-limit');
const adsPhpCache = new Map();

const LIBGEN_PLUS_MIRRORS = [
  'https://libgen.bz',
  'https://libgen.gs',
  'https://libgen.la',
  'https://libgen.gl',
];

/**
 * Parse locator/filename for title, author, year, extension
 */
function parseFilename(locator, metadata) {
  if (!locator) return { title: '', author: '', year: '', extension: '' };
  // Remove underscores and extra spaces
  const cleanLocator = locator.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  // Try "Author - Title (Year).ext" and "Title - Author (Year).ext"
  const regex1 = /^(.*?)\s+-\s+(.*?)\s*(?:\((\d{4})(?:,.*)?\))?\.(\w+)$/;
  const match1 = cleanLocator.match(regex1);
  if (match1) {
    // Heuristic: if metadata.author is present and matches one side, use it
    let author = match1[1].trim();
    let title = match1[2].trim();
    if (metadata && metadata.author) {
      const metaAuthor = metadata.author.trim();
      if (metaAuthor === author) {
        // pattern is Author - Title
        return { author, title, year: match1[3] || '', extension: match1[4] ? match1[4].toLowerCase() : '' };
      } else if (metaAuthor === title) {
        // pattern is Title - Author
        return { author: title, title: author, year: match1[3] || '', extension: match1[4] ? match1[4].toLowerCase() : '' };
      }
    }
    // Fallback: return both guesses
    return { author, title, year: match1[3] || '', extension: match1[4] ? match1[4].toLowerCase() : '' };
  }
  // Fallback: try to split by dash
  const parts = cleanLocator.split('-');
  if (parts.length >= 2) {
    let author = parts[0].trim();
    let title = parts.slice(1).join('-').replace(/\.[^.]+$/, '').trim();
    if (metadata && metadata.author) {
      const metaAuthor = metadata.author.trim();
      if (metaAuthor === author) {
        return { author, title, year: '', extension: cleanLocator.split('.').pop().toLowerCase() || '' };
      } else if (metaAuthor === title) {
        return { author: title, title: author, year: '', extension: cleanLocator.split('.').pop().toLowerCase() || '' };
      }
    }
    return { author, title, year: '', extension: cleanLocator.split('.').pop().toLowerCase() || '' };
  }
  return { title: cleanLocator || '', author: '', year: '', extension: cleanLocator.split('.').pop().toLowerCase() || '' };
}

function isValidMetadata(parsed, metadata) {
  // Check for empty, placeholder, or suspicious values
  const bad = (v) => !v || v === '-' || v === 'N/A' || v === 'Unknown' || v === 'null' || v === 'undefined';
  if (bad(parsed.title) || bad(parsed.author) || bad(parsed.extension)) return false;
  // Only allow common ebook extensions
  const allowedExt = ['epub', 'pdf', 'mobi', 'azw3', 'djvu', 'fb2', 'txt', 'rtf', 'doc', 'docx', 'cbz', 'cbr'];
  if (!allowedExt.includes(parsed.extension)) return false;
  // Filesize check (if available)
  let filesize = 0;
  if (metadata && metadata.filesize) {
    filesize = parseInt(metadata.filesize, 10);
    if (isNaN(filesize) || filesize <= 0) return false;
  }
  return true;
}

/**
 * Search Library Genesis+ for editions, then fetch files for each edition, grouping files under editions.
 * @param {string} query
 * @param {function} [statusCallback]
 * @returns {Promise<Array<{ edition: object, files: Array<object> }>>}
 */
async function searchLibgenPlusEditions(query, statusCallback) {
  for (const mirror of LIBGEN_PLUS_MIRRORS) {
    try {
      // 1. Search for editions (curtab=e)
      const searchUrl = `${mirror}/index.php?req=${encodeURIComponent(query)}&columns[]=t&columns[]=a&columns[]=s&columns[]=y&columns[]=p&columns[]=i&objects[]=e&topics[]=l&topics[]=f&res=100&covers=on&filesuns=all&curtab=e`;
      logger.info(`[libgen.bz] Querying editions search URL: ${searchUrl}`);
      const res = await gotWithLog(searchUrl);
      const $ = cheerio.load(res.body);
      // 2. Parse edition IDs from the editions table
      const editionIds = [];
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/json.php?object=e&ids=')) {
          const match = href.match(/ids=([\d,]+)/);
          if (match) {
            editionIds.push(...match[1].split(','));
          }
        }
      });
      if (editionIds.length === 0) continue;
      if (statusCallback) statusCallback(`Found ${editionIds.length} editions. Fetching edition metadata...`);
      // 3. Fetch edition metadata (with files included)
      const editionApiUrl = `${mirror}/json.php?object=e&addkeys=*&ids=${editionIds.join(',')}`;
      logger.info(`[libgen.bz] Querying edition metadata API URL: ${editionApiUrl}`);
      const editionRes = await gotWithLog(editionApiUrl, { responseType: 'json' });
      const editionData = editionRes.body;
      // 4. For each edition, extract only the first file from the JSON response
      const results = [];
      for (let i = 0; i < editionIds.length; i++) {
        const editionId = editionIds[i];
        const edition = editionData[editionId];
        if (!edition) continue;
        if (statusCallback) statusCallback(`Processing edition ${i + 1} of ${editionIds.length}...`);
        let files = [];
        if (edition.files) {
          const fileKeys = Object.keys(edition.files);
          if (fileKeys.length > 0) {
            const firstFileMeta = edition.files[fileKeys[0]];
            files = [{
              fileId: firstFileMeta.f_id,
              metadata: firstFileMeta,
              mirror,
            }];
          }
        }
        results.push({ edition, files });
      }
      return results;
    } catch (e) {
      logger.warn(`[libgen.bz] Mirror failed: ${mirror} - ${e.message}`);
      continue;
    }
  }
  return [];
}

/**
 * Fetch file metadata from the API for a given mirror.
 * @param {string[]} ids
 * @param {string} mirror
 * @returns {Promise<Array<{ fileId: string, metadata: object, mirror: string }>>}
 */
async function fetchFileMetadata(ids, mirror) {
  if (!ids || ids.length === 0) return [];
  const apiUrl = `${mirror}/json.php?object=f&addkeys=*&ids=${ids.join(',')}`;
  logger.info(`[libgen.bz] Querying file metadata API URL: ${apiUrl}`);
  const res = await gotWithLog(apiUrl, { responseType: 'json' });
  const data = res.body;
  const results = [];
  for (const fileId of Object.keys(data)) {
    const file = data[fileId];
    results.push({ fileId, metadata: file, mirror });
  }
  return results;
}

/**
 * Fetch download links for a file by scraping the file page and filtering out ad links, for a given mirror.
 * @param {string} fileId
 * @param {string} mirror
 * @returns {Promise<Array<{ url: string, label: string }>>}
 */
async function fetchFileDownloadLinks(fileId, mirror) {
  const url = `${mirror}/file.php?id=${fileId}`;
  logger.info(`[libgen.bz] Querying file download page URL: ${url}`);
  const res = await gotWithLog(url);
  const $ = cheerio.load(res.body);
  const links = [];
  $('a').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (!href) return;
    if (
      href.includes('ads.php') ||
      href.includes('doubleclick') ||
      href.includes('adservice') ||
      href.includes('googlesyndication') ||
      (href.startsWith('http') && !href.includes('libgen') && !href.includes('ipfs') && !href.includes('annas-archive') && !href.includes('books.ms') && !href.includes('cloudflare-ipfs') && !href.includes('gateway.pinata.cloud') && !href.includes('gateway.ipfs.io'))
    ) {
      return;
    }
    if (
      href.startsWith('/get.php') ||
      href.startsWith('/download') ||
      href.startsWith('/fiction') ||
      href.startsWith('/file') ||
      href.startsWith('http://books.ms/') ||
      href.startsWith('https://annas-archive.org/') ||
      href.startsWith('http://libgenfrialc7tguyjywa36vtrdcplwpxaw43h6o63dmmwhvavo5rqqd.onion/') ||
      href.startsWith('http://localhost:8080/ipfs/') ||
      href.startsWith('https://cloudflare-ipfs.com/ipfs/') ||
      href.startsWith('https://gateway.ipfs.io/ipfs/') ||
      href.startsWith('https://gateway.pinata.cloud/ipfs/')
    ) {
      const fullUrl = href.startsWith('http') ? href : `${mirror}${href}`;
      links.push({ url: fullUrl, label: text || fullUrl });
    }
  });
  return links;
}

function extractIsbns(identifier) {
  // identifier may be a string like '9781234567890, 123456789X' or similar
  if (!identifier) return [];
  // Match ISBN-10 or ISBN-13
  const matches = (identifier.match(/\b(?:97[89][- ]?)?\d{9}[\dXx]\b/g) || []).map(s => s.replace(/[- ]/g, ''));
  return Array.from(new Set(matches));
}

/**
 * Group files by edition (ISBN if available, else title+author+year), returning editions with all available files and metadata.
 * @param {string} query
 * @returns {Promise<Array<{ isbns: string[], title: string, author: string, year: string, publisher: string, language: string, coverurl: string, files: Array<object> }>>}
 */
async function searchAndFetchLibgenPlus(query, statusCallback) {
  const { fileIds, mirror } = await searchLibgenPlusEditions(query, statusCallback);
  if (!fileIds || fileIds.length === 0 || !mirror) return [];
  const files = await fetchFileMetadata(fileIds, mirror);
  if (statusCallback) statusCallback(`Found ${files.length} files. Processing File 1 of ${files.length}...`);

  // Parallelize download link and ads.php/BibTeX fetching with concurrency limit
  const limit = pLimit(5); // concurrency limit
  await Promise.all(files.map((file, i) => limit(async () => {
    if (statusCallback) statusCallback(`Processing File ${i + 1} of ${files.length}...`);
    // Download links
    try {
      file.downloadLinks = await fetchFileDownloadLinks(file.fileId, mirror);
    } catch (e) {
      file.downloadLinks = [];
    }
    // BibTeX/ads.php cache
    if (file.md5) {
      if (adsPhpCache.has(file.md5)) {
        file.bibtex = adsPhpCache.get(file.md5);
      } else {
        try {
          const bibtex = await fetchBibtexMetadata(file.md5, mirror);
          file.bibtex = bibtex;
          adsPhpCache.set(file.md5, bibtex);
        } catch (e) {
          file.bibtex = null;
        }
      }
    }
    // Show partial progress (optional: could push to a partial results array)
    if (statusCallback) statusCallback(`Finished File ${i + 1} of ${files.length}`);
  })));
  // Group by edition
  const editionMap = new Map();
  for (const file of files) {
    const locator = file.metadata.locator || '';
    const parsed = parseFilename(locator, file.metadata);
    if (!isValidMetadata(parsed, file.metadata)) continue;
    const isbns = extractIsbns(file.metadata.identifier);
    const groupKey = isbns.length > 0
      ? isbns.join(',')
      : [parsed.title, parsed.author, file.metadata.year || parsed.year].join('|');
    if (!editionMap.has(groupKey)) {
      editionMap.set(groupKey, {
        isbns,
        title: file.metadata.title || parsed.title,
        author: file.metadata.author || parsed.author,
        year: file.metadata.year || parsed.year,
        publisher: file.metadata.publisher || '',
        language: file.metadata.language || '',
        coverurl: file.metadata.coverurl || '',
        files: [],
      });
    }
    // Always use file.metadata.md5 as md5, do not use fileId
    const md5 = file.metadata.md5;
    editionMap.get(groupKey).files.push({
      fileId: file.fileId,
      md5: md5,
      extension: parsed.extension,
      filesize: file.metadata.filesize ? parseInt(file.metadata.filesize, 10) : null,
      downloadLinks: file.downloadLinks,
      parsed,
      source: 'libgen.bz',
      mirror,
      locator,
      ...file.metadata,
    });
  }
  return Array.from(editionMap.values());
}

/**
 * Robustly download a file from Library Genesis+ by trying all mirrors and all download links for a fileId.
 * Returns {stream, mirror, link, url} on success, or throws an error with details if all fail.
 * @param {string} fileId
 * @param {string[]} mirrors
 * @param {object} [options] - { method: 'stream' | 'buffer' }
 * @returns {Promise<{stream: any, mirror: string, link: string, url: string}>}
 */
async function robustDownloadLibgenPlus(fileId, mirrors = LIBGEN_PLUS_MIRRORS, options = { method: 'stream' }) {
  const errors = [];
  for (const mirror of mirrors) {
    let links = [];
    try {
      links = await fetchFileDownloadLinks(fileId, mirror);
    } catch (e) {
      errors.push({ mirror, error: `Failed to fetch download links: ${e.message}` });
      continue;
    }
    // Only consider links that point to /get.php on the current mirror
    const getPhpLinks = links.filter(l => l.url.startsWith(mirror + '/get.php'));
    for (const linkObj of getPhpLinks) {
      try {
        // Try HEAD first to check if link is alive and not HTML
        const headRes = await gotWithLog.head(linkObj.url, { timeout: 8000, followRedirect: true });
        const contentType = headRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          errors.push({ mirror, url: linkObj.url, error: 'HEAD returned HTML, not a file' });
          continue;
        }
        // If HEAD succeeds and is not HTML, try to get the file (stream or buffer)
        if (options.method === 'buffer') {
          const res = await gotWithLog(linkObj.url, { responseType: 'buffer', timeout: 20000, followRedirect: true });
          const fileType = res.headers['content-type'] || '';
          if (fileType.includes('text/html')) {
            errors.push({ mirror, url: linkObj.url, error: 'GET returned HTML, not a file' });
            continue;
          }
          if (res && res.body && res.body.length > 0) {
            return { buffer: res.body, mirror, link: linkObj.label, url: linkObj.url };
          }
        } else {
          // Default: return stream
          const stream = gotWithLog.stream(linkObj.url, { timeout: { request: 20000 }, followRedirect: true });
          // Peek at the first chunk to check content-type (optional, not trivial with streams)
          // For now, rely on HEAD check above
          return { stream, mirror, link: linkObj.label, url: linkObj.url };
        }
      } catch (e) {
        errors.push({ mirror, url: linkObj.url, error: e.message });
        continue;
      }
    }
  }
  throw new Error(`All download attempts failed for fileId ${fileId}. Errors: ${JSON.stringify(errors)}`);
}

/**
 * Fetch and parse the ads.php page for a fileId to extract bibtext metadata (including ISBN).
 * @param {string} fileId
 * @param {string} mirror
 * @returns {Promise<object|null>} Parsed bibtex fields or null if not found.
 */
async function fetchBibtexMetadata(md5, mirror) {
  const adsUrl = `${mirror}/ads.php?md5=${md5}`;
  logger.info(`[libgen.bz] Querying ads.php (BibTeX) URL: ${adsUrl}`);
  try {
    const res = await gotWithLog(adsUrl);
    const $ = cheerio.load(res.body);
    // Find all textarea elements
    const textareas = $('textarea');
    if (textareas.length === 0) {
      logger.warn(`[libgen.bz] No textarea found on ads.php for md5 ${md5}`);
      return null;
    }
    if (textareas.length > 1) {
      logger.warn(`[libgen.bz] More than one textarea found on ads.php for md5 ${md5}, using the first one.`);
    }
    const bibtex = $(textareas[0]).text();
    if (!bibtex) return null;
    // Parse bibtex fields (simple key={value} extraction)
    const fields = {};
    const regex = /([a-zA-Z0-9_]+)\s*=\s*[{\"]([^}\"]+)[}\"]/g;
    let match;
    while ((match = regex.exec(bibtex)) !== null) {
      fields[match[1].toLowerCase()] = match[2].trim();
    }
    return fields;
  } catch (e) {
    logger.warn(`[libgen.bz] Failed to fetch/parse bibtex for md5 ${md5}: ${e.message}`);
    return null;
  }
}

function saveTempLogFile(prefix, ext, content) {
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  const filePath = path.join(LOGS_RESPONSES_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// Wrap got to log every URL queried
const gotWithLog = (...args) => {
  let url = args[0];
  if (typeof url === 'object' && url.url) url = url.url;
  if (typeof url === 'string') logger.info(`[libgen.bz] Querying URL: ${url}`);
  return got(...args);
};

module.exports = {
  LIBGEN_PLUS_MIRRORS,
  fetchFileMetadata,
  fetchFileDownloadLinks,
  searchAndFetchLibgenPlus,
  robustDownloadLibgenPlus,
  fetchBibtexMetadata,
  searchLibgenPlusEditions,
}; 