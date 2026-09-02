import React, { useEffect, useMemo, useState } from 'react'
import { useCRM } from '@/contexts/CRMContext'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BookOpen, Plus, Pencil, Trash2 } from 'lucide-react'
import { addBaseConhecimentoV2, deleteBaseConhecimentoV2, getBaseConhecimentoV2ByUser, updateBaseConhecimentoV2 } from '@/lib/supabase-utils'

type ConhecimentoItem = {
  conhecimento_id: number
  user_id: string
  pergunta: string
  resposta: string
  criado_em: string
  ativo_inativo: boolean | null
}

const BaseDeConhecimento = () => {
  const { user } = useCRM()
  const { toast } = useToast()

  const [items, setItems] = useState<ConhecimentoItem[]>([])
  const [loading, setLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<ConhecimentoItem | null>(null)

  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState('')

  const count = useMemo(() => items.length, [items.length])

  const isAdmin = useMemo(() => {
    if (!user) return false
    if (!user.isMembro) return true
    return user.membro_tipo === 'Administrador'
  }, [user])

  const userIdForKnowledgeBase = useMemo(() => {
    if (!user) return ''
    return user.isMembro ? (user.user_id_empresa || '') : user.id
  }, [user])

  const load = async () => {
    if (!user) return
    if (!userIdForKnowledgeBase) return
    setLoading(true)
    const { data, error } = await getBaseConhecimentoV2ByUser(userIdForKnowledgeBase)
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao carregar', description: 'Não foi possível buscar sua base de conhecimento.' })
      return
    }
    setItems((data ?? []) as ConhecimentoItem[])
  }

  useEffect(() => {
    load()
  }, [user?.id, user?.user_id_empresa, userIdForKnowledgeBase])

  const resetForm = () => {
    setPergunta('')
    setResposta('')
  }

  const openCreate = () => {
    if (!isAdmin) return
    resetForm()
    setCreateOpen(true)
  }

  const openEdit = (item: ConhecimentoItem) => {
    if (!isAdmin) return
    setSelected(item)
    setPergunta(item.pergunta || '')
    setResposta(item.resposta || '')
    setEditOpen(true)
  }

  const openDelete = (item: ConhecimentoItem) => {
    if (!isAdmin) return
    setSelected(item)
    setDeleteOpen(true)
  }

  const handleCreate = async () => {
    if (!user || !isAdmin) return
    const p = pergunta.trim()
    const r = resposta.trim()
    if (!p || !r) {
      toast({ title: 'Preencha os campos', description: 'Pergunta e resposta são obrigatórias.' })
      return
    }

    setSaving(true)
    const { data, error } = await addBaseConhecimentoV2({ user_id: userIdForKnowledgeBase, pergunta: p, resposta: r, ativo_inativo: true })
    setSaving(false)

    if (error || !data) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível adicionar a pergunta.' })
      return
    }

    setItems((prev) => [data as ConhecimentoItem, ...prev])
    setCreateOpen(false)
    resetForm()
    toast({ title: 'Adicionado', description: 'Pergunta e resposta salvas.' })
  }

  const handleEdit = async () => {
    if (!user || !selected || !isAdmin) return
    const p = pergunta.trim()
    const r = resposta.trim()
    if (!p || !r) {
      toast({ title: 'Preencha os campos', description: 'Pergunta e resposta são obrigatórias.' })
      return
    }

    setSaving(true)
    const { data, error } = await updateBaseConhecimentoV2({
      userId: userIdForKnowledgeBase,
      conhecimentoId: selected.conhecimento_id,
      updates: { pergunta: p, resposta: r },
    })
    setSaving(false)

    if (error || !data) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível atualizar a pergunta.' })
      return
    }

    setItems((prev) => prev.map((it) => (it.conhecimento_id === selected.conhecimento_id ? (data as ConhecimentoItem) : it)))
    setEditOpen(false)
    setSelected(null)
    resetForm()
    toast({ title: 'Atualizado', description: 'Alterações salvas.' })
  }

  const handleToggleStatus = async (item: ConhecimentoItem, checked: boolean) => {
    if (!user || !isAdmin) return
    const { data, error } = await updateBaseConhecimentoV2({
      userId: userIdForKnowledgeBase,
      conhecimentoId: item.conhecimento_id,
      updates: { ativo_inativo: checked },
    })

    if (error || !data) {
      toast({ title: 'Erro ao atualizar', description: 'Não foi possível alterar o status da pergunta.' })
      return
    }

    setItems((prev) => prev.map((it) => (it.conhecimento_id === item.conhecimento_id ? (data as ConhecimentoItem) : it)))
    toast({ title: 'Status atualizado', description: `Pergunta ${checked ? 'ativada' : 'desativada'} com sucesso.` })
  }

  const handleDelete = async () => {
    if (!user || !selected || !isAdmin) return
    setSaving(true)
    const { error } = await deleteBaseConhecimentoV2({ userId: userIdForKnowledgeBase, conhecimentoId: selected.conhecimento_id })
    setSaving(false)
    if (error) {
      toast({ title: 'Erro ao remover', description: 'Não foi possível remover a pergunta.' })
      return
    }
    setItems((prev) => prev.filter((it) => it.conhecimento_id !== selected.conhecimento_id))
    setDeleteOpen(false)
    setSelected(null)
    toast({ title: 'Removido', description: 'Pergunta excluída.' })
  }

  return (
    <div className="p-6 space-y-6">
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Base de Conhecimento</CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">
                  Cadastre perguntas e respostas para a IA usar durante o atendimento.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-normal bg-background/60">
                {count}
              </Badge>
              {isAdmin && (
                <Button onClick={openCreate} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-6 text-sm text-muted-foreground">
              Nenhuma pergunta cadastrada ainda.
            </div>
          ) : (
            <div className="grid gap-3">
              {items.map((item) => (
                <div
                  key={item.conhecimento_id}
                  className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">Pergunta</div>
                      <div className="mt-1 text-sm font-medium text-foreground whitespace-pre-wrap break-words">
                        {item.pergunta}
                      </div>

                      <div className="mt-4 text-xs text-muted-foreground">Resposta</div>
                      <div className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
                        {item.resposta}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-muted-foreground">{item.ativo_inativo ? 'Ativo' : 'Inativo'}</span>
                        <Switch 
                          checked={item.ativo_inativo ?? false}
                          onCheckedChange={(checked) => handleToggleStatus(item, checked)}
                          disabled={!isAdmin}
                        />
                      </div>
                      {isAdmin && (
                        <>
                          <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => openEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => openDelete(item)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Adicionar pergunta</DialogTitle>
            <DialogDescription>Essa pergunta e resposta ficarão disponíveis para a IA.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Pergunta</Label>
              <Textarea value={pergunta} onChange={(e) => setPergunta(e.target.value)} rows={4} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Resposta</Label>
              <Textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={6} className="rounded-2xl" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button className="rounded-xl" onClick={handleCreate} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Editar pergunta</DialogTitle>
            <DialogDescription>Atualize a pergunta e a resposta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Pergunta</Label>
              <Textarea value={pergunta} onChange={(e) => setPergunta(e.target.value)} rows={4} className="rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label>Resposta</Label>
              <Textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={6} className="rounded-2xl" />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setEditOpen(false)
                  setSelected(null)
                  resetForm()
                }}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button className="rounded-xl" onClick={handleEdit} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pergunta?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação remove a pergunta e resposta da sua base de conhecimento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={saving}>
              {saving ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default BaseDeConhecimento
