# BI Agent Frontend (Next.js + Vercel)

Frontend React complet pentru BI Agent, conectat la backend-ul Modal.

## Setup rapid

### 1. Clonează / dezarhivează

```bash
cd bi_agent_frontend
npm install
```

### 2. Configurează variabilele de environment

Editează `.env.local`:

```env
# Modal API URL (backend-ul tău deployat)
NEXT_PUBLIC_API_URL=https://tudor-34926--bi-agent-v3-web.modal.run

# Supabase — aceleași credențiale ca în v3
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Găsești credențialele Supabase în: Supabase Dashboard → Project Settings → API.

### 3. Rulează local

```bash
npm run dev
```

Deschide http://localhost:3000

### 4. Deploy pe Vercel

```bash
# Instalează Vercel CLI dacă nu ai
npm i -g vercel

# Deploy
vercel

# La întrebări:
# - Set up and deploy? Yes
# - Which scope? (contul tău)
# - Link to existing project? No
# - Project name: bi-agent-frontend
# - In which directory? ./  (lasă default)
```

### 5. Adaugă env vars pe Vercel

În Vercel Dashboard → Project → Settings → Environment Variables:
- `NEXT_PUBLIC_API_URL` = URL-ul Modal
- `NEXT_PUBLIC_SUPABASE_URL` = URL-ul Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = cheia Supabase

### 6. Actualizează CORS în Modal

Când știi URL-ul Vercel (ex. `bi-agent-frontend.vercel.app`), adaugă-l în `src/api/routes.py`:

```python
allow_origins=[
    "http://localhost:3000",
    "https://bi-agent-frontend.vercel.app",  # <-- adaugă asta
    "https://*.vercel.app",
],
```

Apoi redeploy Modal: `python -m modal deploy app.py`

## Structura proiectului

```
app/
  page.tsx              # Redirect la /chat sau /login
  chat/page.tsx         # Pagina principală de chat
  dashboard/page.tsx    # Dashboard (Deck + Roadmap) — TODO
  (auth)/login/page.tsx # Login/Register cu Supabase

components/
  layout/
    sidebar.tsx         # Sidebar cu proiecte + conversații
    theme-provider.tsx  # Light/dark mode
  chat/
    message.tsx         # Mesaje cu markdown + choice chips
  concept/              # Transformation Concept panel — TODO

lib/
  api.ts                # Toate apelurile către Modal backend
  supabase.ts           # Client Supabase
  auth-context.tsx      # Auth state global
  chat-store.ts         # State management (Zustand)
  utils.ts              # Utilitare
```

## Ce e gata vs. ce urmează

### ✅ Gata
- Login / Register cu Supabase
- Sidebar cu proiecte + conversații (expandabile)
- Ecran de start cu alegere Chat/Projekt
- Chat complet cu choice chips și thinking indicator
- Light/dark mode
- Conectare la toate endpoint-urile Modal API

### 🚧 TODO (etapele următoare)
- Dashboard page (Deck + Roadmap)
- Transformation Concept panel (tabelul Ist/Ziel)
- Onboarding modal
- Mobile responsive polish
