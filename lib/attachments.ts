import path from 'path'

export const SUPABASE_ATTACHMENT_BUCKET = 'compras-anexos'

export function isExternalAttachmentUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://')
}

export function isSupabaseAttachmentUrl(value: string) {
  return value.startsWith('supabase://')
}

export function serializeSupabaseAttachmentUrl(bucket: string, objectPath: string) {
  return `supabase://${bucket}/${objectPath.replace(/^\/+/, '')}`
}

export function parseSupabaseAttachmentUrl(value: string) {
  if (!isSupabaseAttachmentUrl(value)) {
    return null
  }

  const withoutScheme = value.replace(/^supabase:\/\//, '')
  const [bucket, ...pathParts] = withoutScheme.split('/')
  const objectPath = pathParts.join('/').replace(/^\/+/, '')

  if (!bucket || !objectPath) {
    return null
  }

  return { bucket, objectPath }
}

export function resolveLocalAttachmentPath(arquivoUrl: string) {
  if (isSupabaseAttachmentUrl(arquivoUrl)) {
    return null
  }

  const pathname = extractAttachmentPathname(arquivoUrl)
  const relativePath = pathname.replace(/^\/+/, '')
  const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads')
  const attachmentPath = path.resolve(process.cwd(), 'public', relativePath)

  if (attachmentPath === uploadsRoot || attachmentPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return attachmentPath
  }

  return null
}

function extractAttachmentPathname(value: string) {
  if (isExternalAttachmentUrl(value)) {
    try {
      return new URL(value).pathname
    } catch {
      return value
    }
  }

  return value
}
