# Benachrichtigung bei neuer Bestellung

## 1. Im Browser (Verkäufer)

1. Als Verkäufer einloggen → Dashboard
2. **„Benachrichtigungen aktivieren“** tippen → erlauben
3. Seite offen lassen (oder Tab im Hintergrund): bei neuer Bestellung **Ton + Banner + System-Meldung**

Funktioniert über **Supabase Realtime** (Tabelle `orders` muss unter Database → Replication aktiviert sein).

---

## 2. Auf dem Handy (kostenlos) — ntfy

1. App **ntfy** installieren ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iOS](https://apps.apple.com/app/ntfy/id1625396347))
2. **+** → Topic abonnieren → z. B. `vape-shop-geheim-7k9m2` (langer Zufallsname!)
3. In `config.js` eintragen:

```js
window.NOTIFY_CONFIG = {
  ntfyUrl: "https://ntfy.sh/vape-shop-geheim-7k9m2",
  sound: true,
  browserNotifications: true,
};
```

4. Seite neu deployen / Strg+F5

Bei jeder Bestellung kommt eine Push-Nachricht aufs Handy — auch wenn die Website zu ist.

**Hinweis:** Die Topic-URL steht in `config.js` (öffentlich). Nur ein **geheimer Topic-Name** verwenden, den niemand erraten kann.

---

## Realtime in Supabase

Dashboard → **Database** → **Replication** (oder Publications) → Tabelle **`orders`** für Realtime aktivieren.
