#!/usr/bin/env bash
# Sirve el repo entero para que el deck y el mock de Vinted compartan origen.
# Uso: ./deck/start.sh  (o PORT=8081 ./deck/start.sh)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8080}"
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  for p in $(seq 8081 8099); do
    if ! ss -ltn 2>/dev/null | grep -q ":${p} "; then
      PORT="$p"
      break
    fi
  done
fi
echo ""
echo "  outfit check — deck"
echo "  Deck:  http://localhost:${PORT}/deck/"
echo "  Demo:  http://localhost:${PORT}/demo/vinted-mock/"
echo ""
echo "  Ctrl+C para parar."
echo ""
python3 -m http.server "$PORT"
