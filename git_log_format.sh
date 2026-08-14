#!/usr/bin/env bash
set -euo pipefail

# Script para gerar saída formatada do git log
# Executar este script a partir do diretório que contém os repositórios
#
# Exemplo de uso:
#  ./git_log_format.sh
#  Nome do projeto (diretório do repo): meu-repo
#  Data inicial (ex: 2026-08-01): 2026-08-01
#  Data final (ex: 2026-08-31): 2026-08-31
#
# Exemplo de saída (uma linha por arquivo modificado):
#  valida-package-json/src/index.js#abcdef1234;5.10.6|Corrige bug no carregamento
#

read -r -p "Nome do projeto (diretório do repo): " repo
read -r -p "Data inicial (ex: 2026-08-01): " since
read -r -p "Data final (ex: 2026-08-31): " until

if [ ! -d "$repo" ]; then
  echo "Erro: diretório '$repo' não encontrado." >&2
  exit 1
fi

cd "$repo" || exit 1
full_repo=$(git rev-parse --show-toplevel)
repo_name=$(basename "$full_repo")

echo "Executando: git log --since=\"$since\" --until=\"$until\" --name-status --pretty=format:'---%n%H|%ad|%s' --date=short"

git log --since="$since" --until="$until" --name-status --pretty=format:'---%n%H|%ad|%s' --date=short | \
while IFS= read -r line; do
  if [ "$line" = "---" ]; then
    # cabeçalho do commit
    IFS= read -r header || break
    hash=${header%%|*}
    tmp=${header#*|}
    date=${tmp%%|*}
    msg=${tmp#*|}
    continue
  fi

  # pular linhas vazias
  [ -z "$line" ] && continue

  # name-status geralmente é: <STATUS><tab><file>
  status=${line%%$'\t'*}
  file=${line#*$'\t'}

  short=${hash:0:10}
  if [ "$status" = "M" ]; then
    ver="5.10.6"
  elif [ "$status" = "A" ]; then
    ver="5.10.5"
  else
    ver="$status"
  fi

  # saída requerida: Nome do repo (basename) + / + nome do arquivo + # + 10 primeiros do hash + ; + versão + | + mensagem do commit
  printf "%s/%s#%s;%s|%s\n" "$repo_name" "$file" "$short" "$ver" "$msg"
done

exit 0
