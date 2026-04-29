// Tipos do Sistema de Compras

export type StatusPedido = 'cotacao' | 'em_analise' | 'retificacao' | 'pedido_autorizado'
export type StatusEntrega = 'pendente' | 'entregue'
export type CategoriaCompra = 'perfis' | 'vidros' | 'acessorios' | 'perdas'
export type TipoAnexo = 'cotacao' | 'nf' | 'boleto' | 'outro'
export type SituacaoEntrega = 'pendente' | 'entregue' | 'atrasado' | 'proximo' | 'no_prazo'
export type PerfilUsuario = 'admin' | 'comprador'

export interface Cliente {
  id: number
  nome: string
  documento: string | null
  contato: string | null
  email: string | null
  arquivado: boolean
  created_at: string
  updated_at: string
}

export interface Proposta {
  id: number
  cliente_id: number
  nome: string
  data_inicio: string | null
  data_fim: string | null
  valor_previsto: number
  valor_previsto_perfis: number
  valor_previsto_vidros: number
  valor_previsto_acessorios: number
  valor_previsto_outros: number
  custo_perdas: number
  arquivado: boolean
  created_at: string
  updated_at: string
  cliente_nome?: string
}

export interface Compra {
  id: number
  cliente_id: number
  proposta_id: number
  categoria: CategoriaCompra
  fornecedor: string
  descricao: string
  valor_total: number | null
  numero_pedido: string | null
  status: StatusPedido
  status_entrega: StatusEntrega
  previsao_entrega: string | null
  data_envio_fornecedor: string | null
  data_entrega_real: string | null
  data_criacao: string
  updated_at: string
  arquivado: boolean
  cliente_nome?: string
  proposta_nome?: string
}

export interface HistoricoCompra {
  id: number
  compra_id: number
  evento: string
  data: string
  usuario: string
}

export interface Anexo {
  id: number
  compra_id: number
  tipo: TipoAnexo
  arquivo_url: string
  nome_arquivo: string
  created_at: string
}

export interface Usuario {
  id: number
  nome: string
  email: string
  senha_hash: string
  perfil: PerfilUsuario
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface CompraFormData {
  cliente_id: number
  proposta_id: number
  categoria: CategoriaCompra
  fornecedor: string
  descricao: string
  valor_total?: number | null
  numero_pedido?: string | null
  previsao_entrega?: string | null
  data_envio_fornecedor?: string | null
  status?: StatusPedido
  status_entrega?: StatusEntrega
}

export interface PropostaFormData {
  cliente_id: number
  nome: string
  data_inicio?: string | null
  data_fim?: string | null
  valor_previsto?: number | null
  valor_previsto_perfis?: number | null
  valor_previsto_vidros?: number | null
  valor_previsto_acessorios?: number | null
  valor_previsto_outros?: number | null
  custo_perdas?: number | null
}

export interface AutorizacaoFormData {
  numero_pedido: string
  valor_total: number
  previsao_entrega: string
}

export interface DashboardStats {
  total_pedidos: number
  em_cotacao: number
  em_analise: number
  autorizados: number
  entregues: number
  valor_total_mes: number
  pedidos_atrasados: number
  pedidos_proximos: number
}

export interface ComparativoMensal {
  mes: string
  previsto: number
  realizado: number
}

export interface DashboardResumoPedido {
  id: number
  fornecedor: string
  categoria: CategoriaCompra
  status: StatusPedido
  status_entrega: StatusEntrega
  previsao_entrega: string | null
  updated_at: string
  cliente_nome: string
  proposta_nome: string
}

export interface DashboardData {
  stats: DashboardStats
  comparativo: ComparativoMensal[]
  ultimosPedidos: DashboardResumoPedido[]
  pedidosParados: DashboardResumoPedido[]
}

export interface PurchaseFilters {
  id?: number
  clienteId?: number
  propostaId?: number
  status?: StatusPedido
  includeArchived?: boolean
  onlyArchived?: boolean
}

export interface DeliveryMetrics {
  total: number
  entregues: number
  entregues_no_prazo: number
  atrasados: number
  tempo_medio_entrega: number
}

export interface FinanceiroReportItem {
  id: number
  proposta_nome: string
  cliente_nome: string
  valor_previsto: number
  valor_realizado: number
  custo_perdas: number
  diferenca: number
}

export interface HistoricoReportItem extends HistoricoCompra {
  cliente_id: number
  proposta_id: number
  compra_status: StatusPedido
  cliente_nome: string
  proposta_nome: string
  fornecedor: string
}
