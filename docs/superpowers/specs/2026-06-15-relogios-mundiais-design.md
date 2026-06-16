# Relógios Mundiais — Documento de Design

**Data:** 2026-06-15
**Status:** Aprovado para planejamento

## Objetivo

Um programa leve e fácil de usar para verificar as horas em diferentes locais do mundo, com foco em ajudar a agendar reuniões entre fusos.

## Decisões principais

| Decisão | Escolha |
|---|---|
| Formato | App web (roda no navegador) |
| Arquitetura | Arquivo `index.html` único — HTML + CSS + JS embutidos |
| Dependências | Zero. Sem build, sem `npm`, sem framework |
| Cálculo de fusos | API `Intl` nativa do navegador (base IANA embutida) |
| Persistência | `localStorage` (sem back-end) |
| Layout dos relógios | Grade de cartões |
| Referência do comparador | Uma cidade favorita escolhida pelo usuário (padrão: fuso local) |
| Dica de cor | Ligada (verde = horário comercial, vermelho = madrugada) |

## Arquitetura

Um único arquivo `index.html`. Sem servidor e sem etapa de build: o "deploy" é copiar/hospedar o arquivo. Toda a lógica de fuso vem da API `Intl`; favoritos e preferências persistem no `localStorage`, por navegador.

```
index.html
 ├─ <style>  CSS embutido (tema claro; grade de cartões)
 └─ <script> módulos lógicos:
     ├─ store   ← localStorage (favoritos, referência, settings)
     ├─ tz      ← único ponto que toca Intl (formatação/offset/labels/lista)
     ├─ clock   ← loop ao vivo (setInterval 1s → re-render)
     └─ ui      ← desenha grade, busca, comparador; trata cliques
```

### Componentes (módulos JS dentro do arquivo)

- **`store`** — lê/grava estado no `localStorage`.
  Interface: `getCities()`, `addCity(tz)`, `removeCity(tz)`, `getReference()`, `setReference(tz)`, `getSettings()`, `setSettings(obj)`.
- **`tz`** — único módulo que usa `Intl`. Funções puras quando possível.
  Interface: `listAllZones()` (para busca), `formatTime(tz, date)`, `getOffsetLabel(tz, date)`, `getCityLabel(tz)`, `dayPart(tz, date)` → `'comercial' | 'madrugada' | 'outro'` (base da dica de cor). Faixas: comercial = 09:00–18:00; madrugada = 00:00–06:00; resto = outro.
- **`clock`** — `setInterval` de 1s que pede ao `ui` para re-renderizar com a hora atual, ou com a hora derivada do slider quando o comparador está ativo.
- **`ui`** — renderiza grade de cartões, barra de busca e comparador; reage a favoritar/desfavoritar, buscar e arrastar o slider.

Princípio: concentrar **todo** acesso ao `Intl` em `tz` mantém o resto simples e torna uma eventual troca de mecanismo de datas um ajuste em um único módulo.

## Funcionalidades

1. **Relógios ao vivo** — grade de cartões; cada cartão mostra cidade, hora (atualiza a cada 1s), data e offset (GMT±). Estrela para favoritar/desfavoritar. A data acompanha a hora para deixar clara a virada de dia entre fusos (ex.: Tóquio em "sex 16").

2. **Busca global** — campo que filtra todas as cidades/fusos disponíveis via `Intl.supportedValuesOf('timeZone')` (rótulos derivados do nome IANA: separar por `/`, trocar `_` por espaço). Clicar adiciona aos favoritos.

3. **Comparador (agendar reuniões)** — um slider **e** um campo de digitação de hora (`<input type="time">`), ambos controlando o mesmo horário de **referência** no fuso de uma cidade escolhida pelo usuário (padrão: fuso local detectado). Ao arrastar o slider ou digitar uma hora, todos os cartões mostram que horas seriam lá naquele momento, permitindo achar um horário que sirva para todos. O slider e o campo são sincronizados (mexer em um atualiza o outro). Como a referência pode ser qualquer favorita — inclusive o fuso local — digitar a hora cobre tanto "hora na cidade de referência" quanto "hora no meu fuso local". Botão "voltar para agora" desliga o modo comparação.

4. **Dica de cor** — cada cartão recebe cor sutil conforme `tz.dayPart`: verde para horário comercial (09:00–18:00), vermelho para madrugada (00:00–06:00), neutro para o resto. Ajuda a bater o olho ao agendar.

## Fluxo de dados

1. Ao abrir: `store` carrega favoritos, referência e settings do `localStorage`.
2. `clock` dispara a cada 1s.
3. `ui` pede ao `tz` a hora de cada cidade — a hora real, ou a hora derivada do slider se o comparador estiver ativo — e desenha a grade com a dica de cor.
4. Interações (buscar, favoritar, mover slider, definir referência) atualizam `store`/estado e disparam re-render.

## Casos de borda e tratamento de erros

- **Primeira visita (sem favoritos):** mostra cidades sugeridas + dica para buscar.
- **`localStorage` indisponível (modo privado):** app funciona na sessão; não persiste; aviso discreto.
- **Fuso salvo inexistente em versão futura do navegador:** ignorado com segurança.
- **Virada de dia entre fusos:** cada cartão exibe a data junto da hora.

## Testes

As funções de `tz` (`formatTime`, `getOffsetLabel`, `getCityLabel`, `dayPart`) são puras e testadas com datas fixas. Por ser arquivo único sem build, os testes podem viver em um `tests.html` simples ou em um pequeno script que exercita as funções de `tz` — sem framework pesado.

## Fora de escopo (YAGNI)

- Back-end, contas de usuário, sincronização entre dispositivos.
- Biblioteca de datas externa (a API `Intl` cobre o necessário).
- Notificações, alarmes, integração com calendário.
- Framework de front-end ou etapa de build.
