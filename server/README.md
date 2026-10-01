# Study Tutor — secure AI server (optional)

A small stateless proxy so the site can use strong models, embeddings and natural voices **without any API key in the frontend**. It never stores documents, chats or audio. Each user's PDFs, index and embeddings stay in their own browser (IndexedDB); a request only carries the few passages that user's browser selected.

## Endpoints
| Route | Purpose |
|---|---|
| `GET /v1/health` | capabilities (no secrets) |
| `POST /v1/chat` | streaming chat → SSE `data: {"t":"..."}` (Anthropic / Gemini / any OpenAI-compatible) |
| `POST /v1/embed` | embeddings for semantic search (Gemini `gemini-embedding-001` or OpenAI `text-embedding-3-small`, 768-d) |
| `POST /api/tts` | text → speech (audio stream). Independent TTS layer in `tts.js` — **no Gemini**. `/v1/tts` is a legacy alias |
| `GET /api/tts/voices` | configured TTS engines, their capabilities and voices (no secrets) |
| `POST /v1/stt?lang=ar-EG` | speech-to-text for browsers without Web Speech (any OpenAI-compatible Whisper endpoint, e.g. Groq) |

Guards: origin allowlist (`ALLOWED_ORIGINS`, same-origin always allowed), per-IP rate limits, request size caps, XML-escaped SSML, upstream errors trimmed.

## Admin panel + provider fallback (no terminal needed)
The chat route tries providers in order and moves to the next one when a provider is out of quota (429), rejects the key, errors, or returns an empty reply — all before the first word reaches the student. A provider that hit its limit rests until its limit resets, so later requests don't waste a call on it. Default order (free first): `gemini → groq → openrouter → cloudflare (Workers AI, keyless) → anthropic → openai`. If every provider is exhausted the site falls back to its in-browser free services.

`/admin` on the worker is a password-protected panel to paste keys, reorder/disable providers, change models, test each provider, set the allowed site origin, daily per-student quotas and the teacher persona. Keys are stored in a KV namespace bound as `CONFIG` (inside your Cloudflare account) and are never sent to the site — the panel only shows the last 4 characters. A key set as a Cloudflare Secret also works; one saved in the panel wins.

Dashboard-only deploy: Workers & Pages → Create → Worker (Hello World) → name `study-tutor` → Deploy → Edit code → replace everything with `server/worker-bundle.js` → Deploy. Then Settings → Bindings → Add → **KV namespace** (create one, variable name `CONFIG`) and **Workers AI** (variable name `AI`). Open `https://study-tutor.<you>.workers.dev/admin`, choose a password, paste keys, set your site origin, save.

## Deploy on Cloudflare Workers (free tier)
```bash
cd server
# edit wrangler.toml → ALLOWED_ORIGINS = "https://<you>.github.io"
npx wrangler secret put ANTHROPIC_API_KEY     # or GEMINI_API_KEY / OPENAI_API_KEY
npx wrangler secret put AZURE_SPEECH_KEY      # optional: Egyptian Neural voices (or point PIPER_URL / TTS_OAI_URL at your own TTS server)
npx wrangler secret put GEMINI_API_KEY        # optional: embeddings
npx wrangler deploy
```
Then set `proxyUrl` in `../config.js` to the worker URL.

## Or run with Node 18+ (serves the site too)
```bash
cp server/.env.example server/.env   # fill in keys
node server/node.mjs                 # http://localhost:8787
```
Set `proxyUrl: "/"` in `config.js`. `.env` and the `server/` folder are never served.

## Provider selection
Auto-detected from which keys exist; override with `LLM_PROVIDER`, `EMBED_PROVIDER`, `TTS_PROVIDER`. Models are env-configurable (`ANTHROPIC_MODEL`, `GEMINI_MODEL`, `OPENAI_MODEL`, `OPENAI_TTS_MODEL`, `ELEVENLABS_MODEL`, `STT_MODEL`). See `.env.example`.

## Text-to-speech (TTS) layer
The AI teacher only generates text. Speech is a separate layer that never calls Gemini:

```
AI Teacher (chat)  ──text──►  browser player (voice.js)  ──►  client TTS layer (tts.js)
                                                               ├─ server   → POST /api/tts ─► server/tts.js adapters
                                                               ├─ local    → Piper in the browser (Web Worker, no key)
                                                               └─ browser  → SpeechSynthesis (fallback only)
```

### API
`POST /api/tts` with JSON:

| field | type | notes |
|---|---|---|
| `text` | string, required | max `MAX_TTS_CHARS` (default 1500) → `413` if longer. The site sends one or two sentences per request |
| `lang` | `"ar"` \| `"en"` | optional, detected from the text |
| `voice` | string | optional voice id from `/api/tts/voices`; the engine that owns it is tried first |
| `pitch` | 0.5–1.5 | used by engines with `caps.pitch` (Azure) |
| `rate` | 0.5–2 | the site keeps `1` and changes speed on the player |

Response: the audio stream (`audio/wav` or `audio/mpeg`) with `x-tts-provider` / `x-tts-voice` headers. Errors are JSON `{ "error": "..." }`: `400` (no text / bad JSON), `413` (too long), `429` (provider limit), `502` (all engines failed), `503` (no engine configured), `403` (origin not allowed). If an engine fails, the next configured engine is tried in the same request.

```bash
curl -X POST http://localhost:8787/api/tts -H 'content-type: application/json' \
  -d '{"text":"الخلية هي وحدة بناء الكائن الحي.","lang":"ar"}' -o test.wav
curl http://localhost:8787/api/tts/voices
```

### Engines (adapters in `tts.js`)
Order = `TTS_PROVIDER` (comma list, e.g. `piper,azure`), otherwise auto: `piper → openai_compatible → azure → elevenlabs → openai`.

| id | env | self-hosted | notes |
|---|---|---|---|
| `piper` | `PIPER_URL`, `PIPER_VOICES` | ✅ | fast on CPU, Arabic (`ar_JO-kareem-medium`, automatic diacritization on the server) + English. No pitch. Tested against piper-tts 1.8 API (`POST /synthesize`) |
| `openai_compatible` | `TTS_OAI_URL`, `TTS_OAI_KEY`, `TTS_OAI_MODEL`, `TTS_OAI_VOICES` | ✅ | any server exposing `POST /v1/audio/speech` (Kokoro-FastAPI, openedai-speech, Chatterbox/XTTS servers…). Use this for your own cloned voice |
| `azure` | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_VOICES` | ❌ | Egyptian Neural voices (Shakir/Salma), SSML pitch + mixed Arabic/English |
| `elevenlabs` | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICES` | ❌ | very natural, supports cloned voices |
| `openai` | `OPENAI_API_KEY`, `OPENAI_TTS_VOICES` | ❌ | set `OPENAI_TTS_DISABLED=true` if that key is only for chat |

Voice lists are JSON arrays: `[{"id":"ar_JO-kareem-medium","name":"كريم","lang":"ar","gender":"m","default":true}, …]`. They appear automatically in the site's voice settings.

### Run Piper yourself (recommended open-source engine)
```bash
python3 -m venv piper && . piper/bin/activate
pip install "piper-tts[http]"
python3 -m piper.download_voices ar_JO-kareem-medium en_US-ryan-medium
python3 -m piper.http_server -m ar_JO-kareem-medium --port 5000   # both voices sit in the same folder; "voice" picks one per request
curl -X POST localhost:5000/synthesize -H 'content-type: application/json' -d '{"text":"مرحبا"}' -o t.wav   # check it answers
```
Then in `server/.env`: `PIPER_URL=http://127.0.0.1:5000` and `TTS_PROVIDER=piper`. Put Piper and `node server/node.mjs` on the same machine (any small VPS; no GPU needed).

### Your own voice (later)
Record clean audio of **your own** voice (or a voice you have written permission to use), host a cloning-capable TTS server with an OpenAI-compatible API, register the voice there, then add it to `TTS_OAI_VOICES` (e.g. `{"id":"my-voice","name":"صوتي","lang":"ar","gender":"m","default":true}`). Check each model's license before commercial use (for example, Coqui XTTS-v2 weights are non-commercial).

### Add a new engine
Server: add an adapter `{ id, label, caps, configured(env), voices(env), owns(id, env), synth(env, q) → Response }` to `PROVIDERS` in `tts.js`. Client (optional, for an engine that runs in the browser): `TTS.register({ id, label, kind: "audio", available, caps, voices, synth })` in `tts.js`. Nothing else in the site changes.
