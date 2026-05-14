import { rm } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { requireAnyFeature } from "@/lib/auth/api"
import { hasFeatureAccess } from "@/lib/auth/permissions"
import { isCompraLockedAfterAdminApproval } from "@/lib/domain"
import { getCompraDetail, permanentlyDeleteCompra, setCompraArchivedState, updateCompra } from "@/lib/repositories"

export const runtime = "nodejs"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAnyFeature(request, ["solicitacoes", "compras"])
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const compra = await getCompraDetail(Number(id))

    if (!compra) {
      return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 })
    }

    const canAdminManage = guard.session.perfil === "admin"
    const canViewAsCompras = canAdminManage || hasFeatureAccess(guard.session.perfil, "compras", guard.session.features)

    const canViewAsRequester =
      compra.solicitante_id === guard.session.userId ||
      (!compra.solicitante_id && compra.solicitado_por?.trim() === guard.session.nome.trim())

    if (!canViewAsCompras && !canViewAsRequester) {
      return NextResponse.json({ error: "Voce nao tem acesso a esta solicitacao." }, { status: 403 })
    }

    return NextResponse.json(compra)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar solicitacao." },
      { status: 500 },
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAnyFeature(request, ["solicitacoes", "compras"])
    if ("response" in guard) {
      return guard.response
    }

    const body = await request.json()
    const { id } = await params
    const compra = await getCompraDetail(Number(id))

    if (!compra) {
      return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 })
    }

    const canAdminManage = guard.session.perfil === "admin"
    const canViewAsCompras = canAdminManage || hasFeatureAccess(guard.session.perfil, "compras", guard.session.features)
    const canViewAsRequester =
      compra.solicitante_id === guard.session.userId ||
      (!compra.solicitante_id && compra.solicitado_por?.trim() === guard.session.nome.trim())

    if (!canViewAsCompras && !canViewAsRequester) {
      return NextResponse.json({ error: "Voce nao tem acesso a esta solicitacao." }, { status: 403 })
    }

    const canRequesterEdit =
      (canAdminManage && hasFeatureAccess(guard.session.perfil, "editar_solicitacao", guard.session.features)) ||
      (canViewAsRequester &&
        hasFeatureAccess(guard.session.perfil, "editar_solicitacao", guard.session.features) &&
        (!isCompraLockedAfterAdminApproval(compra) ||
          hasFeatureAccess(guard.session.perfil, "editar_solicitacao_pos_aprovacao_admin", guard.session.features)))
    const canRequesterManageArchive =
      (canAdminManage && hasFeatureAccess(guard.session.perfil, "arquivar_solicitacao", guard.session.features)) ||
      (canViewAsRequester &&
        hasFeatureAccess(guard.session.perfil, "arquivar_solicitacao", guard.session.features) &&
        (!isCompraLockedAfterAdminApproval(compra) ||
          hasFeatureAccess(guard.session.perfil, "arquivar_solicitacao_pos_aprovacao_admin", guard.session.features)))

    if (!canRequesterEdit) {
      return NextResponse.json(
        { error: "Esta solicitacao nao pode mais ser editada pelo solicitante nesta etapa." },
        { status: 403 },
      )
    }

    if (typeof body.arquivado === "boolean") {
      if (!canRequesterManageArchive) {
        return NextResponse.json(
          { error: "Depois da aprovacao do ADM, o arquivamento da solicitacao exige aprovacao administrativa." },
          { status: 403 },
        )
      }

      const result = await setCompraArchivedState(Number(id), body.arquivado)
      return NextResponse.json({
        message: result.archived ? "Solicitacao arquivada com sucesso." : "Solicitacao desarquivada com sucesso.",
        archived: result.archived,
      })
    }

    if (!String(body.fornecedor ?? "").trim()) {
      return NextResponse.json({ error: "Informe o fornecedor sugerido." }, { status: 400 })
    }

    await updateCompra(Number(id), {
      fornecedor: String(body.fornecedor).trim(),
      descricao: String(body.descricao ?? "").trim(),
      usuario: guard.session.nome,
    })

    return NextResponse.json({ message: "Solicitacao atualizada com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao atualizar solicitacao." },
      { status: 400 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireAnyFeature(request, ["solicitacoes", "compras", "editar_compra"])
    if ("response" in guard) {
      return guard.response
    }

    const { id } = await params
    const compra = await getCompraDetail(Number(id))

    if (!compra) {
      return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 })
    }

    const canAdminManage = guard.session.perfil === "admin"
    const canViewAsCompras = canAdminManage || hasFeatureAccess(guard.session.perfil, "compras", guard.session.features)
    const canViewAsRequester =
      compra.solicitante_id === guard.session.userId ||
      (!compra.solicitante_id && compra.solicitado_por?.trim() === guard.session.nome.trim())

    if (!canViewAsCompras && !canViewAsRequester) {
      return NextResponse.json({ error: "Voce nao tem acesso a esta solicitacao." }, { status: 403 })
    }

    const canRequesterDelete =
      (canAdminManage && hasFeatureAccess(guard.session.perfil, "excluir_solicitacao", guard.session.features)) ||
      (canViewAsRequester &&
        hasFeatureAccess(guard.session.perfil, "excluir_solicitacao", guard.session.features) &&
        (!isCompraLockedAfterAdminApproval(compra) ||
          hasFeatureAccess(guard.session.perfil, "excluir_solicitacao_pos_aprovacao_admin", guard.session.features)))

    if (!canRequesterDelete) {
      return NextResponse.json(
        { error: "Depois da aprovacao do ADM, a exclusao da solicitacao exige aprovacao administrativa." },
        { status: 403 },
      )
    }

    await permanentlyDeleteCompra(Number(id))

    const uploadDirectory = path.join(process.cwd(), "public", "uploads", "compras", id)
    await rm(uploadDirectory, { recursive: true, force: true })

    return NextResponse.json({ message: "Solicitacao excluida com sucesso." })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao excluir solicitacao." },
      { status: 400 },
    )
  }
}
