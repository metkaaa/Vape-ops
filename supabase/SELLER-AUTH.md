# Verkäufer-Login (Backend / Supabase Auth)

Das Passwort liegt **nicht mehr im Website-Code**. Die Anmeldung läuft über **Supabase Auth** (Server).

## 1. Auth in Supabase aktivieren

1. Supabase Dashboard → **Authentication** → **Providers**
2. **Email** einschalten
3. Unter **Settings**: für Tests optional **„Confirm email“** ausschalten (sonst muss jede E-Mail bestätigt werden)

## 2. Verkäufer-Benutzer anlegen

**Authentication** → **Users** → **Add user** → **Create new user**

| Feld | Beispiel |
|------|----------|
| Email | `verkauf@dein-shop.de` |
| Password | z. B. `VOPS2626` (oder ein starkes Passwort) |

Du kannst **einen** Account für beide (Aron & Mehmet wählen danach nur noch das Profil) oder **zwei** Accounts anlegen.

## 3. RLS für Verkäufer-Aktionen (SQL)

Im **SQL Editor** ausführen: `fix-seller-auth-rls.sql`

Damit dürfen nur **eingeloggte** Verkäufer Verkäufe buchen und Bestellungen erledigen. Kunden können weiter Bestellungen **ohne** Login absenden.

## 4. Auf der Website einloggen

1. **Verkäufer-Login**
2. E-Mail + Passwort (aus Schritt 2)
3. Profil **Aron** oder **Mehmet** wählen

Session bleibt gespeichert, bis **Abmelden** gedrückt wird.

## Hinweis

- **Anon Key** in `config.js` bleibt öffentlich — das ist normal.
- Das **Passwort** steht nur in Supabase, nicht in GitHub/Render.
- Für mehr Sicherheit später: starke Passwörter, E-Mail-Bestätigung an, getrennte User für Aron/Mehmet.
