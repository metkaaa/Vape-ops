const TOTAL_COST = 980;
const DEFAULT_PUBLIC_PRICE = 12;

const DEFAULT_FLAVORS = [
  { id: "cherry", name: "Cherry", initialQty: 10 },
  { id: "strawberry-ice", name: "Strawberry Ice", initialQty: 10 },
  { id: "pink-lemonade", name: "Pink Lemonade", initialQty: 10 },
  { id: "blueberry-on-ice", name: "Blueberry on Ice", initialQty: 10 },
  { id: "kiwi-passionfruit-guava", name: "Kiwi Passionfruit Guava", initialQty: 10 },
  { id: "strawberry-kiwi", name: "Strawberry Kiwi", initialQty: 10 },
  { id: "peach-ice", name: "Peach Ice", initialQty: 10 },
  { id: "blue-razz-lemonade", name: "Blue Razz Lemonade", initialQty: 10 },
  { id: "blue-sour-raspberry", name: "Blue Sour Raspberry", initialQty: 10 },
  { id: "blueberry-cherry-cranberry", name: "Blueberry Cherry Cranberry", initialQty: 10 },
  { id: "cherry-berry", name: "Cherry Berry", initialQty: 10 },
  { id: "bingo-crush", name: "Bingo Crush", initialQty: 10 },
  { id: "pineapple-ice", name: "Pineapple Ice", initialQty: 10 },
  { id: "strawberry-grape", name: "Strawberry Grape", initialQty: 20 },
];

const CHART_THEME = {
  lime: "#d4ff00",
  cyan: "#00f0ff",
  grid: "rgba(255, 255, 255, 0.06)",
  text: "#71717a",
};

const state = {
  activeProfile: null,
  loading: false,
  authSession: null,
  publicShopPrice: DEFAULT_PUBLIC_PRICE,
  flavors: DEFAULT_FLAVORS.map((f) => ({ ...f })),
  orders: [],
  profiles: {
    Aron: { sales: [] },
    Mehmet: { sales: [] },
  },
};

let supabaseClient = null;
let useCloud = false;
const LOCAL_STORAGE_KEY = "vape_ops_sales";
const LOCAL_ORDERS_KEY = "vape_ops_orders";
const LOCAL_SHOP_PRICE_KEY = "vape_ops_shop_price";

let appRootEl;
let publicShopSection;
let profileSelectSection;
let dashboardSection;
let stockBannerEl;
let sellerHeroEl;
let costPerVapeEl;
let stockRemainingEl;
let publicShopPriceEl;
let hintShopPriceEl;
let publicFlavorStockEl;
let sellerFlavorStockEl;
let saleFlavorSelect;
let activeProfileNameEl;
let activeProfileAvatarEl;
let changeProfileBtn;
let backToShopBtn;
let sellerAreaBtn;
let sellerGateModal;
let sellerGateForm;
let sellerGateError;
let saleForm;
let statsProfileNameEl;
let statUnitsEl;
let statRevenueEl;
let statCostEl;
let statProfitEl;
let salesListEl;
let undoLastSaleBtn;
let syncStatusEl;
let syncDotEl;
let shopSyncStatusEl;
let shopSyncDotEl;
let saleFeedbackEl;
let orderForm;
let orderCustomerNameInput;
let orderFlavorSelect;
let orderQuantityInput;
let orderTotalPreviewEl;
let orderFeedbackEl;
let pendingOrdersListEl;
let pendingOrdersBadgeEl;
let enableNotifyBtn;
let orderToastEl;
let orderToastTextEl;

const recentOrderNotifyIds = new Map();
const ORDER_NOTIFY_DEDUPE_MS = 8000;

let revenueChart;
let profitChart;
let unitsComparisonChart;
let profitComparisonChart;

function getTotalFlavorCapacity() {
  return state.flavors.reduce((sum, f) => sum + f.initialQty, 0);
}

const TOTAL_VAPES = 160;
const COST_PER_VAPE = TOTAL_COST / TOTAL_VAPES;

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("de-DE").format(value);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getProfile(name) {
  return state.profiles[name];
}

function isSellerAuthed() {
  return !!(state.authSession || window.__sellerAuthed);
}

function setSellerAuthed(value) {
  window.__sellerAuthed = value;
  if (!value) {
    state.authSession = null;
  }
}

async function syncSellerAuthFromSession() {
  if (!supabaseClient) {
    setSellerAuthed(false);
    return false;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error("Auth session:", error);
    setSellerAuthed(false);
    return false;
  }

  state.authSession = data.session;
  setSellerAuthed(!!data.session);
  return !!data.session;
}

function initAuthListener() {
  if (!supabaseClient?.auth?.onAuthStateChange) return;

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.authSession = session;
    setSellerAuthed(!!session);

    if (!session) {
      state.activeProfile = null;
      window.__activeProfile = null;
      if (dashboardSection && !dashboardSection.classList.contains("hidden")) {
        showPublicShopView();
      }
    }
  });
}

async function sellerLogout() {
  state.activeProfile = null;
  window.__activeProfile = null;

  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  setSellerAuthed(false);
  showPublicShopView();
}

function getFlavorById(id) {
  return state.flavors.find((f) => f.id === id);
}

function getFlavorName(id) {
  const f = getFlavorById(id);
  return f ? f.name : id || "—";
}

function getAllSalesFlat() {
  return [
    ...state.profiles.Aron.sales,
    ...state.profiles.Mehmet.sales,
  ];
}

function getFlavorSoldQty(flavorId) {
  let qty = 0;
  for (const sale of getAllSalesFlat()) {
    if (sale.flavor === flavorId) {
      qty += sale.qty || 0;
    }
  }
  return qty;
}

function getFlavorReservedQty(flavorId) {
  let qty = 0;
  for (const order of state.orders) {
    if (order.status === "pending" && order.flavor === flavorId) {
      qty += order.qty || 0;
    }
  }
  return qty;
}

function getFlavorRemaining(flavor) {
  return getFlavorRemainingExcludingSale(flavor.id, null);
}

function getFlavorRemainingExcludingSale(flavorId, excludeSaleId) {
  const flavor = getFlavorById(flavorId);
  if (!flavor) return 0;
  let sold = 0;
  for (const sale of getAllSalesFlat()) {
    if (sale.id === excludeSaleId) continue;
    if (sale.flavor === flavorId) sold += sale.qty || 0;
  }
  const reserved = getFlavorReservedQty(flavorId);
  return Math.max(0, flavor.initialQty - sold - reserved);
}

function getPendingOrders() {
  return state.orders.filter((o) => o.status === "pending");
}

function buildFlavorOptionsForSale(sale) {
  const current = sale.flavor || "";
  return state.flavors
    .map((f) => {
      const rem = getFlavorRemainingExcludingSale(f.id, sale.id);
      const ok = rem >= (sale.qty || 1) || f.id === current;
      const disabled = ok ? "" : " disabled";
      const selected = f.id === current ? " selected" : "";
      const hint = ok ? ` (${rem} frei)` : " (zu wenig)";
      return `<option value="${escapeHtml(f.id)}"${selected}${disabled}>${escapeHtml(f.name)}${hint}</option>`;
    })
    .join("");
}

function getTotalSoldUnits() {
  let units = 0;
  for (const sale of getAllSalesFlat()) {
    if (sale.flavor) {
      units += sale.qty || 0;
    }
  }
  return units;
}

function getStockRemaining() {
  return state.flavors.reduce((sum, f) => sum + getFlavorRemaining(f), 0);
}

function recalculateTotals(profile) {
  profile.totalUnits = 0;
  profile.totalRevenue = 0;
  profile.totalCost = 0;
  profile.totalProfit = 0;

  for (const sale of profile.sales) {
    profile.totalUnits += sale.qty;
    profile.totalRevenue += sale.revenue;
    profile.totalCost += sale.cost;
    profile.totalProfit += sale.profit;
  }
}

function recalculateAllTotals() {
  recalculateTotals(getProfile("Aron"));
  recalculateTotals(getProfile("Mehmet"));
}

function mapRowFromDb(row) {
  return {
    id: row.id,
    buyerName: row.buyer_name,
    flavor: row.flavor || null,
    price: Number(row.price),
    qty: row.qty,
    revenue: Number(row.revenue),
    cost: Number(row.cost),
    profit: Number(row.profit),
    seller: row.seller,
    timestamp: new Date(row.created_at),
  };
}

function mapOrderFromDb(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    flavor: row.flavor,
    qty: row.qty,
    unitPrice: Number(row.unit_price),
    total: Number(row.total),
    status: row.status,
    timestamp: new Date(row.created_at),
  };
}

function createSaleId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createOrderId() {
  return createSaleId();
}

function isValidAnonKey(key) {
  return typeof key === "string" && key.startsWith("eyJ") && !key.includes("sb_secret");
}

function isSupabaseConfigured() {
  const cfg = window.SUPABASE_CONFIG;
  return (
    cfg &&
    cfg.url &&
    cfg.anonKey &&
    !cfg.url.includes("DEIN-PROJEKT") &&
    !cfg.anonKey.includes("DEIN-ANON") &&
    isValidAnonKey(cfg.anonKey)
  );
}

function applySalesToState(rows) {
  state.profiles.Aron.sales = [];
  state.profiles.Mehmet.sales = [];

  for (const row of rows) {
    const sale = row.seller ? row : mapRowFromDb(row);
    if (state.profiles[sale.seller]) {
      state.profiles[sale.seller].sales.push(sale);
    }
  }

  recalculateAllTotals();
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      applySalesToState([]);
      return;
    }
    const parsed = JSON.parse(raw);
    const sales = parsed.map((s) => ({
      ...s,
      timestamp: new Date(s.timestamp),
    }));
    applySalesToState(sales);
  } catch (e) {
    console.error(e);
    applySalesToState([]);
  }

  const savedPrice = localStorage.getItem(LOCAL_SHOP_PRICE_KEY);
  if (savedPrice) {
    const p = parseFloat(savedPrice);
    if (!isNaN(p) && p > 0) state.publicShopPrice = p;
  }
}

function saveToLocalStorage() {
  const all = getAllSalesFlat();
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
}

function loadOrdersFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) {
      state.orders = [];
      return;
    }
    state.orders = JSON.parse(raw).map((o) => ({
      ...o,
      timestamp: new Date(o.timestamp),
    }));
  } catch (e) {
    console.error(e);
    state.orders = [];
  }
}

function saveOrdersToLocalStorage() {
  localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(state.orders));
}

function applyFlavorsFromDb(rows) {
  if (!rows?.length) return;
  state.flavors = rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      initialQty: r.initial_qty,
      sortOrder: r.sort_order ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function loadFlavorsCatalog() {
  if (useCloud && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("flavors")
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data?.length) {
      applyFlavorsFromDb(data);
      return;
    }
  }
  state.flavors = DEFAULT_FLAVORS.map((f) => ({ ...f }));
}

async function loadShopSettings() {
  if (useCloud && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("shop_settings")
      .select("public_price")
      .eq("id", 1)
      .maybeSingle();

    if (!error && data?.public_price != null) {
      state.publicShopPrice = Number(data.public_price);
      localStorage.setItem(LOCAL_SHOP_PRICE_KEY, String(state.publicShopPrice));
      updatePublicShopPriceUI();
      return;
    }
  }

  const saved = localStorage.getItem(LOCAL_SHOP_PRICE_KEY);
  if (saved) {
    const p = parseFloat(saved);
    if (!isNaN(p) && p > 0) state.publicShopPrice = p;
  }
  updatePublicShopPriceUI();
}

function initSupabase() {
  try {
    if (!window.SUPABASE_CONFIG) {
      setSyncStatus("LOKALER MODUS", "error");
      setShopSyncStatus("LOKAL", "error");
      return false;
    }

    if (window.SUPABASE_CONFIG.anonKey?.includes("sb_secret")) {
      setSyncStatus("FALSCHER API KEY", "error");
      setShopSyncStatus("KEY FEHLER", "error");
      return false;
    }

    if (!isSupabaseConfigured()) {
      setSyncStatus("LOKALER MODUS", "error");
      setShopSyncStatus("LOKAL", "error");
      return false;
    }

    if (!window.supabase?.createClient) {
      setSyncStatus("LIB FEHLER", "error");
      return false;
    }

    supabaseClient = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );

    useCloud = true;
    initAuthListener();

    try {
      supabaseClient
        .channel("sales-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sales" },
          () => refreshData({ silent: true })
        )
        .subscribe();

      supabaseClient
        .channel("shop-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "shop_settings" },
          () => loadShopSettings()
        )
        .subscribe();

      supabaseClient
        .channel("orders-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "orders" },
          (payload) => {
            if (
              payload.eventType === "INSERT" &&
              payload.new &&
              payload.new.status === "pending"
            ) {
              notifyNewOrder(mapOrderFromDb(payload.new));
            }
            refreshData({ silent: true });
          }
        )
        .subscribe();
    } catch (channelError) {
      console.warn("Realtime:", channelError);
    }

    setSyncStatus("CLOUD VERBUNDEN", "ok");
    setShopSyncStatus("CLOUD LIVE", "ok");
    return true;
  } catch (e) {
    console.error(e);
    supabaseClient = null;
    useCloud = false;
    setSyncStatus("INIT FEHLER", "error");
    return false;
  }
}

function setSyncStatus(text, mode = "ok") {
  if (syncStatusEl) syncStatusEl.textContent = text;
  if (syncDotEl) {
    syncDotEl.classList.toggle("sync-dot--error", mode === "error");
    syncDotEl.classList.toggle("sync-dot--loading", mode === "loading");
  }
}

function setShopSyncStatus(text, mode = "ok") {
  if (shopSyncStatusEl) shopSyncStatusEl.textContent = text;
  if (shopSyncDotEl) {
    shopSyncDotEl.classList.toggle("sync-dot--error", mode === "error");
    shopSyncDotEl.classList.toggle("sync-dot--loading", mode === "loading");
  }
}

function showSaleFeedback(message, isError = false) {
  const el = saleFeedbackEl || document.getElementById("saleFeedback");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function showOrderFeedback(message, isError = false) {
  const el = orderFeedbackEl || document.getElementById("orderFeedback");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function getNotifyConfig() {
  return window.NOTIFY_CONFIG || {};
}

function shouldNotifyOrder(orderId) {
  const now = Date.now();
  const last = recentOrderNotifyIds.get(orderId);
  if (last && now - last < ORDER_NOTIFY_DEDUPE_MS) return false;
  recentOrderNotifyIds.set(orderId, now);
  if (recentOrderNotifyIds.size > 50) {
    const oldest = [...recentOrderNotifyIds.entries()].sort((a, b) => a[1] - b[1])[0];
    if (oldest) recentOrderNotifyIds.delete(oldest[0]);
  }
  return true;
}

function formatOrderNotifyMessage(order) {
  const flavor = getFlavorName(order.flavor);
  return `${order.customerName}: ${order.qty}× ${flavor} · ${formatCurrency(order.total)}`;
}

function playOrderAlertSound() {
  const cfg = getNotifyConfig();
  if (cfg.sound === false) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
    setTimeout(() => {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.frequency.value = 1100;
      o2.type = "sine";
      g2.gain.setValueAtTime(0.12, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      o2.start(ctx.currentTime);
      o2.stop(ctx.currentTime + 0.25);
    }, 180);
  } catch (e) {
    console.warn("Sound:", e);
  }
}

function showOrderToast(message) {
  const toast = orderToastEl || document.getElementById("orderToast");
  const text = orderToastTextEl || document.getElementById("orderToastText");
  if (!toast || !text) return;
  text.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showOrderToast._timer);
  showOrderToast._timer = setTimeout(() => toast.classList.add("hidden"), 12000);
}

function showBrowserOrderNotification(order) {
  const cfg = getNotifyConfig();
  if (cfg.browserNotifications === false) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const body = formatOrderNotifyMessage(order);
  try {
    const n = new Notification("VAPE SHOP — Neue Bestellung", {
      body,
      icon: undefined,
      tag: `order-${order.id}`,
      requireInteraction: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
      if (isSellerAuthed()) {
        if (!state.activeProfile) showSellerProfileView();
        else {
          showDashboardView();
          document.querySelector(".orders-panel")?.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        openSellerGate();
      }
    };
  } catch (e) {
    console.warn("Notification:", e);
  }
}

async function pushNtfyOrder(order) {
  const baseUrl = getNotifyConfig().ntfyUrl?.trim();
  if (!baseUrl) return false;

  const message = order ? formatOrderNotifyMessage(order) : "Test — Benachrichtigung OK";
  const title = order ? "VAPE SHOP — Neue Bestellung" : "VAPE SHOP — Test";

  try {
    const target = new URL(baseUrl);
    target.searchParams.set("title", title);
    target.searchParams.set("priority", "high");
    target.searchParams.set("tags", "shopping_cart");

    const res = await fetch(target.toString(), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: message,
      mode: "cors",
    });

    if (!res.ok) {
      console.warn("ntfy HTTP", res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("ntfy:", e);
    return false;
  }
}

async function sendTestNotification() {
  const ok = await pushNtfyOrder(null);
  if (ok) {
    alert(
      "Test gesendet.\n\nKommt auf dem Handy nichts an?\n→ ntfy-App: Topic „vape-shop-7282929174“ abonniert?\n→ System-Benachrichtigungen für ntfy erlaubt?"
    );
  } else {
    alert(
      "Test fehlgeschlagen.\n\nPrüfe NOTIFY_CONFIG.ntfyUrl in config.js und Internetverbindung."
    );
  }
}

function notifyNewOrder(order) {
  if (!order || order.status !== "pending") return;
  if (!shouldNotifyOrder(order.id)) return;

  const message = formatOrderNotifyMessage(order);

  if (isSellerAuthed()) {
    playOrderAlertSound();
    showOrderToast(message);
    showBrowserOrderNotification(order);
  }

  pushNtfyOrder(order);
}

async function requestSellerNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Browser unterstützt keine Benachrichtigungen.");
    return false;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (enableNotifyBtn) {
    if (permission === "granted") {
      enableNotifyBtn.textContent = "🔔 Benachrichtigungen aktiv";
      enableNotifyBtn.disabled = true;
    } else if (permission === "denied") {
      enableNotifyBtn.textContent = "Benachrichtigungen blockiert (Browser-Einstellungen)";
    }
  }

  return permission === "granted";
}

function getActiveProfileName() {
  return state.activeProfile || window.__activeProfile || window.__pendingProfile;
}

async function testSupabaseConnection() {
  if (!useCloud || !supabaseClient) {
    setSyncStatus("LOKALER MODUS", "error");
    setShopSyncStatus("LOKAL", "error");
    return false;
  }

  const { error } = await supabaseClient.from("sales").select("id").limit(1);

  if (error) {
    setSyncStatus("DB: " + error.message.slice(0, 28), "error");
    setShopSyncStatus("DB FEHLER", "error");
    return false;
  }

  setSyncStatus("CLOUD VERBUNDEN", "ok");
  setShopSyncStatus("CLOUD LIVE", "ok");
  return true;
}

function setLoading(loading) {
  state.loading = loading;
  if (loading) {
    setSyncStatus("SYNC…", "loading");
    setShopSyncStatus("SYNC…", "loading");
  } else if (useCloud && supabaseClient) {
    setSyncStatus("CLOUD VERBUNDEN", "ok");
    setShopSyncStatus("CLOUD LIVE", "ok");
  }
}

async function loadAllSales({ silent = false } = {}) {
  if (!silent) setLoading(true);

  if (useCloud && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("sales")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setSyncStatus("CLOUD FEHLER", "error");
      loadFromLocalStorage();
    } else {
      applySalesToState(data.map(mapRowFromDb));
      saveToLocalStorage();
      setSyncStatus("CLOUD VERBUNDEN", "ok");
    }
  } else {
    loadFromLocalStorage();
  }

  setLoading(false);

  if (state.activeProfile) {
    updateUI();
  } else {
    afterPublicDataLoad();
  }
}

async function loadAllOrders({ silent = false } = {}) {
  if (!silent) setLoading(true);

  if (useCloud && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setShopSyncStatus("BESTELLUNG FEHLER", "error");
      loadOrdersFromLocalStorage();
    } else {
      state.orders = data.map(mapOrderFromDb);
      saveOrdersToLocalStorage();
    }
  } else {
    loadOrdersFromLocalStorage();
  }

  if (!silent) setLoading(false);
}

async function refreshData({ silent = true } = {}) {
  await loadFlavorsCatalog();
  await loadShopSettings();
  await loadAllOrders({ silent: true });
  await loadAllSales({ silent });
  populateFlavorSelect();
  populateOrderFlavorSelect();
  renderFlavorStockLists();
  renderPendingOrders();
  updatePublicShopPriceUI();
  updateOrderTotalPreview();
}

function afterPublicDataLoad() {
  renderFlavorStockLists();
  populateOrderFlavorSelect();
  updateOrderTotalPreview();
  updateTelemetry();
}

function updatePublicShopPriceUI() {
  const text = formatCurrency(state.publicShopPrice);
  if (publicShopPriceEl) publicShopPriceEl.textContent = text;
  if (hintShopPriceEl) hintShopPriceEl.textContent = text;
}

function updateTelemetry() {
  const costEl = costPerVapeEl || document.getElementById("costPerVape");
  const stockEl = stockRemainingEl || document.getElementById("stockRemaining");

  if (costEl) {
    costEl.textContent = formatCurrency(COST_PER_VAPE);
  }
  if (stockEl) {
    const rem = getStockRemaining();
    stockEl.textContent = formatNumber(rem);
    stockEl.classList.toggle("stock-low", rem <= 20);
    stockEl.classList.toggle("stock-empty", rem === 0);
  }
}

function flavorBarHtml(flavor) {
  const remaining = getFlavorRemaining(flavor);
  const reserved = getFlavorReservedQty(flavor.id);
  const pct = flavor.initialQty
    ? Math.round((remaining / flavor.initialQty) * 100)
    : 0;
  const low = remaining <= 2 && remaining > 0;
  const empty = remaining === 0;
  const reservedNote =
    reserved > 0
      ? `<span class="flavor-stock-reserved">${formatNumber(reserved)} reserviert</span>`
      : "";

  return `
    <div class="flavor-stock-row ${empty ? "flavor-stock-row--empty" : ""} ${low ? "flavor-stock-row--low" : ""}">
      <div class="flavor-stock-head">
        <span class="flavor-stock-name">${escapeHtml(flavor.name)}</span>
        <span class="flavor-stock-count">${formatNumber(remaining)} / ${formatNumber(flavor.initialQty)} ${reservedNote}</span>
      </div>
      <div class="flavor-stock-track" role="progressbar" aria-valuenow="${remaining}" aria-valuemin="0" aria-valuemax="${flavor.initialQty}">
        <div class="flavor-stock-fill" style="width: ${pct}%"></div>
      </div>
    </div>
  `;
}

function renderFlavorStockLists() {
  const html = state.flavors.map((f) => flavorBarHtml(f)).join("");

  if (publicFlavorStockEl) {
    publicFlavorStockEl.innerHTML =
      html || '<p class="sales-empty">Keine Sorten geladen.</p>';
  }
  if (sellerFlavorStockEl) {
    sellerFlavorStockEl.innerHTML = html;
  }
}

function populateFlavorSelect() {
  if (!saleFlavorSelect) return;

  const options = state.flavors
    .map((f) => {
      const rem = getFlavorRemaining(f);
      const disabled = rem === 0 ? " disabled" : "";
      return `<option value="${escapeHtml(f.id)}"${disabled}>${escapeHtml(f.name)} (${rem} übrig)</option>`;
    })
    .join("");

  saleFlavorSelect.innerHTML =
    '<option value="" disabled selected>Geschmack wählen</option>' + options;

  const firstAvailable = state.flavors.find((f) => getFlavorRemaining(f) > 0);
  if (firstAvailable) {
    saleFlavorSelect.value = firstAvailable.id;
  }
}

function populateOrderFlavorSelect() {
  if (!orderFlavorSelect) return;

  const options = state.flavors
    .map((f) => {
      const rem = getFlavorRemaining(f);
      const disabled = rem === 0 ? " disabled" : "";
      return `<option value="${escapeHtml(f.id)}"${disabled}>${escapeHtml(f.name)} (${rem} bestellbar)</option>`;
    })
    .join("");

  orderFlavorSelect.innerHTML =
    '<option value="" disabled selected>Sorte wählen</option>' + options;

  const firstAvailable = state.flavors.find((f) => getFlavorRemaining(f) > 0);
  if (firstAvailable) {
    orderFlavorSelect.value = firstAvailable.id;
  }
}

function updateOrderTotalPreview() {
  const qty = parseInt(orderQuantityInput?.value || "1", 10);
  const safeQty = isNaN(qty) || qty < 1 ? 1 : qty;
  const total = state.publicShopPrice * safeQty;
  if (orderTotalPreviewEl) {
    orderTotalPreviewEl.textContent = formatCurrency(total);
  }
}

function readOrderFormValues() {
  const nameEl = document.getElementById("orderCustomerName");
  const flavorEl = document.getElementById("orderFlavor");
  const qtyEl = document.getElementById("orderQuantity");

  if (!nameEl || !flavorEl || !qtyEl) {
    return { error: "Bestellformular nicht gefunden. Seite neu laden (Strg+F5)." };
  }

  const customerName = nameEl.value.trim();
  const flavorId = flavorEl.value;
  const flavor = getFlavorById(flavorId);
  const qty = parseInt(qtyEl.value, 10);

  if (!customerName) {
    return { error: "Bitte deinen Namen eingeben.", focus: nameEl };
  }
  if (!flavorId || !flavor) {
    return { error: "Bitte eine Sorte wählen.", focus: flavorEl };
  }
  if (isNaN(qty) || qty < 1) {
    return { error: "Bitte gültige Menge eingeben.", focus: qtyEl };
  }

  const available = getFlavorRemaining(flavor);
  if (qty > available) {
    return {
      error: `Nur noch ${available}× ${flavor.name} bestellbar.`,
      focus: qtyEl,
    };
  }

  const unitPrice = state.publicShopPrice;
  const total = unitPrice * qty;

  return { customerName, flavorId, flavorName: flavor.name, qty, unitPrice, total, nameEl, flavorEl, qtyEl };
}

async function handleOrderSubmit(event) {
  if (event) event.preventDefault();
  bindDomRefs();

  const form = readOrderFormValues();
  if (form.error) {
    showOrderFeedback(form.error, true);
    form.focus?.focus();
    return;
  }

  setLoading(true);
  showOrderFeedback("Bestellung wird gesendet…");

  const orderPayload = {
    customer_name: form.customerName,
    flavor: form.flavorId,
    qty: form.qty,
    unit_price: form.unitPrice,
    total: form.total,
    status: "pending",
  };

  try {
    if (useCloud && supabaseClient) {
      const { error } = await supabaseClient.from("orders").insert(orderPayload);

      if (error) {
        console.error(error);
        if (error.message?.includes("orders") || error.code === "42P01") {
          showOrderFeedback(
            "Cloud: Tabelle orders fehlt — fix-orders-table.sql in Supabase ausführen.",
            true
          );
        } else {
          showOrderFeedback("Fehler: " + error.message, true);
        }
        setLoading(false);
        return;
      }

      await refreshData({ silent: true });
      showOrderFeedback(
        `Bestellung eingegangen! ${form.qty}× ${form.flavorName} · ${formatCurrency(form.total)}`
      );
      const latest = [...getPendingOrders()]
        .reverse()
        .find(
          (o) =>
            o.customerName === form.customerName &&
            o.flavor === form.flavorId &&
            o.qty === form.qty
        );
      if (latest) notifyNewOrder(latest);
    } else {
      const order = {
        id: createOrderId(),
        customerName: form.customerName,
        flavor: form.flavorId,
        qty: form.qty,
        unitPrice: form.unitPrice,
        total: form.total,
        status: "pending",
        timestamp: new Date(),
      };
      state.orders.push(order);
      saveOrdersToLocalStorage();
      afterPublicDataLoad();
      renderPendingOrders();
      notifyNewOrder(order);
      showOrderFeedback(
        `Bestellung gespeichert (lokal). ${form.qty}× ${form.flavorName} · ${formatCurrency(form.total)}`
      );
    }

    document.getElementById("orderForm")?.reset();
    if (orderQuantityInput) orderQuantityInput.value = "1";
    populateOrderFlavorSelect();
    updateOrderTotalPreview();
  } catch (err) {
    console.error(err);
    showOrderFeedback("Unerwarteter Fehler: " + err.message, true);
  } finally {
    setLoading(false);
  }
}

async function setOrderStatus(orderId, status) {
  if (!isSellerAuthed()) {
    alert("Bitte als Verkäufer anmelden.");
    return;
  }
  if (state.loading) return;

  const order = state.orders.find((o) => o.id === orderId);
  if (!order || order.status !== "pending") return;

  setLoading(true);

  if (useCloud && supabaseClient) {
    const { error } = await supabaseClient
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (error) {
      alert("Aktion fehlgeschlagen: " + error.message);
      setLoading(false);
      return;
    }

    await refreshData({ silent: true });
  } else {
    order.status = status;
    saveOrdersToLocalStorage();
    await refreshData({ silent: true });
  }

  setLoading(false);
}

function fillOrderIntoSaleForm(order) {
  const buyerEl = document.getElementById("buyerName");
  const priceEl = document.getElementById("salePrice");
  const qtyEl = document.getElementById("saleQuantity");

  if (buyerEl) buyerEl.value = order.customerName;
  if (saleFlavorSelect && order.flavor) saleFlavorSelect.value = order.flavor;
  if (qtyEl) qtyEl.value = String(order.qty);
  if (priceEl) priceEl.value = String(order.unitPrice);

  document.querySelector(".sale-entry-panel")?.scrollIntoView({ behavior: "smooth" });
  showSaleFeedback(`Daten von ${order.customerName} ins Verkaufsformular übernommen.`);
}

function renderPendingOrders() {
  if (!pendingOrdersListEl) return;

  const pending = [...getPendingOrders()].reverse();

  if (pendingOrdersBadgeEl) {
    pendingOrdersBadgeEl.textContent = String(pending.length);
    pendingOrdersBadgeEl.classList.toggle("orders-badge--empty", pending.length === 0);
  }

  if (pending.length === 0) {
    pendingOrdersListEl.innerHTML =
      '<p class="sales-empty">Keine offenen Bestellungen.</p>';
    return;
  }

  pendingOrdersListEl.innerHTML = pending
    .map((order) => {
      return `
        <article class="order-item" data-order-id="${order.id}">
          <div class="order-item-main">
            <div class="order-item-customer">${escapeHtml(order.customerName)}</div>
            <div class="order-item-flavor">${escapeHtml(getFlavorName(order.flavor))}</div>
            <div class="order-item-meta">
              ${order.qty} Stück × ${formatCurrency(order.unitPrice)}
              · ${formatCurrency(order.total)}
              · ${formatDateTime(order.timestamp)}
            </div>
          </div>
          <div class="order-item-actions">
            <button type="button" class="ghost-button order-fill-btn" data-order-id="${order.id}" ${state.loading ? "disabled" : ""}>
              → Verkauf
            </button>
            <button type="button" class="ghost-button order-done-btn" data-order-id="${order.id}" ${state.loading ? "disabled" : ""}>
              Erledigt
            </button>
            <button type="button" class="ghost-button ghost-button--danger order-cancel-btn" data-order-id="${order.id}" ${state.loading ? "disabled" : ""}>
              Storno
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  pendingOrdersListEl.querySelectorAll(".order-fill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.orders.find((o) => o.id === btn.getAttribute("data-order-id"));
      if (order) fillOrderIntoSaleForm(order);
    });
  });

  pendingOrdersListEl.querySelectorAll(".order-done-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.orders.find((o) => o.id === btn.getAttribute("data-order-id"));
      if (!order) return;
      const ok = confirm(
        `Bestellung von ${order.customerName} (${order.qty}× ${getFlavorName(order.flavor)}) als erledigt markieren?`
      );
      if (ok) setOrderStatus(order.id, "completed");
    });
  });

  pendingOrdersListEl.querySelectorAll(".order-cancel-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const order = state.orders.find((o) => o.id === btn.getAttribute("data-order-id"));
      if (!order) return;
      const ok = confirm(`Bestellung von ${order.customerName} wirklich stornieren?`);
      if (ok) setOrderStatus(order.id, "cancelled");
    });
  });
}

function showPublicShopView() {
  const root = appRootEl || document.getElementById("appRoot");
  root?.classList.remove("mode-dashboard");
  state.activeProfile = null;
  window.__activeProfile = null;

  publicShopSection?.classList.remove("hidden");
  profileSelectSection?.classList.add("hidden");
  dashboardSection?.classList.add("hidden");
  stockBannerEl?.classList.add("hidden");
  sellerHeroEl?.classList.add("hidden");
  window.scrollTo(0, 0);
  afterPublicDataLoad();
  updatePublicShopPriceUI();
}

function showSellerProfileView() {
  publicShopSection?.classList.add("hidden");
  profileSelectSection?.classList.remove("hidden");
  dashboardSection?.classList.add("hidden");
  stockBannerEl?.classList.add("hidden");
  sellerHeroEl?.classList.add("hidden");
  appRootEl?.classList.remove("mode-dashboard");
  window.scrollTo(0, 0);
}

function showDashboardView() {
  const root = appRootEl || document.getElementById("appRoot");
  root?.classList.add("mode-dashboard");
  publicShopSection?.classList.add("hidden");
  profileSelectSection?.classList.add("hidden");
  dashboardSection?.classList.remove("hidden");
  stockBannerEl?.classList.remove("hidden");
  sellerHeroEl?.classList.remove("hidden");
  window.scrollTo(0, 0);
}

function openSellerGate() {
  sellerGateModal?.classList.remove("hidden");
  sellerGateError?.classList.add("hidden");
  const emailEl = document.getElementById("sellerEmail");
  const pw = document.getElementById("sellerPassword");
  if (emailEl) emailEl.value = "";
  if (pw) pw.value = "";
  setTimeout(() => (emailEl || pw)?.focus(), 100);
}

function closeSellerGate() {
  sellerGateModal?.classList.add("hidden");
}

async function handleSellerGateSubmit(event) {
  event.preventDefault();

  if (!useCloud || !supabaseClient) {
    if (sellerGateError) {
      sellerGateError.textContent =
        "Verkäufer-Login braucht Supabase Cloud + Auth (siehe supabase/SELLER-AUTH.md).";
      sellerGateError.classList.remove("hidden");
    }
    return;
  }

  const emailEl = document.getElementById("sellerEmail");
  const pwEl = document.getElementById("sellerPassword");
  const email = emailEl?.value?.trim() || "";
  const password = pwEl?.value || "";

  if (!email || !password) {
    if (sellerGateError) {
      sellerGateError.textContent = "E-Mail und Passwort eingeben.";
      sellerGateError.classList.remove("hidden");
    }
    return;
  }

  if (sellerGateError) {
    sellerGateError.textContent = "Anmeldung läuft…";
    sellerGateError.classList.remove("hidden");
    sellerGateError.classList.remove("error");
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(error);
    if (sellerGateError) {
      sellerGateError.textContent =
        error.message === "Invalid login credentials"
          ? "E-Mail oder Passwort falsch."
          : error.message;
      sellerGateError.classList.add("error");
      sellerGateError.classList.remove("hidden");
    }
    return;
  }

  state.authSession = data.session;
  setSellerAuthed(true);
  closeSellerGate();
  showSellerProfileView();
}

async function setActiveProfile(name) {
  bindDomRefs();

  if (!isSellerAuthed()) {
    openSellerGate();
    return;
  }

  const sel = profileSelectSection || document.getElementById("profile-select");
  const dash = dashboardSection || document.getElementById("dashboard");

  if (!name || !sel || !dash) {
    alert("Seite bitte neu laden (Strg+F5).");
    return;
  }

  state.activeProfile = name;
  window.__activeProfile = name;
  showDashboardView();

  if (activeProfileNameEl) activeProfileNameEl.textContent = name;
  if (activeProfileAvatarEl) {
    activeProfileAvatarEl.textContent = name[0] || "?";
    activeProfileAvatarEl.className = "avatar avatar-lg";
    activeProfileAvatarEl.classList.add(
      name === "Aron" ? "avatar-aron" : "avatar-mehmet"
    );
  }
  if (statsProfileNameEl) statsProfileNameEl.textContent = name;

  if (!revenueChart) {
    try {
      initCharts();
    } catch (chartError) {
      console.error("Charts:", chartError);
    }
  }

  try {
    await Promise.race([
      refreshData({ silent: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Zeitüberschreitung")), 12000)
      ),
    ]);
  } catch (loadError) {
    console.error(loadError);
    loadFromLocalStorage();
    renderFlavorStockLists();
    populateFlavorSelect();
    setSyncStatus("OFFLINE MODUS", "error");
  } finally {
    setLoading(false);
    state.loading = false;
  }

  updateUI();
  if (Notification.permission === "default") {
    requestSellerNotificationPermission();
  }
}

function resetToProfileSelection() {
  state.activeProfile = null;
  showSellerProfileView();
}

function readSaleFormValues() {
  const flavorEl = document.getElementById("saleFlavor");
  const buyerEl = document.getElementById("buyerName");
  const priceEl = document.getElementById("salePrice");
  const qtyEl = document.getElementById("saleQuantity");

  if (!flavorEl || !buyerEl || !priceEl || !qtyEl) {
    return { error: "Formular nicht gefunden. Bitte Seite neu laden (Strg+F5)." };
  }

  const flavorId = flavorEl.value;
  const flavor = getFlavorById(flavorId);
  const buyerName = buyerEl.value.trim();
  const price = parseFloat(String(priceEl.value).replace(",", "."));
  const qty = parseInt(qtyEl.value, 10);

  if (!flavorId || !flavor) {
    return { error: "Bitte einen Geschmack wählen.", focus: flavorEl };
  }
  if (!buyerName) {
    return { error: "Bitte Käufername eingeben.", focus: buyerEl };
  }
  if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
    return { error: "Bitte gültigen Preis und Menge eingeben.", focus: priceEl };
  }

  const remaining = getFlavorRemaining(flavor);
  if (qty > remaining) {
    return {
      error: `Nur noch ${remaining}× ${flavor.name} auf Lager.`,
      focus: qtyEl,
    };
  }

  const revenue = price * qty;
  const cost = COST_PER_VAPE * qty;
  const profit = revenue - cost;

  return {
    flavorId,
    flavorName: flavor.name,
    buyerName,
    price,
    qty,
    revenue,
    cost,
    profit,
    flavorEl,
    buyerEl,
    priceEl,
    qtyEl,
  };
}

function saveSaleLocally(profileName, form) {
  const sale = {
    id: createSaleId(),
    buyerName: form.buyerName,
    flavor: form.flavorId,
    price: form.price,
    qty: form.qty,
    revenue: form.revenue,
    cost: form.cost,
    profit: form.profit,
    seller: profileName,
    timestamp: new Date(),
  };
  getProfile(profileName).sales.push(sale);
  recalculateTotals(getProfile(profileName));
  saveToLocalStorage();
  updateUI();
  renderFlavorStockLists();
  populateFlavorSelect();
  return sale;
}

async function handleSaleSubmit(event) {
  if (event) event.preventDefault();
  bindDomRefs();

  if (!isSellerAuthed()) {
    alert("Bitte zuerst als Verkäufer anmelden.");
    openSellerGate();
    return;
  }

  const profileName = getActiveProfileName();
  if (!profileName) {
    alert("Bitte zuerst ein Verkäufer-Profil wählen.");
    return;
  }
  state.activeProfile = profileName;

  const form = readSaleFormValues();
  if (form.error) {
    alert(form.error);
    form.focus?.focus();
    return;
  }

  setLoading(true);
  showSaleFeedback("Speichere…");

  try {
    if (useCloud && supabaseClient) {
      const { error } = await supabaseClient.from("sales").insert({
        seller: profileName,
        buyer_name: form.buyerName,
        flavor: form.flavorId,
        price: form.price,
        qty: form.qty,
        revenue: form.revenue,
        cost: form.cost,
        profit: form.profit,
      });

      if (error) {
        console.error(error);
        saveSaleLocally(profileName, form);
        showSaleFeedback(
          "Cloud-Fehler – lokal gespeichert: " + error.message,
          true
        );
        setSyncStatus("CLOUD FEHLER", "error");
      } else {
        await loadAllSales({ silent: true });
        populateFlavorSelect();
        showSaleFeedback(`Verkauf gespeichert: ${form.flavorName}`);
        setSyncStatus("CLOUD VERBUNDEN", "ok");
      }
    } else {
      saveSaleLocally(profileName, form);
      showSaleFeedback(`Verkauf gespeichert: ${form.flavorName}`);
    }

    document.getElementById("saleForm")?.reset();
    const qtyInput = document.getElementById("saleQuantity");
    if (qtyInput) qtyInput.value = "1";
    populateFlavorSelect();
  } catch (err) {
    console.error(err);
    alert("Unerwarteter Fehler: " + err.message);
    showSaleFeedback("Fehler beim Speichern", true);
  } finally {
    setLoading(false);
  }
}

async function deleteSale(saleId) {
  if (!isSellerAuthed()) return;
  if (!state.activeProfile || state.loading) return;

  const profile = getProfile(state.activeProfile);
  const sale = profile.sales.find((s) => s.id === saleId);
  if (!sale) return;

  const flavorLabel = sale.flavor ? getFlavorName(sale.flavor) : "";
  const ok = confirm(
    `Verkauf an „${sale.buyerName}“ (${sale.qty}× ${flavorLabel || formatCurrency(sale.price)}) wirklich löschen?`
  );
  if (!ok) return;

  setLoading(true);

  if (useCloud && supabaseClient) {
    const { error } = await supabaseClient.from("sales").delete().eq("id", saleId);

    if (error) {
      alert("Löschen fehlgeschlagen: " + error.message);
      setLoading(false);
      return;
    }

    await loadAllSales({ silent: true });
    populateFlavorSelect();
  } else {
    profile.sales = profile.sales.filter((s) => s.id !== saleId);
    recalculateTotals(profile);
    saveToLocalStorage();
    updateUI();
    renderFlavorStockLists();
    populateFlavorSelect();
    setLoading(false);
  }
}

async function updateSaleFlavor(saleId, newFlavorId, selectEl) {
  if (!isSellerAuthed()) return;
  if (!state.activeProfile || state.loading) return;

  const profile = getProfile(state.activeProfile);
  const sale = profile.sales.find((s) => s.id === saleId);
  if (!sale) return;

  const prevFlavor = sale.flavor || "";
  if (newFlavorId === prevFlavor) return;

  const flavor = getFlavorById(newFlavorId);
  if (!flavor) {
    alert("Ungültige Sorte.");
    if (selectEl) selectEl.value = prevFlavor;
    return;
  }

  const available = getFlavorRemainingExcludingSale(newFlavorId, saleId);
  if ((sale.qty || 1) > available) {
    alert(
      `Nur noch ${available}× ${flavor.name} verfügbar — Sorte kann nicht zugewiesen werden.`
    );
    if (selectEl) selectEl.value = prevFlavor;
    return;
  }

  setLoading(true);

  if (useCloud && supabaseClient) {
    const { error } = await supabaseClient
      .from("sales")
      .update({ flavor: newFlavorId })
      .eq("id", saleId);

    if (error) {
      console.error(error);
      alert("Sorte konnte nicht gespeichert werden: " + error.message);
      if (selectEl) selectEl.value = prevFlavor;
      setLoading(false);
      return;
    }

    await loadAllSales({ silent: true });
    populateFlavorSelect();
    showSaleFeedback(`Sorte geändert: ${flavor.name}`);
    setLoading(false);
    return;
  }

  sale.flavor = newFlavorId;
  saveToLocalStorage();
  updateUI();
  showSaleFeedback(`Sorte geändert: ${flavor.name}`);
  setLoading(false);
}

async function undoLastSale() {
  if (!state.activeProfile || state.loading) return;
  const profile = getProfile(state.activeProfile);
  if (profile.sales.length === 0) return;
  const last = profile.sales[profile.sales.length - 1];
  const ok = confirm(
    `Letzten Verkauf widerrufen?\n\n${getFlavorName(last.flavor)}\nKäufer: ${last.buyerName}\n${last.qty}× ${formatCurrency(last.price)}`
  );
  if (!ok) return;
  await deleteSale(last.id);
}

function renderSalesList() {
  if (!state.activeProfile || !salesListEl) return;

  const profile = getProfile(state.activeProfile);

  if (undoLastSaleBtn) {
    undoLastSaleBtn.disabled = profile.sales.length === 0 || state.loading;
  }

  if (profile.sales.length === 0) {
    salesListEl.innerHTML =
      '<p class="sales-empty">Noch keine Verkäufe erfasst.</p>';
    return;
  }

  const items = [...profile.sales].reverse();

  salesListEl.innerHTML = items
    .map((sale) => {
      const profitClass = sale.profit >= 0 ? "" : " negative";
      const flavorOptions = buildFlavorOptionsForSale(sale);
      const noFlavor = !sale.flavor
        ? '<option value="" selected disabled>— Sorte wählen —</option>'
        : "";
      return `
        <article class="sale-item" data-sale-id="${sale.id}">
          <div class="sale-item-main">
            <div class="sale-item-buyer">${escapeHtml(sale.buyerName)}</div>
            <label class="sale-flavor-edit-label">
              <span>Sorte</span>
              <select
                class="sale-flavor-edit"
                data-sale-id="${sale.id}"
                ${state.loading ? "disabled" : ""}
                aria-label="Geschmack für ${escapeHtml(sale.buyerName)}"
              >${noFlavor}${flavorOptions}</select>
            </label>
            <div class="sale-item-meta">
              ${sale.qty} Stück × ${formatCurrency(sale.price)}
              · Umsatz ${formatCurrency(sale.revenue)}
              · ${formatDateTime(sale.timestamp)}
            </div>
            <div class="sale-item-profit${profitClass}">
              Gewinn: ${formatCurrency(sale.profit)}
            </div>
          </div>
          <div class="sale-item-actions">
            <button type="button" class="delete-sale-btn" data-sale-id="${sale.id}" ${state.loading ? "disabled" : ""}>
              Löschen
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  salesListEl.querySelectorAll(".delete-sale-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      deleteSale(btn.getAttribute("data-sale-id"));
    });
  });

  salesListEl.querySelectorAll(".sale-flavor-edit").forEach((sel) => {
    const saleId = sel.getAttribute("data-sale-id");
    const previous = sel.value;
    sel.addEventListener("change", () => {
      const next = sel.value;
      if (!next) {
        sel.value = previous;
        return;
      }
      updateSaleFlavor(saleId, next, sel);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function updateStats() {
  if (!state.activeProfile) return;
  const profile = getProfile(state.activeProfile);

  statUnitsEl.textContent = formatNumber(profile.totalUnits);
  statRevenueEl.textContent = formatCurrency(profile.totalRevenue);
  statCostEl.textContent = formatCurrency(profile.totalCost);
  statProfitEl.textContent = formatCurrency(profile.totalProfit);

  statProfitEl.classList.toggle("negative", profile.totalProfit < 0);
  statProfitEl.classList.toggle("positive", profile.totalProfit >= 0);
}

function chartBaseOptions(currencyY = false) {
  const scaleDefaults = {
    grid: { color: CHART_THEME.grid },
    ticks: { color: CHART_THEME.text, font: { family: "'Syne', sans-serif" } },
    border: { display: false },
  };
  return {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: scaleDefaults,
      y: {
        ...scaleDefaults,
        beginAtZero: true,
        ticks: {
          ...scaleDefaults.ticks,
          ...(currencyY ? { callback: (value) => formatCurrency(value) } : {}),
        },
      },
    },
  };
}

function initCharts() {
  if (typeof Chart === "undefined") return;

  const revenueCanvas = document.getElementById("revenueChart");
  const profitCanvas = document.getElementById("profitChart");
  const unitsCanvas = document.getElementById("unitsComparisonChart");
  const profitCmpCanvas = document.getElementById("profitComparisonChart");

  if (!revenueCanvas || !profitCanvas || !unitsCanvas || !profitCmpCanvas) {
    throw new Error("Chart-Elemente fehlen");
  }

  revenueChart = new Chart(revenueCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Umsatz",
          data: [],
          borderColor: CHART_THEME.lime,
          backgroundColor: "rgba(212, 255, 0, 0.12)",
          tension: 0.35,
          fill: true,
          pointBackgroundColor: CHART_THEME.lime,
          pointBorderColor: "#050508",
          pointRadius: 4,
        },
      ],
    },
    options: chartBaseOptions(true),
  });

  profitChart = new Chart(profitCanvas.getContext("2d"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Gewinn",
          data: [],
          borderColor: CHART_THEME.cyan,
          backgroundColor: "rgba(0, 240, 255, 0.1)",
          tension: 0.35,
          fill: true,
          pointBackgroundColor: CHART_THEME.cyan,
          pointBorderColor: "#050508",
          pointRadius: 4,
        },
      ],
    },
    options: chartBaseOptions(true),
  });

  unitsComparisonChart = new Chart(unitsCanvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Aron", "Mehmet"],
      datasets: [
        {
          label: "Verkaufte Vapes",
          data: [0, 0],
          backgroundColor: [CHART_THEME.lime, CHART_THEME.cyan],
          borderRadius: 2,
        },
      ],
    },
    options: chartBaseOptions(false),
  });

  profitComparisonChart = new Chart(profitCmpCanvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: ["Aron", "Mehmet"],
      datasets: [
        {
          label: "Gesamtgewinn",
          data: [0, 0],
          backgroundColor: [
            "rgba(212, 255, 0, 0.85)",
            "rgba(0, 240, 255, 0.85)",
          ],
          borderRadius: 2,
        },
      ],
    },
    options: chartBaseOptions(true),
  });
}

function updateCharts() {
  if (!state.activeProfile || !revenueChart || typeof Chart === "undefined") return;
  const profile = getProfile(state.activeProfile);

  const labels = profile.sales.map(
    (sale, index) =>
      (sale.flavor ? getFlavorName(sale.flavor) + " · " : "") +
      (sale.buyerName || `Verkauf ${index + 1}`)
  );
  const revenueData = profile.sales.map((sale) => sale.revenue);
  const profitData = profile.sales.map((sale) => sale.profit);

  revenueChart.data.labels = labels;
  revenueChart.data.datasets[0].data = revenueData;
  revenueChart.update();

  profitChart.data.labels = labels;
  profitChart.data.datasets[0].data = profitData;
  profitChart.update();

  const aron = getProfile("Aron");
  const mehmet = getProfile("Mehmet");

  unitsComparisonChart.data.datasets[0].data = [
    aron.totalUnits,
    mehmet.totalUnits,
  ];
  unitsComparisonChart.update();

  profitComparisonChart.data.datasets[0].data = [
    aron.totalProfit,
    mehmet.totalProfit,
  ];
  profitComparisonChart.update();
}

function updateUI() {
  updateTelemetry();
  updateStats();
  renderFlavorStockLists();
  populateFlavorSelect();
  populateOrderFlavorSelect();
  renderPendingOrders();
  renderSalesList();
  try {
    updateCharts();
  } catch (chartErr) {
    console.warn("Charts update:", chartErr);
  }
}

function bindDomRefs() {
  appRootEl = document.getElementById("appRoot");
  publicShopSection = document.getElementById("public-shop");
  profileSelectSection = document.getElementById("profile-select");
  dashboardSection = document.getElementById("dashboard");
  stockBannerEl = document.getElementById("stockBanner");
  sellerHeroEl = document.getElementById("sellerHero");
  costPerVapeEl = document.getElementById("costPerVape");
  stockRemainingEl = document.getElementById("stockRemaining");
  publicShopPriceEl = document.getElementById("publicShopPrice");
  hintShopPriceEl = document.getElementById("hintShopPrice");
  publicFlavorStockEl = document.getElementById("publicFlavorStock");
  sellerFlavorStockEl = document.getElementById("sellerFlavorStock");
  saleFlavorSelect = document.getElementById("saleFlavor");
  activeProfileNameEl = document.getElementById("activeProfileName");
  activeProfileAvatarEl = document.getElementById("activeProfileAvatar");
  changeProfileBtn = document.getElementById("changeProfileBtn");
  backToShopBtn = document.getElementById("backToShopBtn");
  sellerAreaBtn = document.getElementById("sellerAreaBtn");
  sellerGateModal = document.getElementById("sellerGateModal");
  sellerGateForm = document.getElementById("sellerGateForm");
  sellerGateError = document.getElementById("sellerGateError");
  saleForm = document.getElementById("saleForm");
  statsProfileNameEl = document.getElementById("statsProfileName");
  statUnitsEl = document.getElementById("statUnits");
  statRevenueEl = document.getElementById("statRevenue");
  statCostEl = document.getElementById("statCost");
  statProfitEl = document.getElementById("statProfit");
  salesListEl = document.getElementById("salesList");
  undoLastSaleBtn = document.getElementById("undoLastSaleBtn");
  syncStatusEl = document.getElementById("syncStatus");
  syncDotEl = document.getElementById("syncDot");
  shopSyncStatusEl = document.getElementById("shopSyncStatus");
  shopSyncDotEl = document.getElementById("shopSyncDot");
  saleFeedbackEl = document.getElementById("saleFeedback");
  orderForm = document.getElementById("orderForm");
  orderCustomerNameInput = document.getElementById("orderCustomerName");
  orderFlavorSelect = document.getElementById("orderFlavor");
  orderQuantityInput = document.getElementById("orderQuantity");
  orderTotalPreviewEl = document.getElementById("orderTotalPreview");
  orderFeedbackEl = document.getElementById("orderFeedback");
  pendingOrdersListEl = document.getElementById("pendingOrdersList");
  pendingOrdersBadgeEl = document.getElementById("pendingOrdersBadge");
  enableNotifyBtn = document.getElementById("enableNotifyBtn");
  orderToastEl = document.getElementById("orderToast");
  orderToastTextEl = document.getElementById("orderToastText");
}

function setupEvents() {
  sellerAreaBtn?.addEventListener("click", openSellerGate);
  sellerGateForm?.addEventListener("submit", handleSellerGateSubmit);
  sellerGateModal?.querySelectorAll("[data-close-gate]").forEach((el) => {
    el.addEventListener("click", closeSellerGate);
  });

  backToShopBtn?.addEventListener("click", () => {
    showPublicShopView();
  });

  document.getElementById("sellerLogoutBtn")?.addEventListener("click", () => {
    sellerLogout();
  });

  enableNotifyBtn?.addEventListener("click", () => {
    requestSellerNotificationPermission();
  });

  document.getElementById("testNtfyBtn")?.addEventListener("click", () => {
    sendTestNotification();
  });

  document.getElementById("orderToastDismiss")?.addEventListener("click", () => {
    orderToastEl?.classList.add("hidden");
  });

  changeProfileBtn?.addEventListener("click", resetToProfileSelection);
  saleForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSaleSubmit(e);
  });
  undoLastSaleBtn?.addEventListener("click", undoLastSale);

  document.getElementById("submitSaleBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    handleSaleSubmit(e);
  });

  orderForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleOrderSubmit(e);
  });
  document.getElementById("submitOrderBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    handleOrderSubmit(e);
  });
  orderQuantityInput?.addEventListener("input", updateOrderTotalPreview);
  orderFlavorSelect?.addEventListener("change", updateOrderTotalPreview);
}

window.enterProfile = function (name) {
  window.pickProfile(name);
};

window.onProfilePicked = function (name) {
  setActiveProfile(name);
};

async function initApp() {
  bindDomRefs();
  state.loading = false;

  updatePublicShopPriceUI();
  setupEvents();
  initSupabase();

  await syncSellerAuthFromSession();

  await refreshData({ silent: true });
  testSupabaseConnection().catch(console.error);

  if (window.__pendingProfile && isSellerAuthed()) {
    await setActiveProfile(window.__pendingProfile);
    window.__pendingProfile = null;
  } else {
    showPublicShopView();
  }
}

window.openSellerGate = openSellerGate;

window.submitSale = function (event) {
  if (event) event.preventDefault();
  return handleSaleSubmit(event);
};

window.submitOrder = function (event) {
  if (event) event.preventDefault();
  return handleOrderSubmit(event);
};

async function bootApp() {
  try {
    bindDomRefs();
    loadFromLocalStorage();
    loadOrdersFromLocalStorage();
    await initApp();
  } catch (err) {
    console.error("Init fehlgeschlagen:", err);
    alert("App-Fehler: " + err.message + "\n\nBitte F5 drücken.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApp);
} else {
  bootApp();
}
