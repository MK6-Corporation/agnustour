#!/usr/bin/env bash
# Prepara um vídeo de destino para o site: sem som, 720p, H.264 (toca em iPhone/Android/PC), leve.
# Uso: tools/preparar-video.sh ORIGEM ID-DA-VIAGEM [INICIO_SEG] [DURACAO_SEG] [FILTRO_EXTRA]
#   ex.: tools/preparar-video.sh ~/Downloads/roma.mov terra-santa-roma 3 12
# IDs: mexico-cancun · terra-santa-roma · aparecida-pe-idlain · aparecida-pe-welinton
# Gera public/video/ID.mp4 e public/video/ID.jpg (capa). Depois: node build-static.js
set -euo pipefail
src="$1"; id="$2"; ss="${3:-0}"; dur="${4:-12}"; extra="${5:-}"
here="$(cd "$(dirname "$0")/.." && pwd)"
out="$here/public/video"
mkdir -p "$out"
vf="scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30"
[ -n "$extra" ] && vf="$extra,$vf"
ffmpeg -y -v error -ss "$ss" -t "$dur" -i "$src" -an -vf "$vf" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow -crf 27 -movflags +faststart \
  "$out/$id.mp4"
ffmpeg -y -v error -i "$out/$id.mp4" -frames:v 1 -q:v 4 "$out/$id.jpg"
echo "OK $out/$id.mp4 ($(du -h "$out/$id.mp4" | cut -f1))"
