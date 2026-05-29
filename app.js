const TOTAL_VAPES = 160;
const TOTAL_COST = 980;
const COST_PER_VAPE = TOTAL_COST / TOTAL_VAPES; // 6.125 €

const CHART_THEME = {
  lime: "#d4ff00",
  cyan: "#00f0ff",
  grid: "rgba(255, 255, 255, 0.06)",
  text: "#71717a",
};

const state = {
  activeProfile: null,
  profiles: {
    Aron: { sales: [] },
    Mehmet: { sales: [] },
  },
};

const costPerVapeEl = document.getElementById("costPerVape");
const profileSelectSection = document.getElementById("profile-select");
const dashboardSection = document.getElementById("dashboard");
const activeProfileNameEl = document.getElementById("activeProfileName");
const activeProfileAvatarEl = document.getElementById("activeProfileAvatar");
const changeProfileBtn = document.getElementById("changeProfileBtn");
const saleForm = document.getElementById("saleForm");
const buyerNameInput = document.getElementById("buyerName");
const salePriceInput = document.getElementById("salePrice");
const saleQuantityInput = document.getElementById("saleQuantity");
const statsProfileNameEl = document.getElementById("statsProfileName");
const statUnitsEl = document.getElementById("statUnits");
const statRevenueEl = document.getElementById("statRevenue");
const statCostEl = document.getElementById("statCost");
const statProfitEl = document.getElementById("statProfit");
const salesListEl = document.getElementById("salesList");
const undoLastSaleBtn = document.getElementById("undoLastSaleBtn");

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

function createSaleId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

function refreshProfile(name) {
  const profile = getProfile(name);
  recalculateTotals(profile);
}

function initCostInfo() {
  if (costPerVapeEl) {
    costPerVapeEl.textContent = formatCurrency(COST_PER_VAPE);
  }
}

function setActiveProfile(name) {
  state.activeProfile = name;

  profileSelectSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");

  activeProfileNameEl.textContent = name;
  activeProfileAvatarEl.textContent = name[0] || "?";
  activeProfileAvatarEl.className = "avatar avatar-lg";
  activeProfileAvatarEl.classList.add(
    name === "Aron" ? "avatar-aron" : "avatar-mehmet"
  );

  statsProfileNameEl.textContent = name;

  if (!revenueChart) {
    initCharts();
  }

  updateUI();
}

function resetToProfileSelection() {
  state.activeProfile = null;
  dashboardSection.classList.add("hidden");
  profileSelectSection.classList.remove("hidden");
}

function handleSaleSubmit(event) {
  event.preventDefault();
  if (!state.activeProfile) return;

  const buyerName = buyerNameInput.value.trim();
  const price = parseFloat(salePriceInput.value.replace(",", "."));
  const qty = parseInt(saleQuantityInput.value, 10);

  if (!buyerName) {
    alert("Bitte den Namen des Käufers eingeben.");
    buyerNameInput.focus();
    return;
  }

  if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
    alert("Bitte gültigen Verkaufspreis und Menge eingeben.");
    return;
  }

  const profile = getProfile(state.activeProfile);
  const revenue = price * qty;
  const cost = COST_PER_VAPE * qty;
  const profit = revenue - cost;

  profile.sales.push({
    id: createSaleId(),
    buyerName,
    price,
    qty,
    revenue,
    cost,
    profit,
    seller: state.activeProfile,
    timestamp: new Date(),
  });

  recalculateTotals(profile);

  saleForm.reset();
  saleQuantityInput.value = "1";

  updateUI();
}

function deleteSale(saleId) {
  if (!state.activeProfile) return;

  const profile = getProfile(state.activeProfile);
  const index = profile.sales.findIndex((s) => s.id === saleId);
  if (index === -1) return;

  const sale = profile.sales[index];
  const ok = confirm(
    `Verkauf an „${sale.buyerName}“ (${sale.qty}× ${formatCurrency(sale.price)}) wirklich löschen?`
  );
  if (!ok) return;

  profile.sales.splice(index, 1);
  recalculateTotals(profile);
  updateUI();
}

function undoLastSale() {
  if (!state.activeProfile) return;

  const profile = getProfile(state.activeProfile);
  if (profile.sales.length === 0) return;

  const last = profile.sales[profile.sales.length - 1];
  const ok = confirm(
    `Letzten Verkauf widerrufen?\n\nKäufer: ${last.buyerName}\n${last.qty}× ${formatCurrency(last.price)}`
  );
  if (!ok) return;

  profile.sales.pop();
  recalculateTotals(profile);
  updateUI();
}

function renderSalesList() {
  if (!state.activeProfile || !salesListEl) return;

  const profile = getProfile(state.activeProfile);

  if (undoLastSaleBtn) {
    undoLastSaleBtn.disabled = profile.sales.length === 0;
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
            <button type="button" class="delete-sale-btn" data-sale-id="${sale.id}">
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
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: scaleDefaults,
      y: {
        ...scaleDefaults,
        beginAtZero: true,
        ticks: {
          ...scaleDefaults.ticks,
          ...(currencyY
            ? { callback: (value) => formatCurrency(value) }
            : {}),
        },
      },
    },
  };
}

function initCharts() {
  const revenueCtx = document.getElementById("revenueChart").getContext("2d");
  const profitCtx = document.getElementById("profitChart").getContext("2d");
  const unitsComparisonCtx =
    document.getElementById("unitsComparisonChart").getContext("2d");
  const profitComparisonCtx =
    document.getElementById("profitComparisonChart").getContext("2d");

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
  const glow = document.getElementById("cursorGlow");
  if (!glow || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;

  document.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  function animate() {
    x += (targetX - x) * 0.12;
    y += (targetY - y) * 0.12;
    glow.style.left = `${x}px`;
    glow.style.top = `${y}px`;
    requestAnimationFrame(animate);
  }

  animate();
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

function setupProfileCards() {
  document.querySelectorAll(".profile-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveProfile(btn.getAttribute("data-profile"));
    });
  });
}

function setupEvents() {
  setupProfileCards();

  changeProfileBtn.addEventListener("click", resetToProfileSelection);
  saleForm.addEventListener("submit", handleSaleSubmit);

  if (undoLastSaleBtn) {
    undoLastSaleBtn.addEventListener("click", undoLastSale);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCostInfo();
  setupEvents();
  setupCursorGlow();
});
