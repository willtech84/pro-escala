// Worker do Pro-Escala — serve o app estatico (public/) e a API em /api/*
// Auth por sessao (token em D1), senha com PBKDF2 (Web Crypto, sem libs externas).
// Papeis: admin, rh, gestor_setor, usuario.

const SESSAO_DIAS = 30;
const ROLES = ["admin", "rh", "gestor_setor", "usuario"];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
function erro(msg, status = 400) {
  return json({ erro: msg }, status);
}

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bufToHex(arr);
}
async function hashSenha(senha, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(senha), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bufToHex(bits);
}
function isoDaqui(dias) {
  return new Date(Date.now() + dias * 86400000).toISOString();
}

async function usuarioDaSessao(req, env) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT u.id, u.nome, u.email, u.role, u.setor_id, u.status, u.criado_em FROM sessoes s JOIN users u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira_em > ?"
  ).bind(token, new Date().toISOString()).first();
  return row || null;
}

function semSenha(u) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    setorId: u.setor_id,
    tipoEscalaId: u.tipo_escala_id,
    status: u.status,
    criadoEm: u.criado_em,
  };
}

async function criarSessao(env, usuarioId) {
  const token = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO sessoes (token, usuario_id, criado_em, expira_em) VALUES (?,?,?,?)")
    .bind(token, usuarioId, new Date().toISOString(), isoDaqui(SESSAO_DIAS)).run();
  return token;
}

async function handleApi(req, env, url) {
  const path = url.pathname.replace(/^\/api/, "");
  const method = req.method;

  // POST /setup — cria o primeiro admin. So funciona se ainda nao existir nenhum usuario.
  if (path === "/setup" && method === "POST") {
    const { count } = await env.DB.prepare("SELECT COUNT(*) as count FROM users").first();
    if (count > 0) return erro("Sistema ja configurado. Peca a um admin para criar sua conta.", 403);

    const body = await req.json().catch(() => ({}));
    const nome = (body.nome || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const senha = body.senha || "";
    if (!nome || !email || !senha || senha.length < 6) {
      return erro("Preencha nome, e-mail e senha (min. 6 caracteres).");
    }

    const salt = randomHex();
    const hash = await hashSenha(senha, salt);
    const res = await env.DB.prepare(
      "INSERT INTO users (nome, email, senha_hash, senha_salt, role, status) VALUES (?,?,?,?,?,?)"
    ).bind(nome, email, hash, salt, "admin", "ativo").run();

    const token = await criarSessao(env, res.meta.last_row_id);
    const usuario = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(res.meta.last_row_id).first();
    return json({ token, usuario: semSenha(usuario) });
  }

  // POST /login
  if (path === "/login" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();
    const senha = body.senha || "";
    const u = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
    if (!u) return erro("E-mail ou senha incorretos.", 401);
    if (u.status === "bloqueado") return erro("Usuario bloqueado. Fale com o RH ou admin.", 403);
    const hash = await hashSenha(senha, u.senha_salt);
    if (hash !== u.senha_hash) return erro("E-mail ou senha incorretos.", 401);

    const token = await criarSessao(env, u.id);
    return json({ token, usuario: semSenha(u) });
  }

  // POST /logout
  if (path === "/logout" && method === "POST") {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token) await env.DB.prepare("DELETE FROM sessoes WHERE token = ?").bind(token).run();
    return json({ ok: true });
  }

  // A partir daqui, todas as rotas exigem sessao valida
  const usuario = await usuarioDaSessao(req, env);
  if (!usuario) return erro("Sessao invalida ou expirada.", 401);

  // GET /me
  if (path === "/me" && method === "GET") {
    return json({ usuario: semSenha(usuario) });
  }

  // GET /setores
  if (path === "/setores" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM setores ORDER BY nome").all();
    return json({ setores: results });
  }

  // POST /setores — admin cria setor
  if (path === "/setores" && method === "POST") {
    if (usuario.role !== "admin") return erro("Apenas admin pode criar setores.", 403);
    const body = await req.json().catch(() => ({}));
    const nome = (body.nome || "").trim();
    if (!nome) return erro("Informe o nome do setor.");
    const res = await env.DB.prepare("INSERT INTO setores (nome) VALUES (?)").bind(nome).run();
    return json({ id: res.meta.last_row_id, nome });
  }

  // GET /usuarios — admin ve todos; rh ve todos; gestor_setor ve so do proprio setor
  if (path === "/usuarios" && method === "GET") {
    let query = "SELECT id, nome, email, role, setor_id, tipo_escala_id, status, criado_em FROM users";
    let stmt;
    if (usuario.role === "gestor_setor") {
      stmt = env.DB.prepare(query + " WHERE setor_id = ? ORDER BY nome").bind(usuario.setor_id);
    } else if (usuario.role === "admin" || usuario.role === "rh") {
      stmt = env.DB.prepare(query + " ORDER BY nome");
    } else {
      return erro("Sem permissao para listar usuarios.", 403);
    }
    const { results } = await stmt.all();
    return json({ usuarios: results.map(semSenha) });
  }

  // POST /usuarios — cria usuario. admin cria qualquer papel; gestor_setor so 'usuario' no proprio setor
  if (path === "/usuarios" && method === "POST") {
    if (!["admin", "rh", "gestor_setor"].includes(usuario.role)) return erro("Sem permissao.", 403);
    const body = await req.json().catch(() => ({}));
    const nome = (body.nome || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const senha = body.senha || "";
    let role = body.role || "usuario";
    let setorId = body.setorId ?? null;

    if (usuario.role === "gestor_setor") {
      role = "usuario";
      setorId = usuario.setor_id;
    } else if (usuario.role === "rh" && role === "admin") {
      return erro("RH nao pode criar admin.", 403);
    }
    if (!ROLES.includes(role)) return erro("Papel invalido.");
    if (!nome || !email || !senha || senha.length < 6) return erro("Preencha nome, e-mail e senha (min. 6 caracteres).");

    const existe = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existe) return erro("E-mail ja cadastrado.");

    const salt = randomHex();
    const hash = await hashSenha(senha, salt);
    const res = await env.DB.prepare(
      "INSERT INTO users (nome, email, senha_hash, senha_salt, role, setor_id, status) VALUES (?,?,?,?,?,?,?)"
    ).bind(nome, email, hash, salt, role, setorId, "ativo").run();

    const novo = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(res.meta.last_row_id).first();
    return json({ usuario: semSenha(novo) });
  }

  // PUT /usuarios/:id — editar nome, email, role, setor, status. admin: qualquer um. rh: nao-admin. gestor_setor: so do proprio setor (nome/email).
  const mEdit = path.match(/^\/usuarios\/(\d+)$/);
  if (mEdit && method === "PUT") {
    const id = Number(mEdit[1]);
    const alvo = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    if (!alvo) return erro("Usuario nao encontrado.", 404);

    if (usuario.role === "gestor_setor") {
      if (alvo.setor_id !== usuario.setor_id || alvo.role !== "usuario") return erro("Sem permissao.", 403);
    } else if (usuario.role === "rh") {
      if (alvo.role === "admin") return erro("RH nao pode editar admin.", 403);
    } else if (usuario.role !== "admin") {
      return erro("Sem permissao.", 403);
    }

    const body = await req.json().catch(() => ({}));
    const campos = [];
    const valores = [];
    if (typeof body.nome === "string" && body.nome.trim()) { campos.push("nome = ?"); valores.push(body.nome.trim()); }
    if (typeof body.email === "string" && body.email.trim()) { campos.push("email = ?"); valores.push(body.email.trim().toLowerCase()); }
    if (typeof body.status === "string" && ["ativo", "bloqueado"].includes(body.status)) { campos.push("status = ?"); valores.push(body.status); }
    if (body.tipoEscalaId !== undefined) { campos.push("tipo_escala_id = ?"); valores.push(body.tipoEscalaId || null); }
    if (usuario.role === "admin") {
      if (typeof body.role === "string" && ROLES.includes(body.role)) { campos.push("role = ?"); valores.push(body.role); }
      if (body.setorId !== undefined) { campos.push("setor_id = ?"); valores.push(body.setorId); }
    }
    if (typeof body.senha === "string" && body.senha) {
      if (body.senha.length < 6) return erro("Senha deve ter no minimo 6 caracteres.");
      const salt = randomHex();
      const hash = await hashSenha(body.senha, salt);
      campos.push("senha_hash = ?", "senha_salt = ?");
      valores.push(hash, salt);
    }
    if (!campos.length) return erro("Nada para atualizar.");

    valores.push(id);
    await env.DB.prepare(`UPDATE users SET ${campos.join(", ")} WHERE id = ?`).bind(...valores).run();
    const atualizado = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
    return json({ usuario: semSenha(atualizado) });
  }

  // DELETE /usuarios/:id
  const mDel = path.match(/^\/usuarios\/(\d+)$/);
  if (mDel && method === "DELETE") {
    if (usuario.role !== "admin") return erro("Apenas admin pode excluir usuarios.", 403);
    const id = Number(mDel[1]);
    if (id === usuario.id) return erro("Voce nao pode excluir a si mesmo.");
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // GET /config — branding/config geral do app (nome da instituicao, cores, logo)
  if (path === "/config" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT chave, valor FROM config_app").all();
    const config = {};
    for (const r of results) config[r.chave] = r.valor;
    return json({ config });
  }

  // PUT /config — so admin
  if (path === "/config" && method === "PUT") {
    if (usuario.role !== "admin") return erro("Apenas admin pode alterar configuracoes.", 403);
    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object") return erro("Corpo invalido.");
    const agora = new Date().toISOString();
    for (const [chave, valor] of Object.entries(body)) {
      await env.DB.prepare(
        "INSERT INTO config_app (chave, valor, atualizado_por, atualizado_em) VALUES (?,?,?,?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = excluded.atualizado_em"
      ).bind(chave, String(valor), usuario.id, agora).run();
    }
    return json({ ok: true });
  }

  // GET /tipos-escala — qualquer usuario logado pode ver os padroes disponiveis
  if (path === "/tipos-escala" && method === "GET") {
    const { results } = await env.DB.prepare("SELECT * FROM tipos_escala WHERE ativo = 1 ORDER BY carga_horaria_semanal, nome").all();
    return json({ tiposEscala: results.map(t => ({ ...t, blocos: JSON.parse(t.blocos) })) });
  }

  // POST /tipos-escala — so admin cria padrao novo
  if (path === "/tipos-escala" && method === "POST") {
    if (usuario.role !== "admin") return erro("Apenas admin pode criar padrões de escala.", 403);
    const body = await req.json().catch(() => ({}));
    const nome = (body.nome || "").trim();
    const carga = Number(body.cargaHorariaSemanal);
    const blocos = Array.isArray(body.blocos) ? body.blocos : null;
    if (!nome || !carga || !blocos || !blocos.length) return erro("Informe nome, carga horária semanal e ao menos um bloco.");
    for (const b of blocos) {
      if (!/^\d{2}:\d{2}$/.test(b.inicio) || !/^\d{2}:\d{2}$/.test(b.fim)) return erro("Cada bloco precisa de inicio e fim no formato HH:MM.");
    }
    const res = await env.DB.prepare(
      "INSERT INTO tipos_escala (nome, carga_horaria_semanal, blocos, regras) VALUES (?,?,?,?)"
    ).bind(nome, carga, JSON.stringify(blocos), body.regras || null).run();
    return json({ id: res.meta.last_row_id });
  }

  // PUT /tipos-escala/:id — so admin edita (ou desativa, para nao quebrar quem ja usa)
  const mTipoEscala = path.match(/^\/tipos-escala\/(\d+)$/);
  if (mTipoEscala && method === "PUT") {
    if (usuario.role !== "admin") return erro("Apenas admin pode editar padrões de escala.", 403);
    const id = Number(mTipoEscala[1]);
    const body = await req.json().catch(() => ({}));
    const campos = [];
    const valores = [];
    if (typeof body.nome === "string" && body.nome.trim()) { campos.push("nome = ?"); valores.push(body.nome.trim()); }
    if (body.cargaHorariaSemanal !== undefined) { campos.push("carga_horaria_semanal = ?"); valores.push(Number(body.cargaHorariaSemanal)); }
    if (Array.isArray(body.blocos)) { campos.push("blocos = ?"); valores.push(JSON.stringify(body.blocos)); }
    if (typeof body.regras === "string") { campos.push("regras = ?"); valores.push(body.regras); }
    if (typeof body.ativo === "boolean") { campos.push("ativo = ?"); valores.push(body.ativo ? 1 : 0); }
    if (!campos.length) return erro("Nada para atualizar.");
    valores.push(id);
    await env.DB.prepare(`UPDATE tipos_escala SET ${campos.join(", ")} WHERE id = ?`).bind(...valores).run();
    return json({ ok: true });
  }

  // POST /escalas/lote — importa varios registros de escala de uma vez (usado pelas telas de importar Excel/imagem)
  if (path === "/escalas/lote" && method === "POST") {
    if (!["admin", "rh", "gestor_setor"].includes(usuario.role)) return erro("Sem permissao.", 403);
    const body = await req.json().catch(() => ({}));
    const registros = Array.isArray(body.registros) ? body.registros : [];
    const origem = ["manual", "excel", "ocr", "ia"].includes(body.origem) ? body.origem : "manual";
    if (!registros.length) return erro("Nenhum registro para importar.");
    if (registros.length > 1000) return erro("Maximo de 1000 registros por importacao.");

    const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
    const REGEX_HORA = /^\d{2}:\d{2}$/;
    let inseridos = 0;
    const falhas = [];

    for (let i = 0; i < registros.length; i++) {
      const r = registros[i];
      const usuarioId = Number(r.usuarioId);
      const alvo = usuarioId ? await env.DB.prepare("SELECT id, setor_id FROM users WHERE id = ?").bind(usuarioId).first() : null;

      if (!alvo) { falhas.push({ linha: i + 1, motivo: "funcionario nao encontrado" }); continue; }
      if (usuario.role === "gestor_setor" && alvo.setor_id !== usuario.setor_id) {
        falhas.push({ linha: i + 1, motivo: "funcionario fora do seu setor" }); continue;
      }
      if (!REGEX_DATA.test(r.data)) { falhas.push({ linha: i + 1, motivo: "data invalida (use AAAA-MM-DD)" }); continue; }
      if (!REGEX_HORA.test(r.horaInicio) || !REGEX_HORA.test(r.horaFim)) {
        falhas.push({ linha: i + 1, motivo: "horario invalido (use HH:MM)" }); continue;
      }

      const setorId = alvo.setor_id;
      if (!setorId) { falhas.push({ linha: i + 1, motivo: "funcionario sem setor definido" }); continue; }

      await env.DB.prepare(
        "INSERT INTO escalas (setor_id, user_id, data, hora_inicio, hora_fim, tipo, observacao, origem, criado_por) VALUES (?,?,?,?,?,?,?,?,?)"
      ).bind(setorId, alvo.id, r.data, r.horaInicio, r.horaFim, r.tipo || null, r.observacao || null, origem, usuario.id).run();
      inseridos++;
    }

    return json({ inseridos, falhas });
  }

  // GET /escalas?userId=&de=&ate= — lista escalas com filtros simples
  if (path === "/escalas" && method === "GET") {
    const userId = url.searchParams.get("userId");
    const de = url.searchParams.get("de");
    const ate = url.searchParams.get("ate");
    let sql = "SELECT * FROM escalas WHERE 1=1";
    const binds = [];
    if (usuario.role === "gestor_setor") { sql += " AND setor_id = ?"; binds.push(usuario.setor_id); }
    else if (usuario.role === "usuario") { sql += " AND user_id = ?"; binds.push(usuario.id); }
    if (userId) { sql += " AND user_id = ?"; binds.push(Number(userId)); }
    if (de) { sql += " AND data >= ?"; binds.push(de); }
    if (ate) { sql += " AND data <= ?"; binds.push(ate); }
    sql += " ORDER BY data DESC, hora_inicio DESC LIMIT 500";
    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return json({ escalas: results });
  }

  return erro("Rota nao encontrada.", 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(req, env, url);
      } catch (e) {
        return erro("Erro interno: " + (e && e.message ? e.message : String(e)), 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
