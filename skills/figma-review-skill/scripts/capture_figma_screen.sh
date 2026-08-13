#!/bin/zsh
set -euo pipefail

usage() {
  print "Usage: capture_figma_screen.sh --chat-name NAME --purpose NAME [--source IMAGE_PATH] [--root DIRECTORY]"
  print "Appends a Figma capture plus a JSON sidecar to a task-named folder."
}

chat_name=""
purpose=""
capture_root="${HOME}/Documents/Codex/Figma Review Skill Captures"
source_path=""

while (( $# > 0 )); do
  case "$1" in
    --chat-name) chat_name="$2"; shift 2 ;;
    --purpose) purpose="$2"; shift 2 ;;
    --source) source_path="$2"; shift 2 ;;
    --root) capture_root="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) print -u2 "Unknown option: $1"; usage; exit 2 ;;
  esac
done

if [[ -z "$chat_name" || -z "$purpose" ]]; then
  print -u2 "Both --chat-name and --purpose are required."
  usage
  exit 2
fi

safe_name() {
  print -r -- "$1" | tr '/:' '--' | tr -cs '[:alnum:]._- ' '-' | sed 's/^[- ]*//; s/[- ]*$//; s/  */-/g'
}

safe_chat="$(safe_name "$chat_name")"
safe_purpose="$(safe_name "$purpose")"
folder="${capture_root}/${safe_chat}"
stamp="$(date '+%Y-%m-%d_%H-%M-%S')"
extension="png"
capture_mode="current-display"

if [[ -n "$source_path" ]]; then
  if [[ ! -f "$source_path" ]]; then
    print -u2 "Source image does not exist: $source_path"
    exit 2
  fi
  extension="${source_path##*.}"
  capture_mode="computer-use-app-screenshot"
fi

image_path="${folder}/${stamp}__${safe_purpose}.${extension}"
metadata_path="${folder}/${stamp}__${safe_purpose}.json"

mkdir -p "$folder"

if [[ -n "$source_path" ]]; then
  cp "$source_path" "$image_path"
else
  screencapture -x "$image_path"
fi

printf '{\n  "chat_name": "%s",\n  "purpose": "%s",\n  "capture_file": "%s",\n  "captured_at_local": "%s",\n  "capture_mode": "%s",\n  "retention": "append-only; no existing capture was moved, renamed, archived, or deleted"\n}\n' \
  "${chat_name//\"/\\\"}" \
  "${purpose//\"/\\\"}" \
  "$(basename "$image_path")" \
  "$stamp" \
  "$capture_mode" > "$metadata_path"

print "$image_path"
