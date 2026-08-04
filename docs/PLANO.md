# Plano — Pro-Escala

## Origem
Evolução do [GESTAO-SDI](https://github.com/willtech84/GESTAO-SDI), que hoje roda 100% no navegador (`index.html` único, dados em `localStorage`, login com senha em texto puro, único papel "admin/user"). Esse modelo não suporta multi-setor, RH consolidado, bloqueio de usuário nem avisos — por isso a decisão de reescrever o backend do zero, aproveitando a lógica de escala já validada.

## Papéis e permissões
- **admin** (Willyam): branding (cores, logo), cria/edita qualquer usuário incluindo RH e outros admins, acesso a todos os setores
- **rh**: visão consolidada de todos os setores (filtro por setor/data/horário), envia avisos (férias, atestado, afastamento, jurídico), bloqueia usuários, gerencia banco de horas/folgas de qualquer usuário
- **gestor_setor**: gerencia apenas a escala do próprio setor (ex.: SDI, Centro Cirúrgico, Emergência)
- **usuario**: vê a própria escala, banco de horas e folgas; pode solicitar folga

## Arquitetura
- **Backend:** Cloudflare Workers + D1 — mesmo padrão do projeto Plantão (login real, dados centralizados, não presos a um navegador/dispositivo)
- **Senha:** hash (nunca texto puro — diferente do GESTAO-SDI atual)
- **Frontend:** reaproveita telas e lógica de escala do GESTAO-SDI (geração de escala mensal, sobreaviso, feriados, descanso mínimo 12h, relatórios/impressão), reorganizadas em módulos por papel

## Fases
1. **Fundação:** repositório + schema D1 (`schema.sql`) ✅
2. **Autenticação:** login com hash de senha, sessão, papéis
3. **Migração de telas:** extrair do `legacy/gestao-sdi-index.html` os módulos de escala/relatórios e adaptar para multi-setor
4. **Módulo Admin:** branding (cor/logo), gestão de usuários e permissões
5. **Módulo RH:** filtros por setor/data/horário, avisos, bloqueio de usuário
6. **Módulo Setor:** gestor cria/edita escala do próprio grupo
7. **Banco de horas e folgas:** criação e consulta, por usuário e por RH
8. **Deploy e testes:** publicar no Cloudflare, testar com um setor piloto antes de liberar geral

## Referência de dados legados
O arquivo `legacy/gestao-sdi-index.html` é mantido só como referência de UI/lógica de escala — não será usado como fonte de dados de produção (a estrutura `radiologiaDB_v2` do localStorage não é compatível com o novo modelo multi-setor).
