import { supabase } from '@/lib/supabase'

/**
 * Retorna o motorista_id a usar em inserts feitos pelo dashboard.
 *
 * Regra: se o usuário logado é motorista de EMPRESA (funcionário),
 * o registro vai gravado no gestor (dono) da empresa - a receita e
 * o histórico financeiro pertencem ao dono, não ao funcionário.
 * Se é motorista individual (sem empresa), grava com o próprio id.
 */
export async function getMotoristaIdSalvar(userId: string): Promise<string> {
  const { data: motEmp } = await supabase
    .from('motoristas_empresa')
    .select('empresa_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!motEmp) return userId

  const { data: gestor } = await supabase
    .from('gestores')
    .select('user_id')
    .eq('empresa_id', motEmp.empresa_id)
    .limit(1)
    .maybeSingle()

  return gestor?.user_id || userId
}
