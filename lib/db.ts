import mysql from 'mysql2/promise'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerKey, getSupabaseUrl, hasSupabaseServerConfig } from '@/lib/supabase/config'

export type DatabaseType = 'supabase' | 'mysql' | 'none'

let mysqlPool: mysql.Pool | null = null
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getDatabaseType(): DatabaseType {
  if (hasSupabaseServerConfig()) {
    return 'supabase'
  }

  if (process.env.DATABASE_URL) {
    return 'mysql'
  }

  return 'none'
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    const url = getSupabaseUrl()
    const serviceRoleKey = getSupabaseServerKey()

    if (!url || !serviceRoleKey) {
      return null
    }

    supabaseClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return supabaseClient
}

export function getMySQLPool() {
  if (!mysqlPool) {
    if (!process.env.DATABASE_URL) {
      return null
    }

    mysqlPool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
      decimalNumbers: true,
    })
  }

  return mysqlPool
}

export async function queryMySQL<T>(sql: string, params: unknown[] = []) {
  const pool = getMySQLPool()

  if (!pool) {
    throw new Error('MySQL não configurado')
  }

  const [result] = await pool.execute(sql, params as never)
  return result as T
}

export async function getConnection() {
  const pool = getMySQLPool()

  if (!pool) {
    throw new Error('MySQL não configurado')
  }

  return pool.getConnection()
}

export default {
  getDatabaseType,
  getMySQLPool,
  getSupabaseClient,
}
