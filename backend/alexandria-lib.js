// Alexandria utility module (Libgen logic removed)

const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const axios = require('axios');

// API URLs and helpers
const API_URLS = {
  GOOGLE_BOOKS: "https://www.googleapis.com/books/v1/volumes",
  CROSSREF: "https://api.crossref.org/works",
  SCIHUB: "https://sci-hub.box",
  ANNAS_ARCHIVE: "https://annas-archive.org"
};

// --- Utility: Save temp log file ---
function saveTempLogFile(prefix, ext, content) {
  const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  const filePath = path.join(logger.LOGS_RESPONSES_DIR, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

// --- Utility: Extract ISBNs from string ---
function extractIsbns(identifier) {
  if (!identifier) return [];
  const matches = (identifier.match(/\b(?:97[89][- ]?)?\d{9}[\dXx]\b/g) || []).map(s => s.replace(/[- ]/g, ''));
  return Array.from(new Set(matches));
}

// --- Utility: Parse locator/filename for metadata ---
function parseFilename(locator, metadata) {
  if (!locator) return { title: '', author: '', year: '', extension: '' };
  const cleanLocator = locator.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const regex1 = /^(.*?)\s+-\s+(.*?)\s*(?:\((\d{4})(?:,.*)?\))?\.(\w+)$/;
  const match1 = cleanLocator.match(regex1);
  if (match1) {
    let author = match1[1].trim();
    let title = match1[2].trim();
    if (metadata && metadata.author) {
      const metaAuthor = metadata.author.trim();
      if (metaAuthor === author) {
        return { author, title, year: match1[3] || '', extension: match1[4] ? match1[4].toLowerCase() : '' };
      } else if (metaAuthor === title) {
        return { author: title, title: author, year: match1[3] || '', extension: match1[4] ? match1[4].toLowerCase() : '' };
      }
    }
    return { author, title, year: match1[3] || '', extension: match1[4] ? match1[4].toLowerCase() : '' };
  }
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

// --- Utility: Validate parsed metadata ---
function isValidMetadata(parsed, metadata) {
  const bad = (v) => !v || v === '-' || v === 'N/A' || v === 'Unknown' || v === 'null' || v === 'undefined';
  if (bad(parsed.title) || bad(parsed.author) || bad(parsed.extension)) return false;
  const allowedExt = ['epub', 'pdf', 'mobi', 'azw3', 'djvu', 'fb2', 'txt', 'rtf', 'doc', 'docx', 'cbz', 'cbr'];
  if (!allowedExt.includes(parsed.extension)) return false;
  let filesize = 0;
  if (metadata && metadata.filesize) {
    filesize = parseInt(metadata.filesize, 10);
    if (isNaN(filesize) || filesize <= 0) return false;
  }
  return true;
}

// --- Scoring function for editions ---
function scoreEdition(edition, query) {
  if (!edition || !query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  if (edition.title && edition.title.toLowerCase().includes(q)) score += 5;
  if (edition.author && edition.author.toLowerCase().includes(q)) score += 3;
  if (edition.isbn && q.includes(edition.isbn.replace(/[- ]/g, ''))) score += 10;
  if (edition.identifier && q.includes(edition.identifier.replace(/[- ]/g, ''))) score += 8;
  if (edition.title && q.split(' ').some(word => edition.title.toLowerCase().includes(word))) score += 2;
  if (edition.author && q.split(' ').some(word => edition.author.toLowerCase().includes(word))) score += 1;
  return score;
}

// --- Google Books API ---
async function getGoogleBookInfo(isbn) {
  try {
    const url = `${API_URLS.GOOGLE_BOOKS}?q=isbn:${isbn}`;
    const res = await require('axios').get(url);
    if (res.data && res.data.items && res.data.items.length > 0) {
      const info = res.data.items[0].volumeInfo;
      return {
        title: info.title || '',
        subtitle: info.subtitle || '',
        authors: info.authors || [],
        publisher: info.publisher || '',
        publishedDate: info.publishedDate || '',
        description: info.description || '',
        industryIdentifiers: info.industryIdentifiers || [],
        pages: info.pageCount ? info.pageCount.toString() : '',
        categories: info.categories || [],
        averageRating: info.averageRating || null,
        thumbnail: info.imageLinks ? info.imageLinks.thumbnail : '',
        smallThumbnail: info.imageLinks ? info.imageLinks.smallThumbnail : '',
        language: info.language || '',
        previewLink: info.previewLink || '',
        infoLink: info.infoLink || '',
        canonicalVolumeLink: info.canonicalVolumeLink || '',
        maturityRating: info.maturityRating || '',
        printType: info.printType || '',
        readingModes: info.readingModes || {},
        allowAnonLogging: info.allowAnonLogging || false,
        contentVersion: info.contentVersion || '',
        panelizationSummary: info.panelizationSummary || {},
        saleInfo: res.data.items[0].saleInfo || {},
        accessInfo: res.data.items[0].accessInfo || {},
      };
    }
  } catch (e) {
    logger.warn('Google Books API error:', e);
  }
  return null;
}

async function fetchLibgenFileCountByIsbn(isbn) {
  logger.info('[Main] fetchLibgenFileCountByIsbn called', { isbn });
  if (!isbn || typeof isbn !== 'string' || isbn.trim() === '') {
    logger.info('[Main] fetchLibgenFileCountByIsbn: invalid isbn', { isbn });
    return 0;
  }
  const url = `https://libgen.bz/json.php?object=e&addkeys=*&fields=*&isbn=${encodeURIComponent(isbn)}`;
  try {
    const resp = await axios.get(url, { timeout: 8000 });
    const data = resp.data;
    if (!data || typeof data !== 'object') {
      logger.info('[Main] fetchLibgenFileCountByIsbn: empty or invalid response', { isbn, data });
      return 0;
    }
    let count = 0;
    if (Array.isArray(data)) {
      count = data.length;
    } else if (typeof data === 'object') {
      count = Object.keys(data).length;
    }
    logger.info('[Main] fetchLibgenFileCountByIsbn: success', { isbn, count });
    return count;
  } catch (err) {
    logger.error('[Main] fetchLibgenFileCountByIsbn: error', { isbn, error: err && err.message ? err.message : err });
    return 0;
  }
}

module.exports = {
  saveTempLogFile,
  extractIsbns,
  parseFilename,
  isValidMetadata,
  scoreEdition,
  getGoogleBookInfo,
  fetchLibgenFileCountByIsbn,
}; 