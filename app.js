const TOTAL_VAPES = 160;
const TOTAL_COST = 980;
const COST_PER_VAPE = TOTAL_COST / TOTAL_VAPES;

const CHART_THEME = {
  lime: "#d4ff00",
  cyan: "#00f0ff",
  grid: "rgba(255, 255, 255, 0.06)",
  text: "#71717a",
};

const state = {
  activeProfile: null,
  loading: false,
  profiles: {
    Aron: { sales: [] },
    Mehmet: { sales: [] },
  },
};

let supabase = null;
let useCloud = false;
const LOCAL_STORAGE_KEY = "vape_ops_sales";

let appRootEl;
let costPerVapeEl;
let profileSelectSection;
let dashboardSection;
let activeProfileNameEl;
let activeProfileAvatarEl;
let changeProfileBtn;
let saleForm;
let buyerNameInput;
let salePriceInput;
let saleQuantityInput;
let statsProfileNameEl;
let statUnitsEl;
let statRevenueEl;
let statCostEl;
let statProfitEl;
let salesListEl;
let undoLastSaleBtn;
let syncStatusEl;
let syncDotEl;
let saleFeedbackEl;

let revenueChart;
let profitChart;
let unitsComparisonChart;
let profitComparisonChart;

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
    price: Number(row.price),
    qty: row.qty,
    revenue: Number(row.revenue),
    cost: Number(row.cost),
    profit: Number(row.profit),
    seller: row.seller,
    timestamp: new Date(row.created_at),
  };
}

function createSaleId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
}

function saveToLocalStorage() {
  const all = [
    ...state.profiles.Aron.sales,
    ...state.profiles.Mehmet.sales,
  ];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
}

function initSupabase() {
  try {
    if (!window.SUPABASE_CONFIG) {
      setSyncStatus("LOKALER MODUS", "error");
      return false;
    }

    if (window.SUPABASE_CONFIG.anonKey?.includes("sb_secret")) {
      console.warn("Secret Key erkannt – bitte anon public key in config.js nutzen.");
      setSyncStatus("FALSCHER API KEY", "error");
      return false;
    }

    if (!isSupabaseConfigured()) {
      setSyncStatus("LOKALER MODUS", "error");
      return false;
    }

    if (!window.supabase?.createClient) {
      console.error("Supabase-Bibliothek nicht geladen.");
      setSyncStatus("LIB FEHLER", "error");
      return false;
    }

    supabase = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );

    useCloud = true;

    try {
      supabase
        .channel("sales-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sales" },
          () => {
            if (state.activeProfile) {
              loadAllSales({ silent: true });
            }
          }
        )
        .subscribe();
    } catch (channelError) {
      console.warn("Realtime nicht verfügbar:", channelError);
    }

    setSyncStatus("CLOUD VERBUNDEN", "ok");
    return true;
  } catch (e) {
    console.error(e);
    supabase = null;
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

function showSaleFeedback(message, isError = false) {
  const el = saleFeedbackEl || document.getElementById("saleFeedback");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function getActiveProfileName() {
  return state.activeProfile || window.__activeProfile || window.__pendingProfile;
}

async function testSupabaseConnection() {
  if (!useCloud || !supabase) {
    setSyncStatus("LOKALER MODUS", "error");
    return false;
  }

  const { error } = await supabase.from("sales").select("id").limit(1);

  if (error) {
    console.error("Supabase Test:", error);
    setSyncStatus("DB: " + error.message.slice(0, 28), "error");
    return false;
  }

  setSyncStatus("CLOUD VERBUNDEN", "ok");
  return true;
}

function setLoading(loading) {
  state.loading = loading;
  if (saleForm) {
    saleForm.querySelectorAll("input, button").forEach((el) => {
      el.disabled = loading;
    });
  }
  if (loading) {
    setSyncStatus("SYNC…", "loading");
  } else if (isSupabaseConfigured()) {
    setSyncStatus("CLOUD VERBUNDEN", "ok");
  }
}

async function loadAllSales({ silent = false } = {}) {
  if (!silent) setLoading(true);

  if (useCloud && supabase) {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      setSyncStatus("CLOUD FEHLER", "error");
      loadFromLocalStorage();
    } else {
      applySalesToState(data.map(mapRowFromDb));
      setSyncStatus("CLOUD VERBUNDEN", "ok");
    }
  } else {
    loadFromLocalStorage();
  }

  setLoading(false);

  if (state.activeProfile) {
    updateUI();
  }
}

function initCostInfo() {
  if (costPerVapeEl) {
    costPerVapeEl.textContent = formatCurrency(COST_PER_VAPE);
  }
}

function getProfileSelectEl() {
  return document.getElementById("profile-select");
}

function getDashboardEl() {
  return document.getElementById("dashboard");
}

function showDashboardView() {
  const root = appRootEl || document.getElementById("appRoot");
  const sel = getProfileSelectEl();
  const dash = getDashboardEl();
  root?.classList.add("mode-dashboard");
  sel?.classList.add("hidden");
  dash?.classList.remove("hidden");
  window.scrollTo(0, 0);
}

function showProfileSelectView() {
  const root = appRootEl || document.getElementById("appRoot");
  const sel = getProfileSelectEl();
  const dash = getDashboardEl();
  root?.classList.remove("mode-dashboard");
  state.activeProfile = null;
  dash?.classList.add("hidden");
  sel?.classList.remove("hidden");
  window.scrollTo(0, 0);
}

async function setActiveProfile(name) {
  bindDomRefs();

  const sel = getProfileSelectEl();
  const dash = getDashboardEl();

  if (!name || !sel || !dash) {
    alert("Seite bitte neu laden (Strg+F5).");
    return;
  }

  profileSelectSection = sel;
  dashboardSection = dash;

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
      console.error("Charts konnten nicht geladen werden:", chartError);
    }
  }

  try {
    await Promise.race([
      loadAllSales(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Zeitüberschreitung")), 12000)
      ),
    ]);
  } catch (loadError) {
    console.error(loadError);
    loadFromLocalStorage();
    setSyncStatus("OFFLINE MODUS", "error");
  }

  updateUI();
}

function resetToProfileSelection() {
  showProfileSelectView();
}

function readSaleFormValues() {
  const buyerEl = document.getElementById("buyerName");
  const priceEl = document.getElementById("salePrice");
  const qtyEl = document.getElementById("saleQuantity");

  if (!buyerEl || !priceEl || !qtyEl) {
    return { error: "Formular nicht gefunden. Bitte Seite neu laden (Strg+F5)." };
  }

  const buyerName = buyerEl.value.trim();
  const price = parseFloat(String(priceEl.value).replace(",", "."));
  const qty = parseInt(qtyEl.value, 10);

  if (!buyerName) {
    return { error: "Bitte Käufername eingeben.", focus: buyerEl };
  }
  if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
    return { error: "Bitte gültigen Preis und Menge eingeben.", focus: priceEl };
  }

  const revenue = price * qty;
  const cost = COST_PER_VAPE * qty;
  const profit = revenue - cost;

  return { buyerName, price, qty, revenue, cost, profit, buyerEl, priceEl, qtyEl };
}

function saveSaleLocally(profileName, saleData) {
  const sale = {
    id: createSaleId(),
    buyerName: saleData.buyerName,
    price: saleData.price,
    qty: saleData.qty,
    revenue: saleData.revenue,
    cost: saleData.cost,
    profit: saleData.profit,
    seller: profileName,
    timestamp: new Date(),
  };
  getProfile(profileName).sales.push(sale);
  recalculateTotals(getProfile(profileName));
  saveToLocalStorage();
  updateUI();
  return sale;
}

async function handleSaleSubmit(event) {
  if (event) event.preventDefault();
  bindDomRefs();

  const profileName = getActiveProfileName();
  if (!profileName) {
    alert("Bitte zuerst Aron oder Mehmet wählen.");
    return;
  }
  if (state.loading) return;

  state.activeProfile = profileName;
  window.__activeProfile = profileName;

  const form = readSaleFormValues();
  if (form.error) {
    alert(form.error);
    form.focus?.focus();
    return;
  }

  setLoading(true);
  showSaleFeedback("Speichere…");

  try {
    if (useCloud && supabase) {
      const { error } = await supabase.from("sales").insert({
        seller: profileName,
        buyer_name: form.buyerName,
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
        showSaleFeedback("Verkauf gespeichert (Cloud)");
        setSyncStatus("CLOUD VERBUNDEN", "ok");
      }
    } else {
      saveSaleLocally(profileName, form);
      showSaleFeedback("Verkauf gespeichert (lokal)");
    }

    const formEl = document.getElementById("saleForm");
    formEl?.reset();
    const qtyInput = document.getElementById("saleQuantity");
    if (qtyInput) qtyInput.value = "1";
  } catch (err) {
    console.error(err);
    alert("Unerwarteter Fehler: " + err.message);
    showSaleFeedback("Fehler beim Speichern", true);
  } finally {
    setLoading(false);
  }
}

async function deleteSale(saleId) {
  if (!state.activeProfile || state.loading) return;

  const profile = getProfile(state.activeProfile);
  const sale = profile.sales.find((s) => s.id === saleId);
  if (!sale) return;

  const ok = confirm(
    `Verkauf an „${sale.buyerName}“ (${sale.qty}× ${formatCurrency(sale.price)}) wirklich löschen?`
  );
  if (!ok) return;

  setLoading(true);

  if (useCloud && supabase) {
    const { error } = await supabase.from("sales").delete().eq("id", saleId);

    if (error) {
      console.error(error);
      alert("Löschen fehlgeschlagen: " + error.message);
      setLoading(false);
      return;
    }

    await loadAllSales({ silent: true });
  } else {
    profile.sales = profile.sales.filter((s) => s.id !== saleId);
    recalculateTotals(profile);
    saveToLocalStorage();
    updateUI();
    setLoading(false);
  }
}

async function undoLastSale() {
  if (!state.activeProfile || state.loading) return;

  const profile = getProfile(state.activeProfile);
  if (profile.sales.length === 0) return;

  const last = profile.sales[profile.sales.length - 1];
  const ok = confirm(
    `Letzten Verkauf widerrufen?\n\nKäufer: ${last.buyerName}\n${last.qty}× ${formatCurrency(last.price)}`
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
      return `
        <article class="sale-item" data-sale-id="${sale.id}">
          <div class="sale-item-main">
            <div class="sale-item-buyer">${escapeHtml(sale.buyerName)}</div>
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
  const revenueCanvas = document.getElementById("revenueChart");
  const profitCanvas = document.getElementById("profitChart");
  const unitsCanvas = document.getElementById("unitsComparisonChart");
  const profitCmpCanvas = document.getElementById("profitComparisonChart");

  if (!revenueCanvas || !profitCanvas || !unitsCanvas || !profitCmpCanvas) {
    throw new Error("Chart-Elemente fehlen im HTML");
  }

  const revenueCtx = revenueCanvas.getContext("2d");
  const profitCtx = profitCanvas.getContext("2d");
  const unitsComparisonCtx = unitsCanvas.getContext("2d");
  const profitComparisonCtx = profitCmpCanvas.getContext("2d");

  revenueChart = new Chart(revenueCtx, {
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
          pointHoverRadius: 6,
        },
      ],
    },
    options: chartBaseOptions(true),
  });

  profitChart = new Chart(profitCtx, {
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
          pointHoverRadius: 6,
        },
      ],
    },
    options: chartBaseOptions(true),
  });

  unitsComparisonChart = new Chart(unitsComparisonCtx, {
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

  profitComparisonChart = new Chart(profitComparisonCtx, {
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

function setupCursorGlow() {
  /* deaktiviert – kann Klicks blockieren */
}

function updateCharts() {
  if (!state.activeProfile || !revenueChart) return;
  const profile = getProfile(state.activeProfile);

  const labels = profile.sales.map(
    (sale, index) => sale.buyerName || `Verkauf ${index + 1}`
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
  updateStats();
  renderSalesList();
  updateCharts();
}

function bindDomRefs() {
  appRootEl = document.getElementById("appRoot");
  costPerVapeEl = document.getElementById("costPerVape");
  profileSelectSection = document.getElementById("profile-select");
  dashboardSection = document.getElementById("dashboard");
  activeProfileNameEl = document.getElementById("activeProfileName");
  activeProfileAvatarEl = document.getElementById("activeProfileAvatar");
  changeProfileBtn = document.getElementById("changeProfileBtn");
  saleForm = document.getElementById("saleForm");
  buyerNameInput = document.getElementById("buyerName");
  salePriceInput = document.getElementById("salePrice");
  saleQuantityInput = document.getElementById("saleQuantity");
  statsProfileNameEl = document.getElementById("statsProfileName");
  statUnitsEl = document.getElementById("statUnits");
  statRevenueEl = document.getElementById("statRevenue");
  statCostEl = document.getElementById("statCost");
  statProfitEl = document.getElementById("statProfit");
  salesListEl = document.getElementById("salesList");
  undoLastSaleBtn = document.getElementById("undoLastSaleBtn");
  syncStatusEl = document.getElementById("syncStatus");
  syncDotEl = document.getElementById("syncDot");
  saleFeedbackEl = document.getElementById("saleFeedback");
}

function setupEvents() {
  changeProfileBtn?.addEventListener("click", resetToProfileSelection);
  saleForm?.addEventListener("submit", handleSaleSubmit);
  undoLastSaleBtn?.addEventListener("click", undoLastSale);
}

window.enterProfile = function (name) {
  window.pickProfile(name);
};

window.onProfilePicked = function (name) {
  setActiveProfile(name);
};

window.submitSale = function (event) {
  handleSaleSubmit(event);
};

function initApp() {
  bindDomRefs();
  initCostInfo();
  setupEvents();
  initSupabase();
  testSupabaseConnection();

  if (window.__pendingProfile) {
    setActiveProfile(window.__pendingProfile);
    window.__pendingProfile = null;
  }

  if (!profileSelectSection || !dashboardSection) {
    console.error("Kritische DOM-Elemente fehlen (#profile-select / #dashboard)");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
