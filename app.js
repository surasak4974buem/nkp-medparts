// Application Logic Core - Nakhonping Hospital Spare Parts System
// Conforming to SMM 07-1:2024 and CMMS requirements

// Global State
let parts = [];
let equipment = [];
let transactions = [];
let pmPlans = [];
let settings = {
  password: "NKP-medparts-2026",
  gasUrl: "",
  lineToggle: true,
  lineToken: "",
  lineGroupId: ""
};

// Chart References for updates
let tscEvChartRef = null;
let abcChartRef = null;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  initStorage();
  checkAuth();
  initializeUI();
  updateDashboard();
  renderCatalog();
  populateTransactionSelects();
  renderTransactionsTable();
  renderPMPlans();
  renderProcurementMonitor();
});

// 1. LocalStorage and State Initialization
function initStorage() {
  // Load settings
  const storedSettings = localStorage.getItem("nkp_parts_settings");
  if (storedSettings) {
    settings = { ...settings, ...JSON.parse(storedSettings) };
  } else {
    localStorage.setItem("nkp_parts_settings", JSON.stringify(settings));
  }

  // Load parts database
  const storedParts = localStorage.getItem("nkp_parts");
  if (storedParts) {
    parts = JSON.parse(storedParts);
  } else {
    parts = [...INITIAL_PARTS];
    localStorage.setItem("nkp_parts", JSON.stringify(parts));
  }

  // Load equipment
  const storedEquipment = localStorage.getItem("nkp_equipment");
  if (storedEquipment) {
    equipment = JSON.parse(storedEquipment);
  } else {
    equipment = [...INITIAL_EQUIPMENT];
    localStorage.setItem("nkp_equipment", JSON.stringify(equipment));
  }

  // Load transactions
  const storedTx = localStorage.getItem("nkp_transactions");
  if (storedTx) {
    transactions = JSON.parse(storedTx);
  } else {
    transactions = [...INITIAL_TRANSACTIONS];
    localStorage.setItem("nkp_transactions", JSON.stringify(transactions));
  }

  // Load PM Plans
  const storedPm = localStorage.getItem("nkp_pm_plans");
  if (storedPm) {
    pmPlans = JSON.parse(storedPm);
  } else {
    pmPlans = [...INITIAL_PM_PLANS];
    localStorage.setItem("nkp_pm_plans", JSON.stringify(pmPlans));
  }

  // Calculate dynamic ABC tags initially
  recalculateABC();
}

function persistState() {
  localStorage.setItem("nkp_parts", JSON.stringify(parts));
  localStorage.setItem("nkp_transactions", JSON.stringify(transactions));
  localStorage.setItem("nkp_pm_plans", JSON.stringify(pmPlans));
  recalculateABC();
  
  // Optional cloud sync
  triggerCloudSync();
}

// 2. Authentication Password Gate (Default: NKP-medparts-2026)
function checkAuth() {
  const loginOverlay = document.getElementById("login-overlay");
  const isAuthenticated = sessionStorage.getItem("nkp_authenticated");

  if (isAuthenticated === "true") {
    loginOverlay.classList.add("hidden");
  } else {
    loginOverlay.classList.remove("hidden");
  }

  // Bind login action
  document.getElementById("login-submit-btn").addEventListener("click", processLogin);
  document.getElementById("login-password").addEventListener("keypress", (e) => {
    if (e.key === "Enter") processLogin();
  });

  // Logout button
  document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("nkp_authenticated");
    location.reload();
  });
}

function processLogin() {
  const pwdInput = document.getElementById("login-password").value;
  const errorDiv = document.getElementById("login-error");

  if (pwdInput === settings.password) {
    sessionStorage.setItem("nkp_authenticated", "true");
    document.getElementById("login-overlay").classList.add("hidden");
    showToast("เข้าสู่ระบบสำเร็จ", "ยินดีต้อนรับสู่ระบบคลังอะไหล่ รพ.นครพิงค์", "success");
    // Redraw graphs just in case
    setTimeout(() => {
      drawDashboardCharts();
    }, 200);
  } else {
    errorDiv.innerText = "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
    showToast("เข้าสู่ระบบล้มเหลว", "รหัสผ่านที่กรอกไม่ถูกต้อง", "danger");
  }
}

// 3. Tab Navigation & Core Event Listeners
function initializeUI() {
  // Sidebar tab switching
  const links = document.querySelectorAll(".sidebar-link");
  links.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const tabName = link.getAttribute("data-tab");
      
      // Toggle sidebar active state
      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      // Toggle tab panel display
      const tabContents = document.querySelectorAll(".tab-content");
      tabContents.forEach(content => content.classList.remove("active"));
      document.getElementById(`tab-${tabName}`).classList.add("active");

      // Update titles
      updateTabHeader(tabName);
    });
  });

  // Theme Toggle Dark/Light Mode
  const themeToggle = document.getElementById("theme-toggle");
  themeToggle.addEventListener("change", (e) => {
    if (e.target.checked) {
      document.body.setAttribute("data-theme", "dark");
    } else {
      document.body.removeAttribute("data-theme");
    }
    // Re-draw charts to fit the background styling
    drawDashboardCharts();
  });

  // Date and Time ticker
  setInterval(() => {
    const now = new Date();
    document.getElementById("live-time-display").innerText = now.toLocaleString("th-TH");
  }, 1000);

  // Search in catalog
  document.getElementById("catalog-search").addEventListener("input", renderCatalog);
  document.getElementById("catalog-filter-abc").addEventListener("change", renderCatalog);
  document.getElementById("catalog-filter-status").addEventListener("change", renderCatalog);

  // Transaction form dynamic fields show/hide
  const txTypeSelect = document.getElementById("tx-type");
  txTypeSelect.addEventListener("change", handleTxTypeChange);
  handleTxTypeChange();

  // Transaction form submission
  document.getElementById("tx-form").addEventListener("submit", processTransaction);

  // Forecast calculator trigger
  document.getElementById("btn-run-forecast").addEventListener("click", calculateForecast);

  // Reorder point alert trigger for Simulated PR
  document.getElementById("btn-export-logs").addEventListener("click", exportTransactionsToCSV);

  // Settings Save
  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-test-line").addEventListener("click", testLineMessage);

  // Add Part Modal triggers
  document.getElementById("btn-add-part").addEventListener("click", () => {
    document.getElementById("part-form").reset();
    document.getElementById("part-form-mode").value = "add";
    document.getElementById("modal-add-title").innerText = "เพิ่มอะไหล่ทางการแพทย์ใหม่เข้าระบบ";
    document.getElementById("part-code").disabled = false;
    openModal("modal-add-part");
  });

  document.getElementById("btn-save-part").addEventListener("click", savePartDetails);
  document.getElementById("btn-copy-code").addEventListener("click", copyAppsScriptCode);

  // Display initial settings inputs
  document.getElementById("settings-password").value = settings.password;
  document.getElementById("settings-gas-url").value = settings.gasUrl;
  document.getElementById("settings-line-toggle").checked = settings.lineToggle;
  document.getElementById("settings-line-token").value = settings.lineToken;
  document.getElementById("settings-line-groupid").value = settings.lineGroupId;
}

function updateTabHeader(tabName) {
  const titles = {
    dashboard: ["แดชบอร์ดภาพรวม", "วิเคราะห์สถิติคลังสินค้า ความปลอดภัย และอัตราค่าบำรุงรักษา"],
    catalog: ["คลังอะไหล่และอุปกรณ์", "จัดการรายชื่ออะไหล่ สเปกทางเทคนิค และจุดสั่งซื้อที่ได้รับการระบุ"],
    transactions: ["เบิกจ่ายและรับเข้าคลัง", "ทำกิจกรรม เบิก จ่าย รับของ ยืม คืน และตรวจสอบความถูกต้องของระบบคลัง"],
    planning: ["แผนบำรุงรักษาเชิงรุก", "ตาราง PM ประจำปี และเครื่องมือคาดการณ์ความต้องการวัสดุอะไหล่ในอนาคต"],
    procurement: ["ใบขอจัดซื้ออะไหล่", "ตรวจสอบชิ้นส่วนที่หมดเกณฑ์สำรอง และสร้างใบขอเสนอซื้อแบบอัตโนมัติ"],
    settings: ["คลาวด์ & LINE Settings", "ตั้งค่าการเชื่อมต่อฐานข้อมูล Google Sheets และระบบ LINE OA Notifications"]
  };
  
  if (titles[tabName]) {
    document.getElementById("current-tab-title").innerText = titles[tabName][0];
    document.getElementById("current-tab-desc").innerText = titles[tabName][1];
  }

  // Refresh pages when clicked
  if (tabName === "dashboard") {
    updateDashboard();
  } else if (tabName === "catalog") {
    renderCatalog();
  } else if (tabName === "transactions") {
    populateTransactionSelects();
    renderTransactionsTable();
  } else if (tabName === "planning") {
    renderPMPlans();
  } else if (tabName === "procurement") {
    renderProcurementMonitor();
  }
}

// 4. Calculations: ABC Recalculation & Expiry status
function recalculateABC() {
  if (parts.length === 0) return;

  // 1. Calculate individual value contribution (Unit Price * Current Stock)
  parts.forEach(part => {
    part.totalValue = part.unitPrice * part.inStock;
  });

  // 2. Sort parts descending by total value contribution
  const sortedParts = [...parts].sort((a, b) => b.totalValue - a.totalValue);

  // 3. Sum total inventory value
  const grandTotalValue = sortedParts.reduce((sum, p) => sum + p.totalValue, 0);

  if (grandTotalValue === 0) {
    // If no value, divide evenly or make everything Class C
    parts.forEach(part => part.abcClass = "C");
    return;
  }

  // 4. Determine ABC Class based on cumulative contribution percentage
  let cumulativeValue = 0;
  sortedParts.forEach(sortedPart => {
    cumulativeValue += sortedPart.totalValue;
    const ratio = cumulativeValue / grandTotalValue;

    // A: Top 80% value contribution, B: Next 15% (up to 95%), C: Final 5%
    let abcClass = "C";
    if (ratio <= 0.80) {
      abcClass = "A";
    } else if (ratio <= 0.95) {
      abcClass = "B";
    }

    // Match back to main parts array
    const originalPart = parts.find(p => p.code === sortedPart.code);
    if (originalPart) {
      originalPart.abcClass = abcClass;
    }
  });
}

// Check Expiry State
function getExpiryState(expiryStr) {
  const today = new Date();
  const expiryDate = new Date(expiryStr);
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { status: "Expired", label: "หมดอายุแล้ว", class: "badge-expired" };
  } else if (diffDays <= 90) {
    return { status: "Near Expiry", label: `ใกล้หมดอายุ (${diffDays} วัน)`, class: "badge-near-expiry" };
  } else {
    return { status: "Safe", label: "ปกติ", class: "badge-safe" };
  }
}

// Check Stock Level state
function getStockState(part) {
  if (part.inStock <= 0) {
    return { status: "Out of Stock", label: "สินค้าหมด", class: "badge-out-of-stock" };
  } else if (part.inStock <= part.reorderPoint) {
    return { status: "Low Stock", label: "ต่ำกว่าจุดสั่งซื้อ", class: "badge-low-stock" };
  } else {
    return { status: "In Stock", label: "ปกติ", class: "badge-in-stock" };
  }
}

// 5. Dashboard View Updates & Charts
function updateDashboard() {
  recalculateABC();
  
  // Compute metric cards
  document.getElementById("metric-total-items").innerText = parts.length;
  
  const lowStockCount = parts.filter(p => p.inStock <= p.reorderPoint).length;
  document.getElementById("metric-low-stock-count").innerText = lowStockCount;
  
  const expiredCount = parts.filter(p => {
    const state = getExpiryState(p.expiryDate);
    return state.status === "Expired" || state.status === "Near Expiry";
  }).length;
  document.getElementById("metric-expired-count").innerText = expiredCount;

  // Add flashing warning animations to cards if values > 0
  const lowStockCard = document.getElementById("metric-low-stock-card");
  if (lowStockCount > 0) lowStockCard.classList.add("danger");
  else lowStockCard.classList.remove("danger");

  const expiredCard = document.getElementById("metric-expired-card");
  if (expiredCount > 0) expiredCard.style.borderLeftColor = "var(--danger)";

  // Total inventory value
  const totalValue = parts.reduce((sum, p) => sum + (p.unitPrice * p.inStock), 0);
  document.getElementById("metric-total-value").innerText = "฿" + totalValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Render alerts list
  renderDashboardAlertsTable();

  // Draw/Refresh Dashboard Charts
  drawDashboardCharts();
}

function renderDashboardAlertsTable() {
  const tbody = document.querySelector("#dashboard-alerts-table tbody");
  tbody.innerHTML = "";

  // Filter parts with alerts (low stock or near expiry/expired)
  const alertParts = parts.filter(p => {
    const stockState = getStockState(p);
    const expiryState = getExpiryState(p.expiryDate);
    return stockState.status === "Low Stock" || stockState.status === "Out of Stock" || expiryState.status === "Expired" || expiryState.status === "Near Expiry";
  });

  if (alertParts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">🎉 ไม่มีรายการด่วน อะไหล่ทุกรายการมีความปลอดภัยและเพียงพอ</td></tr>`;
    return;
  }

  alertParts.forEach(p => {
    const stockState = getStockState(p);
    const expiryState = getExpiryState(p.expiryDate);
    
    let issueLabel = "";
    if (stockState.status === "Out of Stock") issueLabel += `<span class="badge badge-out-of-stock">คลังหมด</span> `;
    else if (stockState.status === "Low Stock") issueLabel += `<span class="badge badge-low-stock">สต๊อกต่ำ</span> `;
    
    if (expiryState.status === "Expired") issueLabel += `<span class="badge badge-expired">หมดอายุ</span>`;
    else if (expiryState.status === "Near Expiry") issueLabel += `<span class="badge badge-near-expiry">ใกล้หมดอายุ</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.code}</strong></td>
      <td>${p.name}</td>
      <td><span style="font-size: 0.8rem; background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px;">${p.location}</span></td>
      <td><strong>${p.inStock}</strong></td>
      <td>${p.minStock} / ${p.reorderPoint}</td>
      <td>${issueLabel}</td>
      <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${p.supplierName}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function drawDashboardCharts() {
  // Theme styling adjustments for labels
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const labelColor = isDark ? "#d1d5db" : "#334155";
  const gridColor = isDark ? "#374151" : "#e2e8f0";

  // 1. ABC Donut Chart Data preparation
  const abcCounts = { A: 0, B: 0, C: 0 };
  const abcValues = { A: 0, B: 0, C: 0 };

  parts.forEach(p => {
    abcCounts[p.abcClass]++;
    abcValues[p.abcClass] += (p.unitPrice * p.inStock);
  });

  // Destroy previous if exists
  if (abcChartRef) abcChartRef.destroy();

  const abcCtx = document.getElementById("abcChart").getContext("2d");
  abcChartRef = new Chart(abcCtx, {
    type: 'doughnut',
    data: {
      labels: [
        `Class A (มูลค่าสูง) (${abcCounts.A} รายการ)`,
        `Class B (มูลค่ากลาง) (${abcCounts.B} รายการ)`,
        `Class C (มูลค่าต่ำ) (${abcCounts.C} รายการ)`
      ],
      datasets: [{
        data: [abcValues.A, abcValues.B, abcValues.C],
        backgroundColor: [
          '#ef4444', // Red for A
          '#3b82f6', // Blue for B
          '#14b8a6'  // Teal for C
        ],
        borderWidth: 1,
        borderColor: isDark ? '#111827' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: labelColor, font: { family: 'Sarabun', size: 11 } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const val = context.raw || 0;
              return " มูลค่า: ฿" + val.toLocaleString("th-TH", { maximumFractionDigits: 0 });
            }
          }
        }
      }
    }
  });

  // 2. TSC / EV Ratio Bar Chart Data preparation
  // Group transactions by eqSerial to sum parts prices issued to each machine
  const serviceCosts = {};
  transactions.filter(t => t.type === "Issue" && t.eqSerial).forEach(t => {
    if (!serviceCosts[t.eqSerial]) {
      serviceCosts[t.eqSerial] = 0;
    }
    // Multiply qty by unitPrice from parts DB to get actual cost
    const part = parts.find(p => p.code === t.partCode);
    const unitPrice = part ? part.unitPrice : 0;
    serviceCosts[t.eqSerial] += (t.qty * unitPrice);
  });

  // Calculate ratio against machine values
  const labels = [];
  const ratios = [];
  const backgroundColors = [];

  equipment.forEach(eq => {
    const cost = serviceCosts[eq.serial] || 0;
    const ratio = (cost / eq.value) * 100;
    
    // Save to list
    labels.push(`${eq.serial} (${eq.model.split(" ")[0]})`);
    ratios.push(ratio.toFixed(1));

    // Color code based on critical values: Red > 10% for spare parts ratio (standard is technical service ratio)
    // Note: Standard 5.1.5 (ข) uses tech service costs vs. equipment value. High ratio means equipment is unstable.
    if (ratio >= 25.0) {
      backgroundColors.push('#ef4444'); // Dangerous red
    } else if (ratio >= 5.0) {
      backgroundColors.push('#f97316'); // Warning orange
    } else {
      backgroundColors.push('#14b8a6'); // Safe teal
    }
  });

  // Destroy previous if exists
  if (tscEvChartRef) tscEvChartRef.destroy();

  const tscCtx = document.getElementById("tscEvChart").getContext("2d");
  tscEvChartRef = new Chart(tscCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'สัดส่วน TSC / EV (%)',
        data: ratios,
        backgroundColor: backgroundColors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: labelColor, font: { family: 'Sarabun', size: 10 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: labelColor },
          title: { display: true, text: 'อัตราส่วน (%)', color: labelColor }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` อัตราส่วน: ${context.raw}% ของราคาซื้อเครื่อง`;
            }
          }
        }
      }
    }
  });
}

// 6. Spare Parts Catalog tab rendering
function renderCatalog() {
  const tbody = document.getElementById("catalog-table-body");
  tbody.innerHTML = "";

  const searchVal = document.getElementById("catalog-search").value.toLowerCase();
  const filterAbc = document.getElementById("catalog-filter-abc").value;
  const filterStatus = document.getElementById("catalog-filter-status").value;

  const filteredParts = parts.filter(p => {
    // 1. Search filter
    const matchesSearch = p.code.toLowerCase().includes(searchVal) || 
                          p.name.toLowerCase().includes(searchVal) || 
                          p.manufacturer.toLowerCase().includes(searchVal);

    // 2. ABC Class filter
    const matchesAbc = (filterAbc === "ALL" || p.abcClass === filterAbc);

    // 3. Stock Status filter
    const stockState = getStockState(p);
    const expiryState = getExpiryState(p.expiryDate);
    
    let matchesStatus = true;
    if (filterStatus === "LOW") {
      matchesStatus = (stockState.status === "Low Stock" || stockState.status === "Out of Stock");
    } else if (filterStatus === "EXPIRED") {
      matchesStatus = (expiryState.status === "Expired" || expiryState.status === "Near Expiry");
    } else if (filterStatus === "NORMAL") {
      matchesStatus = (stockState.status === "In Stock" && expiryState.status === "Safe");
    }

    return matchesSearch && matchesAbc && matchesStatus;
  });

  if (filteredParts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 30px; color: var(--text-muted);">❌ ไม่พบรายการอะไหล่ตามเงื่อนไขการค้นหา</td></tr>`;
    return;
  }

  filteredParts.forEach(p => {
    const stockState = getStockState(p);
    const expiryState = getExpiryState(p.expiryDate);
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.code}</strong></td>
      <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <span style="font-weight: 600;">${p.name}</span><br>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${p.description}</span>
      </td>
      <td>${p.manufacturer}</td>
      <td><span class="badge badge-${p.abcClass.toLowerCase()}">Class ${p.abcClass}</span></td>
      <td><span style="font-size: 0.8rem; background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px;">${p.location}</span></td>
      <td>
        <span class="badge ${stockState.class}">${p.inStock} ชิ้น</span>
      </td>
      <td><strong>฿${p.unitPrice.toLocaleString("th-TH")}</strong></td>
      <td>
        <span class="badge ${expiryState.class}">${p.expiryDate}</span>
      </td>
      <td>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="showStockCard('${p.code}')" style="padding: 4px 8px; font-size: 0.75rem;">
            <i data-lucide="eye" style="width: 14px; height: 14px;"></i> การใช้งาน
          </button>
          <button class="btn btn-secondary btn-sm" onclick="editPartDetails('${p.code}')" style="padding: 4px 8px; font-size: 0.75rem; color: var(--primary);">
            <i data-lucide="edit" style="width: 14px; height: 14px;"></i> แก้ไข
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Re-init icons dynamically rendered
  lucide.createIcons();
}

// Drawer stock card detail popup
window.showStockCard = function(partCode) {
  const part = parts.find(p => p.code === partCode);
  if (!part) return;

  document.getElementById("modal-sc-name").innerText = part.name;
  document.getElementById("modal-sc-code").innerText = part.code;
  document.getElementById("modal-sc-abc").innerText = `Class ${part.abcClass} (ระดับความเข้มงวด)`;
  document.getElementById("modal-sc-desc").innerText = part.description || "-";
  document.getElementById("modal-sc-manufacturer").innerText = part.manufacturer;
  document.getElementById("modal-sc-location").innerText = part.location;
  document.getElementById("modal-sc-stock").innerText = `${part.inStock} ชิ้น`;
  
  // Set stock color based on thresholds
  const stockColor = part.inStock <= part.reorderPoint ? "var(--danger)" : "var(--success)";
  document.getElementById("modal-sc-stock").style.color = stockColor;

  document.getElementById("modal-sc-price").innerText = `฿${part.unitPrice.toLocaleString("th-TH")}`;
  document.getElementById("modal-sc-purchase").innerText = part.purchaseDate;
  document.getElementById("modal-sc-expiry").innerText = part.expiryDate;
  document.getElementById("modal-sc-leadtime").innerText = `${part.leadTime} วัน`;
  document.getElementById("modal-sc-freq").innerText = `${part.repairFreq} ครั้ง/ปี`;
  document.getElementById("modal-sc-supplier").innerText = `${part.supplierName} (โทร: ${part.supplierContact})`;

  // Render compatibilities
  const compatList = document.getElementById("modal-sc-compat-list");
  compatList.innerHTML = "";
  
  if (part.equipmentModels && part.equipmentModels.length > 0) {
    part.equipmentModels.forEach(model => {
      // Find machines of this model
      const units = equipment.filter(e => e.model === model);
      const serialsStr = units.map(u => u.serial).join(", ");
      const li = document.createElement("li");
      li.innerHTML = `<strong>${model}</strong> ${serialsStr ? `[ซีเรียลใน รพ.: ${serialsStr}]` : `(ไม่มีเครื่องติดตั้งในระบบ)`}`;
      compatList.appendChild(li);
    });
  } else {
    compatList.innerHTML = `<span style="color: var(--text-muted);">ไม่ได้ระบุเครื่องมือที่เชื่อมโยง</span>`;
  }

  openModal("modal-stock-card");
}

// 7. Edit part modal callback
window.editPartDetails = function(partCode) {
  const part = parts.find(p => p.code === partCode);
  if (!part) return;

  // Set form inputs
  document.getElementById("part-form-mode").value = "edit";
  document.getElementById("modal-add-title").innerText = `แก้ไขข้อมูลอะไหล่: ${part.code}`;
  
  document.getElementById("part-code").value = part.code;
  document.getElementById("part-code").disabled = true; // Lock code on edit
  
  document.getElementById("part-name").value = part.name;
  document.getElementById("part-desc").value = part.description || "";
  document.getElementById("part-manufacturer").value = part.manufacturer;
  document.getElementById("part-location").value = part.location;
  document.getElementById("part-price").value = part.unitPrice;
  document.getElementById("part-stock").value = part.inStock;
  document.getElementById("part-min").value = part.minStock;
  document.getElementById("part-max").value = part.maxStock;
  document.getElementById("part-rop").value = part.reorderPoint;
  document.getElementById("part-roq").value = part.reorderQty;
  document.getElementById("part-purchase-date").value = part.purchaseDate;
  document.getElementById("part-expiry-date").value = part.expiryDate;
  document.getElementById("part-leadtime").value = part.leadTime;
  document.getElementById("part-freq").value = part.repairFreq;
  document.getElementById("part-supplier").value = `${part.supplierName} / Tel: ${part.supplierContact}`;
  document.getElementById("part-compat").value = part.equipmentModels ? part.equipmentModels.join(", ") : "";

  openModal("modal-add-part");
}

function savePartDetails() {
  const form = document.getElementById("part-form");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const mode = document.getElementById("part-form-mode").value;
  const partCode = document.getElementById("part-code").value.trim();
  
  // Format supplier input
  const supplierInput = document.getElementById("part-supplier").value.trim();
  let supName = supplierInput;
  let supContact = "-";
  if (supplierInput.includes("/")) {
    const parts = supplierInput.split("/");
    supName = parts[0].trim();
    supContact = parts[1].replace(/Tel:|ติดต่อ:/gi, "").trim();
  }

  // Format compat models array
  const compatInput = document.getElementById("part-compat").value.trim();
  const compatModels = compatInput ? compatInput.split(",").map(m => m.trim()) : [];

  const partPayload = {
    code: partCode,
    name: document.getElementById("part-name").value.trim(),
    description: document.getElementById("part-desc").value.trim(),
    manufacturer: document.getElementById("part-manufacturer").value.trim(),
    equipmentModels: compatModels,
    inStock: parseInt(document.getElementById("part-stock").value),
    unitPrice: parseFloat(document.getElementById("part-price").value),
    minStock: parseInt(document.getElementById("part-min").value),
    maxStock: parseInt(document.getElementById("part-max").value),
    reorderPoint: parseInt(document.getElementById("part-rop").value),
    reorderQty: parseInt(document.getElementById("part-roq").value),
    purchaseDate: document.getElementById("part-purchase-date").value,
    expiryDate: document.getElementById("part-expiry-date").value,
    leadTime: parseInt(document.getElementById("part-leadtime").value),
    repairFreq: parseInt(document.getElementById("part-freq").value),
    supplierName: supName || "ทั่วไป",
    supplierContact: supContact
  };

  if (mode === "add") {
    // Check duplication
    if (parts.some(p => p.code === partCode)) {
      alert("รหัสอะไหล่นี้มีอยู่แล้วในระบบ กรุณาใช้รหัสอื่น");
      return;
    }
    parts.push(partPayload);
    showToast("สำเร็จ", `เพิ่มอะไหล่ ${partCode} สำเร็จ`, "success");
  } else {
    // Edit
    const index = parts.findIndex(p => p.code === partCode);
    if (index !== -1) {
      parts[index] = { ...parts[index], ...partPayload };
      showToast("สำเร็จ", `แก้ไขรายละเอียดอะไหล่ ${partCode} สำเร็จ`, "success");
    }
  }

  closeModal("modal-add-part");
  persistState();
  renderCatalog();
  updateDashboard();
}

// 8. Warehouse Transaction forms and handlers
function populateTransactionSelects() {
  // Parts dropdown
  const partSelect = document.getElementById("tx-part-code");
  partSelect.innerHTML = "";
  parts.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.code;
    opt.innerText = `[${p.code}] ${p.name} (คงเหลือ: ${p.inStock} ชิ้น)`;
    partSelect.appendChild(opt);
  });

  // Equipments dropdown
  const eqSelect = document.getElementById("tx-eq-serial");
  eqSelect.innerHTML = '<option value="">-- ไม่เชื่อมต่อเครื่องมือ --</option>';
  equipment.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.serial;
    opt.innerText = `${e.serial} - [${e.model}] (แผนก: ${e.dept})`;
    eqSelect.appendChild(opt);
  });
}

function handleTxTypeChange() {
  const type = document.getElementById("tx-type").value;
  const issueDiv = document.getElementById("tx-conditional-issue");
  const borrowDiv = document.getElementById("tx-conditional-borrow");

  // Reset required markers
  const serialSelect = document.getElementById("tx-eq-serial");
  const dueDateInput = document.getElementById("tx-due-date");

  if (type === "Issue") {
    issueDiv.style.display = "grid";
    borrowDiv.style.display = "none";
    serialSelect.required = true;
    dueDateInput.required = false;
  } else if (type === "Borrow") {
    issueDiv.style.display = "grid";
    borrowDiv.style.display = "block";
    serialSelect.required = true;
    dueDateInput.required = true;
  } else {
    // Receive, Return, Audit
    issueDiv.style.display = "none";
    borrowDiv.style.display = "none";
    serialSelect.required = false;
    dueDateInput.required = false;
  }
}

function processTransaction(e) {
  e.preventDefault();
  
  const type = document.getElementById("tx-type").value;
  const partCode = document.getElementById("tx-part-code").value;
  const qty = parseInt(document.getElementById("tx-qty").value);
  const refDoc = document.getElementById("tx-ref-doc").value.trim();
  const operator = document.getElementById("tx-operator").value.trim();
  const details = document.getElementById("tx-details").value.trim();
  
  // Find Part
  const partIndex = parts.findIndex(p => p.code === partCode);
  if (partIndex === -1) {
    alert("ไม่พบรหัสชิ้นส่วนดังกล่าว");
    return;
  }
  
  const part = parts[partIndex];

  // Validate Quantity constraints
  if (type === "Issue" || type === "Borrow") {
    if (part.inStock < qty) {
      alert(`อะไหล่ในสต๊อกมีเพียง ${part.inStock} ชิ้น ไม่เพียงพอต่อการจัดกิจกรรมเบิก ${qty} ชิ้น`);
      return;
    }
  }

  // Adjust stock levels
  let stockAdjustment = 0;
  let borrowStatus = undefined;
  let borrowDueDate = undefined;
  let eqSerial = undefined;
  let eqModel = undefined;
  let maintType = undefined;

  if (type === "Receive") {
    stockAdjustment = qty;
  } else if (type === "Issue") {
    stockAdjustment = -qty;
    eqSerial = document.getElementById("tx-eq-serial").value;
    const eq = equipment.find(e => e.serial === eqSerial);
    eqModel = eq ? eq.model : "-";
    maintType = document.getElementById("tx-maint-type").value;
  } else if (type === "Borrow") {
    stockAdjustment = -qty;
    eqSerial = document.getElementById("tx-eq-serial").value;
    const eq = equipment.find(e => e.serial === eqSerial);
    eqModel = eq ? eq.model : "-";
    borrowStatus = "Borrowed";
    borrowDueDate = document.getElementById("tx-due-date").value;
  } else if (type === "Return") {
    stockAdjustment = qty;
    // Mark associated borrow as returned if matching
    const openBorrow = transactions.find(t => t.partCode === partCode && t.type === "Borrow" && t.borrowStatus === "Borrowed");
    if (openBorrow) {
      openBorrow.borrowStatus = "Returned";
    }
    borrowStatus = "Returned";
  } else if (type === "Audit") {
    // For audit, qty input becomes the direct actual target stock
    stockAdjustment = qty - part.inStock;
  }

  // Record Transaction Entry
  const txId = "TX-" + (10000 + transactions.length + 1);
  const now = new Date();
  
  const txEntry = {
    id: txId,
    timestamp: now.toISOString().split(".")[0],
    type: type,
    partCode: partCode,
    partName: part.name,
    qty: qty,
    refDoc: refDoc || "N/A",
    operator: operator,
    details: details,
    cost: qty * part.unitPrice,
    eqSerial,
    eqModel,
    maintenanceType: maintType,
    borrowStatus,
    borrowDueDate
  };

  // Modify stock count in memory
  if (type === "Audit") {
    part.inStock = qty;
  } else {
    part.inStock += stockAdjustment;
  }

  // Push entry
  transactions.unshift(txEntry); // Store at top of stack

  // Save changes
  persistState();
  showToast("สำเร็จ", `ทำการบันทึกรายการ ${type} รหัสอะไหล่ ${partCode} สำเร็จ`, "success");

  // Reset form
  document.getElementById("tx-form").reset();
  document.getElementById("tx-qty").value = "";
  document.getElementById("tx-ref-doc").value = "";
  document.getElementById("tx-details").value = "";

  // Refresh panels
  populateTransactionSelects();
  renderTransactionsTable();
  updateDashboard();

  // Send LINE OA Notifications
  sendLineNotification(txEntry, part.inStock);
}

function renderTransactionsTable() {
  const tbody = document.getElementById("transactions-table-body");
  tbody.innerHTML = "";

  if (transactions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">📭 ยังไม่มีกิจกรรมการรับจ่ายใดๆ</td></tr>`;
    return;
  }

  transactions.forEach(t => {
    // Format timestamp
    const dateObj = new Date(t.timestamp);
    const dateStr = dateObj.toLocaleDateString("th-TH") + " " + dateObj.toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' });

    // Type Badge
    let typeClass = "badge-in-stock";
    let typeTh = t.type;
    if (t.type === "Issue") { typeClass = "badge-low-stock"; typeTh = "เบิกซ่อม (Issue)"; }
    else if (t.type === "Borrow") { typeClass = "badge-expired"; typeTh = "ยืมทดสอบ (Borrow)"; }
    else if (t.type === "Return") { typeClass = "badge-safe"; typeTh = "คืนของยืม (Return)"; }
    else if (t.type === "Receive") { typeClass = "badge-in-stock"; typeTh = "รับเข้า (Receive)"; }
    else if (t.type === "Audit") { typeClass = "badge-class-b"; typeTh = "นับยอด (Audit)"; }

    // Borrow State columns
    let borrowBadge = "";
    if (t.type === "Borrow" && t.borrowStatus === "Borrowed") {
      const isOverdue = new Date(t.borrowDueDate) < new Date();
      borrowBadge = `<span class="badge ${isOverdue ? 'badge-expired' : 'badge-near-expiry'}">กำลังยืม (คืน ${t.borrowDueDate})</span>`;
    } else if (t.type === "Return" || t.borrowStatus === "Returned") {
      borrowBadge = `<span class="badge badge-safe">คืนเรียบร้อย</span>`;
    }

    const eqText = t.eqSerial ? `${t.eqSerial}<br><span style="font-size: 0.75rem; color: var(--text-muted);">${t.maintenanceType || ''}</span>` : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${dateStr}</span></td>
      <td><span class="badge ${typeClass}">${typeTh}</span></td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <strong>${t.partCode}</strong><br>
        <span style="font-size: 0.75rem; color: var(--text-muted);">${t.partName}</span>
      </td>
      <td><strong>${t.qty}</strong></td>
      <td>${eqText}</td>
      <td>${t.operator}</td>
      <td>${borrowBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportTransactionsToCSV() {
  if (transactions.length === 0) return;
  
  let csvContent = "\ufeffID,Timestamp,Type,PartCode,PartName,Qty,RefDoc,Operator,EqSerial,EqModel,MaintType,Cost\n";
  transactions.forEach(t => {
    csvContent += `"${t.id}","${t.timestamp}","${t.type}","${t.partCode}","${t.partName}",${t.qty},"${t.refDoc}","${t.operator}","${t.eqSerial || ''}","${t.eqModel || ''}","${t.maintenanceType || ''}",${t.cost}\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `NKP_spareparts_ledger_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 9. PM schedule planner & Forecast Engine
function renderPMPlans() {
  const tbody = document.getElementById("planning-pm-body");
  tbody.innerHTML = "";

  pmPlans.forEach(pm => {
    // Generate linked parts badge strings
    const partsString = pm.linkedParts.map(lp => {
      const p = parts.find(part => part.code === lp.code);
      const name = p ? p.name.split(" ")[0] : lp.code;
      return `<code style="background: var(--bg-tertiary); padding: 2px 4px; border-radius: 4px;">[${lp.code}] x${lp.qty}</code>`;
    }).join("<br>");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${pm.id}</strong></td>
      <td><span style="font-weight:600;">${pm.name}</span></td>
      <td>${pm.eqModel}</td>
      <td>${pm.frequency}</td>
      <td><span style="font-weight: 500;">${pm.scheduledDate}</span></td>
      <td>${partsString}</td>
      <td>${pm.assignedTech}</td>
    `;
    tbody.appendChild(tr);
  });
}

function calculateForecast() {
  const lookahead = parseInt(document.getElementById("predict-lookahead").value);
  const tbody = document.getElementById("forecast-table-body");
  tbody.innerHTML = "";

  const today = new Date();
  const horizonDate = new Date();
  horizonDate.setDate(today.getDate() + lookahead);

  // Compile overall requirements
  const requiredCounts = {};

  // Scan plans scheduled within horizon
  pmPlans.forEach(pm => {
    const scheduled = new Date(pm.scheduledDate);
    if (scheduled >= today && scheduled <= horizonDate) {
      pm.linkedParts.forEach(lp => {
        if (!requiredCounts[lp.code]) {
          requiredCounts[lp.code] = 0;
        }
        requiredCounts[lp.code] += lp.qty;
      });
    }
  });

  const codes = Object.keys(requiredCounts);
  if (codes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 24px;">📅 ไม่มีแผนงานบำรุงรักษา PM ที่ต้องใช้อะไหล่ในช่วงเวลานี้</td></tr>`;
    return;
  }

  codes.forEach(code => {
    const part = parts.find(p => p.code === code);
    const required = requiredCounts[code];
    const inStock = part ? part.inStock : 0;
    const diff = inStock - required;

    let statusHtml = "";
    if (diff >= 0) {
      statusHtml = `<span class="badge badge-safe">เพียงพอ (เหลือสำรอง ${diff})</span>`;
    } else {
      statusHtml = `<span class="badge badge-expired" style="background-color: var(--danger-light); color: var(--danger);">⚠️ ขาดแคลน ${Math.abs(diff)} ชิ้น</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${code}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${part ? part.name : 'ไม่ระบุ'}</span></td>
      <td><strong>${required} ชิ้น</strong></td>
      <td>${inStock} ชิ้น</td>
      <td>${statusHtml}</td>
    `;
    tbody.appendChild(tr);
  });

  showToast("คำนวณสำเร็จ", "คำนวณคาดการณ์อะไหล่สำหรับช่วงแผนงานซ่อมบำรุงเสร็จสมบูรณ์", "success");
}

// 10. Procurement Reorder tab & Memorandum PR builder
function renderProcurementMonitor() {
  const tbody = document.getElementById("procurement-alerts-body");
  tbody.innerHTML = "";

  // Filter items below ROP
  const reorderItems = parts.filter(p => p.inStock <= p.reorderPoint);

  if (reorderItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">🎉 อะไหล่ทุกรายการมีระดับคงคลังปลอดภัย สูงกว่าจุดเตือนภัยสั่งซื้อ</td></tr>`;
    document.getElementById("simulated-pr-card").style.display = "none";
    return;
  }

  reorderItems.forEach(p => {
    const val = p.reorderQty * p.unitPrice;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.code}</strong></td>
      <td>${p.name}</td>
      <td><span class="badge badge-low-stock">${p.inStock} ชิ้น</span></td>
      <td>${p.reorderPoint} ชิ้น</td>
      <td><strong>${p.reorderQty} ชิ้น</strong></td>
      <td><span style="font-size: 0.8rem;">${p.supplierName}<br>${p.supplierContact}</span></td>
      <td><strong>฿${val.toLocaleString("th-TH")}</strong></td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="generateSimulatedPR('${p.code}')" style="padding: 4px 8px; font-size: 0.75rem;">
          <i data-lucide="file-plus"></i> ออกใบเสนอซื้อ
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

window.generateSimulatedPR = function(partCode) {
  const part = parts.find(p => p.code === partCode);
  if (!part) return;

  const today = new Date();
  
  // Set PR numbers
  document.getElementById("pr-doc-no").innerText = `${today.getFullYear() + 543}/${transactions.length + 20}`;
  
  const thaiMonths = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  document.getElementById("pr-date").innerText = `${today.getDate()} ${thaiMonths[today.getMonth()]} ${today.getFullYear() + 543}`;

  // Populate items table
  const tbody = document.getElementById("pr-items-tbody");
  const amount = part.reorderQty * part.unitPrice;
  
  tbody.innerHTML = `
    <tr>
      <td style="border: 1px solid black; padding: 10px; text-align: center;">๑</td>
      <td style="border: 1px solid black; padding: 10px;">
        <strong>รหัส ${part.code}</strong> - ${part.name}<br>
        <span style="font-size: 0.75rem; color: #555;">(จัดเก็บที่: ${part.location} | ผู้เสนอขาย: ${part.supplierName})</span>
      </td>
      <td style="border: 1px solid black; padding: 10px; text-align: center;">${part.reorderQty}</td>
      <td style="border: 1px solid black; padding: 10px; text-align: right;">${part.unitPrice.toLocaleString("th-TH", {minimumFractionDigits: 2})}</td>
      <td style="border: 1px solid black; padding: 10px; text-align: right;"><strong>${amount.toLocaleString("th-TH", {minimumFractionDigits: 2})}</strong></td>
    </tr>
    <tr>
      <td colspan="4" style="border: 1px solid black; padding: 10px; text-align: right;"><strong>รวมเป็นเงินทั้งสิ้น (รวมภาษีมูลค่าเพิ่ม 7% แล้ว)</strong></td>
      <td style="border: 1px solid black; padding: 10px; text-align: right; background: #e9e9e9;"><strong>${amount.toLocaleString("th-TH", {minimumFractionDigits: 2})}</strong></td>
    </tr>
  `;

  // Display simulated PR Card
  document.getElementById("simulated-pr-card").style.display = "block";
  document.getElementById("simulated-pr-card").scrollIntoView({ behavior: 'smooth' });
  showToast("ออกใบเสนอเสร็จสมบูรณ์", "ระบบร่างบันทึกข้อเสนอจัดซื้อสำรองคลังเรียบร้อยแล้ว", "success");
}

// 11. Cloud & LINE Integration Core
function saveSettings() {
  const newPwd = document.getElementById("settings-password").value.trim();
  const gasUrl = document.getElementById("settings-gas-url").value.trim();
  const lineToggle = document.getElementById("settings-line-toggle").checked;
  const lineToken = document.getElementById("settings-line-token").value.trim();
  const lineGroupId = document.getElementById("settings-line-groupid").value.trim();

  if (newPwd) settings.password = newPwd;
  settings.gasUrl = gasUrl;
  settings.lineToggle = lineToggle;
  settings.lineToken = lineToken;
  settings.lineGroupId = lineGroupId;

  localStorage.setItem("nkp_parts_settings", JSON.stringify(settings));
  showToast("บันทึกข้อมูลแล้ว", "อัปเดตระบบการตั้งค่าความปลอดภัยและเครือข่ายเรียบร้อย", "success");
}

// Send actual LINE Webhook notification (proxy through Google Apps Script to bypass CORS limits)
function sendLineNotification(tx, remainingStock) {
  if (!settings.lineToggle || !settings.lineToken || !settings.lineGroupId) {
    console.log("LINE Notification omitted: Credentials/Toggle are disabled.", tx);
    return;
  }

  // Build beautiful LINE Flex Message payload representing transaction activity
  const isIncrement = tx.type === "Receive" || tx.type === "Return";
  const typeLabel = tx.type === "Issue" ? "เบิกจ่ายอะไหล่ 📤" : 
                    tx.type === "Borrow" ? "ยืมอะไหล่ทดสอบ 🔍" :
                    tx.type === "Return" ? "คืนอะไหล่คลัง 📥" :
                    tx.type === "Receive" ? "รับอะไหล่เข้าคลัง ➕" : "ปรับปรุงสต๊อก ⚙️";

  const colorTheme = tx.type === "Issue" ? "#ef4444" : 
                     tx.type === "Borrow" ? "#f97316" :
                     tx.type === "Receive" ? "#22c55e" : "#14b8a6";

  const flexMessage = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "คลังเครื่องมือแพทย์ รพ.นครพิงค์",
          "color": "#ffffff",
          "weight": "bold",
          "size": "sm"
        },
        {
          "type": "text",
          "text": typeLabel,
          "color": "#ffffff",
          "weight": "bold",
          "size": "xl",
          "margin": "sm"
        }
      ],
      "backgroundColor": colorTheme
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": tx.partName,
          "weight": "bold",
          "size": "md",
          "wrap": true
        },
        {
          "type": "text",
          "text": "รหัสอะไหล่: " + tx.partCode,
          "size": "xs",
          "color": "#888888",
          "margin": "xs"
        },
        {
          "type": "separator",
          "margin": "md"
        },
        {
          "type": "box",
          "layout": "vertical",
          "margin": "md",
          "spacing": "sm",
          "contents": [
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "จำนวน:", "size": "sm", "color": "#555555" },
                { "type": "text", "text": tx.qty + " ชิ้น", "size": "sm", "weight": "bold", "align": "right" }
              ]
            },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "คงคลังล่าสุด:", "size": "sm", "color": "#555555" },
                { "type": "text", "text": remainingStock + " ชิ้น", "size": "sm", "weight": "bold", "color": remainingStock <= 5 ? "#ef4444" : "#22c55e", "align": "right" }
              ]
            },
            tx.eqSerial ? {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "ซีเรียลเครื่องซ่อม:", "size": "sm", "color": "#555555" },
                { "type": "text", "text": tx.eqSerial, "size": "sm", "align": "right" }
              ]
            } : { "type": "filler" },
            {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                { "type": "text", "text": "ช่างเทคนิค:", "size": "sm", "color": "#555555" },
                { "type": "text", "text": tx.operator, "size": "sm", "align": "right" }
              ]
            }
          ]
        }
      ]
    }
  };

  // Dispatch message via Google Apps Script (if configured) or direct to GAS URL
  if (settings.gasUrl) {
    fetch(settings.gasUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "notify",
        token: settings.lineToken,
        groupId: settings.lineGroupId,
        message: flexMessage
      })
    })
    .then(() => console.log("LINE Alert sent via GAS proxy successfully."))
    .catch(err => console.error("Failed to send LINE notification", err));
  } else {
    console.log("Mocking LINE Push flex message - GAS Web App URL not provided:", flexMessage);
  }
}

function testLineMessage() {
  if (!settings.lineToken || !settings.lineGroupId) {
    alert("กรุณากรอก LINE Token และ Group ID ให้ครบก่อนการกดทดสอบ");
    return;
  }

  const mockTx = {
    type: "Issue",
    partCode: "SR-SPO2-001",
    partName: "ทดสอบการเบิกจ่าย (สายวัด SpO2 Masimo LNCS)",
    qty: 1,
    operator: "นายสมชาย ใจดี (ทดสอบระบบ)",
    eqSerial: "NKP-BSM-001"
  };

  sendLineNotification(mockTx, 29);
  showToast("ทดสอบส่งข้อความ", "กำลังส่งคำขอยิงแจ้งเตือนไปยังไลน์ของกลุ่มงาน...", "warning");
}

function triggerCloudSync() {
  if (!settings.gasUrl) return;

  fetch(settings.gasUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sync",
      parts: parts,
      transactions: transactions
    })
  })
  .then(() => console.log("Background Cloud Sync to Google Sheets successful."))
  .catch(err => console.error("Cloud Database sync failure", err));
}

// Helper utility: Copy Script Box code
function copyAppsScriptCode() {
  const preText = document.getElementById("code-content").innerText;
  navigator.clipboard.writeText(preText).then(() => {
    showToast("คัดลอกโค้ดสำเร็จ", "นำโค้ดไปวางใน Google Apps Script ใน Google Sheets ได้ทันที", "success");
  });
}

// 12. Modal Utility Triggers
window.openModal = function(modalId) {
  document.getElementById(modalId).classList.add("active");
}

window.closeModal = function(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

// Toast Popups utility
window.showToast = function(title, msg, type = "success") {
  const toast = document.getElementById("toast-notification");
  document.getElementById("toast-title").innerText = title;
  document.getElementById("toast-message").innerText = msg;

  // Class styling reset
  toast.classList.remove("success", "danger", "warning");
  toast.classList.add(type);

  // Alter icon based on type
  const icon = toast.querySelector(".toast-icon i");
  if (type === "success") icon.setAttribute("data-lucide", "check-circle2");
  else if (type === "danger") icon.setAttribute("data-lucide", "x-circle");
  else icon.setAttribute("data-lucide", "alert-circle");
  
  lucide.createIcons();

  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 4000);
}
