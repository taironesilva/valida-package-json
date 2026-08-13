# Cenários de Teste — Validação de package.json

Este documento lista cenários de teste para apresentar a equipe sobre a implementação em [validate.ts](validate.ts) que valida a versão principal e as versões de dependências presentes em [package.json](package.json).

**Resumo das regras**
- **Branch `main` ou `release/*`:** exigem versão principal estrita no formato `x.y.z` (sem pre-release).
- **Outras branches:** aceitam versão principal aberta no formato `x.y.z-<tag>` (ex.: `1.2.3-rc.1`).
- **Dependências:** aceitas apenas versões no formato `x.y.z` ou com prefixo `^` ou `>=` (ex.: `^1.2.3`, `>=1.2.3`).

**Critérios de aceitação (geral)**
- **Sucesso:** a ação não falha (não chama `core.setFailed`) e a saída `is-version-valid` é `true`.
- **Falha:** a ação chama `core.setFailed` com motivo e `is-version-valid` é `false`.

## Matriz de Cenários Principais

- **ID:** B1
  - **Objetivo:** Verificar versão fechada em `main`.
  - **Entrada:** Branch `refs/heads/main`; `package.json` com `"version": "1.2.3"`.
  - **Passos:** Executar a action com workspace contendo o `package.json`.
  - **Resultado esperado:** `is-version-valid=true`, log indica versão válida.
  - **Prioridade:** Alta

- **ID:** B2
  - **Objetivo:** Rejeitar versão com pre-release em `main`.
  - **Entrada:** Branch `refs/heads/main`; `package.json` com `"version": "1.2.3-rc.1"`.
  - **Resultado esperado:** Falha; mensagem explicando que `main` exige `x.y.z`.
  - **Prioridade:** Alta

- **ID:** B3
  - **Objetivo:** Aceitar versão com pre-release em feature branch.
  - **Entrada:** Branch `refs/heads/feature/xyz`; `package.json` com `"version": "2.0.0-beta.1"`.
  - **Resultado esperado:** `is-version-valid=true` (desde que dependências válidas).
  - **Prioridade:** Alta

- **ID:** B4
  - **Objetivo:** Rejeitar versão principal com formato inválido (ex.: `1.2`).
  - **Entrada:** Branch `refs/heads/feature/foo`; `"version": "1.2"`.
  - **Resultado esperado:** Falha; mensagem de formato inválido.
  - **Prioridade:** Média

## Validação de Dependências

- **ID:** D1
  - **Objetivo:** Aceitar dependência com `^1.2.3`.
  - **Entrada:** `dependencies: { "lib": "^1.2.3" }`.
  - **Resultado esperado:** Dependência marcada como válida no log.
  - **Prioridade:** Alta

- **ID:** D2
  - **Objetivo:** Aceitar dependência com `>=1.2.3`.
  - **Entrada:** `dependencies: { "lib": ">=1.2.3" }`.
  - **Resultado esperado:** Dependência válida.
  - **Prioridade:** Média

- **ID:** D3
  - **Objetivo:** Rejeitar dependência com formato `~1.2.3`.
  - **Entrada:** `dependencies: { "lib": "~1.2.3" }`.
  - **Resultado esperado:** Falha; relatório lista `Dependências inválidas`.
  - **Prioridade:** Alta

- **ID:** D4
  - **Objetivo:** Rejeitar dependência com valor não semver (`latest`, `file:`, `git+ssh:`).
  - **Entrada:** `dependencies: { "lib": "latest" }`.
  - **Resultado esperado:** Falha; dependência inválida listada.
  - **Prioridade:** Alta

## Erros e Casos Limite

- **ID:** E1
  - **Objetivo:** Falhar quando `package.json` não existe.
  - **Entrada:** Workspace sem `package.json`.
  - **Resultado esperado:** Error lançado com mensagem `package.json não encontrado` e action falha.
  - **Prioridade:** Alta

- **ID:** E2
  - **Objetivo:** Falhar com JSON inválido.
  - **Entrada:** `package.json` com conteúdo inválido (JSON malformado).
  - **Resultado esperado:** Error capturado e action falha com mensagem de parse.
  - **Prioridade:** Alta

- **ID:** E3
  - **Objetivo:** Falhar quando `version` não está presente.
  - **Entrada:** `package.json` sem campo `version`.
  - **Resultado esperado:** Tratar como formato inválido; action falha explicando formato.
  - **Prioridade:** Média

## Testes de Integração / Fluxo

- **ID:** I1
  - **Objetivo:** Teste end-to-end em evento `pull_request` usando `payload.pull_request.head.ref`.
  - **Entrada:** Simular evento `pull_request` onde `github.context.payload.pull_request.head.ref` é `feature/foo` e `package.json` com `1.0.0-rc.1`.
  - **Resultado esperado:** Comportamento idêntico ao branch direta — aceita pre-release para feature.
  - **Prioridade:** Média

## Como Executar Manualmente (demonstração rápida)
1. Preparar um diretório com `package.json` de exemplo.
2. Executar a action/JS diretamente (ou via um runner local que carregue `GITHUB_WORKSPACE`):

```bash
# exemplo simples (Node.js) — adaptar conforme ambiente
GITHUB_WORKSPACE=$(pwd) node -e "require('./validate').run()"
```

Observação: em execuções reais dentro do GitHub Actions, o `github.context.ref` e `payload` são populados automaticamente.

## Notas para a apresentação
- Demonstre 3 cenários ao vivo: B1 (sucesso em main), B2 (falha em main com pre-release) e D3 (dependência com `~` invalida).
- Mostre os logs produzidos por `core.info` para evidenciar a lista `Versões encontradas`.
- Aponte a saída `is-version-valid` e `is-version-closed` como indicadores de integração para outros jobs.

---
Arquivo de referência: [validate.ts](validate.ts)
