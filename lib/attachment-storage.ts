import { SUPABASE_ATTACHMENT_BUCKET, serializeSupabaseAttachmentUrl } from '@/lib/attachments'
import { getSupabaseClient } from '@/lib/db'

let supabaseAttachmentBucketEnsured = false

export async function ensureSupabaseAttachmentBucket() {
  if (supabaseAttachmentBucketEnsured) {
    return
  }

  const client = getSupabaseClient()

  if (!client) {
    throw new Error('Supabase nao configurado para armazenar anexos.')
  }

  const { data: existingBuckets, error: listError } = await client.storage.listBuckets()
  if (listError) {
    throw new Error(listError.message)
  }

  const bucketAlreadyExists = (existingBuckets ?? []).some((bucket) => bucket.name === SUPABASE_ATTACHMENT_BUCKET)

  if (!bucketAlreadyExists) {
    const { error: createError } = await client.storage.createBucket(SUPABASE_ATTACHMENT_BUCKET, {
      public: false,
      fileSizeLimit: '20MB',
    })

    if (createError && !createError.message.toLowerCase().includes('already exists')) {
      throw new Error(createError.message)
    }
  }

  supabaseAttachmentBucketEnsured = true
}

export async function uploadBufferToSupabaseAttachmentStorage(
  objectPath: string,
  buffer: Buffer,
  contentType?: string | null,
) {
  await ensureSupabaseAttachmentBucket()

  const client = getSupabaseClient()

  if (!client) {
    throw new Error('Supabase nao configurado para armazenar anexos.')
  }

  const { error } = await client.storage.from(SUPABASE_ATTACHMENT_BUCKET).upload(objectPath, buffer, {
    contentType: contentType || undefined,
    upsert: false,
  })

  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw new Error(error.message)
  }

  return serializeSupabaseAttachmentUrl(SUPABASE_ATTACHMENT_BUCKET, objectPath)
}

export async function deleteSupabaseAttachmentObject(bucket: string, objectPath: string) {
  const client = getSupabaseClient()

  if (!client) {
    return
  }

  await client.storage.from(bucket).remove([objectPath]).catch(() => undefined)
}
