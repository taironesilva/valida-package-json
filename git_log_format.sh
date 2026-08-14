#!/usr/bin/env bash
set -euo pipefail

# Cores ANSI para saída colorida (macOS Terminal / iTerm)
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
RESET=$'\033[0m'

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

convert_date_input() {
  local input="$1"
  IFS='/' read -r dd mm yy <<< "$input"
  if [ -z "$dd" ] || [ -z "$mm" ] || [ -z "$yy" ]; then
    return 1
  fi
  # aceitar apenas ano em 2 dígitos (AA)
  if [ ${#yy} -ne 2 ]; then
    return 1
  fi
  yy="20$yy"
  # validar números
  if ! [[ $yy =~ ^[0-9]{4}$ && $mm =~ ^[0-9]{1,2}$ && $dd =~ ^[0-9]{1,2}$ ]]; then
    return 1
  fi
  # convert to numbers forcing base 10 to avoid octal interpretation (e.g. 08)
  ddn=$((10#$dd))
  mmn=$((10#$mm))
  yyn=$((10#$yy))
  printf "%04d-%02d-%02d" "$yyn" "$mmn" "$ddn"
  return 0
}

# macOS-only helpers (uses BSD date syntax)
# verify running on macOS (requires date supporting -j -f -v)
if ! date -j >/dev/null 2>&1; then
  echo "Este script exige macOS (BSD date). Execute no macOS ou ajuste o script." >&2
  exit 1
fi

valid_iso_date() {
  local d="$1"
  # quick format check
  if ! [[ $d =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    return 1
  fi
  LC_ALL=C date -j -f "%Y-%m-%d" "$d" >/dev/null 2>&1
}

to_epoch() {
  local d="$1"
  LC_ALL=C date -j -f "%Y-%m-%d" "$d" +%s
}

last_day_of_month() {
  local start="$1"
  # start must be YYYY-MM-DD
  if ! [[ $start =~ ^([0-9]{4})-([0-9]{2})-([0-9]{2})$ ]]; then
    return 1
  fi
  local year=${BASH_REMATCH[1]}
  local month=${BASH_REMATCH[2]}
  # force numeric
  year=$((10#$year))
  month=$((10#$month))
  local day
  case $month in
    1|3|5|7|8|10|12) day=31 ;;
    4|6|9|11) day=30 ;;
    2)
      if (( (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) )); then
        day=29
      else
        day=28
      fi
      ;;
    *) return 1 ;;
  esac
  printf "%04d-%02d-%02d" "$year" "$month" "$day"
}

# solicitar nome do repo até o usuário fornecer um diretório válido
while true; do
  read -r -p "Nome do projeto (diretório do repo): " repo
  if [ -d "$repo" ]; then
    break
  fi
  echo "Diretório '$repo' não encontrado. Tente novamente."
done

# escolher período: repetir até opção válida e datas válidas
while true; do
  echo "Escolha uma opção para o período a consultar:"
  echo " 1) Mês atual"
  echo " 2) Data personalizada (digite no formato DD/MM/AA)"
  read -r -p "Opção (1 ou 2): " opt

  if [ "$opt" = "1" ]; then
    # mês atual: desde o dia 1 até o último dia do mês
    since=$(date +%Y-%m-01)
    until=$(last_day_of_month "$since")
    echo "Usando mês atual: $since .. $until"
    break
  elif [ "$opt" = "2" ]; then
    # loop de datas personalizadas até ambas válidas e since<=until
    while true; do
      read -r -p "Data inicial (DD/MM/AA): " since_in
      read -r -p "Data final   (DD/MM/AA): " until_in
      since_conv=$(convert_date_input "$since_in") || { echo "Data inicial inválida — use o formato DD/MM/AA"; continue; }
      until_conv=$(convert_date_input "$until_in") || { echo "Data final inválida — use o formato DD/MM/AA"; continue; }
      # validate with date (GNU or BSD)
      if ! valid_iso_date "$since_conv"; then echo "Data inicial inválida — use o formato DD/MM/AA"; continue; fi
      if ! valid_iso_date "$until_conv"; then echo "Data final inválida — use o formato DD/MM/AA"; continue; fi
      since_ts=$(to_epoch "$since_conv") || { echo "Data inicial inválida"; continue; }
      until_ts=$(to_epoch "$until_conv") || { echo "Data final inválida"; continue; }
      if [ "$since_ts" -gt "$until_ts" ]; then
        echo "Período inválido: a data inicial é posterior à data final. Digite novamente as datas."
        continue
      fi
      since="$since_conv"
      until="$until_conv"
      echo "Usando período personalizado: $since .. $until"
      break
    done
    break
  else
    echo "Opção inválida. Digite 1 ou 2."
  fi
done



if [ ! -d "$repo" ]; then
  echo "Erro: diretório '$repo' não encontrado." >&2
  exit 1
fi

cd "$repo" || exit 1
full_repo=$(git rev-parse --show-toplevel)
repo_name=$(basename "$full_repo")

echo "Executando: git log --since=\"$since\" --until=\"$until\" --name-status --pretty=format:'---%n%H|%ad|%s' --date=short"

# validar que since <= until (usar GNU/BSD date)
since_ts=$(to_epoch "$since") || { echo "Data inicial inválida" >&2; exit 1; }
until_ts=$(to_epoch "$until") || { echo "Data final inválida" >&2; exit 1; }
if [ "$since_ts" -gt "$until_ts" ]; then
  echo "Período inválido: a data inicial é posterior à data final." >&2
  exit 1
fi

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

  # agrupar por tipo: A -> criação, M -> modificação
  if [ "$status" = "A" ]; then
    created+=("$repo_name/$file#$short|$msg")
  elif [ "$status" = "M" ]; then
    modified+=("$repo_name/$file#$short|$msg")
  fi
done

# Imprimir seções separadas
echo
printf "%b\n" "${GREEN}Criação de scripts - 5.10.5:${RESET}"
if [ ${#created[@]:-0} -eq 0 ]; then
  echo "(nenhum)"
else
  for e in "${created[@]}"; do
    echo "$e"
  done
fi

echo
printf "%b\n" "${BLUE}Modificação de scripts - 5.10.6:${RESET}"
if [ ${#modified[@]:-0} -eq 0 ]; then
  echo "(nenhum)"
else
  for e in "${modified[@]}"; do
    echo "$e"
  done
fi

exit 0
