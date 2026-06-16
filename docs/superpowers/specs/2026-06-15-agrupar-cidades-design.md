# Agrupar Cidades — Documento de Design

**Data:** 2026-06-15
**Status:** Aprovado para planejamento
**Projeto:** Relógios Mundiais / WORLD TIMETABLE (`~/Projects/Timezones`)

## Objetivo

Permitir organizar as cidades em **grupos** nomeados (ex.: "Time", "Família", "Clientes"), alternando entre eles por abas. Cada grupo é um quadro independente.

## Decisões principais

| Decisão | Escolha |
|---|---|
| Modelo | Grupos **independentes** — cada grupo tem suas próprias cidades, ordem e referência |
| Multi-pertencimento | Uma cidade **pode** estar em vários grupos (adicionada a cada um separadamente) |
| Referência | **Por grupo** |
| Preferências (cores, 12h) | **Globais** (app inteiro) |
| Alternância/gestão | **Abas** acima da grade (route tabs), com ＋ criar, duplo-clique renomear, ✕ apagar |

## Arquitetura

O `store` passa a guardar grupos, mas **mantém a mesma interface de cidades** que `app.js`/`ui.js` já consomem — agora resolvida para o **grupo ativo**. Toda a complexidade de grupos fica encapsulada no `store`; `app.js`/`ui.js` mudam pouco (ganham apenas a faixa de abas).

```
store.js (encapsula grupos)
 ├─ getGroups / getActiveGroupId / setActiveGroup
 ├─ addGroup(name)→id / renameGroup(id,name) / removeGroup(id)
 └─ cidades do GRUPO ATIVO (assinatura inalterada):
     getCities / addCity / removeCity / setCities
     getReference / setReference / clearReference
ui.js
 ├─ renderTabs(...)  ← novo: desenha abas + fia eventos (onSwitch/onCreate/onRename/onDelete)
 ├─ renderBoard / updateTimes / wireBoard  ← inalterados
app.js  ← fornece handlers das abas; troca de grupo = evento estrutural (rebuild)
index.html  ← faixa .group-tabs entre o painel SCHEDULE e a grade + CSS
```

### Modelo de dados (localStorage)

- `rm.groups` → `[{ id, name, cities: [tz…], reference: tz|null }]`
- `rm.activeGroup` → id do grupo ativo
- `rm.settings` (colorHint, hour12) → **global**, inalterado

IDs de grupo gerados via `crypto.randomUUID()` (com fallback simples), para não colidirem ao renomear.

### Migração (1ª carga após o update)

Se `rm.groups` não existir: criar um grupo padrão `"Geral"` com `cities` = `rm.cities` antigas (ou `[]`) e `reference` = `rm.reference` antiga (ou `null`); definir `activeGroup` para esse grupo. Usuários novos (sem `rm.cities`) caem na semeadura de primeira visita já existente (zona local + fixas), dentro do grupo "Geral".

## Funcionalidades

1. **Abas de grupo** — faixa acima da grade, no tema do placar (Oswald, âmbar). A aba ativa recebe sublinhado luminoso. Estouro de abas → rolagem horizontal.
2. **Trocar de grupo** — clicar numa aba re-renderiza a grade com as cidades, ordem e referência daquele grupo (a barra/slider passa a seguir a referência do grupo ativo). O grupo ativo é persistido.
3. **Criar grupo** — aba **"＋"** cria um grupo novo (nome padrão "Grupo N"), torna-o ativo e entra em modo de renomear.
4. **Renomear** — **duplo-clique** na aba abre edição inline; Enter/blur confirma; vazio/só-espaços mantém o nome anterior. Nomes duplicados são permitidos.
5. **Apagar** — **✕** na aba **ativa** (visível no hover) pede confirmação e remove o grupo (descarta a lista dele). Desabilitado quando só resta um grupo.
6. **Escopo** — adicionar/buscar/remover/reordenar cidades e definir referência operam sobre o **grupo ativo** (via store).

## Fluxo de dados

1. Ao abrir: `store` migra (se preciso), carrega grupos + grupo ativo + settings.
2. `app.js` desenha as abas (`renderTabs`) e o quadro (`renderBoard`) do grupo ativo.
3. Trocar de aba → `store.setActiveGroup(id)` → rebuild do quadro + re-render das abas.
4. Criar/renomear/apagar → atualizam `store` → re-render.
5. Operações de cidade/referência/reorder seguem como hoje, agora escopadas ao grupo ativo pelo `store`.

## Casos de borda e tratamento de erros

- **Apagar com confirmação;** não é possível apagar o último grupo (✕ desabilitado quando `groups.length === 1`). Ao apagar o grupo **ativo**, o **primeiro grupo restante** passa a ser o ativo.
- **Grupo vazio:** estado vazio + busca; referência cai no fuso local até haver cidade.
- **Renomear vazio:** mantém o nome anterior.
- **Referência do grupo inválida/removida:** cai no fuso local com segurança (proteção atual via `isValidZone`/`clearReference`).
- **`activeGroup` inexistente** (ex.: grupo apagado/estado corrompido): cai no primeiro grupo da lista.
- **Fusos inválidos persistidos:** poda na carga, por grupo (mantém a autocorreção atual).

## Testes

No `store` (com `fakeStorage` injetável, sem framework):
- **Migração:** `rm.cities`/`rm.reference` antigos + sem `rm.groups` → cria grupo "Geral" com essas cidades/referência e o ativa.
- **Escopo do grupo ativo:** `addCity`/`getCities`/`setCities`/`setReference` afetam só o grupo ativo; trocar de grupo expõe outra lista/referência.
- **Gestão:** `addGroup` retorna id e o ativa; `renameGroup` altera o nome; `removeGroup` remove e mantém um `activeGroup` válido; não remove o último grupo.

UI (abas, troca, renomear inline, criar, apagar com confirmação) verificada no navegador via Chrome DevTools, como nas features anteriores.

## Fora de escopo (YAGNI)

- Reordenar as próprias abas/grupos (grupos seguem ordem de criação).
- Ícones/cores por grupo.
- Mover cidade de um grupo para outro por arrastar (adiciona-se em cada grupo separadamente).
- Sincronização entre dispositivos.
