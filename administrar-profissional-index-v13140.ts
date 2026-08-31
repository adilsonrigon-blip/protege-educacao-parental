import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const digits=(v:unknown)=>String(v||'').replace(/\D/g,'')
function cpfValido(v:unknown){const c=digits(v);if(c.length!==11||/^(\d)\1{10}$/.test(c))return false;const calc=(base:string,p:number)=>{let s=0;for(let i=0;i<base.length;i++)s+=Number(base[i])*(p-i);const r=(s*10)%11;return r===10?0:r};return calc(c.slice(0,9),10)===Number(c[9])&&calc(c.slice(0,10),11)===Number(c[10])}

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

    const actorEmail=userData.user.email||null
    const audit=async(tabela:string,registroId:string,acao:string,oldData:unknown=null,newData:unknown=null)=>{
      await admin.from('auditoria_eventos').insert({tabela,registro_id:registroId,acao,dados_anteriores:oldData,dados_novos:newData,realizado_por:userData.user.id,realizado_por_email:actorEmail,origem:'edge-function'}).catch(()=>{})
    }
    const history=async(id:string,previous:string|null,next:string,observacao:string|null=null,motivo:string|null=null)=>{
      await admin.from('pre_cadastro_profissionais_historico').insert({pre_cadastro_id:id,status_anterior:previous,status_novo:next,observacao,motivo_recusa:motivo,realizado_por:userData.user.id,realizado_por_email:actorEmail})
    }

    if(action==='pending-pre-count'){
      const {count,error}=await admin.from('pre_cadastro_profissionais').select('id',{count:'exact',head:true}).in('status',['pendente','em_analise']);if(error)throw error;return json({count:count||0})
    }
    if(action==='list-pre-cadastros'){
      const page=Math.max(1,Number(payload.page||1)),pageSize=Math.min(100,Math.max(10,Number(payload.page_size||25)));
      let q=admin.from('pre_cadastro_profissionais').select('*',{count:'exact'}).order('created_at',{ascending:false});
      const st=String(payload.status||'');if(st)q=q.eq('status',st);
      const term=String(payload.q||'').trim().replace(/[,%()]/g,' ');if(term)q=q.or(`nome.ilike.%${term}%,email.ilike.%${term}%,cpf.ilike.%${term}%,cidade.ilike.%${term}%`);
      const from=(page-1)*pageSize;const {data,error,count}=await q.range(from,from+pageSize-1);if(error)throw error;return json({pre_cadastros:data||[],count:count||0,page,page_size:pageSize})
    }
    if(action==='pre-cadastro-history'){
      const id=String(payload.pre_cadastro_id||'');const {data,error}=await admin.from('pre_cadastro_profissionais_historico').select('*').eq('pre_cadastro_id',id).order('created_at',{ascending:false});if(error)throw error;return json({historico:data||[]})
    }
    if(action==='set-pre-cadastro-status'||action==='reject-pre-cadastro'){
      const id=String(payload.pre_cadastro_id||'');const {data:pre,error:pe}=await admin.from('pre_cadastro_profissionais').select('status').eq('id',id).single();if(pe||!pre)return json({error:'Pré-cadastro não encontrado.'},404);
      const next=action==='reject-pre-cadastro'?'recusado':(payload.status==='em_analise'?'em_analise':'pendente');const obs=String(payload.observacoes_admin||'').trim()||null;const reason=action==='reject-pre-cadastro'?(String(payload.motivo_recusa||'').trim()||null):null;if(action==='reject-pre-cadastro'&&!reason)return json({error:'Informe o motivo da recusa.'},400);
      const patch:any={status:next,observacoes_admin:obs,analisado_por:userData.user.id,analisado_em:new Date().toISOString(),updated_at:new Date().toISOString()};if(next==='recusado'){patch.motivo_recusa=reason;patch.recusado_em=new Date().toISOString();patch.recusado_por=userData.user.id}
      const {error}=await admin.from('pre_cadastro_profissionais').update(patch).eq('id',id);if(error)throw error;await history(id,pre.status,next,obs,reason);await audit('pre_cadastro_profissionais',id,next==='recusado'?'RECUSA':'UPDATE',{status:pre.status},{status:next,observacoes_admin:obs,motivo_recusa:reason});return json({ok:true})
    }
    if(action==='approve-pre-cadastro'){
      const id=String(payload.pre_cadastro_id||''),password=String(payload.password||''),status=payload.status==='inativo'?'inativo':'ativo';if(password.length<8)return json({error:'A senha deve ter pelo menos 8 caracteres.'},400);
      const {data:pre,error:preError}=await admin.from('pre_cadastro_profissionais').select('*').eq('id',id).single();if(preError||!pre)return json({error:'Pré-cadastro não encontrado.'},404);if(pre.status==='aprovado')return json({error:'Este pré-cadastro já foi aprovado.'},400);if(!cpfValido(pre.cpf))return json({error:'O CPF do pré-cadastro é inválido.'},400);
      const {data:cpfDup}=await admin.from('profissionais').select('id').eq('cpf',digits(pre.cpf)).maybeSingle();if(cpfDup)return json({error:'Já existe um profissional com este CPF.'},400);const {data:mailDup}=await admin.from('profissionais').select('id').ilike('email',pre.email).maybeSingle();if(mailDup)return json({error:'Já existe um profissional com este e-mail.'},400);
      const {data:created,error:createError}=await admin.auth.admin.createUser({email:pre.email,password,email_confirm:true,user_metadata:{name:pre.nome}});if(createError||!created.user)return json({error:createError?.message||'Falha ao criar acesso.'},400);const authId=created.user.id;
      const {data:professional,error:pError}=await admin.from('profissionais').insert({auth_user_id:authId,nome:pre.nome,email:pre.email,telefone:pre.celular,especialidade:pre.especialidade,cpf:digits(pre.cpf),status,updated_at:new Date().toISOString()}).select('*').single();if(pError){await admin.auth.admin.deleteUser(authId);return json({error:pError.message},400)}
      const {error:profileError}=await admin.from('usuarios_perfis').insert({user_id:authId,profissional_id:professional.id,nome:pre.nome,email:pre.email,perfil:'profissional',ativo:status==='ativo',updated_at:new Date().toISOString()});if(profileError){await admin.from('profissionais').delete().eq('id',professional.id);await admin.auth.admin.deleteUser(authId);return json({error:profileError.message},400)}
      const now=new Date().toISOString(),obs=String(payload.observacoes_admin||'').trim()||null;const {error:updateError}=await admin.from('pre_cadastro_profissionais').update({status:'aprovado',observacoes_admin:obs,motivo_recusa:null,analisado_por:userData.user.id,analisado_em:now,aprovado_por:userData.user.id,aprovado_em:now,profissional_id:professional.id,updated_at:now}).eq('id',id);if(updateError)throw updateError;await history(id,pre.status,'aprovado',obs,null);await audit('pre_cadastro_profissionais',id,'APROVACAO',{status:pre.status},{status:'aprovado',profissional_id:professional.id});return json({ok:true,profissional:professional})
    }
    if(action==='resend-access'){
      const id=String(payload.pre_cadastro_id||'');const {data:pre,error}=await admin.from('pre_cadastro_profissionais').select('id,email,status,profissional_id').eq('id',id).single();if(error||!pre||pre.status!=='aprovado')return json({error:'Pré-cadastro aprovado não encontrado.'},404);
      const redirect=String(payload.redirect_to||'https://protegeducparental.com.br/login.html');const {error:mailError}=await admin.auth.resetPasswordForEmail(pre.email,{redirectTo:redirect});if(mailError)return json({error:'Não foi possível enviar o e-mail de acesso: '+mailError.message},400);const now=new Date().toISOString();await admin.from('pre_cadastro_profissionais').update({ultimo_acesso_enviado_em:now,updated_at:now}).eq('id',id);await audit('pre_cadastro_profissionais',id,'REENVIO_ACESSO',null,{email:pre.email});return json({ok:true})
    }

    // LISTAR PROFISSIONAIS (V13.14: paginação/filtros no servidor)
    if (action === 'list') {
      const paginated=payload.paginated===true;
      const page=Math.max(1,Number(payload.page||1)),pageSize=Math.min(100,Math.max(10,Number(payload.page_size||25)));
      let pq=admin.from('profissionais').select('id, auth_user_id, nome, email, telefone, especialidade, status, ong_id, cpf, created_at, updated_at, updated_by_email, ongs(id,nome,status)',{count:paginated?'exact':undefined}).order('nome',{ascending:true});
      const status=String(payload.status||''),ong=String(payload.ong_id||''),term=String(payload.q||'').trim().replace(/[,%()]/g,' ');if(status)pq=pq.eq('status',status);if(ong)pq=pq.eq('ong_id',ong);if(term)pq=pq.or(`nome.ilike.%${term}%,email.ilike.%${term}%,telefone.ilike.%${term}%,especialidade.ilike.%${term}%`);if(paginated){const from=(page-1)*pageSize;pq=pq.range(from,from+pageSize-1)}
      const [{data:profissionais,error:pError,count},{data:perfis,error:aError}]=await Promise.all([pq,admin.from('usuarios_perfis').select('profissional_id,perfil,ativo')]);if(pError)throw pError;if(aError)throw aError;const byProfessional=new Map((perfis||[]).map((x:any)=>[x.profissional_id,x]));let rows=(profissionais||[]).map((p:any)=>({...p,perfil:byProfessional.get(p.id)?.perfil||'profissional',acesso_ativo:byProfessional.get(p.id)?.ativo??(p.status==='ativo')}));const perfil=String(payload.perfil||'');if(perfil)rows=rows.filter((p:any)=>p.perfil===perfil);return json({profissionais:rows,count:count??rows.length,page,page_size:pageSize})
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
