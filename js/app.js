const CATEGORY_LABEL = {
  culture: "文化場館與文化資產",
  library: "公共圖書館",
  digital: "數位機會中心",
  youth: "青年／志工據點與平台",
  education: "教育資源指標點"
};

const CATEGORY_COLOR = {
  culture: "#8a3324",
  library: "#2f5233",
  digital: "#33546b",
  youth: "#a06a1c",
  education: "#5b4a72"
};

const STALE_WARN_DAYS = 30;
const STALE_ALERT_DAYS = 90;

function daysSince(dateStr) {
  const then = new Date(dateStr + "T00:00:00");
  if (isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

function freshnessBadge(dateStr) {
  const days = daysSince(dateStr);
  if (days == null) return "";
  if (days > STALE_ALERT_DAYS) return `<span class="badge badge-stale-alert">已 ${days} 天未查核，資料可能已過期</span>`;
  if (days > STALE_WARN_DAYS) return `<span class="badge badge-stale-warn">已 ${days} 天未查核，建議重新確認</span>`;
  return `<span class="badge badge-fresh">${days} 天前查核</span>`;
}

const state = {
  resources: [],
  townships: [],
  activeCategories: new Set(Object.keys(CATEGORY_LABEL)),
  activeTownship: "",
  searchTerm: "",
  markers: []
};

const map = L.map("map", { scrollWheelZoom: true }).setView([24.68, 121.63], 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);

function makeIcon(category) {
  const color = CATEGORY_COLOR[category] || "#555";
  return L.divIcon({
    className: "",
    html: `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};border:1px solid rgba(0,0,0,0.35);"></span>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
}

function passesFilter(r) {
  if (!state.activeCategories.has(r.category)) return false;
  if (state.activeTownship && r.township !== state.activeTownship) return false;
  if (state.searchTerm && !r.name.toLowerCase().includes(state.searchTerm)) return false;
  return true;
}

function renderMarkers() {
  markerLayer.clearLayers();
  const visible = state.resources.filter(passesFilter);

  visible.forEach(r => {
    if (r.lat == null || r.lng == null) return;
    const marker = L.marker([r.lat, r.lng], { icon: makeIcon(r.category) });
    const geocodeNote = r.geocode_status === "needs_geocoding"
      ? '<p class="popup-source">座標為概略地理編碼，非精確位置。</p>'
      : "";
    marker.bindPopup(`
      <strong>${escapeHtml(r.name)}</strong><br>
      ${escapeHtml(CATEGORY_LABEL[r.category] || r.category)} ｜ ${escapeHtml(r.township)}<br>
      ${r.address ? escapeHtml(r.address) + "<br>" : ""}
      ${escapeHtml(r.description || "")}
      ${geocodeNote}
      <p class="popup-source">來源：${escapeHtml(r.source_org)}｜查核於 ${escapeHtml(r.last_verified)} ${freshnessBadge(r.last_verified)}<br>
      <a href="${escapeAttr(r.source_url)}" target="_blank" rel="noopener">資料來源連結</a></p>
    `);
    marker.addTo(markerLayer);
  });

  document.getElementById("result-count").textContent = `${visible.length} 筆資源（總計 ${state.resources.length} 筆）`;

  const staleCount = visible.filter(r => { const d = daysSince(r.last_verified); return d != null && d > STALE_WARN_DAYS; }).length;
  const staleEl = document.getElementById("stale-count");
  staleEl.textContent = staleCount > 0 ? `其中 ${staleCount} 筆已超過 ${STALE_WARN_DAYS} 天未查核` : "";

  renderList(visible);
}

function renderList(visible) {
  const list = document.getElementById("resource-list");
  list.innerHTML = "";
  visible
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))
    .forEach(r => {
      const li = document.createElement("li");
      const days = daysSince(r.last_verified);
      const staleMark = days != null && days > STALE_ALERT_DAYS ? '<span class="badge badge-stale-alert badge-inline">過期</span>'
        : days != null && days > STALE_WARN_DAYS ? '<span class="badge badge-stale-warn badge-inline">待複查</span>'
        : "";
      li.innerHTML = `<span class="res-name">${escapeHtml(r.name)} ${staleMark}</span><span class="res-meta">${escapeHtml(r.township)} ・ ${escapeHtml(CATEGORY_LABEL[r.category] || r.category)}</span>`;
      li.addEventListener("click", () => {
        if (r.lat != null && r.lng != null) {
          map.setView([r.lat, r.lng], 14);
          const m = state.markers.find(mk => mk.resourceId === r.id);
        }
      });
      list.appendChild(li);
    });
}

function renderCompareTable() {
  const tbody = document.querySelector("#compare-table tbody");
  tbody.innerHTML = "";

  state.townships.forEach(t => {
    const townshipResources = state.resources.filter(r => r.township === t.name);
    const count = townshipResources.length;
    const categoriesCovered = new Set(townshipResources.map(r => r.category)).size;
    const perTenK = t.population ? ((count / t.population) * 10000).toFixed(2) : "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td class="num">${count}</td>
      <td class="num">${t.population != null ? t.population.toLocaleString("zh-Hant") : "資料待補"}</td>
      <td class="num">${perTenK}</td>
      <td class="num">${categoriesCovered}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderSourceList() {
  const ul = document.getElementById("source-list");
  ul.innerHTML = "";
  const seen = new Map();
  state.resources.forEach(r => {
    const key = r.source_org + "|" + r.source_url;
    if (!seen.has(key)) seen.set(key, r);
  });
  seen.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `${escapeHtml(r.source_org)} — <a href="${escapeAttr(r.source_url)}" target="_blank" rel="noopener">${escapeHtml(r.source_url)}</a>`;
    ul.appendChild(li);
  });
}

function populateTownshipSelect() {
  const select = document.getElementById("township-select");
  state.townships.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.name;
    select.appendChild(opt);
  });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

function wireControls() {
  document.querySelectorAll('input[type="checkbox"][data-category]').forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) state.activeCategories.add(cb.dataset.category);
      else state.activeCategories.delete(cb.dataset.category);
      renderMarkers();
    });
  });

  document.getElementById("township-select").addEventListener("change", e => {
    state.activeTownship = e.target.value;
    renderMarkers();
  });

  document.getElementById("search-box").addEventListener("input", e => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderMarkers();
  });
}

async function init() {
  const [resources, townships] = await Promise.all([
    fetch("data/resources.json").then(r => r.json()),
    fetch("data/townships.json").then(r => r.json())
  ]);

  state.resources = resources;
  state.townships = townships;

  populateTownshipSelect();
  wireControls();
  renderMarkers();
  renderCompareTable();
  renderSourceList();

  document.getElementById("last-updated").textContent =
    resources.reduce((latest, r) => (r.last_verified > latest ? r.last_verified : latest), "0000-00-00");
}

init();
