# Benachrichtigung — Checkliste (Handy & Browser)

## Schritt 1: ntfy auf dem Handy

1. App **ntfy** installieren (Play Store / App Store)
2. **+** → **Subscribe to topic**
3. Exakt eingeben: `vape-shop-7282929174` (ohne https://)
4. iPhone/Android: **Einstellungen → ntfy → Benachrichtigungen erlauben**
5. In der App auf das Topic tippen → Testnachricht von uns abwarten

**Manueller Test (ohne Website):** Im Browser am PC öffnen:  
https://ntfy.sh/vape-shop-7282929174  
→ sollte sofort eine Meldung auf dem Handy erzeugen (GET sendet auch eine Nachricht).

---

## Schritt 2: config.js (Website)

```js
window.NOTIFY_CONFIG = {
  ntfyUrl: "https://ntfy.sh/vape-shop-7282929174",
  sound: true,
  browserNotifications: true,
};
```

- Auf **Render/GitHub** muss dieselbe `config.js` liegen wie lokal
- Nach Änderung: **Strg+F5** auf der Live-Seite

---

## Schritt 3: Supabase Cloud

1. Bestellung muss in Tabelle **orders** landen (nicht nur „lokal“)
2. Oben im Shop: Status **„Cloud live“** / nicht „Lokal“
3. **Database → Replication**: Tabelle **orders** für Realtime an

---

## Schritt 4: Test auf der Website

1. Als **Verkäufer** einloggen → Dashboard
2. **„Test-Push senden“** tippen
3. Handy sollte **sofort** vibrieren/klingeln

Wenn Test klappt, aber echte Bestellung nicht:
→ Bestellung vom **Shop** (nicht eingeloggt) absenden und prüfen ob Cloud-Fehler angezeigt wird.

---

## Schritt 5: Browser-Benachrichtigungen (optional)

- **„Benachrichtigungen aktivieren“** im Dashboard
- Nur wenn Verkäufer-Seite **offen** ist (Tab/App im Hintergrund ok)

---

## Häufige Probleme

| Problem | Lösung |
|--------|--------|
| Kein Push | Topic in ntfy falsch abonniert |
| Test-Button ok, Bestellung nein | Cloud-Fehler / `orders`-Tabelle fehlt |
| Nur lokal | `config.js` Supabase-URL/Key prüfen |
| iPhone still | ntfy Benachrichtigungen in iOS-Einstellungen |
| Alter Stand | Render-Deploy abwarten, Cache leeren |
