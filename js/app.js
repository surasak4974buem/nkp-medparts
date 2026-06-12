/**
 * NKP-Part: Main Application Logic and Controller
 */

// Global State
const state = {
  inventory: [],
  receiving: [],
  transactions: [],
  stockCounts: [],
  abcChart: null
};

// DOM Elements
const elements = {
  loader: document.getElementById('loading-overlay'),
  toast: document.getElementById('toast'),
  statusIndicator: document.getElementById('api-status-indicator'),
  
  // Navigation
  menuItems: document.querySelectorAll('.menu-item'),
  sections: document.querySelectorAll('.view-section'),
  pageTitle: document.getElementById('page-title'),
  
  // Config Page
  configUrlInput: document.getElementById('config-web-app-url'),
  btnSaveConfig: document.getElementById('btn-save-config'),
  btnTestConnection: document.getElementById('btn-test-connection'),
  
  // Dashboard KPIs
  kpiTotalTypes: document.getElementById('kpi-total-types'),
  kpiTotalQty: document.getElementById('kpi-total-qty'),
  kpiTotalValue: document.getElementById('kpi-total-value'),
  kpiLowStock: document.getElementById('kpi-low-stock'),
  lowStockTbody: document.getElementById('low-stock-tbody'),
  btnExportLowStock: document.getElementById('btn-export-low-stock'),
  
  // Registry Page
  registryTbody: document.getElementById('registry-tbody'),
  registrySearch: document.getElementById('registry-search'),
  filterCritical: document.getElementById('filter-critical'),
  filterAbc: document.getElementById('filter-abc'),
  btnAddPart: document.getElementById('btn-add-part'),
  
  // Receiving Page
  receivingTbody: document.getElementById('receiving-tbody'),
  receivingSearch: document.getElementById('receiving-search'),
  btnAddReceiving: document.getElementById('btn-add-receiving'),
  
  // Transactions Page
  transactionsTbody: document.getElementById('transactions-tbody'),
  txSearch: document.getElementById('tx-search'),
  filterTxStatus: document.getElementById('filter-tx-status'),
  btnAddRequisition: document.getElementById('btn-add-requisition'),
  
  // Stocktake Page
  stocktakeTbody: document.getElementById('stocktake-tbody'),
  stocktakeSearch: document.getElementById('stocktake-search'),
  kpiAccuracyVal: document.getElementById('kpi-accuracy-val'),
  btnAddStockcount: document.getElementById('btn-add-stockcount'),
  
  // Modals
  modalPart: document.getElementById('modal-part'),
  modalPartTitle: document.getElementById('modal-part-title'),
  formPart: document.getElementById('form-part'),
  
  modalReceiving: document.getElementById('modal-receiving'),
  formReceiving: document.getElementById('form-receiving'),
  
  modalRequisition: document.getElementById('modal-requisition'),
  formRequisition: document.getElementById('form-requisition'),
  
  modalReturn: document.getElementById('modal-return'),
  formReturn: document.getElementById('form-return'),
  
  modalStockcount: document.getElementById('modal-stockcount'),
  formStockcount: document.getElementById('form-stockcount')
};

// Format Helpers
const format = {
  number(num) {
    return Number(num).toLocaleString('th-TH');
  },
  currency(num) {
    return Number(num).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  date(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }
};

// Toast Notifications
function showToast(message, type = 'success') {
  elements.toast.innerText = message;
  elements.toast.className = `toast active toast-${type}`;
  setTimeout(() => {
    elements.toast.classList.remove('active');
  }, 4000);
}

// Loader Controls
function showLoader() { elements.loader.classList.add('active'); }
function hideLoader() { elements.loader.classList.remove('active'); }

// Modal Helper Functions
function openModal(modalEl) { modalEl.classList.add('active'); }
function closeModal(modalEl) { modalEl.classList.remove('active'); }

// Setup modal close listeners
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const modalId = btn.getAttribute('data-close');
    closeModal(document.getElementById(modalId));
  });
});

// Update API Connection Status Indicator
function updateStatusIndicator(connected) {
  if (connected) {
    elements.statusIndicator.innerHTML = `<span class="status-dot dot-green"></span><span class="status-text">เชื่อมต่อ API แล้ว</span>`;
  } else {
    elements.statusIndicator.innerHTML = `<span class="status-dot dot-red"></span><span class="status-text">ขาดการเชื่อมต่อ API</span>`;
  }
}

// Initialize Application routing
function initRouter() {
  const handleRoute = () => {
    let hash = window.location.hash || '#dashboard';
    const tabName = hash.replace('#', '');
    
    // Deactivate all menus & views
    elements.menuItems.forEach(item => item.classList.remove('active'));
    elements.sections.forEach(sec => sec.classList.remove('active'));
    
    // Find active menu and section
    const activeMenu = document.querySelector(`.menu-item[data-tab="${tabName}"]`);
    const activeSec = document.getElementById(`view-${tabName}`);
    
    if (activeMenu && activeSec) {
      activeMenu.classList.add('active');
      activeSec.classList.add('active');
      
      // Update page title
      const titles = {
        dashboard: "แดชบอร์ดสรุปผล",
        registry: "ทะเบียนอะไหล่เครื่องมือแพทย์ (FM-MED-007-01)",
        receiving: "ประวัติตรวจรับอะไหล่เข้าคลัง (FM-MED-007-03)",
        transactions: "ประวัติการเบิกจ่าย-คืนอะไหล่ (FM-MED-007-02)",
        stocktake: "บันทึกผลการตรวจนับคลังสินค้า (FM-MED-007-04)",
        config: "ตั้งค่าเชื่อมต่อฐานข้อมูล Google Sheets"
      };
      elements.pageTitle.innerText = titles[tabName] || "ระบบบริหารคลังอะไหล่";
      
      // Perform initial load if API URL is set
      if (tabName !== 'config') {
        const url = NKPApi.getApiUrl();
        if (!url) {
          window.location.hash = '#config';
          showToast("กรุณาบันทึก URL เชื่อมต่อ API ก่อนเริ่มใช้งานระบบ", "warning");
        } else if (state.inventory.length === 0) {
          loadAllData();
        }
      }
    }
  };

  window.addEventListener('hashchange', handleRoute);
  
  // Set initial hash
  if (!window.location.hash) {
    window.location.hash = '#dashboard';
  } else {
    handleRoute();
  }
}

// Load all database entities from Google Sheets
async function loadAllData() {
  if (!NKPApi.getApiUrl()) return;
  showLoader();
  try {
    const [inv, rec, txs, scs] = await Promise.all([
      NKPApi.getInventory(),
      NKPApi.getReceiving(),
      NKPApi.getTransactions(),
      NKPApi.getStockCounts()
    ]);
    
    state.inventory = inv;
    state.receiving = rec;
    state.transactions = txs;
    state.stockCounts = scs;
    
    updateStatusIndicator(true);
    renderAll();
  } catch (err) {
    console.error("Load all data failed:", err);
    updateStatusIndicator(false);
    showToast(`ดึงข้อมูลไม่สำเร็จ: ${err.message}`, "danger");
  } finally {
    hideLoader();
  }
}

// Render All Views based on current state
function renderAll() {
  renderDashboard();
  renderRegistry();
  renderReceiving();
  renderTransactions();
  renderStocktake();
}

// ================= RENDER: DASHBOARD =================
function renderDashboard() {
  // 1. Calculations
  const totalTypes = state.inventory.length;
  let totalQty = 0;
  let totalValue = 0;
  let lowStockCount = 0;
  
  const lowStockItems = [];
  
  state.inventory.forEach(item => {
    const qty = Number(item['จำนวนคงเหลือ'] || 0);
    const price = Number(item['ราคา/หน่วย(บาท)'] || 0);
    const rop = Number(item['ROP'] || 0);
    
    totalQty += qty;
    totalValue += (qty * price);
    
    if (qty <= rop) {
      lowStockCount++;
      lowStockItems.push(item);
    }
  });
  
  // Update UI Elements
  elements.kpiTotalTypes.innerText = format.number(totalTypes);
  elements.kpiTotalQty.innerText = format.number(totalQty);
  elements.kpiTotalValue.innerText = format.currency(totalValue);
  elements.kpiLowStock.innerText = format.number(lowStockCount);
  
  // Render Low Stock Table
  elements.lowStockTbody.innerHTML = '';
  if (lowStockItems.length === 0) {
    elements.lowStockTbody.innerHTML = `<tr><td colspan="6" class="text-center">✅ ไม่มีอะไหล่ต่ำกว่าจุดสั่งซื้อ</td></tr>`;
  } else {
    // Sort low stock items: critical out of stock first, then by remaining ratio
    lowStockItems.sort((a, b) => {
      const aCrit = a['อะไหล่วิกฤต'] === 'ใช่' ? 1 : 0;
      const bCrit = b['อะไหล่วิกฤต'] === 'ใช่' ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;
      return Number(a['จำนวนคงเหลือ'] || 0) - Number(b['จำนวนคงเหลือ'] || 0);
    });
    
    lowStockItems.forEach(item => {
      const qty = Number(item['จำนวนคงเหลือ'] || 0);
      const rop = Number(item['ROP'] || 0);
      const max = Number(item['Max'] || 0);
      const isCritical = item['อะไหล่วิกฤต'] === 'ใช่';
      
      let badgeClass = 'badge-yellow';
      let statusText = 'ต่ำกว่าจุดสั่งซื้อ';
      if (qty === 0) {
        badgeClass = 'badge-red';
        statusText = 'สินค้าหมดคลัง';
      }
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${item['รหัสอะไหล่']}</strong></td>
        <td>
          <div>${item['ชื่ออะไหล่ / ยี่ห้อ']}</div>
          <small class="text-muted">${item['รุ่นเครื่องมือที่ใช้ร่วมกัน']}</small>
        </td>
        <td><span class="badge badge-gray">${item['ตำแหน่งจัดเก็บ']}</span></td>
        <td class="${qty === 0 ? 'text-danger font-bold' : ''}">${format.number(qty)}</td>
        <td>${format.number(rop)} / ${format.number(max)}</td>
        <td>
          <span class="badge ${badgeClass}">${statusText}</span>
          ${isCritical ? '<span class="badge badge-red" style="margin-left:4px;">🚨 อะไหล่วิกฤต</span>' : ''}
        </td>
      `;
      elements.lowStockTbody.appendChild(tr);
    });
  }
  
  // Render ABC Doughnut Chart
  renderAbcChart();
}

// Render Doughnut chart of ABC Group distribution
function renderAbcChart() {
  const abcValues = { A: 0, B: 0, C: 0 };
  
  state.inventory.forEach(item => {
    const qty = Number(item['จำนวนคงเหลือ'] || 0);
    const price = Number(item['ราคา/หน่วย(บาท)'] || 0);
    const grp = item['กลุ่ม ABC'] || 'C';
    
    if (abcValues.hasOwnProperty(grp)) {
      abcValues[grp] += (qty * price);
    } else {
      abcValues.C += (qty * price);
    }
  });
  
  const ctx = document.getElementById('abcChart').getContext('2d');
  
  // Destroy old chart if exists
  if (state.abcChart) {
    state.abcChart.destroy();
  }
  
  state.abcChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['กลุ่ม A (มูลค่าสูง)', 'กลุ่ม B (ปานกลาง)', 'กลุ่ม C (มูลค่าต่ำ)'],
      datasets: [{
        data: [abcValues.A, abcValues.B, abcValues.C],
        backgroundColor: ['#ea4335', '#f9ab00', '#34a853'],
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Sarabun', size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` มูลค่าคลัง: ${format.currency(context.raw)} บาท`;
            }
          }
        }
      }
    }
  });
}

// ================= RENDER: REGISTRY =================
function renderRegistry() {
  const query = elements.registrySearch.value.toLowerCase().trim();
  const critFilter = elements.filterCritical.value;
  const abcFilter = elements.filterAbc.value;
  
  elements.registryTbody.innerHTML = '';
  
  const filtered = state.inventory.filter(item => {
    const matchSearch = 
      item['รหัสอะไหล่'].toString().toLowerCase().includes(query) ||
      (item['OEM Part No'] || '').toString().toLowerCase().includes(query) ||
      item['ชื่ออะไหล่ / ยี่ห้อ'].toString().toLowerCase().includes(query) ||
      (item['รุ่นเครื่องมือที่ใช้ร่วมกัน'] || '').toString().toLowerCase().includes(query) ||
      (item['ผู้ผลิต / ผู้แทนจำหน่าย'] || '').toString().toLowerCase().includes(query);
      
    const matchCrit = !critFilter || item['อะไหล่วิกฤต'] === critFilter;
    const matchAbc = !abcFilter || item['กลุ่ม ABC'] === abcFilter;
    
    return matchSearch && matchCrit && matchAbc;
  });
  
  if (filtered.length === 0) {
    elements.registryTbody.innerHTML = `<tr><td colspan="9" class="text-center">ไม่พบรายการอะไหล่ในระบบ</td></tr>`;
    return;
  }
  
  filtered.forEach(item => {
    const qty = Number(item['จำนวนคงเหลือ'] || 0);
    const rop = Number(item['ROP'] || 0);
    const min = Number(item['Min'] || 0);
    const max = Number(item['Max'] || 0);
    const isCritical = item['อะไหล่วิกฤต'] === 'js-yes' || item['อะไหล่วิกฤต'] === 'ใช่';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item['รหัสอะไหล่']}</strong></td>
      <td>
        <div>${item['ชื่ออะไหล่ / ยี่ห้อ']}</div>
        <small class="text-muted">OEM No: ${item['OEM Part No'] || '-'}</small>
      </td>
      <td>
        <div>${item['รุ่นเครื่องมือที่ใช้ร่วมกัน']}</div>
        <small class="text-muted">${item['ผู้ผลิต / ผู้แทนจำหน่าย'] || '-'}</small>
      </td>
      <td><span class="badge badge-gray">${item['ตำแหน่งจัดเก็บ']}</span></td>
      <td class="${qty <= rop ? 'text-danger font-bold' : ''}">
        ${format.number(qty)}
        ${qty <= rop ? '<i class="fa-solid fa-triangle-exclamation" style="margin-left:4px;" title="ต่ำกว่าจุดสั่งซื้อ"></i>' : ''}
      </td>
      <td>${format.number(min)} / ${format.number(rop)} / ${format.number(max)}</td>
      <td>${format.currency(item['ราคา/หน่วย(บาท)'] || 0)}</td>
      <td>
        <span class="badge badge-blue">กลุ่ม ${item['กลุ่ม ABC'] || 'C'}</span>
        ${isCritical ? '<span class="badge badge-red">วิกฤต</span>' : ''}
      </td>
      <td>
        <button class="btn btn-secondary btn-sm btn-icon-only" onclick="editPart('${item['รหัสอะไหล่']}')" title="แก้ไข"><i class="fa-solid fa-pen"></i></button>
      </td>
    `;
    elements.registryTbody.appendChild(tr);
  });
}

// Edit Part action (bind data to part modal form and open it)
window.editPart = function(partId) {
  const part = state.inventory.find(item => item['รหัสอะไหล่'] === partId);
  if (!part) return;
  
  document.getElementById('part-mode').value = 'edit';
  document.getElementById('part-id').value = part['รหัสอะไหล่'];
  document.getElementById('part-id').readOnly = true;
  document.getElementById('part-oem').value = part['OEM Part No'] || '';
  document.getElementById('part-name').value = part['ชื่ออะไหล่ / ยี่ห้อ'] || '';
  document.getElementById('part-supplier').value = part['ผู้ผลิต / ผู้แทนจำหน่าย'] || '';
  document.getElementById('part-models').value = part['รุ่นเครื่องมือที่ใช้ร่วมกัน'] || '';
  document.getElementById('part-location').value = part['ตำแหน่งจัดเก็บ'] || '';
  
  // Hide initial Qty since it can't be updated here (it should be adjusted via stocktake or receiving)
  document.getElementById('part-initial-qty').parentElement.style.display = 'none';
  
  document.getElementById('part-min').value = part['Min'] || 0;
  document.getElementById('part-rop').value = part['ROP'] || 0;
  document.getElementById('part-max').value = part['Max'] || 0;
  document.getElementById('part-price').value = part['ราคา/หน่วย(บาท)'] || 0;
  document.getElementById('part-purchase-date').value = part['วันที่จัดซื้อล่าสุด'] ? new Date(part['วันที่จัดซื้อล่าสุด']).toISOString().split('T')[0] : '';
  document.getElementById('part-expiry').value = part['Shelf Life / วันหมดอายุ'] ? new Date(part['Shelf Life / วันหมดอายุ']).toISOString().split('T')[0] : '';
  document.getElementById('part-status').value = part['สถานะ'] || 'ใหม่';
  document.getElementById('part-critical').value = part['อะไหล่วิกฤต'] || 'ไม่ใช่';
  document.getElementById('part-abc').value = part['กลุ่ม ABC'] || 'C';
  document.getElementById('part-budget-year').value = part['ปีงบประมาณ'] || '';
  
  elements.modalPartTitle.innerText = "แก้ไขข้อมูลอะไหล่";
  openModal(elements.modalPart);
};

// ================= RENDER: RECEIVING =================
function renderReceiving() {
  const query = elements.receivingSearch.value.toLowerCase().trim();
  elements.receivingTbody.innerHTML = '';
  
  const filtered = state.receiving.filter(item => {
    return (
      (item['เลขเอกสารจัดซื้อ / ใบส่งของ'] || '').toString().toLowerCase().includes(query) ||
      (item['ผู้ขาย / ผู้แทนจำหน่าย'] || '').toString().toLowerCase().includes(query) ||
      item['รหัสอะไหล่'].toString().toLowerCase().includes(query) ||
      item['ชื่ออะไหล่'].toString().toLowerCase().includes(query)
    );
  });
  
  if (filtered.length === 0) {
    elements.receivingTbody.innerHTML = `<tr><td colspan="11" class="text-center">ไม่พบประวัติการตรวจรับเข้าคลัง</td></tr>`;
    return;
  }
  
  // Sort receiving logs by date descending
  filtered.sort((a, b) => new Date(b['วันที่รับ']) - new Date(a['วันที่รับ']));
  
  filtered.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${format.date(item['วันที่รับ'])}</td>
      <td><strong>${item['เลขเอกสารจัดซื้อ / ใบส่งของ']}</strong></td>
      <td>${item['ผู้ขาย / ผู้แทนจำหน่าย']}</td>
      <td><strong>${item['รหัสอะไหล่']}</strong></td>
      <td>${item['ชื่ออะไหล่']}</td>
      <td>${format.number(item['จำนวนที่รับ'])}</td>
      <td>${format.currency(item['ราคา/หน่วย(บาท)'] || 0)}</td>
      <td>${item['Lot / Serial No.'] || '-'}</td>
      <td>${format.date(item['วันหมดอายุ(ถ้ามี)'])}</td>
      <td><span class="badge ${item['ผลการตรวจสภาพ'] === 'ผ่าน' ? 'badge-green' : 'badge-red'}">${item['ผลการตรวจสภาพ']}</span></td>
      <td>${item['ผู้รับ']}</td>
    `;
    elements.receivingTbody.appendChild(tr);
  });
}

// ================= RENDER: TRANSACTIONS =================
function renderTransactions() {
  const query = elements.txSearch.value.toLowerCase().trim();
  const statusFilter = elements.filterTxStatus.value;
  elements.transactionsTbody.innerHTML = '';
  
  const filtered = state.transactions.filter(item => {
    const matchSearch = 
      item['เลขที่ใบเบิก'].toString().toLowerCase().includes(query) ||
      item['เลขที่ใบสั่งงาน (Work Order)'].toString().toLowerCase().includes(query) ||
      item['หมายเลขครุภัณฑ์เครื่องมือ'].toString().toLowerCase().includes(query) ||
      item['ผู้เบิก'].toString().toLowerCase().includes(query) ||
      item['รหัสอะไหล่'].toString().toLowerCase().includes(query) ||
      item['ชื่ออะไหล่'].toString().toLowerCase().includes(query);
      
    const matchStatus = !statusFilter || item['สถานะ'] === statusFilter;
    
    return matchSearch && matchStatus;
  });
  
  if (filtered.length === 0) {
    elements.transactionsTbody.innerHTML = `<tr><td colspan="11" class="text-center">ไม่พบประวัติใบเบิกอะไหล่</td></tr>`;
    return;
  }
  
  // Sort transactions by date descending
  filtered.sort((a, b) => new Date(b['วันที่เบิก']) - new Date(a['วันที่เบิก']));
  
  filtered.forEach(item => {
    const qtyReq = Number(item['จำนวนที่ขอเบิก'] || 0);
    const qtyApp = Number(item['จำนวนที่จ่ายจริง'] || 0);
    const qtyReturned = Number(item['จำนวนที่คืน'] || 0);
    const status = item['สถานะ'] || 'เบิกจ่ายสำเร็จ';
    
    let badgeClass = 'badge-blue';
    if (status === 'คืนเสร็จสมบูรณ์') badgeClass = 'badge-green';
    
    const showReturnBtn = status !== 'คืนเสร็จสมบูรณ์' && qtyApp > 0;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item['เลขที่ใบเบิก']}</strong></td>
      <td>${format.date(item['วันที่เบิก'])}</td>
      <td><span class="badge badge-gray">${item['เลขที่ใบสั่งงาน (Work Order)']}</span></td>
      <td>
        <div>${item['ชื่อเครื่องมือ']}</div>
        <small class="text-muted">${item['หมายเลขครุภัณฑ์เครื่องมือ']}</small>
      </td>
      <td>
        <div>${item['ผู้เบิก']}</div>
        <small class="text-muted">${item['หน่วยงานเจ้าของเครื่องมือ']}</small>
      </td>
      <td>
        <div>${item['ชื่ออะไหล่']}</div>
        <small class="text-muted">รหัส: ${item['รหัสอะไหล่']}</small>
      </td>
      <td>${format.number(qtyReq)} / ${format.number(qtyApp)}</td>
      <td>${qtyReturned > 0 ? `${format.number(qtyReturned)} (${format.date(item['วันที่คืน'])})` : '-'}</td>
      <td>${item['สภาพอะไหล่ที่คืน'] || '-'}</td>
      <td><span class="badge ${badgeClass}">${status}</span></td>
      <td>
        ${showReturnBtn ? `<button class="btn btn-warning btn-sm" onclick="returnPartForm('${item['เลขที่ใบเบิก']}', '${item['รหัสอะไหล่']}')"><i class="fa-solid fa-rotate-left"></i> คืนอะไหล่</button>` : '-'}
      </td>
    `;
    elements.transactionsTbody.appendChild(tr);
  });
}

// Return Part Modal Form binding
window.returnPartForm = function(reqNo, partId) {
  const tx = state.transactions.find(t => t['เลขที่ใบเบิก'].toString() === reqNo && t['รหัสอะไหล่'].toString() === partId);
  if (!tx) return;
  
  document.getElementById('return-req-no').value = reqNo;
  document.getElementById('return-part-id').value = partId;
  document.getElementById('return-display-req-no').innerText = reqNo;
  document.getElementById('return-display-part').innerText = `[${partId}] ${tx['ชื่ออะไหล่']}`;
  
  const qtyCheckedOut = Number(tx['จำนวนที่จ่ายจริง'] || 0);
  document.getElementById('ret-qty').value = qtyCheckedOut;
  document.getElementById('ret-qty-max').innerText = `จำนวนเบิกจริงสูงสุดที่สามารถคืนได้: ${qtyCheckedOut} ชิ้น`;
  document.getElementById('ret-qty').max = qtyCheckedOut;
  document.getElementById('ret-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ret-returner').value = tx['ผู้เบิก'] || '';
  
  openModal(elements.modalReturn);
};

// ================= RENDER: STOCKTAKE =================
function renderStocktake() {
  const query = elements.stocktakeSearch.value.toLowerCase().trim();
  elements.stocktakeTbody.innerHTML = '';
  
  const filtered = state.stockCounts.filter(item => {
    return (
      item['รหัสอะไหล่'].toString().toLowerCase().includes(query) ||
      item['ชื่ออะไหล่'].toString().toLowerCase().includes(query) ||
      (item['วันที่ตรวจนับ'] || '').toString().includes(query)
    );
  });
  
  // Calculate Inventory Accuracy: (Number of correct matches / total items counted) * 100
  let totalCounted = state.stockCounts.length;
  let correctCounted = state.stockCounts.filter(item => Number(item['ผลต่าง(+/–)'] || 0) === 0).length;
  let accuracyVal = 100;
  if (totalCounted > 0) {
    accuracyVal = (correctCounted / totalCounted) * 100;
  }
  
  elements.kpiAccuracyVal.innerText = `${accuracyVal.toFixed(1)} %`;
  // Update color based on target >= 98%
  if (accuracyVal >= 98) {
    elements.kpiAccuracyVal.className = 'text-success';
  } else {
    elements.kpiAccuracyVal.className = 'text-danger font-bold';
  }
  
  if (filtered.length === 0) {
    elements.stocktakeTbody.innerHTML = `<tr><td colspan="11" class="text-center">ไม่พบประวัติใบตรวจนับคลัง</td></tr>`;
    return;
  }
  
  // Sort stocktakes by date descending
  filtered.sort((a, b) => new Date(b['วันที่ตรวจนับ']) - new Date(a['วันที่ตรวจนับ']));
  
  filtered.forEach(item => {
    const diff = Number(item['ผลต่าง(+/–)'] || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${format.date(item['วันที่ตรวจนับ'])}</td>
      <td><strong>${item['รอบการตรวจนับ']}</strong></td>
      <td><strong>${item['รหัสอะไหล่']}</strong></td>
      <td>${item['ชื่ออะไหล่']}</td>
      <td>${item['ตำแหน่งจัดเก็บ']} / ${item['หน่วยนับ'] || 'ชิ้น'}</td>
      <td>${format.number(item['ยอดตามทะเบียน'])}</td>
      <td>${format.number(item['ยอดนับจริง'])}</td>
      <td class="${diff !== 0 ? 'text-danger font-bold' : 'text-success'}">
        ${diff > 0 ? `+${diff}` : diff}
      </td>
      <td>${item['พบใกล้หมดอายุ / เสื่อมสภาพ'] || '-'}</td>
      <td>${item['สาเหตุของผลต่าง / การดำเนินการ'] || '-'}</td>
      <td>
        <div>${item['ผู้ตรวจนับ 1']}</div>
        <small class="text-muted">ผู้รับรอง: ${item['หัวหน้างานเครื่องมือแพทย์ (ผู้รับรอง)']}</small>
      </td>
    `;
    elements.stocktakeTbody.appendChild(tr);
  });
}

// Populate Parts Select Option inside Modals (Receiving, Requisition, Stocktake modals)
function populatePartsDropdowns() {
  const parts = state.inventory;
  const selectEls = [
    document.getElementById('rec-part-select'),
    document.getElementById('req-part-select'),
    document.getElementById('sc-part-select')
  ];
  
  selectEls.forEach(selectEl => {
    if (!selectEl) return;
    // Keep first placeholder option
    selectEl.innerHTML = `<option value="">-- กรุณาเลือกรายการ --</option>`;
    
    parts.forEach(part => {
      const opt = document.createElement('option');
      opt.value = part['รหัสอะไหล่'];
      opt.innerText = `[${part['รหัสอะไหล่']}] ${part['ชื่ออะไหล่ / ยี่ห้อ']} (ในคลัง: ${part['จำนวนคงเหลือ']} ชิ้น)`;
      selectEl.appendChild(opt);
    });
  });
}

// Dynamic info update for Requisition form select
document.getElementById('req-part-select').addEventListener('change', (e) => {
  const partId = e.target.value;
  const part = state.inventory.find(item => item['รหัสอะไหล่'] === partId);
  const infoEl = document.getElementById('req-qty-available');
  if (part) {
    const qty = Number(part['จำนวนคงเหลือ'] || 0);
    infoEl.innerText = `จำนวนคงเหลือในคลัง: ${qty} ชิ้น`;
    document.getElementById('req-qty-app').max = qty;
  } else {
    infoEl.innerText = `จำนวนคงเหลือในคลัง: - ชิ้น`;
  }
});

// Dynamic info update for Stocktake form select
document.getElementById('sc-part-select').addEventListener('change', (e) => {
  const partId = e.target.value;
  const part = state.inventory.find(item => item['รหัสอะไหล่'] === partId);
  if (part) {
    const qty = Number(part['จำนวนคงเหลือ'] || 0);
    document.getElementById('sc-system-qty').value = qty;
    updateStocktakeDiff();
  } else {
    document.getElementById('sc-system-qty').value = 0;
  }
});

document.getElementById('sc-actual-qty').addEventListener('input', updateStocktakeDiff);

function updateStocktakeDiff() {
  const sysQty = Number(document.getElementById('sc-system-qty').value || 0);
  const actQty = Number(document.getElementById('sc-actual-qty').value || 0);
  const diff = actQty - sysQty;
  const textEl = document.getElementById('sc-diff-text');
  
  textEl.innerText = `ผลต่าง: ${diff > 0 ? '+' : ''}${diff} ชิ้น`;
  if (diff === 0) {
    textEl.className = 'form-help text-success';
  } else {
    textEl.className = 'form-help text-danger font-bold';
  }
}

// Dynamic info update for Receiving form select (autofill location & price)
document.getElementById('rec-part-select').addEventListener('change', (e) => {
  const partId = e.target.value;
  const part = state.inventory.find(item => item['รหัสอะไหล่'] === partId);
  if (part) {
    document.getElementById('rec-location').value = part['ตำแหน่งจัดเก็บ'] || '';
    document.getElementById('rec-price').value = part['ราคา/หน่วย(บาท)'] || 0;
  } else {
    document.getElementById('rec-location').value = '';
    document.getElementById('rec-price').value = 0;
  }
});

// ================= FORM SUBMISSIONS =================

// 1. Save Config API
elements.btnSaveConfig.addEventListener('click', (e) => {
  e.preventDefault();
  const url = elements.configUrlInput.value.trim();
  if (!url) {
    showToast("กรุณาระบุ URL ให้ถูกต้อง", "danger");
    return;
  }
  NKPApi.setApiUrl(url);
  showToast("บันทึกข้อมูลการตั้งค่า API แล้ว", "success");
  loadAllData();
});

// Test Connection Action
elements.btnTestConnection.addEventListener('click', async (e) => {
  e.preventDefault();
  const url = elements.configUrlInput.value.trim();
  if (!url) {
    showToast("กรุณาระบุ URL ก่อนทำการทดสอบ", "danger");
    return;
  }
  showLoader();
  try {
    localStorage.setItem('nkp_api_url', url); // Temp save for testing
    const ok = await NKPApi.testConnection();
    if (ok) {
      updateStatusIndicator(true);
      showToast("เชื่อมต่อ API และฐานข้อมูล Google Sheets สำเร็จ!", "success");
    } else {
      throw new Error("API return success = false");
    }
  } catch (err) {
    updateStatusIndicator(false);
    showToast(`เชื่อมต่อไม่สำเร็จ: ${err.message}`, "danger");
  } finally {
    hideLoader();
  }
});

// 2. Add/Edit Part Submit
elements.formPart.addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoader();
  
  const mode = document.getElementById('part-mode').value;
  const partData = {
    partId: document.getElementById('part-id').value,
    oemNo: document.getElementById('part-oem').value,
    name: document.getElementById('part-name').value,
    supplier: document.getElementById('part-supplier').value,
    compatibleModels: document.getElementById('part-models').value,
    location: document.getElementById('part-location').value,
    initialQty: document.getElementById('part-initial-qty').value,
    minStock: document.getElementById('part-min').value,
    rop: document.getElementById('part-rop').value,
    maxStock: document.getElementById('part-max').value,
    price: document.getElementById('part-price').value,
    purchaseDate: document.getElementById('part-purchase-date').value,
    expiryDate: document.getElementById('part-expiry').value,
    status: document.getElementById('part-status').value,
    isCritical: document.getElementById('part-critical').value,
    abcGroup: document.getElementById('part-abc').value,
    budgetYear: document.getElementById('part-budget-year').value
  };
  
  try {
    let result;
    if (mode === 'add') {
      result = await NKPApi.addPart(partData);
    } else {
      result = await NKPApi.updatePart(partData);
    }
    
    closeModal(elements.modalPart);
    showToast(result.message || "บันทึกข้อมูลเรียบร้อยแล้ว", "success");
    loadAllData();
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, "danger");
  } finally {
    hideLoader();
  }
});

// 3. Add Receiving Submit
elements.formReceiving.addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoader();
  
  const selectEl = document.getElementById('rec-part-select');
  const partName = selectEl.options[selectEl.selectedIndex].text.split('] ')[1].split(' (')[0];
  
  const receivingData = {
    date: document.getElementById('rec-date').value,
    docNo: document.getElementById('rec-doc').value,
    supplier: document.getElementById('rec-supplier').value,
    partId: selectEl.value,
    partName: partName,
    qty: document.getElementById('rec-qty').value,
    price: document.getElementById('rec-price').value,
    lotNo: document.getElementById('rec-lot').value,
    expiryDate: document.getElementById('rec-expiry').value,
    location: document.getElementById('rec-location').value,
    checkResult: document.getElementById('rec-result').value,
    receiver: document.getElementById('rec-receiver').value
  };
  
  try {
    const result = await NKPApi.receivePart(receivingData);
    closeModal(elements.modalReceiving);
    showToast(result.message || "รับเข้าคลังเรียบร้อย", "success");
    loadAllData();
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, "danger");
  } finally {
    hideLoader();
  }
});

// 4. Requisition Submit
elements.formRequisition.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const selectEl = document.getElementById('req-part-select');
  const partId = selectEl.value;
  const part = state.inventory.find(item => item['รหัสอะไหล่'] === partId);
  const qtyApp = Number(document.getElementById('req-qty-app').value);
  const curQty = Number(part ? part['จำนวนคงเหลือ'] : 0);
  
  if (qtyApp > curQty) {
    showToast(`จำนวนคงคลังไม่เพียงพอ (เบิกได้สูงสุด ${curQty} ชิ้น)`, "danger");
    return;
  }
  
  showLoader();
  const partName = selectEl.options[selectEl.selectedIndex].text.split('] ')[1].split(' (')[0];
  
  const reqData = {
    reqNo: document.getElementById('req-no').value,
    date: document.getElementById('req-date').value,
    workOrder: document.getElementById('req-workorder').value,
    jobType: document.getElementById('req-jobtype').value,
    equipNo: document.getElementById('req-equip-no').value,
    equipName: document.getElementById('req-equip-name').value,
    department: document.getElementById('req-dept').value,
    partId: partId,
    partName: partName,
    qtyRequested: document.getElementById('req-qty-req').value,
    qtyApproved: qtyApp,
    requester: document.getElementById('req-requester').value
  };
  
  try {
    const result = await NKPApi.requisitionPart(reqData);
    closeModal(elements.modalRequisition);
    showToast(result.message || "จ่ายอะไหล่เรียบร้อย", "success");
    loadAllData();
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, "danger");
  } finally {
    hideLoader();
  }
});

// 5. Return Submit
elements.formReturn.addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoader();
  
  const returnData = {
    reqNo: document.getElementById('return-req-no').value,
    partId: document.getElementById('return-part-id').value,
    qtyReturn: document.getElementById('ret-qty').value,
    returnDate: document.getElementById('ret-date').value,
    returnCondition: document.getElementById('ret-condition').value,
    returner: document.getElementById('ret-returner').value,
    receiver: document.getElementById('ret-receiver').value
  };
  
  try {
    const result = await NKPApi.returnPart(returnData);
    closeModal(elements.modalReturn);
    showToast(result.message || "บันทึกรับคืนสำเร็จ", "success");
    loadAllData();
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, "danger");
  } finally {
    hideLoader();
  }
});

// 6. Stock Count Submit
elements.formStockcount.addEventListener('submit', async (e) => {
  e.preventDefault();
  showLoader();
  
  const selectEl = document.getElementById('sc-part-select');
  const partName = selectEl.options[selectEl.selectedIndex].text.split('] ')[1].split(' (')[0];
  
  const countData = {
    date: document.getElementById('sc-date').value,
    countCycle: document.getElementById('sc-cycle').value,
    partId: selectEl.value,
    partName: partName,
    unit: document.getElementById('sc-unit').value,
    actualQty: document.getElementById('sc-actual-qty').value,
    expiredDetails: document.getElementById('sc-expired').value,
    reason: document.getElementById('sc-reason').value,
    counter1: document.getElementById('sc-counter1').value,
    counter2: document.getElementById('sc-counter2').value,
    supervisor: document.getElementById('sc-supervisor').value
  };
  
  try {
    const result = await NKPApi.stockCount(countData);
    closeModal(elements.modalStockcount);
    showToast(result.message || "บันทึกการตรวจนับคลังสำเร็จ", "success");
    loadAllData();
  } catch (err) {
    showToast(`เกิดข้อผิดพลาด: ${err.message}`, "danger");
  } finally {
    hideLoader();
  }
});

// ================= BTN CLICK ACTIONS (Modal Openers) =================

// Register Part Modal
elements.btnAddPart.addEventListener('click', () => {
  document.getElementById('part-mode').value = 'add';
  elements.formPart.reset();
  document.getElementById('part-id').readOnly = false;
  
  // Show initial qty for new parts
  document.getElementById('part-initial-qty').parentElement.style.display = 'block';
  
  document.getElementById('part-purchase-date').value = new Date().toISOString().split('T')[0];
  elements.modalPartTitle.innerText = "ลงทะเบียนอะไหล่ใหม่";
  openModal(elements.modalPart);
});

// Receiving Modal
elements.btnAddReceiving.addEventListener('click', () => {
  if (state.inventory.length === 0) {
    showToast("กรุณาลงทะเบียนอะไหล่หลักในระบบก่อน", "warning");
    return;
  }
  elements.formReceiving.reset();
  document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
  populatePartsDropdowns();
  openModal(elements.modalReceiving);
});

// Requisition Modal
elements.btnAddRequisition.addEventListener('click', () => {
  if (state.inventory.length === 0) {
    showToast("ไม่มีอะไหล่ในคลังให้เบิก", "warning");
    return;
  }
  elements.formRequisition.reset();
  document.getElementById('req-no').value = "REQ-" + Math.floor(100000 + Math.random() * 900000);
  document.getElementById('req-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('req-qty-available').innerText = `จำนวนคงเหลือในคลัง: - ชิ้น`;
  populatePartsDropdowns();
  openModal(elements.modalRequisition);
});

// Stock Count Modal
elements.btnAddStockcount.addEventListener('click', () => {
  if (state.inventory.length === 0) {
    showToast("ไม่มีอะไหล่ให้ทำการตรวจนับ", "warning");
    return;
  }
  elements.formStockcount.reset();
  document.getElementById('sc-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('sc-diff-text').innerText = 'ผลต่าง: 0 ชิ้น';
  populatePartsDropdowns();
  openModal(elements.modalStockcount);
});

// Search & filter listeners
elements.registrySearch.addEventListener('input', renderRegistry);
elements.filterCritical.addEventListener('change', renderRegistry);
elements.filterAbc.addEventListener('change', renderRegistry);

elements.receivingSearch.addEventListener('input', renderReceiving);

elements.txSearch.addEventListener('input', renderTransactions);
elements.filterTxStatus.addEventListener('change', renderTransactions);

elements.stocktakeSearch.addEventListener('input', renderStocktake);

// Export to CSV Helper (UTF-8 BOM support for Excel & Thai characters)
function exportToCSV(filename, headers, rows) {
  let csvContent = "\uFEFF"; // UTF-8 BOM
  
  csvContent += headers.join(",") + "\n";
  
  rows.forEach(row => {
    const formattedRow = row.map(val => {
      let str = val === null || val === undefined ? "" : val.toString();
      // Escape double quotes
      str = str.replace(/"/g, '""');
      // Wrap in double quotes if it contains commas, quotes, or newlines
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        str = `"${str}"`;
      }
      return str;
    });
    csvContent += formattedRow.join(",") + "\n";
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Dashboard Export Low Stock
elements.btnExportLowStock.addEventListener('click', () => {
  const lowStock = state.inventory.filter(item => {
    return Number(item['จำนวนคงเหลือ'] || 0) <= Number(item['ROP'] || 0);
  });
  
  if (lowStock.length === 0) {
    showToast("ไม่มีรายการอะไหล่ต่ำกว่า ROP ในระบบขณะนี้", "info");
    return;
  }
  
  const headers = ['รหัสอะไหล่', 'OEM Part No', 'ชื่ออะไหล่ / ยี่ห้อ', 'ตำแหน่งจัดเก็บ', 'จำนวนคงเหลือ', 'Min', 'ROP', 'Max', 'ราคาต่อหน่วย', 'อะไหล่วิกฤต', 'กลุ่ม ABC'];
  const rows = lowStock.map(item => [
    item['รหัสอะไหล่'],
    item['OEM Part No'] || '',
    item['ชื่ออะไหล่ / ยี่ห้อ'],
    item['ตำแหน่งจัดเก็บ'],
    item['จำนวนคงเหลือ'],
    item['Min'],
    item['ROP'],
    item['Max'],
    item['ราคา/หน่วย(บาท)'],
    item['อะไหล่วิกฤต'],
    item['กลุ่ม ABC']
  ]);
  
  exportToCSV(`รายงานอะไหล่ต่ำกว่าจุดสั่งซื้อ_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  showToast("ดาวน์โหลดรายงานความต้องการอะไหล่สำเร็จ", "success");
});

// App Startup
document.addEventListener('DOMContentLoaded', () => {
  // Load configuration if set
  const savedUrl = NKPApi.getApiUrl();
  if (savedUrl) {
    elements.configUrlInput.value = savedUrl;
  }
  
  // Init routing
  initRouter();
});
