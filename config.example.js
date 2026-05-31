// Kopiere diese Datei nach config.js und trage deine Supabase-Daten ein.
// Supabase → Project Settings → API → Project URL + anon public key
//
// WICHTIG: Nur den "anon public" Key (beginnt mit eyJ...) verwenden.
// NIEMALS den "service_role" oder "secret" Key in die Website packen.

window.SUPABASE_CONFIG = {
  url: "https://DEIN-PROJEKT.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
};

// Verkäufer-Login: Supabase Auth (E-Mail + Passwort in Dashboard anlegen)
// Anleitung: supabase/SELLER-AUTH.md
