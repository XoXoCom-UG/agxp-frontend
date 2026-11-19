# Dashboardul de metrici (`/metrics`)

Pentru sef si marketing: conturi, cine e activ, proiecte, documente terminate, tipurile de consultant alese, cost. **Doar totaluri**, nimic despre un client anume.

## Cum e protejat (5 straturi)

| # | Strat | Unde |
|---|---|---|
| 1 | **Cloudflare Access** in fata `/metrics` si `/api/metrics`: doar 3 emailuri ajung macar la pagina | Cloudflare (pasul 5 de mai jos) |
| 2 | **Login AgentiX + 2FA obligatoriu** (cod din aplicatie de autentificare); baza cere token `aal2` | `metrics_mfa_ok()`, [0033](supabase/migrations/0033_metrics_dashboard.sql) |
| 3 | **Drept separat** `agxp_metrics_viewers` + adresa confirmata `@xoxocom.net` (ambele). Nu da drept de schimbat planuri | `is_metrics_viewer()` |
| 4 | **Fara cheie secreta**: ruta citeste cu tokenul celui logat, nu cu service role | [app/api/metrics/route.ts](app/api/metrics/route.ts) |
| 5 | **Doar totaluri**, grupuri sub 5 ascunse, **jurnal** cu fiecare accesare (si refuzurile), limita pe retea, `no-store` + `noindex`, se ascunde dupa 15 min fara activitate | `metrics_overview()`, `agxp_metrics_access_log` |

## Pornire

1. **Ruleaza migrarea** in Supabase → SQL editor: tot fisierul `supabase/migrations/0033_metrics_dashboard.sql`.
2. **2FA activ in Supabase**: Authentication → Multi-Factor (sau Sign In / Providers → MFA) → TOTP *Enabled*. E pornit implicit; verifica doar.
3. **Da acces** (seful si marketingul trebuie sa aiba deja cont AgentiX pe adresa `@xoxocom.net`, confirmata):

   ```sql
   insert into agxp_metrics_viewers (user_id, note)
   select id, 'Tudor' from auth.users where lower(email) = 'tudor@xoxocom.net';
   -- la fel pentru sef si marketing, cu adresele lor
   ```

   Verifica: `select u.email, v.note, is_metrics_viewer(v.user_id) from agxp_metrics_viewers v join auth.users u on u.id = v.user_id;`
   (`false` = adresa nu e confirmata sau nu e pe domeniu.)

4. **Local**: `npm run dev` → <http://localhost:3000/metrics>. Prima data apare un cod QR: il scanezi cu Google Authenticator / Microsoft Authenticator / 1Password, scrii cele 6 cifre. Data viitoare cere doar codul.

5. **Cand urca pe site — Cloudflare Access** (gratuit pana la 50 de oameni; domeniul trebuie sa treaca prin Cloudflare, cu norisorul portocaliu):
   - Cloudflare → Zero Trust → Access → Applications → *Add an application* → **Self-hosted**.
   - Domeniu: domeniul site-ului, path **`metrics`**. Adauga si un al doilea destination pe acelasi domeniu, path **`api/metrics`**.
   - Policy: *Allow*, Include → *Emails* → cele 3 adrese. Session duration: 8h.
   - Login method: *One-time PIN* (cod pe email) e suficient.
   - Testeaza dintr-o fereastra privata: trebuie sa ceara intai codul Cloudflare, apoi login AgentiX, apoi 2FA.

## Cum iei accesul cuiva

```sql
delete from agxp_metrics_viewers where user_id = (select id from auth.users where lower(email) = '...');
```

Si scoate adresa din policy-ul Cloudflare. Factorul 2FA al contului ramane (nu deranjeaza restul aplicatiei).

## Cine s-a uitat

Pe pagina, jos: *Who looked*. Sau in SQL editor:

```sql
select l.at, u.email, l.what, l.outcome
  from agxp_metrics_access_log l left join auth.users u on u.id = l.user_id
 order by l.at desc limit 100;
```

## Ce nu e inca

- **Trafic pe site** (vizite, de unde vin): asta nu e in baza. Pasul urmator: Umami gazduit la noi, fara cookie-uri, apoi adaugat in CSP (`next.config.ts`).
- **De unde vin conturile** (campanii, UTM): necesita salvarea sursei la inscriere.
- Textele paginii sunt in engleza; nu sunt inca in comutatorul DE/EN.
