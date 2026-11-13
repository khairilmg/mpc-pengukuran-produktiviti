#!/usr/bin/env bash
# Bina public/index.html (frontend) dan functions/_lib/calc.js (logik pengiraan untuk pelayan)
set -e
cd "$(dirname "$0")"
cat src/p1.html src/p2.js src/p4.js src/api.js src/p3.js > public/index.html
{
  echo "// DIJANA OLEH build.sh daripada src/p2.js + src/p4.js — jangan edit terus"
  sed -e '/^<\/\?script>$/d' src/p2.js src/p4.js
  echo 'const PHYS_KEYS = new Set([...PHYS.map(d => d.k), ...PCUST]);'
  echo 'export { computeAll, summaryStatus, FIELDS, PHYS_KEYS };'
} > functions/_lib/calc.js
echo "Siap: public/index.html ($(wc -c < public/index.html) bait), functions/_lib/calc.js"
