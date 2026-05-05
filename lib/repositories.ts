import { format, isAfter, isBefore, parseISO, subMonths } from 'date-fns'
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise'
import { hashPassword } from '@/lib/auth/password'
import { getDatabaseType, getMySQLPool, getSupabaseClient, queryMySQL, type DatabaseType } from '@/lib/db'
import {
  calculateFinanceDifference,
  getCompraCategoriaTotal,
  getDeliverySituation,
  getCompraCategoriaPrincipal,
  normalizeCategoriaCompra,
  normalizeEtapaAutorizacao,
  normalizeStatusEntrega,
  normalizeStatusPedido,
  resolveCompraCategoriaValues,
  resolvePropostaValues,
  STATUS_LABELS,
} from '@/lib/domain'
import type {
  Anexo,
  Cliente,
  Compra,
  CompraFormData,
  DashboardData,
  DeliveryMetrics,
  EtapaAutorizacao,
  FinanceiroReportItem,
  HistoricoCompra,
  HistoricoReportItem,
  PerfilUsuario,
  Proposta,
  PropostaFormData,
  PurchaseFilters,
  SituacaoEntrega,
  StatusEntrega,
  StatusPedido,
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

const REQUIRED_TABLES = ['clientes', 'usuarios', 'propostas', 'compras', 'historico_compras', 'anexos'] as const
const REQUIRED_SCHEMA_COLUMNS: Record<(typeof REQUIRED_TABLES)[number], string[]> = {
  clientes: ['id', 'nome', 'documento', 'contato', 'email', 'arquivado', 'created_at', 'updated_at'],
  usuarios: ['id', 'nome', 'email', 'senha_hash', 'perfil', 'ativo', 'created_at', 'updated_at'],
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
    'previsao_entrega',
    'data_envio_fornecedor',
    'data_entrega_real',
    'data_criacao',
    'updated_at',
    'arquivado',
  ],
  historico_compras: ['id', 'compra_id', 'evento', 'data', 'usuario'],
  anexos: ['id', 'compra_id', 'tipo', 'arquivo_url', 'nome_arquivo', 'created_at'],
}

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
    missingTables: [...REQUIRED_TABLES],
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
    ativo: true,
  })
}

async function createUsuarioInternal(input: {
  nome: string
  email: string
  senha_hash: string
  perfil: PerfilUsuario
  ativo: boolean
}) {
  if (getDatabaseType() === 'mysql') {
    const result = await mysqlExecute(
      'INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?)',
      [input.nome, input.email, input.senha_hash, input.perfil, input.ativo ? 1 : 0],
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

  return createUsuarioInternal({
    nome: input.nome.trim(),
    email,
    senha_hash: hashPassword(String(input.senha)),
    perfil: input.perfil,
    ativo: input.ativo,
  })
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
        'UPDATE usuarios SET nome = ?, email = ?, senha_hash = ?, perfil = ?, ativo = ? WHERE id = ?',
        [input.nome.trim(), email, hashPassword(String(input.senha)), input.perfil, input.ativo ? 1 : 0, id],
      )
    } else {
      await mysqlExecute('UPDATE usuarios SET nome = ?, email = ?, perfil = ?, ativo = ? WHERE id = ?', [
        input.nome.trim(),
        email,
        input.perfil,
        input.ativo ? 1 : 0,
        id,
      ])
    }
    return
  }

  const client = getSupabaseOrThrow()
  const updatePayload: Record<string, unknown> = {
    nome: input.nome.trim(),
    email,
    perfil: input.perfil,
    ativo: input.ativo,
  }

  if (nullableString(input.senha)) {
    updatePayload.senha_hash = hashPassword(String(input.senha))
  }

  const { error } = await client.from('usuarios').update(updatePayload).eq('id', id)
  throwIfSupabaseError(error)
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

export async function listCompras(filters: PurchaseFilters = {}): Promise<Compra[]> {
  const [compras, clientes, propostas] = await Promise.all([
    listComprasRaw(filters),
    listClientes({ includeArchived: true }),
    listPropostasRaw({ includeArchived: true }),
  ])

  const clientesById = new Map(clientes.map((cliente) => [cliente.id, cliente.nome]))
  const propostasById = new Map(propostas.map((proposta) => [proposta.id, proposta.nome]))

  return compras.map((compra) => ({
    ...compra,
    cliente_nome: clientesById.get(compra.cliente_id) ?? 'Cliente não identificado',
    proposta_nome: propostasById.get(compra.proposta_id) ?? 'Proposta não identificada',
  }))
}

export async function getCompraById(id: number): Promise<Compra | null> {
  const compras = await listCompras({ id, includeArchived: true })
  return compras[0] ?? null
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

  return {
    ...compra,
    historico,
    anexos,
  }
}

export async function createCompra(input: CompraFormData) {
  const distribuicaoCategoria = resolveCompraCategoriaValues(input)
  const totalRateado = getCompraCategoriaTotal(distribuicaoCategoria)
  const valorTotal = nullableNumber(input.valor_total) ?? (totalRateado > 0 ? totalRateado : null)
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
        previsao_entrega,
        data_envio_fornecedor,
        data_entrega_real,
        arquivado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cotacao', 'pendente', 'nenhuma', ?, ?, ?, 0)`,
      [
        input.cliente_id,
        input.proposta_id,
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
        valor_total: valorTotal,
        ...distribuicaoCategoria,
        numero_pedido: nullableString(input.numero_pedido),
        status: 'cotacao',
        status_entrega: 'pendente',
        etapa_autorizacao: 'nenhuma',
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

  if (proximoStatus === 'em_analise') {
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

  if (compra.etapa_autorizacao === 'solicitada') {
    throw new Error('Este pedido ja possui uma solicitacao de autorizacao em andamento.')
  }

  if (compra.etapa_autorizacao === 'liberada') {
    throw new Error('Este pedido ja foi liberado pelo administrador para conclusao da autorizacao.')
  }

  await updateCompraAuthorizationStage(id, 'solicitada')
  await addHistoricoEvento(id, 'Solicitacao de autorizacao enviada ao administrador', usuario)
  return { requested: true }
}

export async function approveCompraAuthorizationRequest(id: number, usuario: string) {
  const compra = await getCompraById(id)

  if (!compra) {
    throw new Error('Compra nao encontrada.')
  }

  if (compra.status === 'pedido_autorizado') {
    throw new Error('Este pedido ja foi autorizado.')
  }

  if (compra.etapa_autorizacao !== 'solicitada') {
    throw new Error('Este pedido nao possui solicitacao pendente para aprovacao.')
  }

  await updateCompraAuthorizationStage(id, 'liberada')
  await addHistoricoEvento(id, 'Solicitacao de autorizacao aprovada pelo administrador', usuario)
  return { approved: true }
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
    return rows.map(normalizeAnexo)
  }

  const client = getSupabaseOrThrow()
  const { data, error } = await client
    .from('anexos')
    .select('*')
    .eq('compra_id', compraId)
    .order('created_at', { ascending: false })
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeAnexo(row))
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

export async function getDashboardData(): Promise<DashboardData> {
  const [compras, propostas, historicos] = await Promise.all([listCompras(), listPropostas(), listHistoricosRaw()])
  const hoje = new Date()
  const mesAtual = format(hoje, 'yyyy-MM')
  const meses = Array.from({ length: 6 }, (_, index) => format(subMonths(hoje, 5 - index), 'yyyy-MM'))
  const autorizacoesByCompraId = getAuthorizationMonthsByCompraId(historicos)

  const comparativo = meses.map((mes) => {
    const previsto = propostas
      .filter((proposta) => formatMonthKey(proposta.created_at) === mes)
      .reduce((sum, proposta) => sum + Number(proposta.valor_previsto), 0)

    const realizado = compras
      .filter((compra) => getCompraDashboardMonth(compra, autorizacoesByCompraId) === mes)
      .reduce((sum, compra) => sum + Number(compra.valor_total ?? 0), 0)

    return { mes, previsto, realizado }
  })

  const ultimosPedidos = [...compras]
    .sort((a, b) => compareDesc(a.updated_at, b.updated_at))
    .slice(0, 5)
    .map(asDashboardPedido)

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
    ultimosPedidos,
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

    if (filters.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters.etapaAutorizacao) {
      sql += ' AND etapa_autorizacao = ?'
      params.push(filters.etapaAutorizacao)
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

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.etapaAutorizacao) {
    query = query.eq('etapa_autorizacao', filters.etapaAutorizacao)
  }

  const { data, error } = await query
  throwIfSupabaseError(error)
  return (data ?? []).map((row: Row) => normalizeCompra(row))
}

async function updateCompraAuthorizationStage(id: number, etapaAutorizacao: EtapaAutorizacao) {
  if (getDatabaseType() === 'mysql') {
    await mysqlExecute('UPDATE compras SET etapa_autorizacao = ? WHERE id = ?', [etapaAutorizacao, id])
    return
  }

  const client = getSupabaseOrThrow()
  const { error } = await client.from('compras').update({ etapa_autorizacao: etapaAutorizacao }).eq('id', id)
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

async function checkMySQLSetup(): Promise<SetupStatus> {
  const rows = await mysqlSelect(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => '?').join(', ')})`,
    [...REQUIRED_TABLES],
  )

  const existingTables = rows.map((row) => String(row.TABLE_NAME))
  const missingTables = REQUIRED_TABLES.filter((table) => !existingTables.includes(table))
  const missingColumns = missingTables.length === 0 ? await getMissingCurrentSchemaItemsMySQL() : []
  const missingItems = [...missingTables, ...missingColumns]

  return {
    configured: missingItems.length === 0,
    dbType: 'mysql',
    existingTables,
    missingTables: missingItems,
    setupScript:
      missingTables.length > 0
        ? 'scripts/setup-database.sql'
        : 'scripts/migrations/mysql/2026-04-29-upgrade-current-schema.sql',
  }
}

async function checkSupabaseSetup(): Promise<SetupStatus> {
  const client = getSupabaseOrThrow()
  const existingTables: string[] = []
  const missingTables: string[] = []

  for (const table of REQUIRED_TABLES) {
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
  const missingItems = [...missingTables, ...missingColumns]

  return {
    configured: missingItems.length === 0,
    dbType: 'supabase',
    existingTables,
    missingTables: missingItems,
    setupScript:
      missingTables.length > 0
        ? 'scripts/setup-database-supabase.sql'
        : 'scripts/migrations/supabase/2026-04-29-upgrade-current-schema.sql',
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

    for (const [table, columns] of Object.entries(REQUIRED_SCHEMA_COLUMNS) as Array<
      [keyof typeof REQUIRED_SCHEMA_COLUMNS, string[]]
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

async function getMissingCurrentSchemaItemsSupabase() {
  const client = getSupabaseOrThrow()
  const missingItems: string[] = []

  for (const [table, columns] of Object.entries(REQUIRED_SCHEMA_COLUMNS) as Array<
    [keyof typeof REQUIRED_SCHEMA_COLUMNS, string[]]
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
        perfil ENUM('admin', 'comprador', 'orcamentista') DEFAULT 'comprador',
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
        previsao_entrega DATE NULL,
        data_envio_fornecedor DATE NULL,
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

    await addColumnIfMissing(connection, 'clientes', 'documento', 'VARCHAR(20) NULL')
    await addColumnIfMissing(connection, 'clientes', 'contato', 'VARCHAR(100) NULL')
    await addColumnIfMissing(connection, 'clientes', 'arquivado', 'BOOLEAN DEFAULT FALSE')
    await addColumnIfMissing(connection, 'usuarios', 'senha_hash', 'VARCHAR(255) NOT NULL')
    await addColumnIfMissing(connection, 'usuarios', 'perfil', "ENUM('admin', 'comprador', 'orcamentista') DEFAULT 'comprador'")
    await addColumnIfMissing(connection, 'usuarios', 'ativo', 'BOOLEAN DEFAULT TRUE')
    await addColumnIfMissing(connection, 'propostas', 'data_fim', 'DATE NULL')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_perfis', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_vidros', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_acessorios', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'valor_previsto_outros', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'custo_perdas', 'DECIMAL(15, 2) DEFAULT 0')
    await addColumnIfMissing(connection, 'propostas', 'arquivado', 'BOOLEAN DEFAULT FALSE')
    await addColumnIfMissing(connection, 'compras', 'cliente_id', 'INT NULL')
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
    await addColumnIfMissing(connection, 'compras', 'previsao_entrega', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'data_envio_fornecedor', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'data_entrega_real', 'DATE NULL')
    await addColumnIfMissing(connection, 'compras', 'data_criacao', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    await addColumnIfMissing(connection, 'compras', 'arquivado', 'BOOLEAN DEFAULT FALSE')
    await addColumnIfMissing(connection, 'anexos', 'nome_arquivo', 'VARCHAR(255) NULL')
    await addColumnIfMissing(connection, 'anexos', 'created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')

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
      ALTER TABLE compras
      MODIFY COLUMN status ENUM('cotacao', 'em_analise', 'retificacao', 'pedido_autorizado') DEFAULT 'cotacao',
      MODIFY COLUMN status_entrega ENUM('pendente', 'entregue') DEFAULT 'pendente',
      MODIFY COLUMN etapa_autorizacao ENUM('nenhuma', 'solicitada', 'liberada') DEFAULT 'nenhuma',
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
    throw new Error(error.message)
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
    ativo: normalizeBoolean(row.ativo),
    created_at: toDateTimeString(row.created_at),
    updated_at: toDateTimeString(row.updated_at),
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

function normalizeCompra(row: Row): Compra {
  return {
    id: toNumber(row.id),
    cliente_id: toNumber(row.cliente_id),
    proposta_id: toNumber(row.proposta_id),
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
    status: normalizeStatusPedido(row.status),
    status_entrega: normalizeStatusEntrega(row.status_entrega),
    etapa_autorizacao: normalizeEtapaAutorizacao(row.etapa_autorizacao),
    previsao_entrega: toDateOnlyString(row.previsao_entrega),
    data_envio_fornecedor: toDateOnlyString(row.data_envio_fornecedor),
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
