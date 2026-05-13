import { access, rm } from 'fs/promises'
import path from 'path'
import { format, isAfter, isBefore, parseISO, subMonths } from 'date-fns'
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise'
import { deleteSupabaseAttachmentObject } from '@/lib/attachment-storage'
import {
  isExternalAttachmentUrl,
  isSupabaseAttachmentUrl,
  parseSupabaseAttachmentUrl,
  resolveLocalAttachmentPath,
} from '@/lib/attachments'
import { hashPassword } from '@/lib/auth/password'
import {
  ALL_APP_FEATURES,
  buildFeatureMatrix,
  getDefaultFeatureMatrix,
  getDefaultFeaturesForPerfil,
  normalizeFeatureList,
  PERFIL_LABELS,
} from '@/lib/auth/permissions'
import { getDatabaseType, getMySQLPool, getSupabaseClient, queryMySQL, type DatabaseType } from '@/lib/db'
import {
  calculateFinanceDifference,
  getCompraCategoriaTotal,
  getDeliverySituation,
  getCompraCategoriaPrincipal,
  normalizeEtapaFluxoCompra,
  normalizeCategoriaCompra,
  normalizeEtapaAutorizacao,
  normalizeStatusEntrega,
  normalizeStatusPedido,
  resolveCompraCategoriaValues,
  resolvePropostaValues,
  STATUS_LABELS,
} from '@/lib/domain'
import { normalizeThemePreference } from '@/lib/theme'
import type {
  Anexo,
  AppFeature,
  Cliente,
  Compra,
  CompraFormData,
  DashboardAtualizacaoResumo,
  DashboardData,
  DeliveryMetrics,
  EtapaFluxoCompra,
  EtapaAutorizacao,
  FinanceiroReportItem,
  HistoricoCompra,
  HistoricoReportItem,
  PerfilPermissao,
  PerfilUsuario,
  Proposta,
  PropostaFormData,
  PurchaseFilters,
  ResumoContrato,
  ResumoContratoDetalhe,
  ResumoContratoFormData,
  ResumoContratoObra,
  ResumoContratoReferencia,
  SolicitacaoSensivel,
  SolicitacaoSensivelAcao,
  SolicitacaoSensivelEntidade,
  SolicitacaoSensivelStatus,
  SituacaoEntrega,
  StatusEntrega,
  StatusPedido,
  TemaPreferido,
  TipoAnexo,
  Usuario,
  UsuarioFormData,
} from '@/lib/types'

type Row = Record<string, unknown>

export interface SetupStatus {
  configured: boolean
  dbType: DatabaseType
  existingTables: string[]
  missingTables: string[]
  setupScript: string | null
}

interface ReportFilters {
  clienteId?: number
  propostaId?: number
  dataInicio?: string | null
  dataFim?: string | null
  status?: StatusPedido
}

const REQUIRED_TABLES = [
  'clientes',
  'usuarios',
  'propostas',
  'compras',
  'historico_compras',
  'anexos',
  'solicitacoes_sensiveis',
  'resumos_contratos',
  'resumo_contrato_itens',
] as const
const REQUIRED_SCHEMA_COLUMNS: Record<(typeof REQUIRED_TABLES)[number], string[]> = {
  clientes: ['id', 'nome', 'documento', 'contato', 'email', 'arquivado', 'created_at', 'updated_at'],
  usuarios: ['id', 'nome', 'email', 'senha_hash', 'perfil', 'tema_preferido', 'ativo', 'created_at', 'updated_at'],
  propostas: [
    'id',
    'cliente_id',
    'nome',
    'data_inicio',
    'data_fim',
    'valor_previsto',
    'valor_previsto_perfis',
    'valor_previsto_vidros',
    'valor_previsto_acessorios',
    'valor_previsto_outros',
    'custo_perdas',
    'arquivado',
    'created_at',
    'updated_at',
  ],
  compras: [
    'id',
    'cliente_id',
    'proposta_id',
    'solicitante_id',
    'solicitado_por',
    'categoria',
    'fornecedor',
    'descricao',
    'valor_total',
    'valor_categoria_perfis',
    'valor_categoria_vidros',
    'valor_categoria_acessorios',
    'valor_categoria_perdas',
    'valor_categoria_outros',
    'numero_pedido',
    'status',
    'status_entrega',
    'etapa_autorizacao',
    'etapa_fluxo',
    'previsao_entrega',
    'data_envio_fornecedor',
    'cotacao_enviada_por',
    'cotacao_recebida_em',
    'cotacao_recebida_por',
    'aprovado_solicitante_em',
    'aprovado_solicitante_por',
    'aprovado_admin_em',
    'aprovado_admin_por',
    'aprovado_financeiro_em',
    'aprovado_financeiro_por',
    'documentos_financeiro_confirmados_em',
    'documentos_financeiro_confirmados_por',
    'confirmado_fornecedor_em',
    'confirmado_fornecedor_por',
    'data_entrega_real',
    'data_criacao',
    'updated_at',
    'arquivado',
  ],
  historico_compras: ['id', 'compra_id', 'evento', 'data', 'usuario'],
  anexos: ['id', 'compra_id', 'tipo', 'arquivo_url', 'nome_arquivo', 'created_at'],
  solicitacoes_sensiveis: [
    'id',
    'entidade',
    'entidade_id',
    'acao',
    'status',
    'motivo',
    'payload',
    'solicitante_id',
    'solicitante_nome',
    'solicitante_perfil',
    'aprovado_por',
    'aprovado_em',
    'recusado_por',
    'recusado_em',
    'observacao_admin',
    'created_at',
    'updated_at',
  ],
  resumos_contratos: [
    'id',
    'titulo',
    'periodo_referencia',
    'created_by_user_id',
    'created_by_nome',
    'created_at',
    'updated_at',
  ],
  resumo_contrato_itens: [
    'id',
    'resumo_id',
    'proposta_id',
    'cliente_id',
    'valor_contrato',
    'ordem',
    'created_at',
    'updated_at',
  ],
}

type PerfilFeatureMatrix = Record<PerfilUsuario, AppFeature[]>

const REQUIRED_TABLES_WITH_PERMISSIONS = [...REQUIRED_TABLES, 'perfil_permissoes', 'usuario_permissoes'] as const
const REQUIRED_SCHEMA_COLUMNS_WITH_PERMISSIONS: Record<(typeof REQUIRED_TABLES_WITH_PERMISSIONS)[number], string[]> = {
  ...REQUIRED_SCHEMA_COLUMNS,
  perfil_permissoes: ['id', 'perfil', 'feature', 'permitido', 'created_at', 'updated_at'],
  usuario_permissoes: ['id', 'usuario_id', 'feature', 'permitido', 'created_at', 'updated_at'],
}

let perfilFeatureMatrixCache:
  | {
      expiresAt: number
      matrix: PerfilFeatureMatrix
    }
  | null = null

const REQUIRED_MYSQL_ENUM_VALUES = {
  'usuarios.perfil': ['admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro'],
  'usuarios.tema_preferido': ['claro', 'escuro'],
  'compras.categoria': ['perfis', 'vidros', 'acessorios', 'perdas', 'outros'],
  'compras.status': ['cotacao', 'em_analise', 'retificacao', 'pedido_autorizado'],
  'compras.status_entrega': ['pendente', 'entregue'],
  'compras.etapa_autorizacao': ['nenhuma', 'solicitada', 'liberada'],
  'compras.etapa_fluxo': [
    'solicitacao_registrada',
    'cotacao_em_andamento',
    'analise_solicitante',
    'retificacao',
    'aprovada_solicitante',
    'aguardando_admin',
    'aprovada_admin',
    'aguardando_financeiro',
    'liberada_para_fornecedor',
    'pedido_autorizado',
  ],
  'anexos.tipo': ['cotacao', 'nf', 'boleto', 'outro'],
} as const

export async function getSetupStatus(): Promise<SetupStatus> {
  const dbType = getDatabaseType()

  if (dbType === 'mysql') {
    return checkMySQLSetup()
  }

  if (dbType === 'supabase') {
    return checkSupabaseSetup()
  }

  return {
    configured: false,
    dbType: 'none',
    existingTables: [],
    missingTables: [...REQUIRED_TABLES_WITH_PERMISSIONS],
    setupScript: null,
  }
}

export async function setupDatabase() {
  const dbType = getDatabaseType()

  if (dbType === 'mysql') {
    await setupMySQLDatabase()
    await ensureDefaultAdminUser()
    return { success: true, dbType }
  }

  if (dbType === 'supabase') {
    const status = await checkSupabaseSetup()

    if (!status.configured) {
      return {
        success: false,
        dbType,
        error: 'Estrutura do banco fora da versão atual',
        details: `Execute ${status.setupScript ?? 'scripts/setup-database-supabase.sql'} no SQL Editor do Supabase.`,
      }
    }

    await ensureDefaultAdminUser()
    return { success: true, dbType }
  }

  return {
    success: false,
    dbType: 'none' as const,
    error: 'Nenhum banco de dados configurado',
    details:
      'Configure DATABASE_URL para MySQL ou NEXT_PUBLIC_SUPABASE_URL junto com NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY para Supabase.',
  }
}

export async function getUsuarioByEmail(email: string): Promise<Usuario | null> {
  const normalizedEmail = sanitizeEmail(email)

  if (!normalizedEmail) {
    return null
  }

  let usuario = await getUsuarioByEmailInternal(normalizedEmail)

  if (usuario) {
    return usuario
  }

  await ensureDefaultAdminUser()
  usuario = await getUsuarioByEmailInternal(normalizedEmail)
  return usuario
}

export async function getUsuarioById(id: number): Promise<Usuario | null> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [id])
    return rows[0] ? normalizeUsuario(rows[0]) : null
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('usuarios').select('*').eq('id', id).maybeSingle()
  throwIfSupabaseError(error)
  return data ? normalizeUsuario(data as Row) : null
}

export async function ensureDefaultAdminUser() {
  const totalUsuarios = await countRows('usuarios', {})

  if (totalUsuarios > 0) {
    return
  }

  await createUsuarioInternal({
    nome: process.env.APP_ADMIN_NAME?.trim() || 'Administrador do Sistema',
    email: sanitizeEmail(process.env.APP_ADMIN_EMAIL || 'admin@compras.local'),
    senha_hash: hashPassword(process.env.APP_ADMIN_PASSWORD || 'admin123456'),
    perfil: 'admin',
    tema_preferido: 'claro',
    ativo: true,
  })
}

export async function listPerfilFeatureMatrix(): Promise<PerfilFeatureMatrix> {
  if (perfilFeatureMatrixCache && perfilFeatureMatrixCache.expiresAt > Date.now()) {
    return cloneFeatureMatrix(perfilFeatureMatrixCache.matrix)
  }

  const defaultMatrix = getDefaultFeatureMatrix()
  const records = await listPerfilPermissoesInternal()

  if (!records) {
    perfilFeatureMatrixCache = {
      expiresAt: Date.now() + 30_000,
      matrix: defaultMatrix,
    }
    return cloneFeatureMatrix(defaultMatrix)
  }

  if (records.length === 0) {
    await ensureDefaultPerfilPermissoes()
    const seeded = await listPerfilPermissoesInternal()
    const matrix = seeded && seeded.length > 0 ? buildFeatureMatrix(seeded) : defaultMatrix
    perfilFeatureMatrixCache = {
      expiresAt: Date.now() + 30_000,
      matrix,
    }
    return cloneFeatureMatrix(matrix)
  }

  const matrix = buildFeatureMatrix(records)
  perfilFeatureMatrixCache = {
    expiresAt: Date.now() + 30_000,
    matrix,
  }
  return cloneFeatureMatrix(matrix)
}

export async function listFeaturesByPerfil(perfil: PerfilUsuario) {
  try {
    const matrix = await listPerfilFeatureMatrix()
    return [...matrix[perfil]]
  } catch (error) {
    console.warn(
      'Falha ao consultar permissoes por perfil no banco. Aplicando matriz padrao temporariamente.',
      error,
    )
    return getDefaultFeaturesForPerfil(perfil)
  }
}

export async function listFeaturesByUsuario(userId: number, perfil: PerfilUsuario) {
  try {
    const features = await listUsuarioFeaturesInternal(userId)

    if (!features || features.length === 0) {
      return await listFeaturesByPerfil(perfil)
    }

    return normalizeFeatureList(features, perfil)
  } catch (error) {
    console.warn(
      'Falha ao consultar permissoes do usuario no banco. Aplicando permissoes do perfil temporariamente.',
      error,
    )
    return listFeaturesByPerfil(perfil)
  }
}

export async function saveUsuarioFeatures(userId: number, perfil: PerfilUsuario, features: AppFeature[]) {
  const dbType = getDatabaseType()

  if (dbType === 'none') {
    throw new Error('Nenhum banco de dados configurado para salvar permissoes de usuario.')
  }

  const normalizedFeatures = normalizeFeatureList(features, perfil)

  if (dbType === 'mysql') {
    const pool = getMySQLPool()
    if (!pool) {
      throw new Error('MySQL nao configurado para salvar permissoes de usuario.')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute('DELETE FROM usuario_permissoes WHERE usuario_id = ?', [userId])

      for (const feature of normalizedFeatures) {
        await connection.execute(
          'INSERT INTO usuario_permissoes (usuario_id, feature, permitido) VALUES (?, ?, 1)',
          [userId, feature],
        )
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } else {
    const client = getSupabaseOrThrow()
    const { error: deleteError } = await client.from('usuario_permissoes').delete().eq('usuario_id', userId)
    throwIfSupabaseError(deleteError)

    if (normalizedFeatures.length > 0) {
      const rows = normalizedFeatures.map((feature) => ({
        usuario_id: userId,
        feature,
        permitido: true,
      }))
      const { error: insertError } = await client.from('usuario_permissoes').insert(rows)
      throwIfSupabaseError(insertError)
    }
  }

  return normalizedFeatures
}

export async function savePerfilFeatureMatrix(input: PerfilFeatureMatrix) {
  const dbType = getDatabaseType()

  if (dbType === 'none') {
    throw new Error('Nenhum banco de dados configurado para salvar permissoes.')
  }

  const matrix = Object.fromEntries(
    (Object.keys(PERFIL_LABELS) as PerfilUsuario[]).map((perfil) => [
      perfil,
      normalizeFeatureList(input[perfil], perfil),
    ]),
  ) as PerfilFeatureMatrix

  if (dbType === 'mysql') {
    const pool = getMySQLPool()
    if (!pool) {
      throw new Error('MySQL nao configurado para salvar permissoes.')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute('DELETE FROM perfil_permissoes')

      for (const [perfil, features] of Object.entries(matrix) as Array<[PerfilUsuario, AppFeature[]]>) {
        for (const feature of features) {
          await connection.execute(
            'INSERT INTO perfil_permissoes (perfil, feature, permitido) VALUES (?, ?, 1)',
            [perfil, feature],
          )
        }
      }

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } else {
    const client = getSupabaseOrThrow()
    const { error: deleteError } = await client.from('perfil_permissoes').delete().neq('id', 0)
    throwIfSupabaseError(deleteError)

    const rows = (Object.entries(matrix) as Array<[PerfilUsuario, AppFeature[]]>).flatMap(([perfil, features]) =>
      features.map((feature) => ({
        perfil,
        feature,
        permitido: true,
      })),
    )

    if (rows.length > 0) {
      const { error: insertError } = await client.from('perfil_permissoes').insert(rows)
      throwIfSupabaseError(insertError)
    }
  }

  resetPerfilFeatureMatrixCache()
  return matrix
}

async function createUsuarioInternal(input: {
  nome: string
  email: string
  senha_hash: string
  perfil: PerfilUsuario
  tema_preferido: TemaPreferido
  ativo: boolean
}) {
  if (getDatabaseType() === 'mysql') {
    const result = await mysqlExecute(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil, tema_preferido, ativo) VALUES (?, ?, ?, ?, ?, ?)',
      [input.nome, input.email, input.senha_hash, input.perfil, input.tema_preferido, input.ativo ? 1 : 0],
    )
    return result.insertId
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('usuarios')
    .insert({
        nome: input.nome,
        email: input.email,
        senha_hash: input.senha_hash,
        perfil: input.perfil,
        tema_preferido: input.tema_preferido,
        ativo: input.ativo,
      })
    .select('id')
    .single()
  throwIfSupabaseError(error)
  return Number(data.id)
}

export async function listUsuarios(): Promise<Usuario[]> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM usuarios ORDER BY nome ASC')
    return rows.map(normalizeUsuario)
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('usuarios').select('*').order('nome', { ascending: true })
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeUsuario(row))
}

export async function createUsuario(input: UsuarioFormData) {
  const email = sanitizeEmail(input.email)

  if (!email || !nullableString(input.senha)) {
    throw new Error('Nome, email e senha sao obrigatorios.')
  }

  const existingUser = await getUsuarioByEmail(email)

  if (existingUser) {
    throw new Error('Ja existe um usuario com este email.')
  }

  const id = await createUsuarioInternal({
    nome: input.nome.trim(),
    email,
    senha_hash: hashPassword(String(input.senha)),
    perfil: input.perfil,
    tema_preferido: normalizeThemePreference(input.tema_preferido),
    ativo: input.ativo,
  })

  await saveUsuarioFeatures(id, input.perfil, input.features ?? (await listFeaturesByPerfil(input.perfil)))
  return id
}

export async function updateUsuario(id: number, input: UsuarioFormData) {
  const email = sanitizeEmail(input.email)
  const usuarioAtual = await getUsuarioById(id)

  if (!usuarioAtual) {
    throw new Error('Usuario nao encontrado.')
  }

  const existingUser = await getUsuarioByEmail(email)

  if (existingUser && existingUser.id !== id) {
    throw new Error('Ja existe um usuario com este email.')
  }

  if (getDatabaseType() === 'mysql') {
    if (nullableString(input.senha)) {
      await mysqlExecute(
        'UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, perfil = ?, tema_preferido = ?, ativo = ? WHERE id = ?',
        [
          input.nome.trim(),
          email,
          hashPassword(String(input.senha)),
          input.perfil,
          normalizeThemePreference(input.tema_preferido ?? usuarioAtual.tema_preferido),
          input.ativo ? 1 : 0,
          id,
        ],
      )
    } else {
      await mysqlExecute('UPDATE usuarios SET nome = ?, email = ?, perfil = ?, tema_preferido = ?, ativo = ? WHERE id = ?', [
        input.nome.trim(),
        email,
        input.perfil,
        normalizeThemePreference(input.tema_preferido ?? usuarioAtual.tema_preferido),
        input.ativo ? 1 : 0,
        id,
      ])
    }
    if (input.features) {
      await saveUsuarioFeatures(id, input.perfil, input.features)
    } else if (usuarioAtual.perfil !== input.perfil) {
      await saveUsuarioFeatures(id, input.perfil, await listFeaturesByPerfil(input.perfil))
    }
    return
  }

  const client = getSupabaseOrThrow()
  const updatePayload: Record<string, unknown> = {
    nome: input.nome.trim(),
    email,
    perfil: input.perfil,
    tema_preferido: normalizeThemePreference(input.tema_preferido ?? usuarioAtual.tema_preferido),
    ativo: input.ativo,
  }

  if (nullableString(input.senha)) {
    updatePayload.senha_hash = hashPassword(String(input.senha))
  }

  const { error } = await client.from('usuarios').update(updatePayload).eq('id', id)
  throwIfSupabaseError(error)

  if (input.features) {
    await saveUsuarioFeatures(id, input.perfil, input.features)
  } else if (usuarioAtual.perfil !== input.perfil) {
    await saveUsuarioFeatures(id, input.perfil, await listFeaturesByPerfil(input.perfil))
  }
}

export async function saveUsuarioTheme(id: number, tema: TemaPreferido) {
  const normalizedTheme = normalizeThemePreference(tema)

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('UPDATE usuarios SET tema_preferido = ? WHERE id = ?', [normalizedTheme, id])
    return normalizedTheme
  }

  const client = getSupabaseOrThrow()
  const { error } = await client.from('usuarios').update({ tema_preferido: normalizedTheme }).eq('id', id)
  throwIfSupabaseError(error)
  return normalizedTheme
}

async function getUsuarioByEmailInternal(email: string): Promise<Usuario | null> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM usuarios WHERE LOWER(email) = LOWER(?) LIMIT 1', [email])
    return rows[0] ? normalizeUsuario(rows[0]) : null
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('usuarios').select('*').eq('email', email).maybeSingle()
  throwIfSupabaseError(error)
  return data ? normalizeUsuario(data as Row) : null
}

async function listUsuarioFeaturesInternal(userId: number): Promise<AppFeature[] | null> {
  try {
    if (getDatabaseType() === 'mysql') {
      const rows = await mysqlSelect('SELECT feature FROM usuario_permissoes WHERE usuario_id = ? AND permitido = 1', [userId])
      return rows.map((row) => normalizeAppFeature(row.feature))
    }

    if (getDatabaseType() === 'supabase') {
      const client = getSupabaseOrThrow()
      const { data, error } = await client
        .from('usuario_permissoes')
        .select('feature')
        .eq('usuario_id', userId)
        .eq('permitido', true)

      if (error) {
        if (error.code === '42P01' || error.message.toLowerCase().includes('does not exist')) {
          return null
        }

        throw new Error(error.message)
      }

      return (data ?? []).map((row: Row) => normalizeAppFeature(row.feature))
    }

    return null
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('usuario_permissoes') && (message.includes('does not exist') || message.includes("doesn't exist"))) {
      return null
    }

    throw error
  }
}

export async function listClientes(filters: { includeArchived?: boolean; onlyArchived?: boolean } = {}): Promise<Cliente[]> {
  if (getDatabaseType() === 'mysql') {
    let sql = 'SELECT * FROM clientes WHERE 1 = 1'
    const params: unknown[] = []

    if (filters.onlyArchived) {
      sql += ' AND arquivado = 1'
    } else if (!filters.includeArchived) {
      sql += ' AND arquivado = 0'
    }

    sql += ' ORDER BY nome ASC'
    const rows = await mysqlSelect(sql, params)
    return rows.map(normalizeCliente)
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('clientes').select('*').order('nome', { ascending: true })
  throwIfSupabaseError(error)
  return (data ?? [])
    .map((row: Row) => normalizeCliente(row))
    .filter((cliente: Cliente) => (filters.onlyArchived ? cliente.arquivado : filters.includeArchived || !cliente.arquivado))
}

export async function getClienteById(id: number): Promise<Cliente | null> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM clientes WHERE id = ? LIMIT 1', [id])
    return rows[0] ? normalizeCliente(rows[0]) : null
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('clientes').select('*').eq('id', id).maybeSingle()
  throwIfSupabaseError(error)
  return data ? normalizeCliente(data as Row) : null
}

export async function createCliente(input: Pick<Cliente, 'nome' | 'documento' | 'contato' | 'email'>) {
  if (getDatabaseType() === 'mysql') {
    const result = await mysqlExecute(
      'INSERT INTO clientes (nome, documento, contato, email) VALUES (?, ?, ?, ?)',
      [input.nome, nullableString(input.documento), nullableString(input.contato), nullableString(input.email)],
    )
    return result.insertId
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('clientes')
    .insert({
      nome: input.nome,
      documento: nullableString(input.documento),
      contato: nullableString(input.contato),
      email: nullableString(input.email),
    })
    .select('id')
    .single()
  throwIfSupabaseError(error)
  return Number(data.id)
}

export async function updateCliente(id: number, input: Pick<Cliente, 'nome' | 'documento' | 'contato' | 'email'>) {
  if (getDatabaseType() === 'mysql') {
    await mysqlExecute(
      'UPDATE clientes SET nome = ?, documento = ?, contato = ?, email = ? WHERE id = ?',
      [input.nome, nullableString(input.documento), nullableString(input.contato), nullableString(input.email), id],
    )
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client
    .from('clientes')
    .update({
      nome: input.nome,
      documento: nullableString(input.documento),
      contato: nullableString(input.contato),
      email: nullableString(input.email),
    })
    .eq('id', id)
  throwIfSupabaseError(error)
}

export async function deleteCliente(id: number) {
  const [propostasRelacionadas, comprasRelacionadas] = await Promise.all([
    countRows('propostas', { cliente_id: id }),
    countRows('compras', { cliente_id: id }),
  ])

  if (propostasRelacionadas > 0 || comprasRelacionadas > 0) {
    throw new Error('Não é possível excluir um cliente com propostas ou compras vinculadas.')
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('DELETE FROM clientes WHERE id = ?', [id])
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client.from('clientes').delete().eq('id', id)
  throwIfSupabaseError(error)
}

export async function setClienteArchivedState(id: number, arquivado: boolean) {
  const cliente = await getClienteById(id)

  if (!cliente) {
    throw new Error('Cliente nÃ£o encontrado.')
  }

  if (cliente.arquivado === arquivado) {
    return { archived: arquivado }
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('UPDATE clientes SET arquivado = ? WHERE id = ?', [arquivado ? 1 : 0, id])
  } else {
    const client = getSupabaseOrThrow()
    const { error } = await client.from('clientes').update({ arquivado }).eq('id', id)
    throwIfSupabaseError(error)
  }

  return { archived: arquivado }
}

export async function listPropostas(filters: {
  clienteId?: number
  includeArchived?: boolean
  onlyArchived?: boolean
} = {}): Promise<Proposta[]> {
  const [propostas, clientes] = await Promise.all([
    listPropostasRaw(filters),
    listClientes({ includeArchived: true }),
  ])
  const clientesById = new Map(clientes.map((cliente) => [cliente.id, cliente.nome]))

  return propostas.map((proposta) => ({
    ...proposta,
    cliente_nome: clientesById.get(proposta.cliente_id) ?? 'Cliente não identificado',
  }))
}

export async function getPropostaById(id: number): Promise<Proposta | null> {
  const [proposta] = await listPropostasRaw({ id, includeArchived: true })

  if (!proposta) {
    return null
  }

  const cliente = await getClienteById(proposta.cliente_id)
  return {
    ...proposta,
    cliente_nome: cliente?.nome ?? 'Cliente não identificado',
  }
}

export async function createProposta(input: PropostaFormData) {
  const values = resolvePropostaValues(input)

  if (getDatabaseType() === 'mysql') {
    const result = await mysqlExecute(
      `INSERT INTO propostas (
        cliente_id,
        nome,
        data_inicio,
        data_fim,
        valor_previsto,
        valor_previsto_perfis,
        valor_previsto_vidros,
        valor_previsto_acessorios,
        valor_previsto_outros,
        custo_perdas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.cliente_id,
        input.nome,
        nullableString(input.data_inicio),
        nullableString(input.data_fim),
        values.valor_previsto,
        values.valor_previsto_perfis,
        values.valor_previsto_vidros,
        values.valor_previsto_acessorios,
        values.valor_previsto_outros,
        values.custo_perdas,
      ],
    )
    return result.insertId
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('propostas')
    .insert({
      cliente_id: input.cliente_id,
      nome: input.nome,
      data_inicio: nullableString(input.data_inicio),
      data_fim: nullableString(input.data_fim),
      ...values,
    })
    .select('id')
    .single()
  throwIfSupabaseError(error)
  return Number(data.id)
}

export async function updateProposta(id: number, input: PropostaFormData) {
  const values = resolvePropostaValues(input)

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute(
      `UPDATE propostas SET
        cliente_id = ?,
        nome = ?,
        data_inicio = ?,
        data_fim = ?,
        valor_previsto = ?,
        valor_previsto_perfis = ?,
        valor_previsto_vidros = ?,
        valor_previsto_acessorios = ?,
        valor_previsto_outros = ?,
        custo_perdas = ?
      WHERE id = ?`,
      [
        input.cliente_id,
        input.nome,
        nullableString(input.data_inicio),
        nullableString(input.data_fim),
        values.valor_previsto,
        values.valor_previsto_perfis,
        values.valor_previsto_vidros,
        values.valor_previsto_acessorios,
        values.valor_previsto_outros,
        values.custo_perdas,
        id,
      ],
    )
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client
    .from('propostas')
    .update({
      cliente_id: input.cliente_id,
      nome: input.nome,
      data_inicio: nullableString(input.data_inicio),
      data_fim: nullableString(input.data_fim),
      ...values,
    })
    .eq('id', id)
  throwIfSupabaseError(error)
}

export async function deleteProposta(id: number) {
  const comprasRelacionadas = await countRows('compras', { proposta_id: id })

  if (comprasRelacionadas > 0) {
    throw new Error('Não é possível excluir uma proposta com compras vinculadas.')
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('DELETE FROM propostas WHERE id = ?', [id])
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client.from('propostas').delete().eq('id', id)
  throwIfSupabaseError(error)
}

export async function setPropostaArchivedState(id: number, arquivado: boolean) {
  const proposta = await getPropostaById(id)

  if (!proposta) {
    throw new Error('Proposta nÃ£o encontrada.')
  }

  if (proposta.arquivado === arquivado) {
    return { archived: arquivado }
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('UPDATE propostas SET arquivado = ? WHERE id = ?', [arquivado ? 1 : 0, id])
  } else {
    const client = getSupabaseOrThrow()
    const { error } = await client.from('propostas').update({ arquivado }).eq('id', id)
    throwIfSupabaseError(error)
  }

  return { archived: arquivado }
}

export async function createSensitiveChangeRequest(input: {
  entidade: SolicitacaoSensivelEntidade
  entidade_id: number
  acao: SolicitacaoSensivelAcao
  motivo?: string | null
  payload?: Record<string, unknown> | null
  solicitante_id: number
  solicitante_nome: string
  solicitante_perfil: PerfilUsuario
}) {
  const motivo = nullableString(input.motivo)
  const payload = input.payload && Object.keys(input.payload).length > 0 ? input.payload : null

  if (getDatabaseType() === 'mysql') {
    const result = await mysqlExecute(
      `INSERT INTO solicitacoes_sensiveis (
        entidade, entidade_id, acao, status, motivo, payload, solicitante_id, solicitante_nome, solicitante_perfil
      ) VALUES (?, ?, ?, 'pendente', ?, ?, ?, ?, ?)`,
      [
        input.entidade,
        input.entidade_id,
        input.acao,
        motivo,
        payload ? JSON.stringify(payload) : null,
        input.solicitante_id,
        input.solicitante_nome,
        input.solicitante_perfil,
      ],
    )
    return result.insertId
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('solicitacoes_sensiveis')
    .insert({
      entidade: input.entidade,
      entidade_id: input.entidade_id,
      acao: input.acao,
      status: 'pendente',
      motivo,
      payload,
      solicitante_id: input.solicitante_id,
      solicitante_nome: input.solicitante_nome,
      solicitante_perfil: input.solicitante_perfil,
    })
    .select('id')
    .single()
  throwIfSupabaseError(error)
  return Number(data.id)
}

export async function listSensitiveChangeRequests(filters: {
  status?: SolicitacaoSensivelStatus
  solicitanteId?: number
} = {}) {
  if (getDatabaseType() === 'mysql') {
    let sql = 'SELECT * FROM solicitacoes_sensiveis WHERE 1 = 1'
    const params: unknown[] = []

    if (filters.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters.solicitanteId) {
      sql += ' AND solicitante_id = ?'
      params.push(filters.solicitanteId)
    }

    sql += ' ORDER BY created_at DESC'
    const rows = await mysqlSelect(sql, params)
    return rows.map(normalizeSolicitacaoSensivel)
  }

  const client = getSupabaseOrThrow()
  let query = client.from('solicitacoes_sensiveis').select('*').order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.solicitanteId) {
    query = query.eq('solicitante_id', filters.solicitanteId)
  }

  const { data, error } = await query
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeSolicitacaoSensivel(row))
}

export async function approveSensitiveChangeRequest(id: number, usuario: string, observacaoAdmin?: string | null) {
  const request = await getSensitiveChangeRequestById(id)

  if (!request) {
    throw new Error('Solicitacao nao encontrada.')
  }

  if (request.status !== 'pendente') {
    throw new Error('Esta solicitacao ja foi concluida.')
  }

  await applySensitiveChangeRequest(request, usuario)

  const observacao = nullableString(observacaoAdmin)
  const approvedAt = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute(
      `UPDATE solicitacoes_sensiveis
       SET status = 'aprovada', aprovado_por = ?, aprovado_em = ?, observacao_admin = ?, recusado_por = NULL, recusado_em = NULL
       WHERE id = ?`,
      [usuario, approvedAt, observacao, id],
    )
  } else {
    const client = getSupabaseOrThrow()
    const { error } = await client
      .from('solicitacoes_sensiveis')
      .update({
        status: 'aprovada',
        aprovado_por: usuario,
        aprovado_em: approvedAt,
        observacao_admin: observacao,
        recusado_por: null,
        recusado_em: null,
      })
      .eq('id', id)
    throwIfSupabaseError(error)
  }

  return { approved: true }
}

export async function rejectSensitiveChangeRequest(id: number, usuario: string, observacaoAdmin?: string | null) {
  const request = await getSensitiveChangeRequestById(id)

  if (!request) {
    throw new Error('Solicitacao nao encontrada.')
  }

  if (request.status !== 'pendente') {
    throw new Error('Esta solicitacao ja foi concluida.')
  }

  const observacao = nullableString(observacaoAdmin)
  const rejectedAt = format(new Date(), 'yyyy-MM-dd HH:mm:ss')

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute(
      `UPDATE solicitacoes_sensiveis
       SET status = 'recusada', recusado_por = ?, recusado_em = ?, observacao_admin = ?, aprovado_por = NULL, aprovado_em = NULL
       WHERE id = ?`,
      [usuario, rejectedAt, observacao, id],
    )
  } else {
    const client = getSupabaseOrThrow()
    const { error } = await client
      .from('solicitacoes_sensiveis')
      .update({
        status: 'recusada',
        recusado_por: usuario,
        recusado_em: rejectedAt,
        observacao_admin: observacao,
        aprovado_por: null,
        aprovado_em: null,
      })
      .eq('id', id)
    throwIfSupabaseError(error)
  }

  return { rejected: true }
}

export async function listCompras(filters: PurchaseFilters = {}): Promise<Compra[]> {
  const [compras, clientes, propostas] = await Promise.all([
    listComprasRaw(filters),
    listClientes({ includeArchived: true }),
    listPropostasRaw({ includeArchived: true }),
  ])

  const clientesById = new Map(clientes.map((cliente) => [cliente.id, cliente.nome]))
  const propostasById = new Map(propostas.map((proposta) => [proposta.id, proposta.nome]))
  const anexosByCompraId = await getAnexoSummaryByCompraIds(compras.map((compra) => compra.id))

  return compras.map((compra) => ({
    ...compra,
    cliente_nome: clientesById.get(compra.cliente_id) ?? 'Cliente não identificado',
    proposta_nome: propostasById.get(compra.proposta_id) ?? 'Proposta não identificada',
    possui_nf: anexosByCompraId.get(compra.id)?.possui_nf ?? false,
    possui_boleto: anexosByCompraId.get(compra.id)?.possui_boleto ?? false,
  }))
}

async function getCompraRecordById(id: number): Promise<Row | null> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM compras WHERE id = ? LIMIT 1', [id])
    return rows[0] ?? null
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('compras').select('*').eq('id', id).maybeSingle()
  throwIfSupabaseError(error)
  return data ? (data as Row) : null
}

export async function getCompraById(id: number): Promise<Compra | null> {
  const record = await getCompraRecordById(id)

  if (!record) {
    return null
  }

  const compra = normalizeCompra(record)
  const [cliente, proposta, anexosByCompraId] = await Promise.all([
    getClienteById(compra.cliente_id),
    getPropostaById(compra.proposta_id),
    getAnexoSummaryByCompraIds([compra.id]),
  ])

  return {
    ...compra,
    cliente_nome: cliente?.nome ?? 'Cliente nÃ£o identificado',
    proposta_nome: proposta?.nome ?? 'Proposta nÃ£o identificada',
    possui_cotacao: anexosByCompraId.get(compra.id)?.possui_cotacao ?? false,
    possui_nf: anexosByCompraId.get(compra.id)?.possui_nf ?? false,
    possui_boleto: anexosByCompraId.get(compra.id)?.possui_boleto ?? false,
  }
}

export async function getCompraDetail(id: number) {
  const [compra, historico, anexos] = await Promise.all([
    getCompraById(id),
    listHistoricoByCompraId(id),
    listAnexosByCompraId(id),
  ])

  if (!compra) {
    return null
  }

  const proposta = await getPropostaById(compra.proposta_id)

  return {
    ...compra,
    proposta_orcamento: proposta
      ? {
          valor_previsto: proposta.valor_previsto,
          valor_previsto_perfis: proposta.valor_previsto_perfis,
          valor_previsto_vidros: proposta.valor_previsto_vidros,
          valor_previsto_acessorios: proposta.valor_previsto_acessorios,
          valor_previsto_outros: proposta.valor_previsto_outros,
          custo_perdas: proposta.custo_perdas,
        }
      : null,
    historico,
    anexos,
  }
}

export async function createCompra(input: CompraFormData) {
  const distribuicaoCategoria = resolveCompraCategoriaValues(input)
  const totalRateado = getCompraCategoriaTotal(distribuicaoCategoria)
  const valorTotal = nullableNumber(input.valor_total) ?? (totalRateado > 0 ? totalRateado : null)
  const solicitanteId = nullableNumber(input.solicitante_id)
  const solicitadoPor = nullableString(input.solicitado_por)
  const categoria = normalizeCategoriaCompra(
    input.categoria ??
      getCompraCategoriaPrincipal({
        categoria: 'outros',
        valor_total: valorTotal,
        ...distribuicaoCategoria,
      }),
  )

  let compraId = 0

  if (getDatabaseType() === 'mysql') {
    const result = await mysqlExecute(
      `INSERT INTO compras (
        cliente_id,
        proposta_id,
        solicitante_id,
        solicitado_por,
        categoria,
        fornecedor,
        descricao,
        valor_total,
        valor_categoria_perfis,
        valor_categoria_vidros,
        valor_categoria_acessorios,
        valor_categoria_perdas,
        valor_categoria_outros,
        numero_pedido,
        status,
        status_entrega,
        etapa_autorizacao,
        etapa_fluxo,
        previsao_entrega,
        data_envio_fornecedor,
        data_entrega_real,
        arquivado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cotacao', 'pendente', 'nenhuma', 'solicitacao_registrada', ?, ?, ?, 0)`,
      [
        input.cliente_id,
        input.proposta_id,
        solicitanteId,
        solicitadoPor,
        serializeCategoriaCompra(categoria),
        input.fornecedor,
        input.descricao,
        valorTotal,
        distribuicaoCategoria.valor_categoria_perfis,
        distribuicaoCategoria.valor_categoria_vidros,
        distribuicaoCategoria.valor_categoria_acessorios,
        distribuicaoCategoria.valor_categoria_perdas,
        distribuicaoCategoria.valor_categoria_outros,
        nullableString(input.numero_pedido),
        nullableString(input.previsao_entrega),
        nullableString(input.data_envio_fornecedor),
        null,
      ],
    )
    compraId = result.insertId
  } else {
    const client = getSupabaseOrThrow()
    const { data, error } = await client
      .from('compras')
      .insert({
        cliente_id: input.cliente_id,
        proposta_id: input.proposta_id,
        categoria: serializeCategoriaCompra(categoria),
        fornecedor: input.fornecedor,
        descricao: input.descricao,
        solicitante_id: solicitanteId,
        solicitado_por: solicitadoPor,
        valor_total: valorTotal,
        ...distribuicaoCategoria,
        numero_pedido: nullableString(input.numero_pedido),
        status: 'cotacao',
        status_entrega: 'pendente',
        etapa_autorizacao: 'nenhuma',
        etapa_fluxo: 'solicitacao_registrada',
        previsao_entrega: nullableString(input.previsao_entrega),
        data_envio_fornecedor: nullableString(input.data_envio_fornecedor),
        data_entrega_real: null,
        arquivado: false,
      })
      .select('id')
      .single()
    throwIfSupabaseError(error)
    compraId = Number(data.id)
  }

  await addHistoricoEvento(compraId, `Pedido de compra criado na categoria ${categoriaLabel(categoria)} com status ${STATUS_LABELS.cotacao}`)
  if (solicitadoPor) {
    await addHistoricoEvento(compraId, `Solicitacao registrada por ${solicitadoPor}`, solicitadoPor)
  }
  return compraId
}

export async function updateCompra(
  id: number,
  input: Partial<CompraFormData> & {
    data_entrega_real?: string | null
    usuario?: string | null
    motivo_revisao?: string | null
  },
) {
  const atual = await getCompraById(id)

  if (!atual) {
    throw new Error('Compra não encontrada.')
  }

  const proximoStatus = input.status ? normalizeStatusPedido(input.status) : atual.status
  const proximaEntrega = input.status_entrega ? normalizeStatusEntrega(input.status_entrega) : atual.status_entrega
  const proximaDistribuicaoCategoria = resolveCompraCategoriaValues({
    valor_categoria_perfis:
      input.valor_categoria_perfis !== undefined ? input.valor_categoria_perfis : atual.valor_categoria_perfis,
    valor_categoria_vidros:
      input.valor_categoria_vidros !== undefined ? input.valor_categoria_vidros : atual.valor_categoria_vidros,
    valor_categoria_acessorios:
      input.valor_categoria_acessorios !== undefined ? input.valor_categoria_acessorios : atual.valor_categoria_acessorios,
    valor_categoria_perdas:
      input.valor_categoria_perdas !== undefined ? input.valor_categoria_perdas : atual.valor_categoria_perdas,
    valor_categoria_outros:
      input.valor_categoria_outros !== undefined ? input.valor_categoria_outros : atual.valor_categoria_outros,
  })
  const hasRateioUpdate =
    input.valor_categoria_perfis !== undefined ||
    input.valor_categoria_vidros !== undefined ||
    input.valor_categoria_acessorios !== undefined ||
    input.valor_categoria_perdas !== undefined ||
    input.valor_categoria_outros !== undefined
  const proximoTotalRateado = getCompraCategoriaTotal(proximaDistribuicaoCategoria)
  const proximaCategoria = normalizeCategoriaCompra(
    input.categoria ??
      getCompraCategoriaPrincipal({
        ...atual,
        valor_total:
          input.valor_total !== undefined
            ? nullableNumber(input.valor_total)
            : hasRateioUpdate && proximoTotalRateado > 0
              ? proximoTotalRateado
              : atual.valor_total,
        ...proximaDistribuicaoCategoria,
      }),
  )
  const proximoValorTotal =
    input.valor_total !== undefined
      ? nullableNumber(input.valor_total)
      : hasRateioUpdate && proximoTotalRateado > 0
        ? proximoTotalRateado
        : atual.valor_total
  const proximoNumeroPedido = input.numero_pedido !== undefined ? nullableString(input.numero_pedido) : atual.numero_pedido
  const proximaPrevisao = input.previsao_entrega !== undefined ? nullableString(input.previsao_entrega) : atual.previsao_entrega
  const proximaDataEnvio =
    input.data_envio_fornecedor !== undefined ? nullableString(input.data_envio_fornecedor) : atual.data_envio_fornecedor
  const estaConcluindoAutorizacao = atual.status !== 'pedido_autorizado' && proximoStatus === 'pedido_autorizado'

  if (input.status !== undefined && input.status !== atual.status && proximoStatus === 'em_analise') {
    if (!proximoNumeroPedido || !proximoValorTotal || proximoValorTotal <= 0) {
      throw new Error('Para colocar o pedido em análise, informe o número do pedido e o valor total.')
    }
  }

  if (estaConcluindoAutorizacao && atual.etapa_autorizacao !== 'liberada') {
    throw new Error('Este pedido ainda nao foi liberado pelo administrador para conclusao da autorizacao.')
  }

  if (proximoStatus === 'pedido_autorizado') {
    if (!proximoNumeroPedido || !proximoValorTotal || proximoValorTotal <= 0 || !proximaPrevisao) {
      throw new Error(
        'Para autorizar o pedido, é necessário informar o número do pedido, valor total e a previsão de entrega.',
      )
    }
  }

  let statusEntrega: StatusEntrega = proximaEntrega
  let dataEntregaReal =
    input.data_entrega_real !== undefined ? nullableString(input.data_entrega_real) : atual.data_entrega_real

  if (proximoStatus !== 'pedido_autorizado') {
    statusEntrega = 'pendente'
    dataEntregaReal = null
  } else if (statusEntrega === 'entregue' && !dataEntregaReal) {
    dataEntregaReal = format(new Date(), 'yyyy-MM-dd')
  } else if (statusEntrega === 'pendente') {
    dataEntregaReal = null
  }

  const payload = {
    categoria: proximaCategoria,
    fornecedor: input.fornecedor ?? atual.fornecedor,
    descricao: input.descricao ?? atual.descricao,
    valor_total: proximoValorTotal,
    ...proximaDistribuicaoCategoria,
    numero_pedido: proximoNumeroPedido,
    status: proximoStatus,
    status_entrega: statusEntrega,
    etapa_autorizacao: proximoStatus === 'pedido_autorizado' ? 'nenhuma' : atual.etapa_autorizacao,
    etapa_fluxo: proximoStatus === 'pedido_autorizado' ? 'pedido_autorizado' : atual.etapa_fluxo,
    previsao_entrega: proximaPrevisao,
    data_envio_fornecedor: proximaDataEnvio,
    data_entrega_real: dataEntregaReal,
  }
  const auditUser = nullableString(input.usuario) ?? 'Sistema'

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute(
      `UPDATE compras SET
        categoria = ?,
        fornecedor = ?,
        descricao = ?,
        valor_total = ?,
        valor_categoria_perfis = ?,
        valor_categoria_vidros = ?,
        valor_categoria_acessorios = ?,
        valor_categoria_perdas = ?,
        valor_categoria_outros = ?,
        numero_pedido = ?,
        status = ?,
        status_entrega = ?,
        etapa_autorizacao = ?,
        etapa_fluxo = ?,
        previsao_entrega = ?,
        data_envio_fornecedor = ?,
        data_entrega_real = ?
      WHERE id = ?`,
      [
        serializeCategoriaCompra(payload.categoria),
        payload.fornecedor,
        payload.descricao,
        payload.valor_total,
        payload.valor_categoria_perfis,
        payload.valor_categoria_vidros,
        payload.valor_categoria_acessorios,
        payload.valor_categoria_perdas,
        payload.valor_categoria_outros,
        payload.numero_pedido,
        payload.status,
        payload.status_entrega,
        payload.etapa_autorizacao,
        payload.etapa_fluxo,
        payload.previsao_entrega,
        payload.data_envio_fornecedor,
        payload.data_entrega_real,
        id,
      ],
    )
  } else {
    const client = getSupabaseOrThrow()
    const { error } = await client
      .from('compras')
      .update({
        ...payload,
        categoria: serializeCategoriaCompra(payload.categoria),
      })
      .eq('id', id)
    throwIfSupabaseError(error)
  }

  const eventos: string[] = []

  if (payload.categoria !== atual.categoria) {
    eventos.push(`Categoria alterada para ${categoriaLabel(payload.categoria)}`)
  }

  if (
    payload.valor_categoria_perfis !== atual.valor_categoria_perfis ||
    payload.valor_categoria_vidros !== atual.valor_categoria_vidros ||
    payload.valor_categoria_acessorios !== atual.valor_categoria_acessorios ||
    payload.valor_categoria_perdas !== atual.valor_categoria_perdas ||
    payload.valor_categoria_outros !== atual.valor_categoria_outros
  ) {
    eventos.push('Rateio da compra por categoria atualizado')
  }

  if (payload.status !== atual.status) {
    eventos.push(`Status alterado para ${STATUS_LABELS[payload.status]}`)
  }

  if (payload.status_entrega !== atual.status_entrega) {
    eventos.push(`Status de entrega alterado para ${payload.status_entrega === 'entregue' ? 'Entregue' : 'Pendente'}`)
  }

  if (payload.previsao_entrega !== atual.previsao_entrega) {
    if (payload.previsao_entrega) {
      const dataFormatada = formatDateBr(payload.previsao_entrega)
      eventos.push(
        atual.previsao_entrega
          ? `Previsão de entrega atualizada para ${dataFormatada}`
          : `Previsão de entrega definida para ${dataFormatada}`,
      )
    } else {
      eventos.push('Previsão de entrega removida')
    }
  }

  if (payload.valor_total !== atual.valor_total && payload.valor_total) {
    eventos.push(`Valor atualizado para ${formatCurrency(payload.valor_total)}`)
  }

  if (payload.numero_pedido !== atual.numero_pedido && payload.numero_pedido) {
    eventos.push(`Número do pedido definido: ${payload.numero_pedido}`)
  }

  if (payload.data_entrega_real && payload.data_entrega_real !== atual.data_entrega_real) {
    eventos.push(`Entrega registrada em ${formatDateBr(payload.data_entrega_real)}`)
  } else if (!payload.data_entrega_real && atual.data_entrega_real) {
    eventos.push('Data real de entrega removida')
  }

  if (nullableString(input.motivo_revisao)) {
    eventos.push(`Motivo da revisao: ${String(input.motivo_revisao).trim()}`)
  }

  await Promise.all(eventos.map((evento) => addHistoricoEvento(id, evento, auditUser)))
}

export async function deleteCompra(id: number) {
  const [compra, historico] = await Promise.all([getCompraById(id), listHistoricoByCompraId(id)])

  if (!compra) {
    throw new Error('Compra não encontrada.')
  }

  if (historico.length > 0) {
    if (getDatabaseType() === 'mysql') {
      await mysqlExecute('UPDATE compras SET arquivado = 1 WHERE id = ?', [id])
    } else {
      const client = getSupabaseOrThrow()
      const { error } = await client.from('compras').update({ arquivado: true }).eq('id', id)
      throwIfSupabaseError(error)
    }

    await addHistoricoEvento(id, 'Pedido arquivado automaticamente')
    return { archived: true }
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('DELETE FROM compras WHERE id = ?', [id])
  } else {
    const client = getSupabaseOrThrow()
    const { error } = await client.from('compras').delete().eq('id', id)
    throwIfSupabaseError(error)
  }

  return { archived: false }
}

export async function permanentlyDeleteCompra(id: number) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nÃ£o encontrada.')
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('DELETE FROM anexos WHERE compra_id = ?', [id])
    await mysqlExecute('DELETE FROM historico_compras WHERE compra_id = ?', [id])
    await mysqlExecute('DELETE FROM compras WHERE id = ?', [id])
  } else {
    const client = getSupabaseOrThrow()
    const { error: anexosError } = await client.from('anexos').delete().eq('compra_id', id)
    throwIfSupabaseError(anexosError)
    const { error: historicoError } = await client.from('historico_compras').delete().eq('compra_id', id)
    throwIfSupabaseError(historicoError)
    const { error: compraError } = await client.from('compras').delete().eq('id', id)
    throwIfSupabaseError(compraError)
  }

  return { deleted: true }
}

export async function setCompraArchivedState(id: number, arquivado: boolean) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra não encontrada.')
  }

  if (compra.arquivado === arquivado) {
    return { archived: arquivado }
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('UPDATE compras SET arquivado = ? WHERE id = ?', [arquivado ? 1 : 0, id])
  } else {
    const client = getSupabaseOrThrow()
    const { error } = await client.from('compras').update({ arquivado }).eq('id', id)
    throwIfSupabaseError(error)
  }

  await addHistoricoEvento(id, arquivado ? 'Pedido arquivado manualmente' : 'Pedido desarquivado')
  return { archived: arquivado }
}

export async function requestCompraAuthorization(id: number, usuario: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.status === 'pedido_autorizado') {
    throw new Error('Este pedido ja foi autorizado.')
  }

  if (compra.etapa_fluxo !== 'aprovada_solicitante') {
    throw new Error('Este pedido ainda nao foi aprovado pelo solicitante para seguir para autorizacao administrativa.')
  }

  if (compra.etapa_autorizacao === 'solicitada') {
    throw new Error('Este pedido ja possui uma solicitacao de autorizacao em andamento.')
  }

  if (compra.etapa_autorizacao === 'liberada') {
    throw new Error('Este pedido ja foi liberado pelo administrador para conclusao da autorizacao.')
  }

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_autorizacao: 'solicitada',
    etapa_fluxo: 'aguardando_admin',
  })
  await addHistoricoEvento(id, 'Solicitacao de autorizacao enviada ao administrador', usuario)
  return { requested: true }
}

export async function approveCompraAuthorizationRequest(id: number, usuario: string, numeroPedido: string, valorTotal: number) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.status === 'pedido_autorizado') {
    throw new Error('Este pedido ja foi autorizado.')
  }

  if (compra.etapa_fluxo !== 'aguardando_admin' || compra.etapa_autorizacao !== 'solicitada') {
    throw new Error('Este pedido nao possui solicitacao pendente para aprovacao.')
  }

  if (!nullableString(numeroPedido) || !Number.isFinite(valorTotal) || valorTotal <= 0) {
    throw new Error('Numero do pedido e valor autorizado sao obrigatorios para a aprovacao administrativa.')
  }

  const approvedAt = format(new Date(), 'yyyy-MM-dd')

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_autorizacao: 'liberada',
    etapa_fluxo: 'aprovada_admin',
    numero_pedido: nullableString(numeroPedido),
    valor_total: valorTotal,
    aprovado_admin_em: approvedAt,
    aprovado_admin_por: usuario,
  })
  await addHistoricoEvento(id, 'Solicitacao de autorizacao aprovada pelo administrador', usuario)
  await addHistoricoEvento(id, `Numero do pedido definido: ${numeroPedido.trim()}`, usuario)
  await addHistoricoEvento(id, `Valor autorizado registrado em ${formatCurrency(valorTotal)}`, usuario)
  return { approved: true }
}

export async function rejectCompraAuthorizationRequest(id: number, usuario: string, motivo?: string | null) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.etapa_fluxo !== 'aguardando_admin' || compra.etapa_autorizacao !== 'solicitada') {
    throw new Error('Este pedido nao possui solicitacao administrativa pendente para recusa.')
  }

  const motivoNormalizado = nullableString(motivo)

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_autorizacao: 'nenhuma',
    etapa_fluxo: 'aprovada_solicitante',
    aprovado_admin_em: null,
    aprovado_admin_por: null,
  })

  await addHistoricoEvento(
    id,
    motivoNormalizado
      ? `Administrador recusou a solicitacao e devolveu ao comprador: ${motivoNormalizado}`
      : 'Administrador recusou a solicitacao e devolveu o pedido ao comprador',
    usuario,
  )

  return { rejected: true }
}

export async function requestCompraFinanceApproval(id: number, usuario: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.status === 'pedido_autorizado') {
    throw new Error('Este pedido ja foi autorizado.')
  }

  if (compra.etapa_fluxo !== 'aprovada_admin' || compra.etapa_autorizacao !== 'liberada') {
    throw new Error('Este pedido ainda nao foi liberado pelo administrativo para seguir ao financeiro.')
  }

  if (!compra.numero_pedido || !compra.valor_total || compra.valor_total <= 0) {
    throw new Error('O pedido precisa ter numero e valor autorizados antes de seguir para o financeiro.')
  }

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_fluxo: 'aguardando_financeiro',
  })

  await addHistoricoEvento(id, 'Solicitacao de aprovacao financeira enviada pelo comprador', usuario)
  return { requested: true }
}

function shouldSkipRequesterApproval(compra: Pick<Compra, 'solicitante_id'>) {
  return !compra.solicitante_id
}

export async function markCompraQuotationSent(
  id: number,
  usuario: string,
  options: { data_envio_fornecedor?: string | null } = {},
) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.status === 'pedido_autorizado') {
    throw new Error('Este pedido ja foi autorizado e nao pode voltar para cotacao.')
  }

  const dataEnvio = nullableString(options.data_envio_fornecedor) ?? format(new Date(), 'yyyy-MM-dd')

  await updateCompraWorkflowFields(id, {
    status: 'cotacao',
    etapa_fluxo: 'cotacao_em_andamento',
    data_envio_fornecedor: dataEnvio,
    cotacao_enviada_por: usuario,
  })

  await addHistoricoEvento(id, `Solicitacao enviada ao fornecedor em ${formatDateBr(dataEnvio)}`, usuario)
  return { sent: true }
}

export async function markCompraQuotationReceived(id: number, usuario: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.status === 'pedido_autorizado') {
    throw new Error('Este pedido ja foi autorizado.')
  }

  if (compra.etapa_fluxo !== 'cotacao_em_andamento' && compra.etapa_fluxo !== 'retificacao') {
    throw new Error('A cotacao so pode ser registrada depois do envio ao fornecedor.')
  }

  const anexos = await listAnexosByCompraId(id)
  const possuiCotacao = anexos.some((anexo) => anexo.tipo === 'cotacao')

  if (!possuiCotacao) {
    throw new Error('Anexe ao menos um arquivo de cotacao antes de solicitar a aprovacao do solicitante.')
  }

  const receivedAt = format(new Date(), 'yyyy-MM-dd')
  const skipRequesterApproval = shouldSkipRequesterApproval(compra)

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_autorizacao: skipRequesterApproval ? 'solicitada' : compra.etapa_autorizacao,
    etapa_fluxo: skipRequesterApproval ? 'aguardando_admin' : 'analise_solicitante',
    cotacao_recebida_em: receivedAt,
    cotacao_recebida_por: usuario,
  })

  if (skipRequesterApproval) {
    await addHistoricoEvento(
      id,
      'Cotacao recebida e enviada diretamente para aprovacao do ADM, sem etapa do solicitante por se tratar de compra direta',
      usuario,
    )
    await addHistoricoEvento(id, 'Solicitacao de autorizacao enviada ao administrador', usuario)
    return { received: true, skippedRequesterApproval: true, requestedAdminApproval: true }
  }

  await addHistoricoEvento(id, 'Cotacao recebida e encaminhada para aprovacao do solicitante', usuario)
  return { received: true, skippedRequesterApproval: false, requestedAdminApproval: false }
}

export async function approveCompraByRequester(id: number, usuario: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.etapa_fluxo !== 'analise_solicitante') {
    throw new Error('Este pedido nao esta aguardando aprovacao do solicitante.')
  }

  const approvedAt = format(new Date(), 'yyyy-MM-dd')

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_fluxo: 'aprovada_solicitante',
    aprovado_solicitante_em: approvedAt,
    aprovado_solicitante_por: usuario,
  })

  await addHistoricoEvento(id, 'Solicitante aprovou a cotacao para seguir com a autorizacao', usuario)
  return { approved: true }
}

export async function requestCompraRetification(id: number, usuario: string, motivo: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  const motivoNormalizado = nullableString(motivo)

  if (!motivoNormalizado) {
    throw new Error('Informe o motivo da retificacao.')
  }

  if (compra.etapa_fluxo !== 'analise_solicitante' && compra.etapa_fluxo !== 'aprovada_solicitante') {
    throw new Error('Este pedido nao esta em etapa de analise para retificacao.')
  }

  await updateCompraWorkflowFields(id, {
    status: 'retificacao',
    etapa_autorizacao: 'nenhuma',
    etapa_fluxo: 'retificacao',
  })

  await addHistoricoEvento(id, `Solicitante pediu retificacao: ${motivoNormalizado}`, usuario)
  return { retified: true }
}

export async function rejectCompraFinanceiro(id: number, usuario: string, motivo?: string | null) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.etapa_fluxo !== 'aguardando_financeiro') {
    throw new Error('Este pedido nao esta aguardando aprovacao financeira.')
  }

  const motivoNormalizado = nullableString(motivo)

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_autorizacao: 'liberada',
    etapa_fluxo: 'aprovada_admin',
    aprovado_financeiro_em: null,
    aprovado_financeiro_por: null,
  })

  await addHistoricoEvento(
    id,
    motivoNormalizado
      ? `Financeiro recusou a liberacao e devolveu ao comprador: ${motivoNormalizado}`
      : 'Financeiro recusou a liberacao e devolveu o pedido ao comprador',
    usuario,
  )

  return { rejected: true }
}

export async function approveCompraFinanceiro(id: number, usuario: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.etapa_fluxo !== 'aguardando_financeiro') {
    throw new Error('Este pedido nao esta aguardando aprovacao financeira.')
  }

  const approvedAt = format(new Date(), 'yyyy-MM-dd')

  await updateCompraWorkflowFields(id, {
    status: 'em_analise',
    etapa_autorizacao: 'liberada',
    etapa_fluxo: 'liberada_para_fornecedor',
    aprovado_financeiro_em: approvedAt,
    aprovado_financeiro_por: usuario,
  })

  await addHistoricoEvento(id, 'Financeiro registrou ciencia e liberou o pedido para fechamento com fornecedor', usuario)
  return { approved: true }
}

export async function confirmCompraFinanceDocuments(id: number, usuario: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.status !== 'pedido_autorizado') {
    throw new Error('Os documentos so podem ser conciliados no financeiro apos o pedido ser autorizado.')
  }

  if (!compra.possui_nf || !compra.possui_boleto) {
    throw new Error('Ainda faltam nota fiscal e/ou boleto para concluir o registro financeiro.')
  }

  if (compra.documentos_financeiro_confirmados_em) {
    return { confirmed: true }
  }

  const confirmedAt = format(new Date(), 'yyyy-MM-dd')

  await updateCompraWorkflowFields(id, {
    documentos_financeiro_confirmados_em: confirmedAt,
    documentos_financeiro_confirmados_por: usuario,
  })

  await addHistoricoEvento(id, 'Financeiro confirmou o registro da nota fiscal e do boleto no sistema financeiro', usuario)
  return { confirmed: true }
}

export async function confirmCompraWithSupplier(id: number, usuario: string, previsaoEntrega: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.etapa_fluxo !== 'liberada_para_fornecedor' || compra.etapa_autorizacao !== 'liberada') {
    throw new Error('Este pedido ainda nao foi liberado para fechamento com o fornecedor.')
  }

  const previsaoNormalizada = nullableString(previsaoEntrega)

  if (!previsaoNormalizada) {
    throw new Error('Informe a previsao de entrega para concluir o fechamento do pedido.')
  }

  if (!compra.numero_pedido || !compra.valor_total || compra.valor_total <= 0) {
    throw new Error('O numero do pedido e o valor autorizado precisam estar registrados antes do fechamento com o fornecedor.')
  }

  const confirmedAt = format(new Date(), 'yyyy-MM-dd')

  await updateCompraWorkflowFields(id, {
    status: 'pedido_autorizado',
    status_entrega: 'pendente',
    etapa_autorizacao: 'nenhuma',
    etapa_fluxo: 'pedido_autorizado',
    previsao_entrega: previsaoNormalizada,
    confirmado_fornecedor_em: confirmedAt,
    confirmado_fornecedor_por: usuario,
  })

  await addHistoricoEvento(id, 'Comprador confirmou o fechamento do pedido com o fornecedor', usuario)
  await addHistoricoEvento(id, `Previsao de entrega definida para ${formatDateBr(previsaoNormalizada)}`, usuario)
  return { confirmed: true }
}

export async function listHistoricoByCompraId(compraId: number): Promise<HistoricoCompra[]> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM historico_compras WHERE compra_id = ? ORDER BY data DESC', [compraId])
    return rows.map(normalizeHistorico)
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('historico_compras')
    .select('*')
    .eq('compra_id', compraId)
    .order('data', { ascending: false })
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeHistorico(row))
}

export async function listAnexosByCompraId(compraId: number): Promise<Anexo[]> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM anexos WHERE compra_id = ? ORDER BY created_at DESC', [compraId])
    return annotateAnexoAvailability(rows.map(normalizeAnexo))
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('anexos')
    .select('*')
    .eq('compra_id', compraId)
    .order('created_at', { ascending: false })
  throwIfSupabaseError(error)
  return annotateAnexoAvailability((data ?? []).map((row: Row) => normalizeAnexo(row)))
}

async function getAnexoSummaryByCompraIds(compraIds: number[]) {
  const summary = new Map<number, { possui_cotacao: boolean; possui_nf: boolean; possui_boleto: boolean }>()

  if (compraIds.length === 0) {
    return summary
  }

  const rows =
    getDatabaseType() === 'mysql'
      ? await mysqlSelect(
          `SELECT compra_id, tipo FROM anexos WHERE compra_id IN (${compraIds.map(() => '?').join(', ')})`,
          compraIds,
        )
      : await listAnexoSummaryRowsSupabase(compraIds)

  for (const row of rows) {
    const compraId = toNumber(row.compra_id)
    if (!compraId) {
      continue
    }

    const current = summary.get(compraId) ?? { possui_cotacao: false, possui_nf: false, possui_boleto: false }
    const tipo = normalizeTipoAnexo(row.tipo)

    if (tipo === 'cotacao') {
      current.possui_cotacao = true
    }

    if (tipo === 'nf') {
      current.possui_nf = true
    }

    if (tipo === 'boleto') {
      current.possui_boleto = true
    }

    summary.set(compraId, current)
  }

  return summary
}

async function listAnexoSummaryRowsSupabase(compraIds: number[]) {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('anexos').select('compra_id,tipo').in('compra_id', compraIds)
  throwIfSupabaseError(error)
  return (data ?? []) as Row[]
}

async function getSensitiveChangeRequestById(id: number) {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM solicitacoes_sensiveis WHERE id = ? LIMIT 1', [id])
    return rows[0] ? normalizeSolicitacaoSensivel(rows[0]) : null
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('solicitacoes_sensiveis').select('*').eq('id', id).maybeSingle()
  throwIfSupabaseError(error)
  return data ? normalizeSolicitacaoSensivel(data as Row) : null
}

async function applySensitiveChangeRequest(request: SolicitacaoSensivel, usuario: string) {
  if (request.entidade === 'cliente') {
    if (request.acao === 'excluir') {
      await deleteCliente(request.entidade_id)
      return
    }

    await updateCliente(request.entidade_id, sanitizeSensitiveClientePayload(request.payload))
    return
  }

  if (request.entidade === 'proposta') {
    if (request.acao === 'excluir') {
      await deleteProposta(request.entidade_id)
      return
    }

    await updateProposta(request.entidade_id, sanitizeSensitivePropostaPayload(request.payload))
    return
  }

  if (request.acao === 'excluir') {
    await permanentlyDeleteCompra(request.entidade_id)
    return
  }

  if (request.payload?.operation === 'delete_attachment') {
    const attachmentId = toNumber(request.payload.attachment_id)

    if (!attachmentId) {
      throw new Error('A solicitacao de exclusao do anexo nao informou o anexo corretamente.')
    }

    const anexo = await getAnexoById(request.entidade_id, attachmentId)
    if (!anexo) {
      throw new Error('O anexo solicitado para exclusao nao foi encontrado.')
    }

    await deleteAnexo(request.entidade_id, attachmentId)
    await deleteStoredAttachmentAsset(anexo)
    await addHistoricoEvento(
      request.entidade_id,
      `Anexo ${anexo.nome_arquivo} removido com aprovacao administrativa`,
      usuario,
    )
    return
  }

  await updateCompra(request.entidade_id, {
    ...sanitizeSensitiveCompraPayload(request.payload),
    usuario,
  })
}

async function deleteStoredAttachmentAsset(anexo: Anexo) {
  const supabaseObject = parseSupabaseAttachmentUrl(anexo.arquivo_url)

  if (supabaseObject) {
    await deleteSupabaseAttachmentObject(supabaseObject.bucket, supabaseObject.objectPath)
    return
  }

  const attachmentPath = resolveLocalAttachmentPath(anexo.arquivo_url)
  if (attachmentPath) {
    await rm(attachmentPath, { force: true }).catch(() => undefined)
  }
}

export async function getAnexoById(compraId: number, anexoId: number): Promise<Anexo | null> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM anexos WHERE id = ? AND compra_id = ? LIMIT 1', [anexoId, compraId])
    return rows[0] ? normalizeAnexo(rows[0]) : null
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('anexos').select('*').eq('id', anexoId).eq('compra_id', compraId).maybeSingle()
  throwIfSupabaseError(error)
  return data ? normalizeAnexo(data as Row) : null
}

export async function createAnexo(input: { compra_id: number; tipo: TipoAnexo; arquivo_url: string; nome_arquivo: string }) {
  if (getDatabaseType() === 'mysql') {
    const result = await mysqlExecute(
      'INSERT INTO anexos (compra_id, tipo, arquivo_url, nome_arquivo) VALUES (?, ?, ?, ?)',
      [input.compra_id, input.tipo, input.arquivo_url, input.nome_arquivo],
    )
    return result.insertId
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('anexos')
    .insert(input)
    .select('id')
    .single()
  throwIfSupabaseError(error)
  return Number(data.id)
}

export async function deleteAnexo(compraId: number, anexoId: number) {
  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('DELETE FROM anexos WHERE id = ? AND compra_id = ?', [anexoId, compraId])
    return { deleted: true }
  }

  const client = getSupabaseOrThrow()
  const { error } = await client.from('anexos').delete().eq('id', anexoId).eq('compra_id', compraId)
  throwIfSupabaseError(error)
  return { deleted: true }
}

export async function updateAnexoArquivoUrl(compraId: number, anexoId: number, arquivoUrl: string) {
  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('UPDATE anexos SET arquivo_url = ? WHERE id = ? AND compra_id = ?', [arquivoUrl, anexoId, compraId])
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client
    .from('anexos')
    .update({ arquivo_url: arquivoUrl })
    .eq('id', anexoId)
    .eq('compra_id', compraId)
  throwIfSupabaseError(error)
}

export async function getDashboardData(): Promise<DashboardData> {
  const [compras, propostas, historicos] = await Promise.all([listCompras(), listPropostas(), listHistoricosRaw()])
  const hoje = new Date()
  const mesAtual = format(hoje, 'yyyy-MM')
  const meses = Array.from({ length: 6 }, (_, index) => format(subMonths(hoje, 5 - index), 'yyyy-MM'))
  const autorizacoesByCompraId = getAuthorizationMonthsByCompraId(historicos)
  const comprasById = new Map(compras.map((compra) => [compra.id, compra]))

  const comparativo = meses.map((mes) => {
    const previsto = propostas
      .filter((proposta) => formatMonthKey(proposta.created_at) === mes)
      .reduce((sum, proposta) => sum + Number(proposta.valor_previsto), 0)

    const realizado = compras
      .filter((compra) => getCompraDashboardMonth(compra, autorizacoesByCompraId) === mes)
      .reduce((sum, compra) => sum + Number(compra.valor_total ?? 0), 0)

    return { mes, previsto, realizado }
  })

  const ultimasAtualizacoes = historicos
    .map((historico) => {
      const compra = comprasById.get(historico.compra_id)

      if (!compra) {
        return null
      }

      return asDashboardAtualizacao(historico, compra)
    })
    .filter((item): item is DashboardAtualizacaoResumo => item !== null)
    .slice(0, 5)

  const pedidosParados = compras
    .filter((compra) => {
      const dias = differenceInDaysFromNow(compra.updated_at)
      return compra.status_entrega === 'pendente' && dias >= 7
    })
    .sort((a, b) => compareAsc(a.updated_at, b.updated_at))
    .slice(0, 5)
    .map(asDashboardPedido)

  const stats = {
    total_pedidos: compras.filter((compra) => compra.status_entrega !== 'entregue').length,
    em_cotacao: compras.filter((compra) => compra.status === 'cotacao').length,
    em_analise: compras.filter((compra) => compra.status === 'em_analise').length,
    autorizados: compras.filter((compra) => compra.status === 'pedido_autorizado' && compra.status_entrega === 'pendente').length,
    entregues: compras.filter((compra) => compra.status_entrega === 'entregue').length,
    valor_total_mes: compras
      .filter((compra) => getCompraDashboardMonth(compra, autorizacoesByCompraId) === mesAtual)
      .reduce((sum, compra) => sum + Number(compra.valor_total ?? 0), 0),
    pedidos_atrasados: compras.filter((compra) => getDeliverySituation(compra) === 'atrasado').length,
    pedidos_proximos: compras.filter((compra) => getDeliverySituation(compra) === 'proximo').length,
  }

  return {
    stats,
    comparativo,
    ultimasAtualizacoes,
    pedidosParados,
  }
}

export async function getComprasReport(filters: ReportFilters = {}): Promise<Compra[]> {
  const compras = await listCompras({
    clienteId: filters.clienteId,
    propostaId: filters.propostaId,
    status: filters.status,
  })

  return compras.filter((compra) => matchDateRange(compra.data_criacao, filters.dataInicio, filters.dataFim))
}

export async function getFinanceiroReport(filters: ReportFilters = {}): Promise<FinanceiroReportItem[]> {
  const [propostas, compras] = await Promise.all([listPropostas(), listCompras({ includeArchived: true })])
  const comprasFiltradas = compras.filter((compra) => {
    if (filters.clienteId && compra.cliente_id !== filters.clienteId) {
      return false
    }

    if (filters.propostaId && compra.proposta_id !== filters.propostaId) {
      return false
    }

    return matchDateRange(compra.data_criacao, filters.dataInicio, filters.dataFim)
  })

  return propostas
    .filter((proposta) => {
      if (filters.clienteId && proposta.cliente_id !== filters.clienteId) {
        return false
      }

      if (filters.propostaId && proposta.id !== filters.propostaId) {
        return false
      }

      return true
    })
    .map((proposta) => {
      const valorRealizado = comprasFiltradas
        .filter((compra) => compra.proposta_id === proposta.id)
        .reduce((sum, compra) => sum + Number(compra.valor_total ?? 0), 0)

      const item: FinanceiroReportItem = {
        id: proposta.id,
        proposta_nome: proposta.nome,
        cliente_nome: proposta.cliente_nome ?? 'Cliente não identificado',
        valor_previsto: Number(proposta.valor_previsto),
        valor_realizado: valorRealizado,
        custo_perdas: Number(proposta.custo_perdas),
        diferenca: 0,
      }

      item.diferenca = calculateFinanceDifference(item)
      return item
    })
}

export async function listResumoContratoReferencias(search?: string | null): Promise<ResumoContratoReferencia[]> {
  const [propostas, compras] = await Promise.all([
    listPropostas({ includeArchived: true }),
    listCompras({ includeArchived: true }),
  ])

  const normalizedSearch = String(search ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')

  const gastoRealByProposta = buildGastoRealByProposta(compras)

  return propostas
    .map((proposta) => ({
      proposta_id: proposta.id,
      proposta_nome: proposta.nome,
      cliente_id: proposta.cliente_id,
      cliente_nome: proposta.cliente_nome ?? 'Cliente não identificado',
      valor_real_gasto: gastoRealByProposta.get(proposta.id) ?? 0,
      valor_previsto: Number(proposta.valor_previsto ?? 0),
      data_inicio: proposta.data_inicio,
      data_fim: proposta.data_fim,
    }))
    .filter((item) => {
      if (!normalizedSearch) {
        return true
      }

      const haystack = [
        item.cliente_nome,
        item.proposta_nome,
        item.valor_previsto.toString(),
        item.valor_real_gasto.toString(),
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR')

      return haystack.includes(normalizedSearch)
    })
    .sort((left, right) => {
      const clientCompare = left.cliente_nome.localeCompare(right.cliente_nome, 'pt-BR')
      if (clientCompare !== 0) {
        return clientCompare
      }

      return left.proposta_nome.localeCompare(right.proposta_nome, 'pt-BR')
    })
}

export async function listResumosContratos(): Promise<ResumoContrato[]> {
  const [records, itens, compras] = await Promise.all([
    listResumosContratosRaw(),
    listResumoContratoItensRaw(),
    listCompras({ includeArchived: true }),
  ])

  const gastoRealByProposta = buildGastoRealByProposta(compras)
  const itensByResumoId = groupResumoContratoItensByResumo(itens)

  return records
    .map((record) => buildResumoContratoAggregate(record, itensByResumoId.get(record.id) ?? [], gastoRealByProposta))
    .sort((left, right) => parseISO(right.updated_at).getTime() - parseISO(left.updated_at).getTime())
}

export async function getResumoContratoById(id: number): Promise<ResumoContratoDetalhe | null> {
  const [record] = await listResumosContratosRaw({ id })
  if (!record) {
    return null
  }

  const [itens, propostas, compras] = await Promise.all([
    listResumoContratoItensRaw({ resumoId: id }),
    listPropostas({ includeArchived: true }),
    listCompras({ includeArchived: true }),
  ])

  const propostasById = new Map(propostas.map((proposta) => [proposta.id, proposta]))
  const gastoRealByProposta = buildGastoRealByProposta(compras)
  const aggregate = buildResumoContratoAggregate(record, itens, gastoRealByProposta)

  const detalhamento: ResumoContratoObra[] = itens
    .slice()
    .sort((left, right) => left.ordem - right.ordem || left.id - right.id)
    .map((item) => {
      const proposta = propostasById.get(item.proposta_id)
      const valorRealGasto = gastoRealByProposta.get(item.proposta_id) ?? 0
      const valorContrato = Number(item.valor_contrato)
      return {
        proposta_id: item.proposta_id,
        proposta_nome: proposta?.nome ?? `Proposta #${item.proposta_id}`,
        cliente_id: item.cliente_id,
        cliente_nome: proposta?.cliente_nome ?? 'Cliente não identificado',
        valor_real_gasto: valorRealGasto,
        valor_contrato: valorContrato,
        lucro_bruto: valorContrato - valorRealGasto,
        data_inicio: proposta?.data_inicio ?? null,
        data_fim: proposta?.data_fim ?? null,
      }
    })

  return {
    ...aggregate,
    itens: detalhamento,
  }
}

export async function createResumoContrato(
  input: ResumoContratoFormData,
  actor: { userId: number; nome: string },
): Promise<number> {
  const normalizedInput = await resolveResumoContratoMutationInput(input)

  const { titulo, periodoReferencia, normalizedItens } = normalizedInput

  if (getDatabaseType() === 'mysql') {
    const pool = getMySQLPool()
    if (!pool) {
      throw new Error('Pool MySQL não configurado.')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const [summaryResult] = await connection.execute<ResultSetHeader>(
        `INSERT INTO resumos_contratos (
          titulo,
          periodo_referencia,
          created_by_user_id,
          created_by_nome
        ) VALUES (?, ?, ?, ?)`,
        [titulo, periodoReferencia, actor.userId, actor.nome],
      )

      const resumoId = Number(summaryResult.insertId)

      for (const item of normalizedItens) {
        await connection.execute(
          `INSERT INTO resumo_contrato_itens (
            resumo_id,
            proposta_id,
            cliente_id,
            valor_contrato,
            ordem
          ) VALUES (?, ?, ?, ?, ?)`,
          [resumoId, item.proposta_id, item.cliente_id, item.valor_contrato, item.ordem],
        )
      }

      await connection.commit()
      return resumoId
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('resumos_contratos')
    .insert({
      titulo,
      periodo_referencia: periodoReferencia,
      created_by_user_id: actor.userId,
      created_by_nome: actor.nome,
    })
    .select('id')
    .single()

  throwIfSupabaseError(error)

  const resumoId = Number(data.id)
  const { error: itemError } = await client.from('resumo_contrato_itens').insert(
    normalizedItens.map((item) => ({
      resumo_id: resumoId,
      proposta_id: item.proposta_id,
      cliente_id: item.cliente_id,
      valor_contrato: item.valor_contrato,
      ordem: item.ordem,
    })),
  )
  throwIfSupabaseError(itemError)

  return resumoId
}

export async function updateResumoContrato(
  id: number,
  input: ResumoContratoFormData,
): Promise<void> {
  const normalizedInput = await resolveResumoContratoMutationInput(input)
  const { titulo, periodoReferencia, normalizedItens } = normalizedInput

  const existing = await getResumoContratoById(id)
  if (!existing) {
    throw new Error('Resumo de contratos não encontrado.')
  }

  if (getDatabaseType() === 'mysql') {
    const pool = getMySQLPool()
    if (!pool) {
      throw new Error('Pool MySQL não configurado.')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      await connection.execute(
        `UPDATE resumos_contratos
         SET titulo = ?, periodo_referencia = ?
         WHERE id = ?`,
        [titulo, periodoReferencia, id],
      )

      await connection.execute(`DELETE FROM resumo_contrato_itens WHERE resumo_id = ?`, [id])

      for (const item of normalizedItens) {
        await connection.execute(
          `INSERT INTO resumo_contrato_itens (
            resumo_id,
            proposta_id,
            cliente_id,
            valor_contrato,
            ordem
          ) VALUES (?, ?, ?, ?, ?)`,
          [id, item.proposta_id, item.cliente_id, item.valor_contrato, item.ordem],
        )
      }

      await connection.commit()
      return
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  const client = getSupabaseOrThrow()
  const { error: updateError } = await client
    .from('resumos_contratos')
    .update({
      titulo,
      periodo_referencia: periodoReferencia,
    })
    .eq('id', id)
  throwIfSupabaseError(updateError)

  const { error: deleteError } = await client.from('resumo_contrato_itens').delete().eq('resumo_id', id)
  throwIfSupabaseError(deleteError)

  const { error: insertError } = await client.from('resumo_contrato_itens').insert(
    normalizedItens.map((item) => ({
      resumo_id: id,
      proposta_id: item.proposta_id,
      cliente_id: item.cliente_id,
      valor_contrato: item.valor_contrato,
      ordem: item.ordem,
    })),
  )
  throwIfSupabaseError(insertError)
}

export async function deleteResumoContrato(id: number): Promise<void> {
  const existing = await getResumoContratoById(id)
  if (!existing) {
    throw new Error('Resumo de contratos não encontrado.')
  }

  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('DELETE FROM resumos_contratos WHERE id = ?', [id])
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client.from('resumos_contratos').delete().eq('id', id)
  throwIfSupabaseError(error)
}

async function resolveResumoContratoMutationInput(input: ResumoContratoFormData) {
  const titulo = String(input.titulo ?? '').trim()
  const periodoReferencia = String(input.periodo_referencia ?? '').trim()
  const itens = Array.isArray(input.itens)
    ? input.itens
        .map((item, index) => ({
          proposta_id: Number(item.proposta_id),
          valor_contrato: Number(item.valor_contrato ?? 0),
          ordem: index + 1,
        }))
        .filter((item) => Number.isFinite(item.proposta_id) && item.proposta_id > 0)
    : []

  if (!titulo) {
    throw new Error('Informe o título da seleção.')
  }

  if (!/^\d{4}-\d{2}$/.test(periodoReferencia)) {
    throw new Error('Informe o mês/ano da seleção.')
  }

  if (itens.length === 0) {
    throw new Error('Selecione ao menos uma obra para o resumo.')
  }

  const propostas = await listPropostas({ includeArchived: true })
  const propostasById = new Map(propostas.map((proposta) => [proposta.id, proposta]))
  const uniqueIds = new Set<number>()
  const normalizedItens = itens.map((item) => {
    if (uniqueIds.has(item.proposta_id)) {
      throw new Error('Não é possível repetir a mesma obra na seleção.')
    }

    uniqueIds.add(item.proposta_id)
    const proposta = propostasById.get(item.proposta_id)
    if (!proposta) {
      throw new Error(`Obra/proposta #${item.proposta_id} não encontrada.`)
    }

    return {
      ...item,
      cliente_id: proposta.cliente_id,
    }
  })

  return { titulo, periodoReferencia, normalizedItens }
}

export async function getEntregasReport(filters: ReportFilters = {}): Promise<{
  dados: Array<Compra & { situacao_entrega: SituacaoEntrega }>
  metricas: DeliveryMetrics
}> {
  const compras = await listCompras({
    clienteId: filters.clienteId,
    propostaId: filters.propostaId,
    includeArchived: true,
  })

  const dados = compras
    .filter((compra) => compra.status === 'pedido_autorizado')
    .filter((compra) => matchDateRange(compra.previsao_entrega ?? compra.data_criacao, filters.dataInicio, filters.dataFim))
    .map((compra) => ({
      ...compra,
      situacao_entrega: getDeliverySituation(compra),
    }))

  const entregues = dados.filter((compra) => compra.status_entrega === 'entregue')
  const entreguesNoPrazo = entregues.filter((compra) => {
    if (!compra.previsao_entrega || !compra.data_entrega_real) {
      return false
    }

    return parseISO(compra.data_entrega_real) <= parseISO(compra.previsao_entrega)
  })

  const tempoMedioEntrega =
    entregues.length === 0
      ? 0
      : Number(
          (
            entregues.reduce((sum, compra) => {
              if (!compra.data_entrega_real) {
                return sum
              }

              const origem = compra.data_envio_fornecedor ?? compra.data_criacao
              return sum + differenceInDays(compra.data_entrega_real, origem)
            }, 0) / entregues.length
          ).toFixed(1),
        )

  const metricas: DeliveryMetrics = {
    total: dados.length,
    entregues: entregues.length,
    entregues_no_prazo: entreguesNoPrazo.length,
    atrasados: dados.filter((compra) => compra.situacao_entrega === 'atrasado').length,
    tempo_medio_entrega: tempoMedioEntrega,
  }

  return { dados, metricas }
}

export async function getHistoricoReport(filters: ReportFilters = {}): Promise<HistoricoReportItem[]> {
  const [historicos, compras, clientes, propostas] = await Promise.all([
    listHistoricosRaw(),
    listCompras({ includeArchived: true }),
    listClientes({ includeArchived: true }),
    listPropostas({ includeArchived: true }),
  ])

  const comprasById = new Map(compras.map((compra) => [compra.id, compra]))
  const clientesById = new Map(clientes.map((cliente) => [cliente.id, cliente.nome]))
  const propostasById = new Map(propostas.map((proposta) => [proposta.id, proposta.nome]))

  return historicos
    .map((historico) => {
      const compra = comprasById.get(historico.compra_id)

      if (!compra) {
        return null
      }

      return {
        ...historico,
        cliente_id: compra.cliente_id,
        proposta_id: compra.proposta_id,
        compra_status: compra.status,
        cliente_nome: clientesById.get(compra.cliente_id) ?? 'Cliente não identificado',
        proposta_nome: propostasById.get(compra.proposta_id) ?? 'Proposta não identificada',
        fornecedor: compra.fornecedor,
      } satisfies HistoricoReportItem
    })
    .filter((item): item is HistoricoReportItem => item !== null)
    .filter((item) => {
      if (filters.clienteId && item.cliente_id !== filters.clienteId) {
        return false
      }

      if (filters.propostaId && item.proposta_id !== filters.propostaId) {
        return false
      }

      return matchDateRange(item.data, filters.dataInicio, filters.dataFim)
    })
}

async function listPropostasRaw(filters: {
  id?: number
  clienteId?: number
  includeArchived?: boolean
  onlyArchived?: boolean
} = {}): Promise<Proposta[]> {
  if (getDatabaseType() === 'mysql') {
    let sql = 'SELECT * FROM propostas WHERE 1 = 1'
    const params: unknown[] = []

    if (filters.onlyArchived) {
      sql += ' AND arquivado = 1'
    } else if (!filters.includeArchived) {
      sql += ' AND arquivado = 0'
    }

    if (filters.id) {
      sql += ' AND id = ?'
      params.push(filters.id)
    }

    if (filters.clienteId) {
      sql += ' AND cliente_id = ?'
      params.push(filters.clienteId)
    }

    sql += ' ORDER BY created_at DESC'
    const rows = await mysqlSelect(sql, params)
    return rows.map(normalizeProposta)
  }

  const client = getSupabaseOrThrow()
  let query = client.from('propostas').select('*').order('created_at', { ascending: false })

  if (filters.id) {
    query = query.eq('id', filters.id)
  }

  if (filters.clienteId) {
    query = query.eq('cliente_id', filters.clienteId)
  }

  const { data, error } = await query
  throwIfSupabaseError(error)
  return (data ?? [])
    .map((row: Row) => normalizeProposta(row))
    .filter((proposta: Proposta) => (filters.onlyArchived ? proposta.arquivado : filters.includeArchived || !proposta.arquivado))
}

type ResumoContratoRecordRow = {
  id: number
  titulo: string
  periodo_referencia: string
  created_by_user_id: number
  created_by_nome: string
  created_at: string
  updated_at: string
}

type ResumoContratoItemRow = {
  id: number
  resumo_id: number
  proposta_id: number
  cliente_id: number
  valor_contrato: number
  ordem: number
  created_at: string
  updated_at: string
}

async function listResumosContratosRaw(filters: { id?: number } = {}): Promise<ResumoContratoRecordRow[]> {
  if (getDatabaseType() === 'mysql') {
    let sql = 'SELECT * FROM resumos_contratos WHERE 1 = 1'
    const params: unknown[] = []

    if (filters.id) {
      sql += ' AND id = ?'
      params.push(filters.id)
    }

    sql += ' ORDER BY updated_at DESC'
    const rows = await mysqlSelect(sql, params)
    return rows.map(normalizeResumoContratoRecordRow)
  }

  const client = getSupabaseOrThrow()
  let query = client.from('resumos_contratos').select('*').order('updated_at', { ascending: false })

  if (filters.id) {
    query = query.eq('id', filters.id)
  }

  const { data, error } = await query
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeResumoContratoRecordRow(row))
}

async function listResumoContratoItensRaw(filters: { resumoId?: number } = {}): Promise<ResumoContratoItemRow[]> {
  if (getDatabaseType() === 'mysql') {
    let sql = 'SELECT * FROM resumo_contrato_itens WHERE 1 = 1'
    const params: unknown[] = []

    if (filters.resumoId) {
      sql += ' AND resumo_id = ?'
      params.push(filters.resumoId)
    }

    sql += ' ORDER BY ordem ASC, id ASC'
    const rows = await mysqlSelect(sql, params)
    return rows.map(normalizeResumoContratoItemRow)
  }

  const client = getSupabaseOrThrow()
  let query = client.from('resumo_contrato_itens').select('*').order('ordem', { ascending: true }).order('id', { ascending: true })

  if (filters.resumoId) {
    query = query.eq('resumo_id', filters.resumoId)
  }

  const { data, error } = await query
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeResumoContratoItemRow(row))
}

async function listComprasRaw(filters: PurchaseFilters = {}): Promise<Compra[]> {
  if (getDatabaseType() === 'mysql') {
    let sql = 'SELECT * FROM compras WHERE 1 = 1'
    const params: unknown[] = []

    if (filters.onlyArchived) {
      sql += ' AND arquivado = 1'
    } else if (!filters.includeArchived) {
      sql += ' AND arquivado = 0'
    }

    if (filters.id) {
      sql += ' AND id = ?'
      params.push(filters.id)
    }

    if (filters.clienteId) {
      sql += ' AND cliente_id = ?'
      params.push(filters.clienteId)
    }

    if (filters.propostaId) {
      sql += ' AND proposta_id = ?'
      params.push(filters.propostaId)
    }

    if (filters.solicitanteId && filters.solicitanteNome) {
      sql += ' AND (solicitante_id = ? OR (solicitante_id IS NULL AND solicitado_por = ?))'
      params.push(filters.solicitanteId, filters.solicitanteNome)
    } else if (filters.solicitanteId) {
      sql += ' AND solicitante_id = ?'
      params.push(filters.solicitanteId)
    } else if (filters.solicitanteNome) {
      sql += ' AND solicitado_por = ?'
      params.push(filters.solicitanteNome)
    }

    if (filters.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters.etapaAutorizacao) {
      sql += ' AND etapa_autorizacao = ?'
      params.push(filters.etapaAutorizacao)
    }

    if (filters.etapaFluxo) {
      sql += ' AND etapa_fluxo = ?'
      params.push(filters.etapaFluxo)
    }

    sql += ' ORDER BY updated_at DESC'
    const rows = await mysqlSelect(sql, params)
    return rows.map(normalizeCompra)
  }

  const client = getSupabaseOrThrow()
  let query = client.from('compras').select('*').order('updated_at', { ascending: false })

  if (filters.onlyArchived) {
    query = query.eq('arquivado', true)
  } else if (!filters.includeArchived) {
    query = query.eq('arquivado', false)
  }

  if (filters.id) {
    query = query.eq('id', filters.id)
  }

  if (filters.clienteId) {
    query = query.eq('cliente_id', filters.clienteId)
  }

  if (filters.propostaId) {
    query = query.eq('proposta_id', filters.propostaId)
  }

  if (filters.solicitanteId && filters.solicitanteNome) {
    const requesterQuery = client.from('compras').select('*').order('updated_at', { ascending: false }).eq('solicitante_id', filters.solicitanteId)
    const requesterNameFallbackQuery = client
      .from('compras')
      .select('*')
      .order('updated_at', { ascending: false })
      .is('solicitante_id', null)
      .eq('solicitado_por', filters.solicitanteNome)

    const [requesterResult, requesterNameFallbackResult] = await Promise.all([
      applyPurchaseFiltersToSupabaseQuery(requesterQuery, filters, { skipRequesterFilters: true }),
      applyPurchaseFiltersToSupabaseQuery(requesterNameFallbackQuery, filters, { skipRequesterFilters: true }),
    ])

    throwIfSupabaseError(requesterResult.error)
    throwIfSupabaseError(requesterNameFallbackResult.error)

    const rowsById = new Map<number, Row>()
    ;[...(requesterResult.data ?? []), ...(requesterNameFallbackResult.data ?? [])].forEach((row: Row) => {
      rowsById.set(toNumber(row.id), row)
    })

    return [...rowsById.values()]
      .sort((left, right) => new Date(String(right.updated_at ?? '')).getTime() - new Date(String(left.updated_at ?? '')).getTime())
      .map((row: Row) => normalizeCompra(row))
  }

  if (filters.solicitanteId) {
    query = query.eq('solicitante_id', filters.solicitanteId)
  } else if (filters.solicitanteNome) {
    query = query.eq('solicitado_por', filters.solicitanteNome)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.etapaAutorizacao) {
    query = query.eq('etapa_autorizacao', filters.etapaAutorizacao)
  }

  if (filters.etapaFluxo) {
    query = query.eq('etapa_fluxo', filters.etapaFluxo)
  }

  const { data, error } = await query
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeCompra(row))
}

function applyPurchaseFiltersToSupabaseQuery(
  query: {
    eq: (column: string, value: unknown) => unknown
  },
  filters: PurchaseFilters,
  options: { skipRequesterFilters?: boolean } = {},
) {
  let nextQuery: any = query

  if (filters.onlyArchived) {
    nextQuery = nextQuery.eq('arquivado', true)
  } else if (!filters.includeArchived) {
    nextQuery = nextQuery.eq('arquivado', false)
  }

  if (filters.id) {
    nextQuery = nextQuery.eq('id', filters.id)
  }

  if (filters.clienteId) {
    nextQuery = nextQuery.eq('cliente_id', filters.clienteId)
  }

  if (filters.propostaId) {
    nextQuery = nextQuery.eq('proposta_id', filters.propostaId)
  }

  if (!options.skipRequesterFilters) {
    if (filters.solicitanteId) {
      nextQuery = nextQuery.eq('solicitante_id', filters.solicitanteId)
    } else if (filters.solicitanteNome) {
      nextQuery = nextQuery.eq('solicitado_por', filters.solicitanteNome)
    }
  }

  if (filters.status) {
    nextQuery = nextQuery.eq('status', filters.status)
  }

  if (filters.etapaAutorizacao) {
    nextQuery = nextQuery.eq('etapa_autorizacao', filters.etapaAutorizacao)
  }

  if (filters.etapaFluxo) {
    nextQuery = nextQuery.eq('etapa_fluxo', filters.etapaFluxo)
  }

  return nextQuery
}

async function updateCompraAuthorizationStage(id: number, etapaAutorizacao: EtapaAutorizacao) {
  await updateCompraWorkflowFields(id, { etapa_autorizacao: etapaAutorizacao })
}

async function updateCompraWorkflowFields(id: number, payload: Record<string, unknown>) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined)

  if (entries.length === 0) {
    return
  }

  if (getDatabaseType() === 'mysql') {
    const assignments = entries.map(([column]) => `${column} = ?`).join(', ')
    const values = entries.map(([column, value]) =>
      column === 'categoria' ? serializeCategoriaCompra(value as Compra['categoria']) : value,
    )
    await mysqlExecute(`UPDATE compras SET ${assignments} WHERE id = ?`, [...values, id])
    return
  }

  const client = getSupabaseOrThrow()
  const data = Object.fromEntries(
    entries.map(([column, value]) => [column, column === 'categoria' ? serializeCategoriaCompra(value as Compra['categoria']) : value]),
  )
  const { error } = await client.from('compras').update(data).eq('id', id)
  throwIfSupabaseError(error)
}

async function listHistoricosRaw(): Promise<HistoricoCompra[]> {
  if (getDatabaseType() === 'mysql') {
    const rows = await mysqlSelect('SELECT * FROM historico_compras ORDER BY data DESC')
    return rows.map(normalizeHistorico)
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client.from('historico_compras').select('*').order('data', { ascending: false })
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeHistorico(row))
}

async function addHistoricoEvento(compraId: number, evento: string, usuario = 'Sistema') {
  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('INSERT INTO historico_compras (compra_id, evento, usuario) VALUES (?, ?, ?)', [
      compraId,
      evento,
      usuario,
    ])
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client.from('historico_compras').insert({
    compra_id: compraId,
    evento,
    usuario,
  })
  throwIfSupabaseError(error)
}

async function countRows(table: string, filter: Record<string, unknown>) {
  if (getDatabaseType() === 'mysql') {
    let sql = `SELECT COUNT(*) as total FROM ${table} WHERE 1 = 1`
    const params: unknown[] = []

    Object.entries(filter).forEach(([key, value]) => {
      sql += ` AND ${key} = ?`
      params.push(value)
    })

    const rows = await mysqlSelect(sql, params)
    return Number(rows[0]?.total ?? 0)
  }

  const client = getSupabaseOrThrow()
  let query = client.from(table).select('*', { count: 'exact', head: true })

  Object.entries(filter).forEach(([key, value]) => {
    query = query.eq(key, value)
  })

  const { count, error } = await query
  throwIfSupabaseError(error)
  return Number(count ?? 0)
}

async function ensureDefaultPerfilPermissoes() {
  const current = await listPerfilPermissoesInternal()

  if (!current || current.length > 0) {
    return
  }

  const matrix = getDefaultFeatureMatrix()

  if (getDatabaseType() === 'mysql') {
    const pool = getMySQLPool()
    if (!pool) {
      return
    }

    const connection = await pool.getConnection()
    try {
      for (const [perfil, features] of Object.entries(matrix) as Array<[PerfilUsuario, AppFeature[]]>) {
        for (const feature of features) {
          await connection.execute(
            'INSERT INTO perfil_permissoes (perfil, feature, permitido) VALUES (?, ?, 1)',
            [perfil, feature],
          )
        }
      }
    } finally {
      connection.release()
    }
  } else if (getDatabaseType() === 'supabase') {
    const client = getSupabaseOrThrow()
    const rows = (Object.entries(matrix) as Array<[PerfilUsuario, AppFeature[]]>).flatMap(([perfil, features]) =>
      features.map((feature) => ({
        perfil,
        feature,
        permitido: true,
      })),
    )

    if (rows.length > 0) {
      const { error } = await client.from('perfil_permissoes').insert(rows)
      throwIfSupabaseError(error)
    }
  }
}

async function listPerfilPermissoesInternal(): Promise<PerfilPermissao[] | null> {
  try {
    if (getDatabaseType() === 'mysql') {
      const rows = await mysqlSelect('SELECT * FROM perfil_permissoes WHERE permitido = 1')
      return rows.map(normalizePerfilPermissao)
    }

    if (getDatabaseType() === 'supabase') {
      const client = getSupabaseOrThrow()
      const { data, error } = await client.from('perfil_permissoes').select('*').eq('permitido', true)
      if (error) {
        if (error.code === '42P01' || error.message.toLowerCase().includes('does not exist')) {
          return null
        }

        throw new Error(error.message)
      }

      return (data ?? []).map((row: Row) => normalizePerfilPermissao(row))
    }

    return null
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('perfil_permissoes') && (message.includes('does not exist') || message.includes('doesn\'t exist'))) {
      return null
    }

    throw error
  }
}

function normalizePerfilPermissao(row: Row): PerfilPermissao {
  return {
    perfil: normalizePerfilUsuario(row.perfil),
    feature: normalizeAppFeature(row.feature),
    permitido: normalizeBoolean(row.permitido),
  }
}

function normalizeAppFeature(value: unknown): AppFeature {
  const current = String(value ?? '') as AppFeature
  return ALL_APP_FEATURES.includes(current) ? current : 'dashboard'
}

function cloneFeatureMatrix(matrix: PerfilFeatureMatrix): PerfilFeatureMatrix {
  return Object.fromEntries(
    (Object.keys(matrix) as PerfilUsuario[]).map((perfil) => [perfil, [...matrix[perfil]]]),
  ) as PerfilFeatureMatrix
}

function resetPerfilFeatureMatrixCache() {
  perfilFeatureMatrixCache = null
}

async function checkMySQLSetup(): Promise<SetupStatus> {
  const rows = await mysqlSelect(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${REQUIRED_TABLES_WITH_PERMISSIONS.map(() => '?').join(', ')})`,
    [...REQUIRED_TABLES_WITH_PERMISSIONS],
  )

  const existingTables = rows.map((row) => String(row.TABLE_NAME))
  const missingTables = REQUIRED_TABLES_WITH_PERMISSIONS.filter((table) => !existingTables.includes(table))
  const missingColumns = missingTables.length === 0 ? await getMissingCurrentSchemaItemsMySQL() : []
  const missingRules = missingTables.length === 0 ? await getMissingCurrentSchemaRulesMySQL() : []
  const missingItems = [...missingTables, ...missingColumns, ...missingRules]

  return {
    configured: missingItems.length === 0,
    dbType: 'mysql',
    existingTables,
    missingTables: missingItems,
    setupScript:
      missingTables.length > 0
        ? 'scripts/setup-database.sql'
        : 'scripts/migrations/mysql/2026-05-07-workflow-signatures.sql',
  }
}

async function checkSupabaseSetup(): Promise<SetupStatus> {
  const client = getSupabaseOrThrow()
  const existingTables: string[] = []
  const missingTables: string[] = []

  for (const table of REQUIRED_TABLES_WITH_PERMISSIONS) {
    const { error } = await client.from(table).select('id').limit(1)

    if (error) {
      const isMissing = error.code === '42P01' || error.message.toLowerCase().includes('does not exist')

      if (isMissing) {
        missingTables.push(table)
        continue
      }

      throw new Error(error.message)
    }

    existingTables.push(table)
  }

  const missingColumns = missingTables.length === 0 ? await getMissingCurrentSchemaItemsSupabase() : []
  const missingRules = missingTables.length === 0 ? await getMissingCurrentSchemaRulesSupabase() : []
  const missingItems = [...missingTables, ...missingColumns, ...missingRules]

  return {
    configured: missingItems.length === 0,
    dbType: 'supabase',
    existingTables,
    missingTables: missingItems,
    setupScript:
      missingTables.length > 0
        ? 'scripts/setup-database-supabase.sql'
        : 'scripts/migrations/supabase/2026-05-07-workflow-signatures.sql',
  }
}

async function getMissingCurrentSchemaItemsMySQL() {
  const pool = getMySQLPool()

  if (!pool) {
    return []
  }

  const connection = await pool.getConnection()

  try {
    const missingItems: string[] = []

    for (const [table, columns] of Object.entries(REQUIRED_SCHEMA_COLUMNS_WITH_PERMISSIONS) as Array<
      [keyof typeof REQUIRED_SCHEMA_COLUMNS_WITH_PERMISSIONS, string[]]
    >) {
      for (const column of columns) {
        if (!(await hasColumn(connection, table, column))) {
          missingItems.push(`${table}.${column}`)
        }
      }
    }

    return missingItems
  } finally {
    connection.release()
  }
}

async function getMissingCurrentSchemaRulesMySQL() {
  const pool = getMySQLPool()

  if (!pool) {
    return []
  }

  const connection = await pool.getConnection()

  try {
    const missingItems: string[] = []

    for (const [key, expectedValues] of Object.entries(REQUIRED_MYSQL_ENUM_VALUES)) {
      const [table, column] = key.split('.') as [string, string]
      const [rows] = await connection.execute(
        `SELECT COLUMN_TYPE
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1`,
        [table, column],
      )

      const currentType = String((rows as Row[])[0]?.COLUMN_TYPE ?? '').toLowerCase()
      const missingValue = expectedValues.find((value) => !currentType.includes(`'${value}'`))

      if (missingValue) {
        missingItems.push(`${table}.${column}:enum`)
      }
    }

    return missingItems
  } finally {
    connection.release()
  }
}

async function getMissingCurrentSchemaItemsSupabase() {
  const client = getSupabaseOrThrow()
  const missingItems: string[] = []

  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA_COLUMNS_WITH_PERMISSIONS) as Array<
    [keyof typeof REQUIRED_SCHEMA_COLUMNS_WITH_PERMISSIONS, string[]]
  >) {
    for (const column of columns) {
      const { error } = await client.from(table).select(column).limit(1)

      if (error) {
        const message = error.message.toLowerCase()

        if (message.includes(column.toLowerCase()) && (message.includes('column') || message.includes('schema cache'))) {
          missingItems.push(`${table}.${column}`)
          continue
        }

        throw new Error(error.message)
      }
    }
  }

  return [...new Set(missingItems)]
}

async function getMissingCurrentSchemaRulesSupabase() {
  const client = getSupabaseOrThrow()
  const { data, error } = await client.rpc('validate_setor_compras_schema')

  if (error) {
    const message = error.message.toLowerCase()

    if (message.includes('validate_setor_compras_schema')) {
      return ['public.validate_setor_compras_schema']
    }

    throw new Error(error.message)
  }

  const payload =
    data && typeof data === 'object' && !Array.isArray(data)
      ? (data as { missing_items?: unknown })
      : { missing_items: [] }

  return Array.isArray(payload.missing_items)
    ? payload.missing_items.map((item) => String(item))
    : []
}

async function setupMySQLDatabase() {
  const pool = getMySQLPool()

  if (!pool) {
    throw new Error('MySQL não configurado.')
  }

  const connection = await pool.getConnection()

  if (!connection) {
    throw new Error('MySQL não configurado.')
  }

  try {
    await connection.beginTransaction()

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        documento VARCHAR(20) NULL,
        contato VARCHAR(100) NULL,
        email VARCHAR(255) NULL,
        arquivado BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        senha_hash VARCHAR(255) NOT NULL,
        perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') DEFAULT 'comprador',
        ativo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS propostas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        data_inicio DATE NULL,
        data_fim DATE NULL,
        valor_previsto DECIMAL(15, 2) DEFAULT 0,
        valor_previsto_perfis DECIMAL(15, 2) DEFAULT 0,
        valor_previsto_vidros DECIMAL(15, 2) DEFAULT 0,
        valor_previsto_acessorios DECIMAL(15, 2) DEFAULT 0,
        valor_previsto_outros DECIMAL(15, 2) DEFAULT 0,
        custo_perdas DECIMAL(15, 2) DEFAULT 0,
        arquivado BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_propostas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS compras (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        proposta_id INT NOT NULL,
        solicitante_id INT NULL,
        solicitado_por VARCHAR(255) NULL,
        categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros',
        fornecedor VARCHAR(255) NOT NULL,
        descricao TEXT NOT NULL,
        valor_total DECIMAL(15, 2) NULL,
        valor_categoria_perfis DECIMAL(15, 2) DEFAULT 0,
        valor_categoria_vidros DECIMAL(15, 2) DEFAULT 0,
        valor_categoria_acessorios DECIMAL(15, 2) DEFAULT 0,
        valor_categoria_perdas DECIMAL(15, 2) DEFAULT 0,
        valor_categoria_outros DECIMAL(15, 2) DEFAULT 0,
        numero_pedido VARCHAR(100) NULL,
        status ENUM('cotacao', 'em_analise', 'retificacao', 'pedido_autorizado') DEFAULT 'cotacao',
        status_entrega ENUM('pendente', 'entregue') DEFAULT 'pendente',
        etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma',
        etapa_fluxo ENUM(
          'solicitacao_registrada',
          'cotacao_em_andamento',
          'analise_solicitante',
          'retificacao',
          'aprovada_solicitante',
          'aguardando_admin',
          'aprovada_admin',
          'aguardando_financeiro',
          'liberada_para_fornecedor',
          'pedido_autorizado'
        ) DEFAULT 'solicitacao_registrada',
        previsao_entrega DATE NULL,
        data_envio_fornecedor DATE NULL,
        cotacao_enviada_por VARCHAR(255) NULL,
        cotacao_recebida_em DATE NULL,
        cotacao_recebida_por VARCHAR(255) NULL,
        aprovado_solicitante_em DATE NULL,
        aprovado_solicitante_por VARCHAR(255) NULL,
        aprovado_admin_em DATE NULL,
        aprovado_admin_por VARCHAR(255) NULL,
        aprovado_financeiro_em DATE NULL,
        aprovado_financeiro_por VARCHAR(255) NULL,
        confirmado_fornecedor_em DATE NULL,
        confirmado_fornecedor_por VARCHAR(255) NULL,
        data_entrega_real DATE NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        arquivado BOOLEAN DEFAULT FALSE,
        CONSTRAINT fk_compras_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
        CONSTRAINT fk_compras_proposta FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS historico_compras (
        id INT AUTO_INCREMENT PRIMARY KEY,
        compra_id INT NOT NULL,
        evento VARCHAR(500) NOT NULL,
        data TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        usuario VARCHAR(100) DEFAULT 'Sistema',
        CONSTRAINT fk_historico_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS anexos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        compra_id INT NOT NULL,
        tipo ENUM('cotacao', 'nf', 'boleto', 'outro') DEFAULT 'outro',
        arquivo_url VARCHAR(500) NOT NULL,
        nome_arquivo VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_anexos_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS perfil_permissoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        perfil VARCHAR(40) NOT NULL,
        feature VARCHAR(80) NOT NULL,
        permitido BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_perfil_feature (perfil, feature)
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS solicitacoes_sensiveis (
        id INT AUTO_INCREMENT PRIMARY KEY,
        entidade ENUM('cliente', 'proposta', 'compra') NOT NULL,
        entidade_id INT NOT NULL,
        acao ENUM('editar', 'excluir') NOT NULL,
        status ENUM('pendente', 'aprovada', 'recusada') DEFAULT 'pendente',
        motivo TEXT NULL,
        payload JSON NULL,
        solicitante_id INT NOT NULL,
        solicitante_nome VARCHAR(255) NOT NULL,
        solicitante_perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') NOT NULL,
        aprovado_por VARCHAR(255) NULL,
        aprovado_em TIMESTAMP NULL,
        recusado_por VARCHAR(255) NULL,
        recusado_em TIMESTAMP NULL,
        observacao_admin TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS resumos_contratos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        periodo_referencia CHAR(7) NOT NULL,
        created_by_user_id INT NOT NULL,
        created_by_nome VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_resumos_contratos_periodo (periodo_referencia)
      )
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS resumo_contrato_itens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        resumo_id INT NOT NULL,
        proposta_id INT NOT NULL,
        cliente_id INT NOT NULL,
        valor_contrato DECIMAL(15, 2) DEFAULT 0,
        ordem INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_resumo_contrato_itens_resumo FOREIGN KEY (resumo_id) REFERENCES resumos_contratos(id) ON DELETE CASCADE,
        CONSTRAINT fk_resumo_contrato_itens_proposta FOREIGN KEY (proposta_id) REFERENCES propostas(id) ON DELETE CASCADE,
        INDEX idx_resumo_contrato_itens_resumo (resumo_id)
      )
    `)

    await addColumnIfMissing(connection, 'clientes', 'documento', 'VARCHAR(20) NULL')
    await addColumnIfMissing(connection, 'clientes', 'contato', 'VARCHAR(100) NULL')
    await addColumnIfMissing(connection, 'clientes', 'arquivado', 'BOOLEAN DEFAULT FALSE')
    await addColumnIfMissing(connection, 'usuarios', 'senha_hash', 'VARCHAR(255) NOT NULL')
    await addColumnIfMissing(
      connection,
      'usuarios',
      'perfil',
      "ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') DEFAULT 'comprador'",
    )
    await addColumnIfMissing(connection, 'usuarios', 'ativo', 'BOOLEAN DEFAULT TRUE')
    await addColumnIfMissing(connection, 'propostas', 'data_fim', 'DATE NULL')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_perfis', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_vidros', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_acessorios', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_outros', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'custo_perdas', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'arquivado', 'BOOLEAN DEFAULT FALSE')
    await addColumnIfMissing(connection, 'compras', 'cliente_id', 'INT NULL')
    await addColumnIfMissing(connection, 'compras', 'solicitante_id', 'INT NULL')
    await addColumnIfMissing(connection, 'compras', 'solicitado_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'categoria', "ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros'")
    await addColumnIfMissing(connection, 'compras', 'valor_total', 'DECIMAL(15, 2) NULL')
    await addColumnIfMissing(connection, 'compras', 'valor_categoria_perfis', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'compras', 'valor_categoria_vidros', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'compras', 'valor_categoria_acessorios', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'compras', 'valor_categoria_perdas', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'compras', 'valor_categoria_outros', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'compras', 'status_entrega', "ENUM('pendente', 'entregue') DEFAULT 'pendente'")
    await addColumnIfMissing(
      connection,
      'compras',
      'etapa_autorizacao',
      "ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma'",
    )
    await addColumnIfMissing(
      connection,
      'compras',
      'etapa_fluxo',
      "ENUM('solicitacao_registrada', 'cotacao_em_andamento', 'analise_solicitante', 'retificacao', 'aprovada_solicitante', 'aguardando_admin', 'aprovada_admin', 'aguardando_financeiro', 'liberada_para_fornecedor', 'pedido_autorizado') DEFAULT 'solicitacao_registrada'",
    )
    await addColumnIfMissing(connection, 'compras', 'previsao_entrega', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'data_envio_fornecedor', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'cotacao_enviada_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'cotacao_recebida_em', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'cotacao_recebida_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'aprovado_solicitante_em', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'aprovado_solicitante_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'aprovado_admin_em', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'aprovado_admin_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'aprovado_financeiro_em', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'aprovado_financeiro_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'documentos_financeiro_confirmados_em', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'documentos_financeiro_confirmados_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'confirmado_fornecedor_em', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'confirmado_fornecedor_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'compras', 'data_entrega_real', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'data_criacao', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'compras', 'arquivado', 'BOOLEAN DEFAULT FALSE')
    await addColumnIfMissing(connection, 'anexos', 'nome_arquivo', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'anexos', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'perfil_permissoes', 'permitido', 'BOOLEAN DEFAULT TRUE')
    await addColumnIfMissing(connection, 'perfil_permissoes', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'perfil_permissoes', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'motivo', 'TEXT NULL')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'payload', 'JSON NULL')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'aprovado_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'aprovado_em', 'TIMESTAMP NULL')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'recusado_por', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'recusado_em', 'TIMESTAMP NULL')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'observacao_admin', 'TEXT NULL')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'solicitacoes_sensiveis', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'resumos_contratos', 'periodo_referencia', 'CHAR(7) NOT NULL')
    await addColumnIfMissing(connection, 'resumos_contratos', 'created_by_user_id', 'INT NOT NULL')
    await addColumnIfMissing(connection, 'resumos_contratos', 'created_by_nome', 'VARCHAR(255) NOT NULL')
    await addColumnIfMissing(connection, 'resumos_contratos', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'resumos_contratos', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'resumo_contrato_itens', 'cliente_id', 'INT NOT NULL')
    await addColumnIfMissing(connection, 'resumo_contrato_itens', 'valor_contrato', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'resumo_contrato_itens', 'ordem', 'INT DEFAULT 1')
    await addColumnIfMissing(connection, 'resumo_contrato_itens', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'resumo_contrato_itens', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')

    if (await hasColumn(connection, 'clientes', 'cnpj')) {
      await connection.execute('UPDATE clientes SET documento = COALESCE(documento, cnpj) WHERE documento IS NULL')
    }

    if (await hasColumn(connection, 'clientes', 'telefone')) {
      await connection.execute('UPDATE clientes SET contato = COALESCE(contato, telefone) WHERE contato IS NULL')
    }

    if (await hasColumn(connection, 'propostas', 'data_fim_prevista')) {
      await connection.execute('UPDATE propostas SET data_fim = COALESCE(data_fim, data_fim_prevista) WHERE data_fim IS NULL')
    }

    await connection.execute(`
      UPDATE compras c
      JOIN propostas p ON p.id = c.proposta_id
      SET c.cliente_id = COALESCE(c.cliente_id, p.cliente_id)
      WHERE c.cliente_id IS NULL
    `)

    if (await hasColumn(connection, 'compras', 'valor_autorizado')) {
      await connection.execute(`
        UPDATE compras
        SET valor_total = COALESCE(valor_total, valor_autorizado, valor_estimado)
        WHERE valor_total IS NULL
      `)
    }

    if (await hasColumn(connection, 'compras', 'created_at')) {
      await connection.execute('UPDATE compras SET data_criacao = COALESCE(data_criacao, created_at) WHERE data_criacao IS NULL')
    }

    await connection.execute(`
      UPDATE compras
      SET categoria = 'outros'
      WHERE categoria IS NULL OR categoria = ''
    `)

    await connection.execute(`
      UPDATE compras
      SET
        valor_categoria_perfis = CASE
          WHEN COALESCE(valor_categoria_perfis, 0) = 0
            AND COALESCE(valor_categoria_vidros, 0) = 0
            AND COALESCE(valor_categoria_acessorios, 0) = 0
            AND COALESCE(valor_categoria_perdas, 0) = 0
            AND COALESCE(valor_categoria_outros, 0) = 0
            AND categoria = 'perfis'
          THEN COALESCE(valor_total, 0)
          ELSE COALESCE(valor_categoria_perfis, 0)
        END,
        valor_categoria_vidros = CASE
          WHEN COALESCE(valor_categoria_perfis, 0) = 0
            AND COALESCE(valor_categoria_vidros, 0) = 0
            AND COALESCE(valor_categoria_acessorios, 0) = 0
            AND COALESCE(valor_categoria_perdas, 0) = 0
            AND COALESCE(valor_categoria_outros, 0) = 0
            AND categoria = 'vidros'
          THEN COALESCE(valor_total, 0)
          ELSE COALESCE(valor_categoria_vidros, 0)
        END,
        valor_categoria_acessorios = CASE
          WHEN COALESCE(valor_categoria_perfis, 0) = 0
            AND COALESCE(valor_categoria_vidros, 0) = 0
            AND COALESCE(valor_categoria_acessorios, 0) = 0
            AND COALESCE(valor_categoria_perdas, 0) = 0
            AND COALESCE(valor_categoria_outros, 0) = 0
            AND categoria = 'acessorios'
          THEN COALESCE(valor_total, 0)
          ELSE COALESCE(valor_categoria_acessorios, 0)
        END,
        valor_categoria_perdas = CASE
          WHEN COALESCE(valor_categoria_perfis, 0) = 0
            AND COALESCE(valor_categoria_vidros, 0) = 0
            AND COALESCE(valor_categoria_acessorios, 0) = 0
            AND COALESCE(valor_categoria_perdas, 0) = 0
            AND COALESCE(valor_categoria_outros, 0) = 0
            AND categoria = 'perdas'
          THEN COALESCE(valor_total, 0)
          ELSE COALESCE(valor_categoria_perdas, 0)
        END,
        valor_categoria_outros = CASE
          WHEN COALESCE(valor_categoria_perfis, 0) = 0
            AND COALESCE(valor_categoria_vidros, 0) = 0
            AND COALESCE(valor_categoria_acessorios, 0) = 0
            AND COALESCE(valor_categoria_perdas, 0) = 0
            AND COALESCE(valor_categoria_outros, 0) = 0
            AND categoria = 'outros'
          THEN COALESCE(valor_total, 0)
          ELSE COALESCE(valor_categoria_outros, 0)
        END
      WHERE valor_total IS NOT NULL
    `)

    await connection.execute(`
      ALTER TABLE compras
      MODIFY COLUMN status VARCHAR(50) NULL
    `)

    await connection.execute(`
      UPDATE compras
      SET status = CASE
        WHEN status IN ('Cotação', 'Cotação', 'cotacao') THEN 'cotacao'
        WHEN status IN ('Em Análise', 'Em Analise', 'em_analise') THEN 'em_analise'
        WHEN status IN ('Retificação', 'Retificacao', 'retificacao') THEN 'retificacao'
        WHEN status IN ('Pedido Autorizado', 'Autorizado', 'pedido_autorizado') THEN 'pedido_autorizado'
        ELSE 'cotacao'
      END
    `)

    await connection.execute(`
      UPDATE compras
      SET etapa_autorizacao = 'nenhuma'
      WHERE etapa_autorizacao IS NULL OR etapa_autorizacao = ''
    `)

    await connection.execute(`
      UPDATE compras
      SET etapa_fluxo = CASE
        WHEN status = 'pedido_autorizado' THEN 'pedido_autorizado'
        WHEN etapa_autorizacao = 'liberada' THEN 'liberada_para_fornecedor'
        WHEN etapa_autorizacao = 'solicitada' THEN 'aguardando_admin'
        WHEN status = 'retificacao' THEN 'retificacao'
        WHEN data_envio_fornecedor IS NOT NULL THEN 'cotacao_em_andamento'
        ELSE 'solicitacao_registrada'
      END
      WHERE etapa_fluxo IS NULL OR etapa_fluxo = ''
    `)

    await connection.execute(`
      ALTER TABLE usuarios
      MODIFY COLUMN perfil ENUM('admin', 'comprador', 'orcamentista', 'solicitante', 'financeiro') DEFAULT 'comprador'
    `)

    await connection.execute(`
      ALTER TABLE compras
        MODIFY COLUMN status ENUM('cotacao', 'em_analise', 'retificacao', 'pedido_autorizado') DEFAULT 'cotacao',
        MODIFY COLUMN status_entrega ENUM('pendente', 'entregue') DEFAULT 'pendente',
        MODIFY COLUMN etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma',
        MODIFY COLUMN etapa_fluxo ENUM('solicitacao_registrada', 'cotacao_em_andamento', 'analise_solicitante', 'retificacao', 'aprovada_solicitante', 'aguardando_admin', 'aprovada_admin', 'aguardando_financeiro', 'liberada_para_fornecedor', 'pedido_autorizado') DEFAULT 'solicitacao_registrada',
        MODIFY COLUMN categoria ENUM('perfis', 'vidros', 'acessorios', 'perdas', 'outros') DEFAULT 'outros'
    `)

    if (await hasTable(connection, 'compras_historico')) {
      await connection.execute(`
        INSERT INTO historico_compras (compra_id, evento, data, usuario)
        SELECT
          compra_id,
          COALESCE(
            observacao,
            CONCAT('Status alterado de ', COALESCE(status_anterior, 'desconhecido'), ' para ', COALESCE(status_novo, 'desconhecido'))
          ),
          COALESCE(created_at, CURRENT_TIMESTAMP),
          COALESCE(usuario, 'Sistema')
        FROM compras_historico legado
        WHERE NOT EXISTS (
          SELECT 1
          FROM historico_compras novo
          WHERE novo.compra_id = legado.compra_id
            AND novo.evento = COALESCE(
              legado.observacao,
              CONCAT('Status alterado de ', COALESCE(legado.status_anterior, 'desconhecido'), ' para ', COALESCE(legado.status_novo, 'desconhecido'))
            )
        )
      `)
    }

    await connection.execute(`
      UPDATE anexos
      SET nome_arquivo = COALESCE(NULLIF(nome_arquivo, ''), SUBSTRING_INDEX(arquivo_url, '/', -1), 'anexo')
      WHERE nome_arquivo IS NULL OR nome_arquivo = ''
    `)

    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function hasTable(connection: PoolConnection, table: string) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as total
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table],
  )
  return Number((rows as Array<{ total: number }>)[0]?.total ?? 0) > 0
}

async function hasColumn(
  connection: PoolConnection,
  table: string,
  column: string,
) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as total
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  )
  return Number((rows as Array<{ total: number }>)[0]?.total ?? 0) > 0
}

async function addColumnIfMissing(
  connection: PoolConnection,
  table: string,
  column: string,
  definition: string,
) {
  if (await hasColumn(connection, table, column)) {
    return
  }

  await connection.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

async function mysqlSelect(sql: string, params: unknown[] = []) {
  return queryMySQL<Row[]>(sql, params)
}

async function mysqlExecute(sql: string, params: unknown[] = []) {
  return queryMySQL<ResultSetHeader>(sql, params)
}

function getSupabaseOrThrow(): any {
  const client = getSupabaseClient()

  if (!client) {
    throw new Error('Supabase não configurado.')
  }

  return client as any
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) {
    const message = error.message
    const lowerMessage = message.toLowerCase()

    if (message.includes("usuarios_perfil_check")) {
      throw new Error(
        "O banco Supabase ainda esta com a constraint antiga de perfis de usuario. Execute scripts/migrations/supabase/2026-05-07-workflow-signatures.sql e tente novamente.",
      )
    }

    if (message.includes("compras_categoria_check")) {
      throw new Error(
        "O banco Supabase ainda esta com a constraint antiga de categorias de compra. Execute scripts/migrations/supabase/2026-05-07-workflow-signatures.sql e tente novamente.",
      )
    }

    if (message.includes("compras_etapa_autorizacao_check")) {
      throw new Error(
        "O banco Supabase ainda esta com a constraint antiga do fluxo de autorizacao. Execute scripts/migrations/supabase/2026-05-07-workflow-signatures.sql e tente novamente.",
      )
    }

    if (message.includes("compras_etapa_fluxo_check")) {
      throw new Error(
        "O banco Supabase ainda esta com a constraint antiga das etapas do fluxo de compras. Execute scripts/migrations/supabase/2026-05-07-workflow-signatures.sql e tente novamente.",
      )
    }

    if (message.includes("compras_status_check")) {
      throw new Error(
        "O banco Supabase ainda esta com a constraint antiga de status do pedido. Execute scripts/migrations/supabase/2026-05-07-workflow-signatures.sql e tente novamente.",
      )
    }

    if (message.includes("compras_status_entrega_check")) {
      throw new Error(
        "O banco Supabase ainda esta com a constraint antiga de status de entrega. Execute scripts/migrations/supabase/2026-05-07-workflow-signatures.sql e tente novamente.",
      )
    }

    if (message.includes("anexos_tipo_check")) {
      throw new Error(
        "O banco Supabase ainda esta com a constraint antiga de tipos de anexo. Execute scripts/migrations/supabase/2026-05-07-workflow-signatures.sql e tente novamente.",
      )
    }

    if (
      lowerMessage.includes("solicitacoes_sensiveis") &&
      (lowerMessage.includes("does not exist") ||
        lowerMessage.includes("could not find the table") ||
        lowerMessage.includes("schema cache") ||
        lowerMessage.includes("column"))
    ) {
      throw new Error(
        "A fila administrativa de alteracoes sensiveis ainda nao esta criada ou atualizada no Supabase. Execute scripts/migrations/supabase/2026-05-08-sensitive-change-requests.sql e tente novamente.",
      )
    }

    if (
      lowerMessage.includes("usuario_permissoes") &&
      (lowerMessage.includes("does not exist") ||
        lowerMessage.includes("could not find the table") ||
        lowerMessage.includes("schema cache") ||
        lowerMessage.includes("column"))
    ) {
      throw new Error(
        "As permissoes por usuario ainda nao estao criadas ou atualizadas no Supabase. Execute scripts/migrations/supabase/2026-05-11-user-feature-access.sql e tente novamente.",
      )
    }

    throw new Error(message)
  }
}

function normalizeCliente(row: Row): Cliente {
  return {
    id: toNumber(row.id),
    nome: String(row.nome ?? ''),
    documento: nullableString(row.documento),
    contato: nullableString(row.contato),
    email: nullableString(row.email),
    arquivado: normalizeBoolean(row.arquivado),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  }
}

function normalizeUsuario(row: Row): Usuario {
  return {
    id: toNumber(row.id),
    nome: String(row.nome ?? ''),
    email: sanitizeEmail(String(row.email ?? '')),
    senha_hash: String(row.senha_hash ?? ''),
    perfil: normalizePerfilUsuario(row.perfil),
    tema_preferido: normalizeThemePreference(row.tema_preferido),
    ativo: normalizeBoolean(row.ativo),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  }
}

function normalizeSolicitacaoSensivel(row: Row): SolicitacaoSensivel {
  return {
    id: toNumber(row.id),
    entidade: normalizeSolicitacaoEntidade(row.entidade),
    entidade_id: toNumber(row.entidade_id),
    acao: normalizeSolicitacaoAcao(row.acao),
    status: normalizeSolicitacaoStatus(row.status),
    motivo: nullableString(row.motivo),
    payload: parseSolicitacaoPayload(row.payload),
    solicitante_id: toNumber(row.solicitante_id),
    solicitante_nome: nullableString(row.solicitante_nome) ?? 'Usuario',
    solicitante_perfil: normalizePerfilUsuario(row.solicitante_perfil),
    aprovado_por: nullableString(row.aprovado_por),
    aprovado_em: nullableString(row.aprovado_em),
    recusado_por: nullableString(row.recusado_por),
    recusado_em: nullableString(row.recusado_em),
    observacao_admin: nullableString(row.observacao_admin),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  }
}

function parseSolicitacaoPayload(value: unknown) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>
    } catch {
      return null
    }
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>
  }

  return null
}

function normalizeSolicitacaoEntidade(value: unknown): SolicitacaoSensivelEntidade {
  const current = String(value ?? '').toLowerCase()

  if (current === 'cliente') {
    return 'cliente'
  }

  if (current === 'proposta') {
    return 'proposta'
  }

  return 'compra'
}

function normalizeSolicitacaoAcao(value: unknown): SolicitacaoSensivelAcao {
  return String(value ?? '').toLowerCase() === 'excluir' ? 'excluir' : 'editar'
}

function normalizeSolicitacaoStatus(value: unknown): SolicitacaoSensivelStatus {
  const current = String(value ?? '').toLowerCase()

  if (current === 'aprovada') {
    return 'aprovada'
  }

  if (current === 'recusada') {
    return 'recusada'
  }

  return 'pendente'
}

function sanitizeSensitiveClientePayload(payload: Record<string, unknown> | null) {
  const nome = nullableString(payload?.nome)

  if (!nome) {
    throw new Error('A solicitacao de alteracao do cliente esta sem nome valido.')
  }

  return {
    nome,
    documento: nullableString(payload?.documento),
    contato: nullableString(payload?.contato),
    email: nullableString(payload?.email),
  } as Pick<Cliente, 'nome' | 'documento' | 'contato' | 'email'>
}

function sanitizeSensitivePropostaPayload(payload: Record<string, unknown> | null): PropostaFormData {
  const cliente_id = toNumber(payload?.cliente_id)
  const nome = nullableString(payload?.nome)

  if (!cliente_id || !nome) {
    throw new Error('A solicitacao de alteracao da proposta esta incompleta.')
  }

  return {
    cliente_id,
    nome,
    data_inicio: nullableString(payload?.data_inicio),
    data_fim: nullableString(payload?.data_fim),
    valor_previsto_perfis: toNumber(payload?.valor_previsto_perfis),
    valor_previsto_vidros: toNumber(payload?.valor_previsto_vidros),
    valor_previsto_acessorios: toNumber(payload?.valor_previsto_acessorios),
    valor_previsto_outros: toNumber(payload?.valor_previsto_outros),
    custo_perdas: toNumber(payload?.custo_perdas),
  }
}

function sanitizeSensitiveCompraPayload(payload: Record<string, unknown> | null): Partial<CompraFormData> {
  const fornecedor = nullableString(payload?.fornecedor)
  const descricao = nullableString(payload?.descricao)

  if (!fornecedor || !descricao) {
    throw new Error('A solicitacao de alteracao da compra esta incompleta.')
  }

  return {
    fornecedor,
    descricao,
    data_envio_fornecedor: nullableString(payload?.data_envio_fornecedor),
    valor_categoria_perfis: toNumber(payload?.valor_categoria_perfis),
    valor_categoria_vidros: toNumber(payload?.valor_categoria_vidros),
    valor_categoria_acessorios: toNumber(payload?.valor_categoria_acessorios),
    valor_categoria_perdas: toNumber(payload?.valor_categoria_perdas),
    valor_categoria_outros: toNumber(payload?.valor_categoria_outros),
  }
}

function normalizeProposta(row: Row): Proposta {
  return {
    id: toNumber(row.id),
    cliente_id: toNumber(row.cliente_id),
    nome: String(row.nome ?? ''),
    data_inicio: toDateOnlyString(row.data_inicio),
    data_fim: toDateOnlyString(row.data_fim),
    valor_previsto: toNumber(row.valor_previsto),
    valor_previsto_perfis: toNumber(row.valor_previsto_perfis),
    valor_previsto_vidros: toNumber(row.valor_previsto_vidros),
    valor_previsto_acessorios: toNumber(row.valor_previsto_acessorios),
    valor_previsto_outros: toNumber(row.valor_previsto_outros),
    custo_perdas: toNumber(row.custo_perdas),
    arquivado: normalizeBoolean(row.arquivado),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  }
}

function normalizeResumoContratoRecordRow(row: Row): ResumoContratoRecordRow {
  return {
    id: toNumber(row.id),
    titulo: String(row.titulo ?? ''),
    periodo_referencia: String(row.periodo_referencia ?? ''),
    created_by_user_id: toNumber(row.created_by_user_id),
    created_by_nome: String(row.created_by_nome ?? 'Sistema'),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  }
}

function normalizeResumoContratoItemRow(row: Row): ResumoContratoItemRow {
  return {
    id: toNumber(row.id),
    resumo_id: toNumber(row.resumo_id),
    proposta_id: toNumber(row.proposta_id),
    cliente_id: toNumber(row.cliente_id),
    valor_contrato: toNumber(row.valor_contrato),
    ordem: toNumber(row.ordem),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
  }
}

function buildGastoRealByProposta(compras: Compra[]) {
  const map = new Map<number, number>()

  for (const compra of compras) {
    map.set(compra.proposta_id, (map.get(compra.proposta_id) ?? 0) + Number(compra.valor_total ?? 0))
  }

  return map
}

function groupResumoContratoItensByResumo(itens: ResumoContratoItemRow[]) {
  const map = new Map<number, ResumoContratoItemRow[]>()

  for (const item of itens) {
    const current = map.get(item.resumo_id)
    if (current) {
      current.push(item)
    } else {
      map.set(item.resumo_id, [item])
    }
  }

  return map
}

function buildResumoContratoAggregate(
  record: ResumoContratoRecordRow,
  itens: ResumoContratoItemRow[],
  gastoRealByProposta: Map<number, number>,
): ResumoContrato {
  const normalizedItens = itens.slice().sort((left, right) => left.ordem - right.ordem || left.id - right.id)
  const valorTotalContrato = normalizedItens.reduce((sum, item) => sum + Number(item.valor_contrato), 0)
  const valorTotalRealGasto = normalizedItens.reduce(
    (sum, item) => sum + Number(gastoRealByProposta.get(item.proposta_id) ?? 0),
    0,
  )

  return {
    id: record.id,
    titulo: record.titulo,
    periodo_referencia: record.periodo_referencia,
    created_by_user_id: record.created_by_user_id,
    created_by_nome: record.created_by_nome,
    created_at: record.created_at,
    updated_at: record.updated_at,
    quantidade_obras: normalizedItens.length,
    valor_total_contrato: valorTotalContrato,
    valor_total_real_gasto: valorTotalRealGasto,
    lucro_bruto_total: valorTotalContrato - valorTotalRealGasto,
  }
}

function resolveCompraEtapaFluxo(
  row: Row,
  rawStatus: StatusPedido,
  rawEtapaAutorizacao: EtapaAutorizacao,
  rawEtapaFluxo: EtapaFluxoCompra,
): EtapaFluxoCompra {
  const hasRequester = nullableNumber(row.solicitante_id) !== null
  const hasQuoteSent = Boolean(nullableString(row.cotacao_enviada_por) || toDateOnlyString(row.data_envio_fornecedor))
  const hasQuoteReceived = Boolean(nullableString(row.cotacao_recebida_por) || toDateOnlyString(row.cotacao_recebida_em))
  const hasRequesterApproval = Boolean(
    nullableString(row.aprovado_solicitante_por) || toDateOnlyString(row.aprovado_solicitante_em),
  )
  const hasAdminApproval = Boolean(nullableString(row.aprovado_admin_por) || toDateOnlyString(row.aprovado_admin_em))
  const hasFinanceApproval = Boolean(
    nullableString(row.aprovado_financeiro_por) || toDateOnlyString(row.aprovado_financeiro_em),
  )
  const hasSupplierConfirmation = Boolean(
    nullableString(row.confirmado_fornecedor_por) || toDateOnlyString(row.confirmado_fornecedor_em),
  )

  if (rawStatus === 'pedido_autorizado' || hasSupplierConfirmation || rawEtapaFluxo === 'pedido_autorizado') {
    return 'pedido_autorizado'
  }

  if (hasFinanceApproval) {
    return 'liberada_para_fornecedor'
  }

  if (rawEtapaFluxo === 'aguardando_financeiro') {
    return 'aguardando_financeiro'
  }

  if (hasAdminApproval) {
    return 'aprovada_admin'
  }

  if (rawEtapaAutorizacao === 'liberada' || rawEtapaFluxo === 'aprovada_admin') {
    return 'aprovada_admin'
  }

  if (rawEtapaAutorizacao === 'solicitada' || rawEtapaFluxo === 'aguardando_admin') {
    return 'aguardando_admin'
  }

  if (rawStatus === 'retificacao' || rawEtapaFluxo === 'retificacao') {
    return 'retificacao'
  }

  if (!hasRequester && (rawEtapaFluxo === 'analise_solicitante' || rawEtapaFluxo === 'aprovada_solicitante' || hasQuoteReceived)) {
    return 'aguardando_admin'
  }

  if (hasRequesterApproval || rawEtapaFluxo === 'aprovada_solicitante') {
    return 'aprovada_solicitante'
  }

  if (rawEtapaFluxo === 'analise_solicitante' || hasQuoteReceived) {
    return 'analise_solicitante'
  }

  if (rawEtapaFluxo === 'cotacao_em_andamento' || hasQuoteSent) {
    return 'cotacao_em_andamento'
  }

  return 'solicitacao_registrada'
}

function resolveCompraStatus(row: Row, etapaFluxo: EtapaFluxoCompra, rawStatus: StatusPedido): StatusPedido {
  if (etapaFluxo === 'pedido_autorizado') {
    return 'pedido_autorizado'
  }

  if (etapaFluxo === 'retificacao') {
    return 'retificacao'
  }

  if (etapaFluxo === 'solicitacao_registrada' || etapaFluxo === 'cotacao_em_andamento') {
    return 'cotacao'
  }

  if (rawStatus === 'pedido_autorizado') {
    return 'pedido_autorizado'
  }

  return 'em_analise'
}

function resolveCompraEtapaAutorizacao(etapaFluxo: EtapaFluxoCompra): EtapaAutorizacao {
  if (etapaFluxo === 'aguardando_admin') {
    return 'solicitada'
  }

  if (etapaFluxo === 'aprovada_admin' || etapaFluxo === 'aguardando_financeiro' || etapaFluxo === 'liberada_para_fornecedor') {
    return 'liberada'
  }

  return 'nenhuma'
}

function normalizeCompra(row: Row): Compra {
  const rawStatus = normalizeStatusPedido(row.status)
  const rawEtapaAutorizacao = normalizeEtapaAutorizacao(row.etapa_autorizacao)
  const rawEtapaFluxo = normalizeEtapaFluxoCompra(row.etapa_fluxo)
  const etapa_fluxo = resolveCompraEtapaFluxo(row, rawStatus, rawEtapaAutorizacao, rawEtapaFluxo)
  const status = resolveCompraStatus(row, etapa_fluxo, rawStatus)
  const etapa_autorizacao = resolveCompraEtapaAutorizacao(etapa_fluxo)

  return {
    id: toNumber(row.id),
    cliente_id: toNumber(row.cliente_id),
    proposta_id: toNumber(row.proposta_id),
    solicitante_id: nullableNumber(row.solicitante_id),
    solicitado_por: nullableString(row.solicitado_por),
    categoria: normalizeCategoriaCompra(row.categoria),
    fornecedor: String(row.fornecedor ?? ''),
    descricao: String(row.descricao ?? ''),
    valor_total: nullableNumber(row.valor_total),
    valor_categoria_perfis: toNumber(row.valor_categoria_perfis),
    valor_categoria_vidros: toNumber(row.valor_categoria_vidros),
    valor_categoria_acessorios: toNumber(row.valor_categoria_acessorios),
    valor_categoria_perdas: toNumber(row.valor_categoria_perdas),
    valor_categoria_outros: toNumber(row.valor_categoria_outros),
    numero_pedido: nullableString(row.numero_pedido),
    status,
    status_entrega: normalizeStatusEntrega(row.status_entrega),
    etapa_autorizacao,
    etapa_fluxo,
    previsao_entrega: toDateOnlyString(row.previsao_entrega),
    data_envio_fornecedor: toDateOnlyString(row.data_envio_fornecedor),
    cotacao_enviada_por: nullableString(row.cotacao_enviada_por),
    cotacao_recebida_em: toDateOnlyString(row.cotacao_recebida_em),
    cotacao_recebida_por: nullableString(row.cotacao_recebida_por),
    aprovado_solicitante_em: toDateOnlyString(row.aprovado_solicitante_em),
    aprovado_solicitante_por: nullableString(row.aprovado_solicitante_por),
    aprovado_admin_em: toDateOnlyString(row.aprovado_admin_em),
    aprovado_admin_por: nullableString(row.aprovado_admin_por),
    aprovado_financeiro_em: toDateOnlyString(row.aprovado_financeiro_em),
    aprovado_financeiro_por: nullableString(row.aprovado_financeiro_por),
    documentos_financeiro_confirmados_em: toDateOnlyString(row.documentos_financeiro_confirmados_em),
    documentos_financeiro_confirmados_por: nullableString(row.documentos_financeiro_confirmados_por),
    confirmado_fornecedor_em: toDateOnlyString(row.confirmado_fornecedor_em),
    confirmado_fornecedor_por: nullableString(row.confirmado_fornecedor_por),
    data_entrega_real: toDateOnlyString(row.data_entrega_real),
    data_criacao: toDateTimeString(row.data_criacao),
    updated_at: toDateTimeString(row.updated_at),
    arquivado: Boolean(row.arquivado),
  }
}

function normalizeHistorico(row: Row): HistoricoCompra {
  return {
    id: toNumber(row.id),
    compra_id: toNumber(row.compra_id),
    evento: String(row.evento ?? ''),
    data: toDateTimeString(row.data),
    usuario: String(row.usuario ?? 'Sistema'),
  }
}

function normalizeAnexo(row: Row): Anexo {
  return {
    id: toNumber(row.id),
    compra_id: toNumber(row.compra_id),
    tipo: normalizeTipoAnexo(row.tipo),
    arquivo_url: String(row.arquivo_url ?? ''),
    nome_arquivo: String(row.nome_arquivo ?? ''),
    created_at: toDateTimeString(row.created_at),
  }
}

async function annotateAnexoAvailability(anexos: Anexo[]) {
  return Promise.all(
    anexos.map(async (anexo) => ({
      ...anexo,
      disponivel: await isAnexoAvailable(anexo.arquivo_url),
    })),
  )
}

async function isAnexoAvailable(arquivoUrl: string) {
  if (isExternalAttachmentUrl(arquivoUrl)) {
    return true
  }

  if (isSupabaseAttachmentUrl(arquivoUrl)) {
    const parsed = parseSupabaseAttachmentUrl(arquivoUrl)
    const client = getSupabaseClient()

    if (!parsed || !client) {
      return false
    }

    const directoryPath = path.posix.dirname(parsed.objectPath)
    const fileName = path.posix.basename(parsed.objectPath)
    const listPath = directoryPath === '.' ? '' : directoryPath
    const { data, error } = await client.storage.from(parsed.bucket).list(listPath, {
      limit: 100,
      search: fileName,
    })

    if (error) {
      return false
    }

    return (data ?? []).some((entry) => entry.name === fileName)
  }

  const localPath = resolveLocalAttachmentPath(arquivoUrl)

  if (!localPath) {
    return false
  }

  try {
    await access(localPath)
    return true
  } catch {
    return false
  }
}

function normalizeTipoAnexo(value: unknown): TipoAnexo {
  const current = String(value ?? '').toLowerCase()

  if (current === 'cotacao') {
    return 'cotacao'
  }

  if (current === 'nf') {
    return 'nf'
  }

  if (current === 'boleto') {
    return 'boleto'
  }

  return 'outro'
}

function normalizePerfilUsuario(value: unknown): PerfilUsuario {
  const perfil = String(value ?? '').toLowerCase()

  if (perfil === 'admin') {
    return 'admin'
  }

  if (perfil === 'orcamentista') {
    return 'orcamentista'
  }

  if (perfil === 'solicitante') {
    return 'solicitante'
  }

  if (perfil === 'financeiro') {
    return 'financeiro'
  }

  return 'comprador'
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value === 1
  }

  const normalized = String(value ?? '').toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 't'
}

function toDateTimeString(value: unknown) {
  if (!value) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const current = String(value)
  return current.includes('T') ? current : current.replace(' ', 'T')
}

function toDateOnlyString(value: unknown) {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return format(value, 'yyyy-MM-dd')
  }

  return String(value).slice(0, 10)
}

function sanitizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function formatMonthKey(value: string) {
  const normalized = normalizeDateForParse(value)
  const matchedMonth = normalized.match(/^(\d{4}-\d{2})/)

  if (matchedMonth) {
    return matchedMonth[1]
  }

  return format(parseISO(normalized), 'yyyy-MM')
}

function matchDateRange(value: string, dataInicio?: string | null, dataFim?: string | null) {
  const target = parseISO(normalizeDateForParse(value))

  if (dataInicio) {
    const start = parseISO(`${dataInicio}T00:00:00`)
    if (isBefore(target, start)) {
      return false
    }
  }

  if (dataFim) {
    const end = parseISO(`${dataFim}T23:59:59`)
    if (isAfter(target, end)) {
      return false
    }
  }

  return true
}

function normalizeDateForParse(value: string) {
  return value.includes('T') ? value : value.replace(' ', 'T')
}

function differenceInDays(value: string, reference: string) {
  const current = parseISO(normalizeDateForParse(value))
  const origin = parseISO(normalizeDateForParse(reference))
  return Math.max(0, Math.round((current.getTime() - origin.getTime()) / 86400000))
}

function differenceInDaysFromNow(value: string) {
  return Math.floor((Date.now() - parseISO(normalizeDateForParse(value)).getTime()) / 86400000)
}

function compareDesc(left: string, right: string) {
  return parseISO(normalizeDateForParse(right)).getTime() - parseISO(normalizeDateForParse(left)).getTime()
}

function compareAsc(left: string, right: string) {
  return parseISO(normalizeDateForParse(left)).getTime() - parseISO(normalizeDateForParse(right)).getTime()
}

function asDashboardPedido(compra: Compra) {
  return {
    id: compra.id,
    fornecedor: compra.fornecedor,
    categoria: compra.categoria,
    status: compra.status,
    status_entrega: compra.status_entrega,
    previsao_entrega: compra.previsao_entrega,
    updated_at: compra.updated_at,
    cliente_nome: compra.cliente_nome ?? 'Cliente não identificado',
    proposta_nome: compra.proposta_nome ?? 'Proposta não identificada',
  }
}

function asDashboardAtualizacao(historico: HistoricoCompra, compra: Compra): DashboardAtualizacaoResumo {
  return {
    id: historico.id,
    compra_id: historico.compra_id,
    evento: historico.evento,
    data: historico.data,
    usuario: historico.usuario,
    fornecedor: compra.fornecedor,
    cliente_nome: compra.cliente_nome ?? 'Cliente nÃ£o identificado',
    proposta_nome: compra.proposta_nome ?? 'Proposta nÃ£o identificada',
    compra_status: compra.status,
  }
}

function getAuthorizationMonthsByCompraId(historicos: HistoricoCompra[]) {
  const monthsByCompraId = new Map<number, string>()

  ;[...historicos]
    .sort((left, right) => compareAsc(left.data, right.data))
    .forEach((historico) => {
      if (
        !monthsByCompraId.has(historico.compra_id) &&
        historico.evento.toLowerCase().includes('status alterado para pedido autorizado')
      ) {
        monthsByCompraId.set(historico.compra_id, formatMonthKey(historico.data))
      }
    })

  return monthsByCompraId
}

function getCompraDashboardMonth(compra: Compra, autorizacoesByCompraId: Map<number, string>) {
  if (compra.status === 'pedido_autorizado') {
    return autorizacoesByCompraId.get(compra.id) ?? formatMonthKey(compra.updated_at)
  }

  return formatMonthKey(compra.data_criacao)
}

function categoriaLabel(categoria: Compra['categoria']) {
  switch (categoria) {
    case 'perfis':
      return 'Perfis'
    case 'vidros':
      return 'Vidros'
    case 'acessorios':
      return 'Acessórios'
    case 'perdas':
      return 'Perdas/Reposição'
    default:
      return 'Outros'
  }
}

function serializeCategoriaCompra(categoria: Compra['categoria']) {
  return categoria
}

function formatDateBr(value: string) {
  return format(parseISO(normalizeDateForParse(value)), 'dd/MM/yyyy')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
