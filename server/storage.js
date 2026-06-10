import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const uploadDir = path.resolve('uploads');
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'campusx-uploads';
const hasSupabaseStorage = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = hasSupabaseStorage
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

export const storageMode = hasSupabaseStorage ? 'Supabase Storage' : 'local uploads folder';

function safeName(originalName = 'upload') {
  return originalName.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function storagePath(file, folder) {
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(file.originalname)}`;
}

export async function initStorage() {
  await fs.mkdir(uploadDir, { recursive: true });
  if (!supabase) return;

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const exists = buckets.some((item) => item.name === bucket);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
      ]
    });
    if (error) throw error;
  }
}

export async function saveUpload(file, folder) {
  if (!file) return null;

  const filePath = storagePath(file, folder);
  if (supabase) {
    const { error } = await supabase.storage.from(bucket).upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const localName = path.basename(filePath);
  await fs.writeFile(path.join(uploadDir, localName), file.buffer);
  return `/uploads/${localName}`;
}
