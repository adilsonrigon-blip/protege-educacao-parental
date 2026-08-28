import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function getServiceRoleKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não está disponível na Edge Function.')
  }

  // Proteção adicional: a função administrativa nunca deve operar com chave anon/publishable.
  // Chaves JWT legadas carregam o papel no payload; chaves novas podem não ser JWT.
  if (key.split('.').length === 3) {
    try {
      const payload = JSON.parse(
        atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      )
      if (payload?.role && payload.role !== 'service_role') {
        throw new Error(
          `A chave configurada em SUPABASE_SERVICE_ROLE_KEY possui role "${payload.role}", não "service_role".`
        )
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('não "service_role"')) throw err
    }
  }

  return key
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) throw new Error('SUPABASE_URL não está disponível.')

    const admin = createClient(supabaseUrl, getServiceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Valida o usuário que chamou a função.
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Sessão não encontrada.' }, 401)

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Sessão inválida.' }, 401)

    // Somente administradores ativos podem gerenciar profissionais/acessos.
    const { data: callerProfile, error: callerError } = await admin
      .from('usuarios_perfis')
      .select('perfil, ativo')
      .eq('user_id', userData.user.id)
      .single()

    if (callerError || !callerProfile?.ativo || callerProfile.perfil !== 'admin') {
      return json({ error: 'Apenas administradores podem gerenciar acessos.' }, 403)
    }

    const payload = await req.json()
    const action = String(payload.action || 'create')

    // LISTAR PROFISSIONAIS
    if (action === 'list') {
      const [{ data: profissionais, error: pError }, { data: perfis, error: aError }] = await Promise.all([
        admin
          .from('profissionais')
          .select('id, auth_user_id, nome, email, telefone, especialidade, status, ong_id, created_at, ongs(id,nome,status)')
          .order('nome', { ascending: true }),
        admin
          .from('usuarios_perfis')
          .select('profissional_id, perfil, ativo'),
      ])

      if (pError) throw pError
      if (aError) throw aError

      const byProfessional = new Map((perfis || []).map((x) => [x.profissional_id, x]))
      const rows = (profissionais || []).map((p) => {
        const access = byProfessional.get(p.id)
        return {
          ...p,
          perfil: access?.perfil || 'profissional',
          acesso_ativo: access?.ativo ?? (p.status === 'ativo'),
        }
      })

      return json({ profissionais: rows })
    }

    // V13.8 - CRIAR PROFISSIONAL COM VALIDAÇÃO DE E-MAIL
    // Regra:
    // - mesmo e-mail em profissional ATIVO: bloqueia;
    // - mesmo e-mail em profissional INATIVO: reutiliza o cadastro e o usuário Auth,
    //   atualizando dados, senha, perfil e status. Assim não criamos duplicidade no Auth.
    if (action === 'create') {
      const nome = String(payload.nome || '').trim()
      const email = String(payload.email || '').trim().toLowerCase()
      const password = String(payload.password || '')
      const perfil = payload.perfil === 'admin' ? 'admin' : 'profissional'
      const telefone = String(payload.telefone || '').trim() || null
      const especialidade = String(payload.especialidade || '').trim() || null
      const status = payload.status === 'inativo' ? 'inativo' : 'ativo'
      const ongId = payload.ong_id ? String(payload.ong_id) : null

      if (!nome || !email) return json({ error: 'Nome e e-mail são obrigatórios.' }, 400)
      if (password.length < 8) return json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, 400)

      // Procura qualquer cadastro com o mesmo e-mail, sem diferenciar maiúsculas/minúsculas.
      const { data: existingRows, error: existingError } = await admin
        .from('profissionais')
        .select('id, auth_user_id, nome, email, status, created_at')
        .ilike('email', email)
        .order('created_at', { ascending: false })
        .limit(10)

      if (existingError) throw existingError

      const existingActive = (existingRows || []).find((p) => p.status === 'ativo')
      if (existingActive) {
        return json({
          error: 'Já existe um profissional ativo cadastrado com este e-mail.',
          code: 'EMAIL_ATIVO_JA_CADASTRADO',
          profissional_id: existingActive.id,
        }, 409)
      }

      const existingInactive = (existingRows || []).find((p) => p.status === 'inativo')

      if (existingInactive) {
        let authUserId = existingInactive.auth_user_id || null

        // Se o cadastro antigo perdeu o vínculo, tenta reaproveitar usuário Auth com o mesmo e-mail.
        if (!authUserId) {
          let page = 1
          let foundUser = null
          while (page <= 10 && !foundUser) {
            const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
              page,
              perPage: 100,
            })
            if (usersError) break
            foundUser = (usersData?.users || []).find(
              (u) => String(u.email || '').trim().toLowerCase() === email
            ) || null
            if (!usersData?.users?.length || usersData.users.length < 100) break
            page++
          }
          authUserId = foundUser?.id || null
        }

        // Se não houver usuário Auth reaproveitável, cria um novo.
        if (!authUserId) {
          const { data: created, error: createError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: nome },
          })
          if (createError || !created.user) {
            return json({
              error: `Falha ao criar usuário no Authentication: ${createError?.message || 'erro desconhecido'}`,
              etapa: 'authentication',
            }, 400)
          }
          authUserId = created.user.id
        } else {
          const { error: authUpdateError } = await admin.auth.admin.updateUserById(authUserId, {
            email,
            password,
            email_confirm: true,
            user_metadata: { name: nome },
          })
          if (authUpdateError) {
            return json({
              error: `Falha ao atualizar usuário no Authentication: ${authUpdateError.message}`,
              etapa: 'authentication',
            }, 400)
          }
        }

        const now = new Date().toISOString()
        const { data: professional, error: professionalError } = await admin
          .from('profissionais')
          .update({
            auth_user_id: authUserId,
            nome,
            email,
            telefone,
            especialidade,
            ong_id: ongId,
            status,
            updated_at: now,
          })
          .eq('id', existingInactive.id)
          .select('*')
          .single()

        if (professionalError) {
          return json({
            error: `Falha ao reativar o profissional: ${professionalError.message}`,
            etapa: 'profissionais',
          }, 400)
        }

        // Remove eventual perfil antigo ligado ao profissional mas a outro user_id,
        // evitando dois acessos para o mesmo cadastro após recuperação de vínculo.
        const { error: cleanupError } = await admin
          .from('usuarios_perfis')
          .delete()
          .eq('profissional_id', existingInactive.id)
          .neq('user_id', authUserId)
        if (cleanupError) throw cleanupError

        const { error: profileError } = await admin
          .from('usuarios_perfis')
          .upsert({
            user_id: authUserId,
            profissional_id: professional.id,
            nome,
            email,
            perfil,
            ativo: status === 'ativo',
            updated_at: now,
          }, { onConflict: 'user_id' })

        if (profileError) {
          return json({
            error: `Profissional atualizado, mas o perfil de acesso apresentou erro: ${profileError.message}`,
            etapa: 'usuarios_perfis',
          }, 400)
        }

        return json({
          profissional: professional,
          perfil,
          reativado: true,
          message: 'Cadastro inativo reutilizado e acesso atualizado.',
        })
      }

      // Nenhum cadastro anterior: criação normal.
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: nome },
      })

      if (createError) {
        return json({
          error: `Falha ao criar usuário no Authentication: ${createError.message}`,
          etapa: 'authentication'
        }, 400)
      }

      const authUserId = created.user.id

      const { data: professional, error: professionalError } = await admin
        .from('profissionais')
        .insert({
          auth_user_id: authUserId,
          nome,
          email,
          telefone,
          especialidade,
          ong_id: ongId,
          status,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single()

      if (professionalError) {
        await admin.auth.admin.deleteUser(authUserId)
        return json({
          error: `Falha ao gravar o profissional: ${professionalError.message}`,
          etapa: 'profissionais'
        }, 400)
      }

      const { error: profileError } = await admin
        .from('usuarios_perfis')
        .insert({
          user_id: authUserId,
          profissional_id: professional.id,
          nome,
          email,
          perfil,
          ativo: status === 'ativo',
          updated_at: new Date().toISOString(),
        })

      if (profileError) {
        await admin.from('profissionais').delete().eq('id', professional.id)
        await admin.auth.admin.deleteUser(authUserId)
        return json({
          error: `Falha ao gravar o perfil de acesso: ${profileError.message}`,
          etapa: 'usuarios_perfis'
        }, 400)
      }

      return json({ profissional: professional, perfil, reativado: false })
    }

    // V13.7 - ALTERAR DADOS CADASTRAIS DO PROFISSIONAL
    if (action === 'update-details') {
      const profissionalId = String(payload.profissional_id || '')
      const nome = String(payload.nome || '').trim()
      const email = String(payload.email || '').trim().toLowerCase()
      const telefone = payload.telefone ? String(payload.telefone).trim() : null
      const especialidade = payload.especialidade ? String(payload.especialidade).trim() : null
      const ongId = payload.ong_id ? String(payload.ong_id) : null
      if (!profissionalId || !nome || !email) return json({ error: 'Profissional, nome e e-mail são obrigatórios.' }, 400)

      const { data: professional, error: pError } = await admin.from('profissionais')
        .select('id,auth_user_id').eq('id', profissionalId).single()
      if (pError || !professional) return json({ error: 'Profissional não encontrado.' }, 404)

      const { data: authData } = await admin.auth.getUser(token)
      const editorEmail = authData?.user?.email || null
      const editorId = authData?.user?.id || null

      if (professional.auth_user_id) {
        const { error: authError } = await admin.auth.admin.updateUserById(professional.auth_user_id, {
          email,
          user_metadata: { name: nome },
        })
        if (authError) return json({ error: `Falha ao atualizar o acesso: ${authError.message}` }, 400)
      }

      const { error: profError } = await admin.from('profissionais').update({
        nome,email,telefone,especialidade,ong_id:ongId,updated_at:new Date().toISOString(),
        updated_by:editorId,updated_by_email:editorEmail,
      }).eq('id', profissionalId)
      if (profError) return json({ error: `Falha ao atualizar profissional: ${profError.message}` }, 400)

      if (professional.auth_user_id) {
        const { error: profileError } = await admin.from('usuarios_perfis').update({ nome,email })
          .eq('user_id', professional.auth_user_id)
        if (profileError) return json({ error: `Profissional atualizado, mas o perfil apresentou erro: ${profileError.message}` }, 400)
      }
      return json({ ok: true })
    }

    // ALTERAR PERFIL/ATIVAÇÃO
    if (action === 'set-profile') {
      const profissionalId = String(payload.profissional_id || '')
      const perfil = payload.perfil === 'admin' ? 'admin' : 'profissional'
      const ativo = payload.ativo !== false

      const { data: professional, error: pError } = await admin
        .from('profissionais')
        .select('id, auth_user_id, nome, email')
        .eq('id', profissionalId)
        .single()

      if (pError || !professional?.auth_user_id) {
        return json({ error: 'Profissional sem usuário de acesso vinculado.' }, 400)
      }

      const nome = professional.nome || 'Profissional'
      const email = professional.email || 'sem-email@protege.local'

      const { error } = await admin
        .from('usuarios_perfis')
        .upsert({
          user_id: professional.auth_user_id,
          profissional_id: professional.id,
          nome,
          email,
          perfil,
          ativo,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error
      return json({ ok: true })
    }

    // ALTERAR ONG VINCULADA AO PROFISSIONAL
    if (action === 'set-ong') {
      const profissionalId = String(payload.profissional_id || '')
      const ongId = payload.ong_id ? String(payload.ong_id) : null

      if (ongId) {
        const { data: ong, error: ongError } = await admin
          .from('ongs')
          .select('id')
          .eq('id', ongId)
          .single()
        if (ongError || !ong) return json({ error: 'ONG não encontrada.' }, 400)
      }

      const { data, error } = await admin
        .from('profissionais')
        .update({ ong_id: ongId, updated_at: new Date().toISOString() })
        .eq('id', profissionalId)
        .select('id, ong_id, ongs(id,nome,status)')
        .single()

      if (error) throw error
      return json({ profissional: data })
    }

    // REDEFINIR SENHA DE UM PROFISSIONAL
    if (action === 'reset-password') {
      const profissionalId = String(payload.profissional_id || '')
      const password = String(payload.password || '')

      if (password.length < 8) {
        return json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, 400)
      }

      const { data: professional, error: pError } = await admin
        .from('profissionais')
        .select('auth_user_id')
        .eq('id', profissionalId)
        .single()

      if (pError || !professional?.auth_user_id) {
        return json({ error: 'Profissional sem usuário de acesso vinculado.' }, 400)
      }

      const { error } = await admin.auth.admin.updateUserById(
        professional.auth_user_id,
        { password },
      )

      if (error) throw error
      return json({ ok: true })
    }

    return json({ error: 'Ação inválida.' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: error instanceof Error ? error.message : 'Erro inesperado.' }, 500)
  }
})
