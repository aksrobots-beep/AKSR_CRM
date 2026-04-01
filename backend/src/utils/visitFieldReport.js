import archiver from 'archiver';
import { createWriteStream, mkdirSync, existsSync, unlinkSync, statSync } from 'fs';
import path from 'path';
import os from 'os';

const MAX_FILES = 20;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export { MAX_FILES, MAX_FILE_BYTES };

function safeEntryName(original, used) {
  let base = String(original || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .slice(0, 180);
  if (!base.trim()) base = 'file';
  let out = base;
  let n = 2;
  while (used.has(out)) {
    const dot = base.lastIndexOf('.');
    if (dot > 0) {
      out = `${base.slice(0, dot)}_${n}${base.slice(dot)}`;
    } else {
      out = `${base}_${n}`;
    }
    n += 1;
  }
  used.add(out);
  return out;
}

export function getVisitFieldReportsRoot() {
  // In serverless runtimes (e.g. Vercel), app root is often read-only.
  // Prefer /tmp unless VISIT_FIELD_REPORTS_DIR is explicitly provided.
  const defaultRoot = process.env.VERCEL
    ? path.join(os.tmpdir(), 'visit-field-reports')
    : path.join(process.cwd(), 'uploads', 'visit-field-reports');
  const root = process.env.VISIT_FIELD_REPORTS_DIR || defaultRoot;
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

/** Resolve DB-stored relative path (e.g. visit-field-reports/uuid.zip) under uploads/ */
export function resolveStoredVisitZip(relStored) {
  const rel = String(relStored || '').trim().replace(/^[/\\]+/, '');
  if (!rel || rel.includes('..')) return null;
  const uploadsRoot = path.resolve(path.join(process.cwd(), 'uploads'));
  const full = path.resolve(path.join(uploadsRoot, rel));
  if (!full.startsWith(uploadsRoot)) return null;
  return full;
}

/**
 * Build a deflate-compressed ZIP from in-memory uploads (multer buffers).
 * @param {string} visitId
 * @param {{ buffer: Buffer, originalname?: string }[]} files
 * @returns {Promise<{ relPath: string, manifest: { filenames: string[], size_bytes: number } }>}
 */
export async function writeVisitFieldReportZip(visitId, files) {
  const root = getVisitFieldReportsRoot();
  const zipName = `${visitId}.zip`;
  const abs = path.join(root, zipName);
  if (existsSync(abs)) {
    try {
      unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }

  const used = new Set();
  const filenames = [];

  return new Promise((resolve, reject) => {
    const output = createWriteStream(abs);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const fail = (err) => {
      try {
        output.destroy();
      } catch {
        /* ignore */
      }
      try {
        if (existsSync(abs)) unlinkSync(abs);
      } catch {
        /* ignore */
      }
      reject(err);
    };

    output.on('error', fail);
    archive.on('error', fail);
    output.on('close', () => {
      let size = archive.pointer();
      try {
        const st = statSync(abs);
        size = st.size;
      } catch {
        /* use pointer */
      }
      resolve({
        relPath: `visit-field-reports/${zipName}`,
        manifest: { filenames, size_bytes: size },
      });
    });

    archive.pipe(output);
    for (const f of files) {
      if (!f?.buffer || !Buffer.isBuffer(f.buffer)) continue;
      const entry = safeEntryName(f.originalname, used);
      filenames.push(entry);
      archive.append(f.buffer, { name: entry });
    }
    archive.finalize();
  });
}
