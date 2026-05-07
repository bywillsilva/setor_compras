import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const bucketName = 'compras-anexos'

async function main() {
  await loadLocalEnvFiles()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()

  if (!url || !secretKey) {
    throw new Error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY antes de executar o reparo de anexos.')
  }

  const client = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  await ensureBucket(client)

  const { data: anexos, error } = await client
    .from('anexos')
    .select('id,compra_id,arquivo_url,nome_arquivo')
    .like('arquivo_url', '/uploads/%')
    .order('id', { ascending: true })

  if (error) {
    throw error
  }

  let migrated = 0
  let missing = 0
  let skipped = 0

  for (const anexo of anexos ?? []) {
    const localPath = path.resolve(process.cwd(), 'public', anexo.arquivo_url.replace(/^\/+/, ''))
    const objectPath = `compras/${anexo.compra_id}/${path.basename(localPath)}`
    const storageUrl = `supabase://${bucketName}/${objectPath}`

    try {
      const buffer = await fs.readFile(localPath)
      const { error: uploadError } = await client.storage.from(bucketName).upload(objectPath, buffer, {
        contentType: getContentType(localPath),
        upsert: false,
      })

      if (uploadError && !uploadError.message.toLowerCase().includes('already exists')) {
        throw uploadError
      }

      const { error: updateError } = await client
        .from('anexos')
        .update({ arquivo_url: storageUrl })
        .eq('id', anexo.id)
        .eq('compra_id', anexo.compra_id)

      if (updateError) {
        throw updateError
      }

      migrated += 1
      console.log(`Migrado anexo #${anexo.id} -> ${storageUrl}`)
    } catch (repairError) {
      const notFound = isFileNotFound(repairError)
      if (notFound) {
        missing += 1
        console.warn(`Arquivo ausente para o anexo #${anexo.id}: ${anexo.arquivo_url}`)
      } else {
        skipped += 1
        console.warn(`Falha ao reparar o anexo #${anexo.id}: ${repairError instanceof Error ? repairError.message : String(repairError)}`)
      }
    }
  }

  console.log(JSON.stringify({ migrated, missing, skipped }))
}

async function loadLocalEnvFiles() {
  for (const fileName of ['.env.local', '.env']) {
    const envPath = path.resolve(process.cwd(), fileName)
    const fileContents = await fs.readFile(envPath, 'utf8').catch(() => null)

    if (!fileContents) {
      continue
    }

    for (const rawLine of fileContents.split(/\r?\n/)) {
      const line = rawLine.trim()

      if (!line || line.startsWith('#')) {
        continue
      }

      const separatorIndex = line.indexOf('=')
      if (separatorIndex <= 0) {
        continue
      }

      const key = line.slice(0, separatorIndex).trim()
      if (!key || process.env[key]) {
        continue
      }

      let value = line.slice(separatorIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  }
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets()
  if (listError) {
    throw listError
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === bucketName)
  if (exists) {
    return
  }

  const { error: createError } = await client.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: '20MB',
  })

  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw createError
  }
}

function isFileNotFound(error) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()

  switch (extension) {
    case '.pdf':
      return 'application/pdf'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.csv':
      return 'text/csv; charset=utf-8'
    case '.xls':
      return 'application/vnd.ms-excel'
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case '.doc':
      return 'application/msword'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'application/octet-stream'
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
