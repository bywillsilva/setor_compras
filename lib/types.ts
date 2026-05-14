// Tipos do Sistema de Compras

export type StatusPedido = 'cotacao' | 'em_analise' | 'retificacao' | 'pedido_autorizado'
export type StatusEntrega = 'pendente' | 'entregue'
export type CategoriaCompra = 'perfis' | 'vidros' | 'acessorios' | 'perdas' | 'outros'
export type TipoAnexo = 'cotacao' | 'nf' | 'boleto' | 'outro'
export type SituacaoEntrega = 'pendente' | 'entregue' | 'atrasado' | 'proximo' | 'no_prazo'
export type PerfilUsuario = 'admin' | 'comprador' | 'orcamentista' | 'solicitante' | 'financeiro'
export type TemaPreferido = 'claro' | 'escuro'
export type SolicitacaoSensivelEntidade = 'cliente' | 'proposta' | 'compra'
export type SolicitacaoSensivelAcao = 'editar' | 'excluir'
export type SolicitacaoSensivelStatus = 'pendente' | 'aprovada' | 'recusada'
export type AppFeature =
  | 'dashboard'
  | 'solicitacoes'
  | 'clientes'
  | 'propostas'
  | 'compras'
  | 'autorizacoes'
  | 'solicitacoes_autorizacao'
  | 'financeiro'
  | 'entregas'
  | 'orcamentos'
  | 'resumo_contratos'
  | 'configuracoes'
  | 'usuarios'
  | 'editar_compra'
  | 'arquivar_compra'
  | 'excluir_compra'
  | 'excluir_anexo_compra'
  | 'editar_compra_pos_aprovacao_admin'
  | 'arquivar_compra_pos_aprovacao_admin'
  | 'excluir_compra_pos_aprovacao_admin'
  | 'excluir_anexo_compra_pos_aprovacao_admin'
  | 'aprovar_compra_admin'
  | 'recusar_compra_admin'
  | 'aprovar_compra_financeiro'
  | 'recusar_compra_financeiro'
  | 'confirmar_fornecedor'
  | 'confirmar_documentos_financeiro'
  | 'editar_solicitacao'
  | 'arquivar_solicitacao'
  | 'excluir_solicitacao'
  | 'aprovar_solicitacao'
  | 'retificar_solicitacao'
  | 'editar_solicitacao_pos_aprovacao_admin'
  | 'arquivar_solicitacao_pos_aprovacao_admin'
  | 'excluir_solicitacao_pos_aprovacao_admin'
  | 'editar_proposta'
  | 'revisar_entrega'
  | 'solicitar_autorizacao'
export type EtapaAutorizacao = 'nenhuma' | 'solicitada' | 'liberada'
export type EtapaFluxoCompra =
  | 'solicitacao_registrada'
  | 'cotacao_em_andamento'
  | 'analise_solicitante'
  | 'retificacao'
  | 'aprovada_solicitante'
  | 'aguardando_admin'
  | 'aprovada_admin'
  | 'aguardando_financeiro'
  | 'liberada_para_fornecedor'
  | 'pedido_autorizado'

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
  solicitante_id: number | null
  solicitado_por: string | null
  categoria: CategoriaCompra
  fornecedor: string
  descricao: string
  valor_total: number | null
  valor_categoria_perfis: number
  valor_categoria_vidros: number
  valor_categoria_acessorios: number
  valor_categoria_perdas: number
  valor_categoria_outros: number
  numero_pedido: string | null
  status: StatusPedido
  status_entrega: StatusEntrega
  etapa_autorizacao: EtapaAutorizacao
  etapa_fluxo: EtapaFluxoCompra
  previsao_entrega: string | null
  data_envio_fornecedor: string | null
  cotacao_enviada_por: string | null
  cotacao_recebida_em: string | null
  cotacao_recebida_por: string | null
  aprovado_solicitante_em: string | null
  aprovado_solicitante_por: string | null
  aprovado_admin_em: string | null
  aprovado_admin_por: string | null
  aprovado_financeiro_em: string | null
  aprovado_financeiro_por: string | null
  documentos_financeiro_confirmados_em: string | null
  documentos_financeiro_confirmados_por: string | null
  confirmado_fornecedor_em: string | null
  confirmado_fornecedor_por: string | null
  data_entrega_real: string | null
  data_criacao: string
  updated_at: string
  arquivado: boolean
  possui_cotacao?: boolean
  possui_nf?: boolean
  possui_boleto?: boolean
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
  disponivel?: boolean
}

export interface Usuario {
  id: number
  nome: string
  email: string
  senha_hash: string
  perfil: PerfilUsuario
  tema_preferido: TemaPreferido
  features?: AppFeature[]
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface PerfilPermissao {
  perfil: PerfilUsuario
  feature: AppFeature
  permitido: boolean
}

export interface UsuarioFormData {
  nome: string
  email: string
  senha?: string | null
  perfil: PerfilUsuario
  tema_preferido?: TemaPreferido | null
  ativo: boolean
  features?: AppFeature[] | null
}

export interface CompraFormData {
  cliente_id: number
  proposta_id: number
  solicitante_id?: number | null
  solicitado_por?: string | null
  categoria?: CategoriaCompra
  fornecedor: string
  descricao: string
  valor_total?: number | null
  valor_categoria_perfis?: number | null
  valor_categoria_vidros?: number | null
  valor_categoria_acessorios?: number | null
  valor_categoria_perdas?: number | null
  valor_categoria_outros?: number | null
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

export interface DashboardAtualizacaoResumo {
  id: number
  compra_id: number
  evento: string
  data: string
  usuario: string
  fornecedor: string
  cliente_nome: string
  proposta_nome: string
  compra_status: StatusPedido
}

export interface DashboardData {
  stats: DashboardStats
  comparativo: ComparativoMensal[]
  ultimasAtualizacoes: DashboardAtualizacaoResumo[]
  pedidosParados: DashboardResumoPedido[]
}

export interface PurchaseFilters {
  id?: number
  clienteId?: number
  propostaId?: number
  solicitanteId?: number
  solicitanteNome?: string
  status?: StatusPedido
  etapaAutorizacao?: EtapaAutorizacao
  etapaFluxo?: EtapaFluxoCompra
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

export interface SolicitacaoSensivel {
  id: number
  entidade: SolicitacaoSensivelEntidade
  entidade_id: number
  acao: SolicitacaoSensivelAcao
  status: SolicitacaoSensivelStatus
  motivo: string | null
  payload: Record<string, unknown> | null
  solicitante_id: number
  solicitante_nome: string
  solicitante_perfil: PerfilUsuario
  aprovado_por: string | null
  aprovado_em: string | null
  recusado_por: string | null
  recusado_em: string | null
  observacao_admin: string | null
  created_at: string
  updated_at: string
}

export interface ResumoContrato {
  id: number
  titulo: string
  periodo_referencia: string
  created_by_user_id: number
  created_by_nome: string
  created_at: string
  updated_at: string
  quantidade_obras: number
  valor_total_contrato: number
  valor_total_real_gasto: number
  lucro_bruto_total: number
}

export interface ResumoContratoObra {
  proposta_id: number
  proposta_nome: string
  cliente_id: number
  cliente_nome: string
  valor_real_gasto: number
  valor_contrato: number
  lucro_bruto: number
  data_inicio: string | null
  data_fim: string | null
}

export interface ResumoContratoDetalhe extends ResumoContrato {
  itens: ResumoContratoObra[]
}

export interface ResumoContratoReferencia {
  proposta_id: number
  proposta_nome: string
  cliente_id: number
  cliente_nome: string
  valor_real_gasto: number
  valor_previsto: number
  data_inicio: string | null
  data_fim: string | null
}

export interface ResumoContratoFormData {
  titulo: string
  periodo_referencia: string
  itens: Array<{
    proposta_id: number
    valor_contrato: number
  }>
}
