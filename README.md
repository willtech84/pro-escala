# Pro-Escala

Sistema multi-setor de gestão de escalas, banco de horas, folgas e RH — evolução do [GESTAO-SDI](https://github.com/willtech84/GESTAO-SDI).

## Visão geral

Cada setor (SDI, Centro Cirúrgico, Emergência, etc.) gerencia sua própria escala de forma isolada. O RH tem visão consolidada de todos os setores, com filtros por setor/data/horário, envio de avisos e bloqueio de acesso. O Admin tem controle total: branding (cores/logo), criação de usuários/RH/admins e permissões.

## Papéis (roles)

| Papel | Permissões |
|---|---|
| **admin** | Acesso total: branding, cria/edita qualquer usuário (inclusive RH e outros admins), todos os setores |
| **rh** | Vê todos os setores, filtra por setor/data/horário, envia avisos, bloqueia usuários, gerencia banco de horas/folgas de qualquer usuário |
| **gestor_setor** | Gerencia apenas o próprio setor (escala do grupo) |
| **usuario** | Vê sua própria escala, banco de horas e folgas |

## Status

🚧 Em construção — migrando do GESTAO-SDI (que roda 100% em localStorage, sem backend) para Cloudflare Workers + D1, com autenticação real e multi-setor.

- [x] Repositório criado
- [x] Código legado do GESTAO-SDI copiado em `/legacy` como referência
- [x] Schema do banco (D1) — ver `schema.sql`
- [x] Backend de autenticação (Workers) — login, sessão, papéis, setup do primeiro admin
- [ ] Módulo Admin (branding + gestão de usuários)
- [ ] Módulo RH (filtros, avisos, bloqueio)
- [ ] Módulo de setor (escala própria)
- [ ] Banco de horas / folgas
- [ ] Deploy

Veja o plano completo em [`docs/PLANO.md`](docs/PLANO.md).

## Stack

- **Backend:** Cloudflare Workers + D1 (mesmo padrão usado no projeto [Plantão](https://github.com/willtech84/plantao))
- **Frontend:** reaproveitando telas/lógica de escala do GESTAO-SDI, reorganizadas em módulos
