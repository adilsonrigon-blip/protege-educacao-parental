import {createClient} from 'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
const digits=(x:unknown)=>String(x||'').replace(/\D/g,'');
function cpfOk(v:unknown){const c=digits(v);if(c.length!==11||/^(\d)\1{10}$/.test(c))return false;const check=(s:string,n:number)=>{let sum=0;for(let i=0;i<s.length;i++)sum+=Number(s[i])*(n-i);const r=(sum*10)%11;return r===10?0:r};return check(c.slice(0,9),10)===Number(c[9])&&check(c.slice(0,10),11)===Number(c[10])}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({error:'Método não permitido'},405);
 try{
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)throw new Error('Configuração indisponível');
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});const p=await req.json();
 const nome=String(p.nome||'').trim(),email=String(p.email||'').trim().toLowerCase(),senha=String(p.senha||'');
 const pais=String(p.pais||'BR'),tipo=String(p.tipo_documento||(pais==='BR'?'cpf':'passaporte'));
 const cpf=tipo==='cpf'?digits(p.cpf):null,numero=String(p.numero_documento||(cpf||'')).trim();
 const cidade=String(p.cidade||'').trim(),estado=String(p.estado||'').trim(),celular=String(p.celular||'').trim();
 if(!nome||!email||!p.data_nascimento||!cidade||!estado||!celular||!String(p.especialidade||'').trim()||!String(p.formacao_origem||'').trim()||!String(p.motivacao||'').trim()||!numero)return reply({error:'Preencha os campos obrigatórios.'},400);
 if(!p.consentimento_lgpd)return reply({error:'Consentimento obrigatório.'},400);
 if(tipo==='cpf'&&!cpfOk(cpf))return reply({error:'CPF inválido.'},400);
 if(pais==='BR'&&!/^[A-Z]{2}$/i.test(estado))return reply({error:'UF inválida.'},400);
 if(pais!=='BR'&&!/^\+[1-9]\d{6,14}$/.test(celular.replace(/[\s().-]/g,'')))return reply({error:'Telefone internacional inválido.'},400);
 if(senha.length<8)return reply({error:'Senha deve ter pelo menos 8 caracteres.'},400);
 const {data:profession,error:professionError}=await db.from('profissoes').select('nome').eq('nome',String(p.especialidade).trim()).eq('ativo',true).maybeSingle();if(professionError||!profession)return reply({error:'Selecione uma profissão ativa.'},400);
 const {data:existingProf}=await db.from('profissionais').select('id').ilike('email',email).maybeSingle();if(existingProf)return reply({error:'E-mail já cadastrado.'},409);
 const {data:existingDoc}=await db.from('profissionais').select('id').eq('pais',pais).eq('tipo_documento',tipo).eq('numero_documento',numero).maybeSingle();if(existingDoc)return reply({error:'Documento já cadastrado.'},409);
 const {data:preEmail}=await db.from('pre_cadastro_profissionais').select('*').ilike('email',email).maybeSingle();
 const {data:preDoc}=await db.from('pre_cadastro_profissionais').select('*').eq('pais',pais).eq('tipo_documento',tipo).eq('numero_documento',numero).maybeSingle();
 const existing=preEmail||preDoc;if(existing&&existing.status!=='recusado')return reply({error:'Já existe pré-cadastro com esse documento ou e-mail.'},409);
 let page=1,authUser:any=null;while(page<=10&&!authUser){const {data,error}=await db.auth.admin.listUsers({page,perPage:100});if(error)throw error;authUser=(data.users||[]).find((u:any)=>String(u.email||'').toLowerCase()===email);if((data.users||[]).length<100)break;page++}
 let authId=authUser?.id||null,created=false;
 if(authId){const {data:linked}=await db.from('profissionais').select('id').eq('auth_user_id',authId).maybeSingle();if(linked)return reply({error:'Acesso já associado a profissional.'},409);const {error}=await db.auth.admin.updateUserById(authId,{email,password:senha,email_confirm:true,user_metadata:{name:nome}});if(error)return reply({error:error.message},400)}
 else{const {data,error}=await db.auth.admin.createUser({email,password:senha,email_confirm:true,user_metadata:{name:nome}});if(error||!data.user)return reply({error:error?.message||'Erro ao criar usuário'},400);authId=data.user.id;created=true}
 const row={nome,email,cpf,pais,tipo_documento:tipo,numero_documento:numero,data_nascimento:p.data_nascimento,cep:String(p.cep||'').trim()||null,logradouro:String(p.logradouro||'').trim()||null,numero:String(p.numero||'').trim()||null,complemento:String(p.complemento||'').trim()||null,bairro:String(p.bairro||'').trim()||null,cidade,estado:estado.toUpperCase(),celular,especialidade:String(p.especialidade).trim(),formacao_origem:String(p.formacao_origem).trim(),formacao_educacao_parental:String(p.formacao_educacao_parental||'').trim(),como_conheceu:String(p.como_conheceu||'').trim(),motivacao:String(p.motivacao).trim(),consentimento_lgpd:true,auth_user_id:authId,status:'pendente',observacoes_admin:null,motivo_recusa:null,analisado_por:null,analisado_em:null,aprovado_por:null,aprovado_em:null,profissional_id:null,updated_at:new Date().toISOString()};
 const query=existing?db.from('pre_cadastro_profissionais').update(row).eq('id',existing.id):db.from('pre_cadastro_profissionais').insert(row);
 const {data:saved,error}=await query.select('id,status').single();if(error){if(created&&authId)await db.auth.admin.deleteUser(authId);return reply({error:error.message},400)}
 return reply({ok:true,id:saved.id,status:'pendente',reused_auth_user:!!authUser});
 }catch(e){console.error(e);return reply({error:e instanceof Error?e.message:'Erro interno'},500)}
});
