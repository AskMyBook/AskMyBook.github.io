#!/usr/bin/env bash
# فحص سريع لطبقة الصوت بعد ما تشغّل السيرفر:  bash server/smoke-tts.sh http://localhost:8787
B="${1:-http://localhost:8787}"; set -u; ok=0; bad=0
t() { if eval "$2"; then echo "✅ $1"; ok=$((ok+1)); else echo "❌ $1"; bad=$((bad+1)); fi; }
t "voices listed"            '[ "$(curl -s "$B/api/tts/voices" | grep -c "\"voices\"")" = 1 ]'
t "Arabic → audio"           '[ "$(curl -s -o /tmp/tts-ar -w "%{http_code} %{content_type}" -X POST "$B/api/tts" -H "content-type: application/json" -d "{\"text\":\"الخلية هي وحدة بناء الكائن الحي.\",\"lang\":\"ar\"}" | cut -c1-9)" = "200 audio" ]'
t "English → audio"          '[ "$(curl -s -o /tmp/tts-en -w "%{http_code} %{content_type}" -X POST "$B/api/tts" -H "content-type: application/json" -d "{\"text\":\"The cell membrane protects the cell.\",\"lang\":\"en\"}" | cut -c1-9)" = "200 audio" ]'
t "empty text → 400"         '[ "$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/tts" -H "content-type: application/json" -d "{\"text\":\"\"}")" = 400 ]'
t "too long → 413"           '[ "$(python3 -c "import json;print(json.dumps({\"text\":\"ا\"*5000}))" | curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/tts" -H "content-type: application/json" --data @-)" = 413 ]'
echo "audio files: /tmp/tts-ar /tmp/tts-en (شغّلهم واسمع)"; echo "$ok passed, $bad failed"; [ $bad = 0 ]
