// Standalone Application Logic Core - Nakhonping Hospital Spare Parts System
// Auto-synchronized from index.html

// Mobile Viewport Zoom Auto-Adjustment for Desktop View on Mobile
    function adjustZoom() {
      const targetWidth = 1280;
      const width = window.innerWidth;
      const appContainer = document.querySelector(".app-container");
      
      if (width < targetWidth) {
        const scale = width / targetWidth;
        document.body.style.zoom = scale;
        document.body.style.width = targetWidth + "px";
        if (appContainer) {
          appContainer.style.width = targetWidth + "px";
        }
      } else {
        document.body.style.zoom = "1";
        document.body.style.width = "auto";
        if (appContainer) {
          appContainer.style.width = "100%";
        }
      }
    }

    // Run zoom adjustment immediately and on window resize / load
    adjustZoom();
    window.addEventListener("resize", adjustZoom);
    document.addEventListener("DOMContentLoaded", adjustZoom);

    // Global State
    let parts = [];
    let equipment = [];
    let transactions = [];
    let pmPlans = [];
    let settings = {
      password: "NKP-medparts-2026",
      gasUrl: "https://script.google.com/macros/s/AKfycbyD6kMKrvj8O1JjYAj_Dk-tYY4iW63phFQIidNGPsqjymO2d_dZtmFL9B4ujgYNZps8/exec",
      lineToggle: true,
      lineToken: "",
      lineGroupId: ""
    };
    let userAccounts = [];
    let currentUser = null;

    // Chart References
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
      renderMemorandum();
      
      // ดึงโค้ด Google Apps Script ล่าสุดมาแสดงผลในหน้าตั้งค่าโดยตรง
      fetch('./code.gs')
        .then(response => {
          if (response.ok) return response.text();
          throw new Error('Failed to fetch code.gs');
        })
        .then(codeText => {
          const el = document.getElementById("code-content");
          if (el) el.innerText = codeText;
        })
        .catch(err => {
          console.log("Could not load code.gs dynamically, using fallback HTML content.", err);
        });
    });

    // 1. LocalStorage and State Initialization
    function initStorage() {
      const storedSettings = localStorage.getItem("nkp_parts_settings");
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        settings = { ...settings, ...parsed };
        if (!settings.gasUrl) {
          settings.gasUrl = "https://script.google.com/macros/s/AKfycbyD6kMKrvj8O1JjYAj_Dk-tYY4iW63phFQIidNGPsqjymO2d_dZtmFL9B4ujgYNZps8/exec";
          localStorage.setItem("nkp_parts_settings", JSON.stringify(settings));
        }
      } else {
        localStorage.setItem("nkp_parts_settings", JSON.stringify(settings));
      }

      const storedParts = localStorage.getItem("nkp_parts");
      if (storedParts) {
        parts = JSON.parse(storedParts);
      } else {
        parts = [...INITIAL_PARTS];
        localStorage.setItem("nkp_parts", JSON.stringify(parts));
      }

      const storedEquipment = localStorage.getItem("nkp_equipment");
      if (storedEquipment) {
        equipment = JSON.parse(storedEquipment);
      } else {
        equipment = [...INITIAL_EQUIPMENT];
        localStorage.setItem("nkp_equipment", JSON.stringify(equipment));
      }

      const storedTx = localStorage.getItem("nkp_transactions");
      if (storedTx) {
        transactions = JSON.parse(storedTx);
      } else {
        transactions = [...INITIAL_TRANSACTIONS];
        localStorage.setItem("nkp_transactions", JSON.stringify(transactions));
      }

      const storedPm = localStorage.getItem("nkp_pm_plans");
      if (storedPm) {
        pmPlans = JSON.parse(storedPm);
      } else {
        pmPlans = [...INITIAL_PM_PLANS];
        localStorage.setItem("nkp_pm_plans", JSON.stringify(pmPlans));
      }

      const storedUsers = localStorage.getItem("nkp_users");
      if (storedUsers) {
        userAccounts = JSON.parse(storedUsers);
      } else {
        userAccounts = [
          {
            realName: "NKP Programmer (Default)",
            password: "NKP-programmer-2026",
            role: "Programmer",
            status: "Active",
            loginCount: 0
          }
        ];
        localStorage.setItem("nkp_users", JSON.stringify(userAccounts));
      }

      recalculateABC();
      pullFromCloud();
    }

    function persistState() {
      localStorage.setItem("nkp_parts", JSON.stringify(parts));
      localStorage.setItem("nkp_transactions", JSON.stringify(transactions));
      localStorage.setItem("nkp_pm_plans", JSON.stringify(pmPlans));
      recalculateABC();
      triggerCloudSync();
    }

    // 2. Authentication Password Gate (Default: NKP-programmer-2026)
    function checkAuth() {
      const loginOverlay = document.getElementById("login-overlay");
      const isAuthenticated = sessionStorage.getItem("nkp_authenticated");

      if (isAuthenticated === "true") {
        const storedUser = sessionStorage.getItem("nkp_current_user");
        if (storedUser) {
          currentUser = JSON.parse(storedUser);
          loginOverlay.classList.add("hidden");
          applyPermissions(currentUser.role);
          updateUserDisplay();
        } else {
          sessionStorage.removeItem("nkp_authenticated");
          loginOverlay.classList.remove("hidden");
        }
      } else {
        loginOverlay.classList.remove("hidden");
      }

      document.getElementById("login-submit-btn").onclick = processLogin;
      document.getElementById("login-password").onkeypress = (e) => {
        if (e.key === "Enter") processLogin();
      };

      document.getElementById("logout-btn").onclick = () => {
        sessionStorage.removeItem("nkp_authenticated");
        sessionStorage.removeItem("nkp_current_user");
        location.reload();
      };
    }

    function processLogin() {
      const pwdInput = document.getElementById("login-password").value.trim();
      const errorDiv = document.getElementById("login-error");

      const user = userAccounts.find(u => String(u.password) === pwdInput && u.status === "Active");

      if (user) {
        user.loginCount = (user.loginCount || 0) + 1;
        localStorage.setItem("nkp_users", JSON.stringify(userAccounts));

        currentUser = user;
        sessionStorage.setItem("nkp_authenticated", "true");
        sessionStorage.setItem("nkp_current_user", JSON.stringify(currentUser));

        document.getElementById("login-overlay").classList.add("hidden");
        updateUserDisplay();
        applyPermissions(currentUser.role);

        showToast("เข้าสู่ระบบสำเร็จ", `ยินดีต้อนรับคุณ ${currentUser.realName}`, "success");
        persistState();

        setTimeout(() => {
          drawDashboardCharts();
        }, 200);
      } else {
        errorDiv.innerText = "รหัสผ่านไม่ถูกต้อง หรือ บัญชีนี้ถูกระงับสิทธิ์การใช้งาน";
        showToast("เข้าสู่ระบบล้มเหลว", "รหัสผ่านที่กรอกไม่ถูกต้อง", "danger");
      }
    }

    function updateUserDisplay() {
      if (!currentUser) return;

      const displayUserEl = document.getElementById("display-user");
      if (displayUserEl) {
        displayUserEl.innerText = `${currentUser.realName} (${currentUser.role})`;
      }

      const headerUserEl = document.getElementById("header-user-name");
      if (headerUserEl) {
        headerUserEl.innerText = `${currentUser.realName} [${currentUser.role}]`;
      }

      const operatorInput = document.getElementById("tx-operator");
      if (operatorInput) {
        operatorInput.value = currentUser.realName;
        operatorInput.disabled = true;
      }
    }

    function applyPermissions(role) {
      const programmerOnlyElements = document.querySelectorAll(".programmer-only");
      programmerOnlyElements.forEach(el => {
        if (role === "Programmer") {
          el.style.display = "block";
        } else {
          el.style.display = "none";
        }
      });

      const menuCatalog = document.getElementById("menu-catalog");
      if (menuCatalog) {
        if (role === "General User") {
          menuCatalog.style.display = "none";
        } else {
          menuCatalog.style.display = "block";
        }
      }

      const menuPlanning = document.getElementById("menu-planning");
      if (menuPlanning) {
        if (role === "General User") {
          menuPlanning.style.display = "none";
        } else {
          menuPlanning.style.display = "block";
        }
      }

      const menuProcurement = document.getElementById("menu-procurement");
      if (menuProcurement) {
        if (role === "General User") {
          menuProcurement.style.display = "none";
        } else {
          menuProcurement.style.display = "block";
        }
      }

      const btnAddPart = document.getElementById("btn-add-part");
      if (btnAddPart) {
        if (role === "General User") {
          btnAddPart.style.display = "none";
        } else {
          btnAddPart.style.display = "inline-flex";
        }
      }

      const btnExportCatalog = document.getElementById("btn-export-catalog");
      if (btnExportCatalog) {
        if (role === "General User") {
          btnExportCatalog.style.display = "none";
        } else {
          btnExportCatalog.style.display = "inline-flex";
        }
      }

      const btnImportCatalog = document.getElementById("btn-import-catalog-trigger");
      if (btnImportCatalog) {
        if (role === "General User") {
          btnImportCatalog.style.display = "none";
        } else {
          btnImportCatalog.style.display = "inline-flex";
        }
      }

      const refDocGroup = document.getElementById("tx-ref-doc-group");
      if (refDocGroup) {
        if (role === "General User") {
          refDocGroup.style.display = "none";
        } else {
          refDocGroup.style.display = "block";
        }
      }

      const btnExport = document.getElementById("btn-export-logs");
      if (btnExport) {
        if (role === "General User") {
          btnExport.style.display = "none";
        } else {
          btnExport.style.display = "inline-flex";
        }
      }

      populateTxTypeOptions();

      const activeLink = document.querySelector(".sidebar-link.active");
      if (activeLink) {
        const activeTab = activeLink.getAttribute("data-tab");
        let redirect = false;

        if (role !== "Programmer" && (activeTab === "settings" || activeTab === "user-management")) {
          redirect = true;
        } else if (role === "General User" && (activeTab === "procurement" || activeTab === "catalog" || activeTab === "planning")) {
          redirect = true;
        }

        if (redirect) {
          const dashLink = document.querySelector('.sidebar-link[data-tab="dashboard"]');
          if (dashLink) {
            dashLink.click();
          }
        }
      }
    }

    function populateTxTypeOptions() {
      const txTypeSelect = document.getElementById("tx-type");
      if (!txTypeSelect) return;

      const currentVal = txTypeSelect.value;
      txTypeSelect.innerHTML = "";

      const options = [
        { value: "Issue", text: "เบิกจ่ายไปซ่อมบำรุง (Issue)" },
        { value: "Receive", text: "รับสินค้าเข้าคลัง (Receive)" },
        { value: "Borrow", text: "ยืมเพื่อทดสอบ (Borrow)" },
        { value: "Return", text: "คืนของที่ยืม (Return)" },
        { value: "Audit", text: "ตรวจสอบสต๊อกจริง (Audit)" }
      ];

      options.forEach(opt => {
        if (currentUser && currentUser.role === "General User" && (opt.value === "Receive" || opt.value === "Audit")) {
          return;
        }
        const el = document.createElement("option");
        el.value = opt.value;
        el.text = opt.text;
        txTypeSelect.appendChild(el);
      });

      if ([...txTypeSelect.options].some(o => o.value === currentVal)) {
        txTypeSelect.value = currentVal;
      } else {
        txTypeSelect.selectedIndex = 0;
      }
      handleTxTypeChange();
    }

    // 3. Tab Navigation & Core Event Listeners
    function initializeUI() {
      // Sidebar Collapse Toggle Logic
      const btnToggleSidebar = document.getElementById("btn-toggle-sidebar");
      const appContainer = document.querySelector(".app-container");
      
      const isSidebarCollapsed = localStorage.getItem("nkp_sidebar_collapsed") === "true";
      if (isSidebarCollapsed && appContainer && btnToggleSidebar) {
        appContainer.classList.add("sidebar-collapsed");
        const icon = btnToggleSidebar.querySelector("i");
        if (icon) icon.setAttribute("data-lucide", "chevron-right");
      }

      if (btnToggleSidebar && appContainer) {
        btnToggleSidebar.addEventListener("click", () => {
          appContainer.classList.toggle("sidebar-collapsed");
          const isCollapsed = appContainer.classList.contains("sidebar-collapsed");
          localStorage.setItem("nkp_sidebar_collapsed", isCollapsed);
          
          const icon = btnToggleSidebar.querySelector("i");
          if (icon) {
            icon.setAttribute("data-lucide", isCollapsed ? "chevron-right" : "chevron-left");
            lucide.createIcons();
          }
        });
      }

      const links = document.querySelectorAll(".sidebar-link");
      links.forEach(link => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const tabName = link.getAttribute("data-tab");
          
          links.forEach(l => l.classList.remove("active"));
          link.classList.add("active");

          const tabContents = document.querySelectorAll(".tab-content");
          tabContents.forEach(content => content.classList.remove("active"));
          document.getElementById(`tab-${tabName}`).classList.add("active");

          updateTabHeader(tabName);
        });
      });

      const themeToggle = document.getElementById("theme-toggle");
      themeToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
          document.body.setAttribute("data-theme", "dark");
        } else {
          document.body.removeAttribute("data-theme");
        }
        drawDashboardCharts();
      });

      setInterval(() => {
        const now = new Date();
        document.getElementById("live-time-display").innerText = now.toLocaleString("th-TH");
      }, 1000);

      document.getElementById("catalog-search").addEventListener("input", renderCatalog);
      document.getElementById("catalog-filter-abc").addEventListener("change", renderCatalog);
      document.getElementById("catalog-filter-status").addEventListener("change", renderCatalog);

      const txTypeSelect = document.getElementById("tx-type");
      txTypeSelect.addEventListener("change", handleTxTypeChange);
      handleTxTypeChange();

      document.getElementById("tx-eq-serial").addEventListener("input", validateInputs);
      document.getElementById("tx-repair-no").addEventListener("input", validateInputs);
      document.getElementById("tx-dept").addEventListener("input", validateInputs);

      document.getElementById("tx-form").addEventListener("submit", processTransaction);
      document.getElementById("btn-run-forecast").addEventListener("click", calculateForecast);
      document.getElementById("btn-export-logs").addEventListener("click", exportTransactionsToCSV);

      document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
      document.getElementById("btn-test-line").addEventListener("click", testLineMessage);

      document.getElementById("btn-add-part").addEventListener("click", () => {
        document.getElementById("part-form").reset();
        document.getElementById("part-form-mode").value = "add";
        document.getElementById("modal-add-title").innerText = "เพิ่มอะไหล่ทางการแพทย์ใหม่เข้าระบบ";
        document.getElementById("part-code").disabled = false;
        openModal("modal-add-part");
      });

      document.getElementById("btn-export-catalog").addEventListener("click", exportCatalogToCSV);
      
      const fileInput = document.getElementById("btn-import-catalog");
      document.getElementById("btn-import-catalog-trigger").addEventListener("click", () => {
        fileInput.value = "";
        fileInput.click();
      });
      fileInput.addEventListener("change", importCatalogFromCSV);

      document.getElementById("btn-save-part").addEventListener("click", savePartDetails);
      document.getElementById("btn-copy-code").addEventListener("click", copyAppsScriptCode);

      // Memorandum Form Event Bindings
      document.getElementById("btn-add-item-to-memo").addEventListener("click", addMemoItem);
      document.getElementById("btn-load-rop").addEventListener("click", loadROPItemsIntoMemo);
      document.getElementById("btn-clear-memo").addEventListener("click", clearMemoForm);
      document.getElementById("btn-print-memo").addEventListener("click", () => window.print());

      const memoInputs = [
        "memo-edit-dept", "memo-edit-doc-no", "memo-edit-date", "memo-edit-subject",
        "memo-edit-to", "memo-edit-body", "memo-edit-reason", "memo-edit-committee",
        "memo-edit-sig-left1", "memo-edit-title-left1",
        "memo-edit-sig-right1", "memo-edit-title-right1",
        "memo-edit-sig-left2", "memo-edit-title-left2",
        "memo-edit-sig-right2", "memo-edit-title-right2"
      ];
      memoInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", renderMemorandum);
      });

      for(let i=1; i<=6; i++) {
        const el = document.getElementById(`memo-chk-${i}`);
        if (el) {
          el.addEventListener("change", (e) => {
            if (i === 6) {
              document.getElementById("memo-chk-other-text").style.display = e.target.checked ? "inline-block" : "none";
            }
            renderMemorandum();
          });
        }
      }
      const otherTxt = document.getElementById("memo-chk-other-text");
      if (otherTxt) otherTxt.addEventListener("input", renderMemorandum);

      // Ledger Logs Real-Time Filters
      const ledgerSearch = document.getElementById("ledger-search");
      const ledgerFilterType = document.getElementById("ledger-filter-type");
      const ledgerFilterTime = document.getElementById("ledger-filter-time");

      if (ledgerSearch) ledgerSearch.addEventListener("input", renderTransactionsTable);
      if (ledgerFilterType) ledgerFilterType.addEventListener("change", renderTransactionsTable);
      if (ledgerFilterTime) ledgerFilterTime.addEventListener("change", renderTransactionsTable);

      // User Management
      const btnGenUser = document.getElementById("btn-generate-user");
      if (btnGenUser) btnGenUser.addEventListener("click", generateUserAccount);

      const btnSaveOwnPwd = document.getElementById("btn-save-own-password");
      if (btnSaveOwnPwd) btnSaveOwnPwd.addEventListener("click", saveOwnPassword);

      const btnChangeOwnPwd = document.getElementById("btn-change-own-pwd");
      if (btnChangeOwnPwd) {
        btnChangeOwnPwd.addEventListener("click", () => {
          if (!currentUser) return;
          document.getElementById("change-pwd-username").innerText = currentUser.realName;
          document.getElementById("change-pwd-new").value = "";
          document.getElementById("change-pwd-confirm").value = "";
          document.getElementById("change-pwd-error").innerText = "";
          openModal("modal-change-own-password");
        });
      }
    }

    function updateTabHeader(tabName) {
      const titles = {
        dashboard: ["แดชบอร์ดภาพรวม", "วิเคราะห์สถิติคลังสินค้า ความปลอดภัย และอัตราค่าบำรุงรักษา"],
        catalog: ["คลังอะไหล่และอุปกรณ์", "จัดการรายชื่ออะไหล่ สเปกทางเทคนิค และจุดสั่งซื้อที่ได้รับการระบุ"],
        transactions: ["เบิกจ่ายและรับเข้าคลัง", "ทำกิจกรรม เบิก จ่าย รับของ ยืม คืน และตรวจสอบความถูกต้องของระบบคลัง"],
        ledger: ["ประวัติรายการคลังอะไหล่ (Ledger Logs)", "ตรวจสอบประวัติการเบิกจ่าย รับเข้า ยืมคืน อะไหล่สำรองคลังทั้งหมด"],
        planning: ["แผนบำรุงรักษาเชิงรุก", "ตาราง PM ประจำปี และเครื่องมือคาดการณ์ความต้องการวัสดุอะไหล่ในอนาคต"],
        procurement: ["ใบขอจัดซื้ออะไหล่", "ตรวจสอบชิ้นส่วนที่หมดเกณฑ์สำรอง และสร้างใบขอเสนอซื้อแบบอัตโนมัติ"],
        "user-management": ["ระบบจัดการสิทธิ์ผู้ใช้", "จัดการผู้ดูแลระบบและกำหนดรหัสผ่านแยกสิทธิ์ในการใช้งาน"],
        settings: ["คลาวด์ & LINE Settings", "ตั้งค่าการเชื่อมต่อฐานข้อมูล Google Sheets และระบบ LINE OA Notifications"]
      };
      
      if (titles[tabName]) {
        document.getElementById("current-tab-title").innerText = titles[tabName][0];
        document.getElementById("current-tab-desc").innerText = titles[tabName][1];
      }

      if (tabName === "dashboard") {
        updateDashboard();
      } else if (tabName === "catalog") {
        renderCatalog();
      } else if (tabName === "transactions") {
        populateTransactionSelects();
      } else if (tabName === "ledger") {
        renderTransactionsTable();
      } else if (tabName === "planning") {
        renderPMPlans();
      } else if (tabName === "procurement") {
        renderProcurementMonitor();
        renderMemorandum();
      } else if (tabName === "user-management") {
        renderUserManagement();
      } else if (tabName === "settings") {
        document.getElementById("settings-password").value = settings.password;
        document.getElementById("settings-gas-url").value = settings.gasUrl || "";
        document.getElementById("settings-line-toggle").checked = settings.lineToggle;
        document.getElementById("settings-line-token").value = settings.lineToken || "";
        document.getElementById("settings-line-groupid").value = settings.lineGroupId || "";
      }
    }

    // 4. Calculations: ABC Recalculation & Expiry status
    function recalculateABC() {
      if (parts.length === 0) return;

      parts.forEach(part => {
        part.totalValue = part.unitPrice * part.inStock;
      });

      const sortedParts = [...parts].sort((a, b) => b.totalValue - a.totalValue);
      const grandTotalValue = sortedParts.reduce((sum, p) => sum + p.totalValue, 0);

      if (grandTotalValue === 0) {
        parts.forEach(part => part.abcClass = "C");
        return;
      }

      let cumulativeValue = 0;
      sortedParts.forEach(sortedPart => {
        cumulativeValue += sortedPart.totalValue;
        const ratio = cumulativeValue / grandTotalValue;

        let abcClass = "C";
        if (ratio <= 0.80) {
          abcClass = "A";
        } else if (ratio <= 0.95) {
          abcClass = "B";
        }

        const originalPart = parts.find(p => p.code === sortedPart.code);
        if (originalPart) {
          originalPart.abcClass = abcClass;
        }
      });
    }

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
      
      document.getElementById("metric-total-items").innerText = parts.length;
      
      const lowStockCount = parts.filter(p => p.inStock <= p.reorderPoint).length;
      document.getElementById("metric-low-stock-count").innerText = lowStockCount;
      
      const expiredCount = parts.filter(p => {
        const state = getExpiryState(p.expiryDate);
        return state.status === "Expired" || state.status === "Near Expiry";
      }).length;
      document.getElementById("metric-expired-count").innerText = expiredCount;

      const lowStockCard = document.getElementById("metric-low-stock-card");
      if (lowStockCount > 0) lowStockCard.classList.add("danger");
      else lowStockCard.classList.remove("danger");

      const expiredCard = document.getElementById("metric-expired-card");
      if (expiredCount > 0) expiredCard.style.borderLeftColor = "var(--danger)";

      const totalValue = parts.reduce((sum, p) => sum + (p.unitPrice * p.inStock), 0);
      document.getElementById("metric-total-value").innerText = "฿" + totalValue.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      renderDashboardAlertsTable();
      drawDashboardCharts();
    }

    function renderDashboardAlertsTable() {
      const tbody = document.querySelector("#dashboard-alerts-table tbody");
      tbody.innerHTML = "";

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
      const isDark = document.body.getAttribute("data-theme") === "dark";
      const labelColor = isDark ? "#d1d5db" : "#334155";
      const gridColor = isDark ? "#374151" : "#e2e8f0";

      const abcCounts = { A: 0, B: 0, C: 0 };
      const abcValues = { A: 0, B: 0, C: 0 };

      parts.forEach(p => {
        abcCounts[p.abcClass]++;
        abcValues[p.abcClass] += (p.unitPrice * p.inStock);
      });

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
            backgroundColor: ['#ef4444', '#3b82f6', '#14b8a6'],
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

      const serviceCosts = {};
      transactions.filter(t => t.type === "Issue" && t.eqSerial).forEach(t => {
        if (!serviceCosts[t.eqSerial]) {
          serviceCosts[t.eqSerial] = 0;
        }
        const part = parts.find(p => p.code === t.partCode);
        const unitPrice = part ? part.unitPrice : 0;
        serviceCosts[t.eqSerial] += (t.qty * unitPrice);
      });

      const labels = [];
      const ratios = [];
      const backgroundColors = [];

      equipment.forEach(eq => {
        const cost = serviceCosts[eq.serial] || 0;
        const ratio = (cost / eq.value) * 100;
        
        labels.push(`${eq.serial} (${eq.model.split(" ")[0]})`);
        ratios.push(ratio.toFixed(1));

        if (ratio >= 25.0) {
          backgroundColors.push('#ef4444');
        } else if (ratio >= 5.0) {
          backgroundColors.push('#f97316');
        } else {
          backgroundColors.push('#14b8a6');
        }
      });

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
        const matchesSearch = p.code.toLowerCase().includes(searchVal) || 
                              p.name.toLowerCase().includes(searchVal) || 
                              p.manufacturer.toLowerCase().includes(searchVal);
        const matchesAbc = (filterAbc === "ALL" || p.abcClass === filterAbc);
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
              ${currentUser && currentUser.role !== "General User" ? `
              <button class="btn btn-secondary btn-sm" onclick="editPartDetails('${p.code}')" style="padding: 4px 8px; font-size: 0.75rem; color: var(--primary);">
                <i data-lucide="edit" style="width: 14px; height: 14px;"></i> แก้ไข
              </button>
              ` : ''}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      lucide.createIcons();
    }

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
      
      const stockColor = part.inStock <= part.reorderPoint ? "var(--danger)" : "var(--success)";
      document.getElementById("modal-sc-stock").style.color = stockColor;

      document.getElementById("modal-sc-price").innerText = `฿${part.unitPrice.toLocaleString("th-TH")}`;
      document.getElementById("modal-sc-purchase").innerText = part.purchaseDate;
      document.getElementById("modal-sc-expiry").innerText = part.expiryDate;
      document.getElementById("modal-sc-leadtime").innerText = `${part.leadTime} วัน`;
      document.getElementById("modal-sc-freq").innerText = `${part.repairFreq} ครั้ง/ปี`;
      document.getElementById("modal-sc-supplier").innerText = `${part.supplierName} (โทร: ${part.supplierContact})`;

      const compatList = document.getElementById("modal-sc-compat-list");
      compatList.innerHTML = "";
      
      if (part.equipmentModels && part.equipmentModels.length > 0) {
        part.equipmentModels.forEach(model => {
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

    window.editPartDetails = function(partCode) {
      const part = parts.find(p => p.code === partCode);
      if (!part) return;

      document.getElementById("part-form-mode").value = "edit";
      document.getElementById("modal-add-title").innerText = `แก้ไขข้อมูลอะไหล่: ${part.code}`;
      
      document.getElementById("part-code").value = part.code;
      document.getElementById("part-code").disabled = true;
      
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

    function exportCatalogToCSV() {
      const csvHeaders = [
        "code", "name", "description", "manufacturer", "equipmentModels",
        "inStock", "unitPrice", "minStock", "maxStock", "reorderPoint",
        "reorderQty", "location", "supplierName", "supplierContact",
        "purchaseDate", "expiryDate", "leadTime", "repairFreq"
      ];
      
      let csvRows = [csvHeaders.join(",")];
      
      parts.forEach(p => {
        let values = csvHeaders.map(header => {
          let val = p[header];
          if (header === "equipmentModels") {
            val = Array.isArray(val) ? val.join(";") : (val || "");
          }
          val = val === undefined || val === null ? "" : String(val);
          // Escape quotes and wrap in quotes if commas, quotes, or newlines exist
          if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        });
        csvRows.push(values.join(","));
      });
      
      const csvContent = "\ufeff" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `NKP_Medparts_Catalog_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function parseCSVLine(text) {
      let p = '', r = [];
      let q = false;
      for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (c === '"') {
          if (q && text[i+1] === '"') { r[r.length-1] += '"'; i++; }
          else { q = !q; }
        } else if (c === ',' && !q) {
          r.push('');
        } else {
          if (r.length === 0) r.push('');
          r[r.length-1] += c;
        }
      }
      return r.map(x => x.trim());
    }

    window.closeConfirmModal = function() {
      const modal = document.getElementById("confirm-modal");
      if (modal) modal.classList.remove("show");
    }

    function importCatalogFromCSV(e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(evt) {
        const text = evt.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) {
          showToast("รูปแบบไฟล์ไม่ถูกต้อง", "ไฟล์ CSV ว่างเปล่า ไม่มีข้อมูลสำหรับนำเข้า", "danger");
          return;
        }

        const expectedHeaders = [
          "code", "name", "description", "manufacturer", "equipmentModels",
          "inStock", "unitPrice", "minStock", "maxStock", "reorderPoint",
          "reorderQty", "location", "supplierName", "supplierContact",
          "purchaseDate", "expiryDate", "leadTime", "repairFreq"
        ];

        let headerLine = lines[0];
        if (headerLine.charCodeAt(0) === 0xFEFF) {
          headerLine = headerLine.substring(1);
        }
        const headers = parseCSVLine(headerLine);

        const isValidHeaders = expectedHeaders.every((h, idx) => headers[idx] === h);
        if (!isValidHeaders) {
          showToast("นำเข้าข้อมูลล้มเหลว", "หัวข้อตาราง (Headers) ของไฟล์ CSV ไม่ถูกต้องตามรูปแบบของคลัง", "danger");
          return;
        }

        let parsedParts = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < expectedHeaders.length) continue;

          let partObj = {};
          expectedHeaders.forEach((h, idx) => {
            let val = values[idx];
            if ([
              "inStock", "minStock", "maxStock", "reorderPoint",
              "reorderQty", "leadTime", "repairFreq"
            ].includes(h)) {
              partObj[h] = parseInt(val) || 0;
            } else if (h === "unitPrice") {
              partObj[h] = parseFloat(val) || 0;
            } else if (h === "equipmentModels") {
              partObj[h] = val ? val.split(";").map(m => m.trim()).filter(Boolean) : [];
            } else {
              partObj[h] = val || "";
            }
          });
          parsedParts.push(partObj);
        }

        if (parsedParts.length === 0) {
          showToast("ไม่พบรายการอะไหล่", "ไม่มีข้อมูลอะไหล่ที่ถูกต้องในไฟล์ CSV สำหรับนำเข้า", "danger");
          return;
        }

        // Show custom confirmation modal
        document.getElementById("confirm-message").innerText = `พบอะไหล่จำนวน ${parsedParts.length} รายการในไฟล์นี้ การนำเข้าข้อมูลนี้จะทำการล้างข้อมูลเดิมในคลังทั้งหมดและเขียนทับใหม่ คุณยืนยันที่จะทำรายการนี้หรือไม่?`;
        
        const confirmBtn = document.getElementById("btn-confirm-import");
        confirmBtn.onclick = function() {
          closeConfirmModal();
          parts = parsedParts;
          persistState();
          
          renderCatalog();
          updateDashboard();
          populateTransactionSelects();
          
          showToast("นำเข้าข้อมูลสำเร็จ", `นำเข้าคลังอะไหล่ใหม่จำนวน ${parsedParts.length} รายการ และซิงก์เรียบร้อยแล้ว`, "success");
        };

        const modal = document.getElementById("confirm-modal");
        if (modal) modal.classList.add("show");
      };
      
      reader.readAsText(file, "UTF-8");
    }

    function savePartDetails() {
      const form = document.getElementById("part-form");
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const mode = document.getElementById("part-form-mode").value;
      const partCode = document.getElementById("part-code").value.trim();
      
      const supplierInput = document.getElementById("part-supplier").value.trim();
      let supName = supplierInput;
      let supContact = "-";
      if (supplierInput.includes("/")) {
        const parts = supplierInput.split("/");
        supName = parts[0].trim();
        supContact = parts[1].replace(/Tel:|ติดต่อ:/gi, "").trim();
      }

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
        if (parts.some(p => p.code === partCode)) {
          alert("รหัสอะไหล่นี้มีอยู่แล้วในระบบ กรุณาใช้รหัสอื่น");
          return;
        }
        parts.push(partPayload);
        showToast("สำเร็จ", `เพิ่มอะไหล่ ${partCode} สำเร็จ`, "success");
      } else {
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
      const partSelect = document.getElementById("tx-part-code");
      partSelect.innerHTML = "";
      parts.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.code;
        opt.innerText = `[${p.code}] ${p.name} (คงเหลือ: ${p.inStock} ชิ้น)`;
        partSelect.appendChild(opt);
      });
    }

    function handleTxTypeChange() {
      const type = document.getElementById("tx-type").value;
      const issueDiv = document.getElementById("tx-conditional-issue");
      const borrowDiv = document.getElementById("tx-conditional-borrow");

      const serialInput = document.getElementById("tx-eq-serial");
      const dueDateInput = document.getElementById("tx-due-date");
      
      const repairGroup = document.getElementById("tx-repair-group");
      const deptGroup = document.getElementById("tx-dept-group");

      if (type === "Issue") {
        issueDiv.style.display = "grid";
        borrowDiv.style.display = "none";
        serialInput.required = true;
        dueDateInput.required = false;
        if (repairGroup) repairGroup.style.display = "block";
        if (deptGroup) deptGroup.style.display = "block";
      } else if (type === "Borrow") {
        issueDiv.style.display = "grid";
        borrowDiv.style.display = "block";
        serialInput.required = true;
        dueDateInput.required = true;
        if (repairGroup) repairGroup.style.display = "block";
        if (deptGroup) deptGroup.style.display = "block";
      } else {
        issueDiv.style.display = "none";
        borrowDiv.style.display = "none";
        serialInput.required = false;
        dueDateInput.required = false;
        if (repairGroup) repairGroup.style.display = "none";
        if (deptGroup) deptGroup.style.display = "none";
      }

      validateInputs();
    }

    function validateInputs() {
      const type = document.getElementById("tx-type").value;
      const serialInput = document.getElementById("tx-eq-serial");
      const repairInput = document.getElementById("tx-repair-no");
      const deptInput = document.getElementById("tx-dept");

      const isRequired = (type === "Issue" || type === "Borrow");

      // Validate Serial
      if (isRequired) {
        if (serialInput.value.trim() === "") {
          serialInput.classList.add("input-required-empty");
          serialInput.classList.remove("input-required-valid");
        } else {
          serialInput.classList.remove("input-required-empty");
          serialInput.classList.add("input-required-valid");
        }
      } else {
        serialInput.classList.remove("input-required-empty", "input-required-valid");
      }

      // Validate Repair Number (Must be exactly 6 digits)
      if (isRequired) {
        const repairVal = repairInput.value.trim();
        const isValidRepair = /^\d{6}$/.test(repairVal);
        if (!isValidRepair) {
          repairInput.classList.add("input-required-empty");
          repairInput.classList.remove("input-required-valid");
        } else {
          repairInput.classList.remove("input-required-empty");
          repairInput.classList.add("input-required-valid");
        }
      } else {
        repairInput.classList.remove("input-required-empty", "input-required-valid");
      }

      // Validate Department
      if (isRequired) {
        if (deptInput.value.trim() === "") {
          deptInput.classList.add("input-required-empty");
          deptInput.classList.remove("input-required-valid");
        } else {
          deptInput.classList.remove("input-required-empty");
          deptInput.classList.add("input-required-valid");
        }
      } else {
        deptInput.classList.remove("input-required-empty", "input-required-valid");
      }
    }

    async function processTransaction(e) {
      e.preventDefault();
      
      const type = document.getElementById("tx-type").value;
      const partCode = document.getElementById("tx-part-code").value;
      const qty = parseInt(document.getElementById("tx-qty").value);
      const refDoc = document.getElementById("tx-ref-doc").value.trim();
      const operator = document.getElementById("tx-operator").value.trim();
      const details = document.getElementById("tx-details").value.trim();
      
      const repairNoVal = document.getElementById("tx-repair-no").value.trim();
      const deptVal = document.getElementById("tx-dept").value.trim();

      const isRequired = (type === "Issue" || type === "Borrow");

      // Validation check
      if (isRequired) {
        const serialVal = document.getElementById("tx-eq-serial").value.trim();
        if (serialVal === "") {
          showToast("ตรวจสอบข้อมูลล้มเหลว", "กรุณาระบุซีเรียลเครื่องมือแพทย์ที่ใช้อะไหล่", "danger");
          return;
        }
        if (!/^\d{6}$/.test(repairNoVal)) {
          showToast("ตรวจสอบข้อมูลล้มเหลว", "กรุณาระบุเลขซ่อมให้ถูกต้อง (ต้องเป็นตัวเลข 6 หลัก)", "danger");
          return;
        }
        if (deptVal === "") {
          showToast("ตรวจสอบข้อมูลล้มเหลว", "กรุณาระบุหน่วยงานที่เบิก / แผนกที่ใช้", "danger");
          return;
        }
      }

      const partIndex = parts.findIndex(p => p.code === partCode);
      if (partIndex === -1) {
        showToast("ไม่พบรหัสชิ้นส่วน", "ไม่พบรหัสอะไหล่ดังกล่าวในระบบ", "danger");
        return;
      }
      
      const part = parts[partIndex];

      if (type === "Issue" || type === "Borrow") {
        if (part.inStock < qty) {
          showToast("จำนวนอะไหล่ไม่พอ", `อะไหล่ในสต๊อกมีเพียง ${part.inStock} ชิ้น ไม่เพียงพอต่อการจัดกิจกรรมเบิก/ยืมจำนวน ${qty} ชิ้น`, "danger");
          return;
        }
      }

      // Disable submit button during processing
      const submitBtn = e.target.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="margin-right: 5px;"></span> กำลังบันทึกรายการ...';

      try {
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
          eqSerial = document.getElementById("tx-eq-serial").value.trim();
          const eq = equipment.find(e => e.serial === eqSerial);
          eqModel = eq ? eq.model : "-";
          maintType = document.getElementById("tx-maint-type").value;
        } else if (type === "Borrow") {
          stockAdjustment = -qty;
          eqSerial = document.getElementById("tx-eq-serial").value.trim();
          const eq = equipment.find(e => e.serial === eqSerial);
          eqModel = eq ? eq.model : "-";
          borrowStatus = "Borrowed";
          borrowDueDate = document.getElementById("tx-due-date").value;
        } else if (type === "Return") {
          stockAdjustment = qty;
          const openBorrow = transactions.find(t => t.partCode === partCode && t.type === "Borrow" && t.borrowStatus === "Borrowed");
          if (openBorrow) {
            openBorrow.borrowStatus = "Returned";
          }
          borrowStatus = "Returned";
        } else if (type === "Audit") {
          stockAdjustment = qty - part.inStock;
        }

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
          repairNo: repairNoVal,
          dept: deptVal,
          operator: currentUser ? currentUser.realName : operator,
          operatorRole: currentUser ? currentUser.role : "Unknown",
          details: details,
          cost: qty * part.unitPrice,
          eqSerial,
          eqModel,
          maintenanceType: maintType,
          borrowStatus,
          borrowDueDate
        };

        if (type === "Audit") {
          part.inStock = qty;
        } else {
          part.inStock += stockAdjustment;
        }

        transactions.unshift(txEntry);
        persistState();

        // Send LINE Alert and wait for response
        const lineResult = await sendLineNotification(txEntry, part.inStock);

        // Reset form & inputs
        document.getElementById("tx-form").reset();
        if (currentUser) {
          document.getElementById("tx-operator").value = currentUser.realName;
          document.getElementById("tx-operator").disabled = true;
        }
        document.getElementById("tx-qty").value = "";
        document.getElementById("tx-ref-doc").value = "";
        document.getElementById("tx-repair-no").value = "";
        document.getElementById("tx-dept").value = "";
        document.getElementById("tx-details").value = "";

        populateTransactionSelects();
        renderTransactionsTable();
        updateDashboard();

        // Check LINE result to determine popup modal notification style
        if (lineResult.success) {
          if (lineResult.omitted) {
            showToast("บันทึกสำเร็จ", `บันทึกรายการทำธุรกรรม ${type} (รหัสอะไหล่ ${partCode}) ลงในฐานข้อมูลคลังสำเร็จเรียบร้อยแล้ว`, "success");
          } else {
            showToast("บันทึก & แจ้งเตือนสำเร็จ", `บันทึกรายการธุรกรรมคลังสำเร็จ และได้จัดส่งข้อความแจ้งเตือน LINE เรียบร้อยสมบูรณ์`, "success");
          }
        } else {
          // Local save succeeded, but LINE failed (Partial Success)
          showToast("สมบูรณ์บางส่วน (บันทึกสำเร็จ แต่ LINE ล้มเหลว)", `ระบบบันทึกรายการในคลังสำเร็จแล้ว แต่ไม่สามารถส่งแจ้งเตือน LINE ได้เนื่องจาก: ${lineResult.error}`, "warning");
        }

      } catch (err) {
        console.error(err);
        showToast("บันทึกข้อมูลล้มเหลว", `ไม่สามารถทำการบันทึกหรือส่ง LINE ได้เลย: ${err.message}`, "danger");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }

    function renderTransactionsTable() {
      const tbody = document.getElementById("transactions-table-body");
      if (!tbody) return;
      tbody.innerHTML = "";

      const searchQuery = document.getElementById("ledger-search") ? document.getElementById("ledger-search").value.toLowerCase() : "";
      const filterType = document.getElementById("ledger-filter-type") ? document.getElementById("ledger-filter-type").value : "All";
      const filterTime = document.getElementById("ledger-filter-time") ? document.getElementById("ledger-filter-time").value : "All";

      // Filter transactions
      let filtered = transactions;

      // 1. Filter by search query
      if (searchQuery) {
        filtered = filtered.filter(t => 
          t.partCode.toLowerCase().includes(searchQuery) ||
          t.partName.toLowerCase().includes(searchQuery) ||
          t.operator.toLowerCase().includes(searchQuery) ||
          (t.eqSerial && t.eqSerial.toLowerCase().includes(searchQuery)) ||
          (t.refDoc && t.refDoc.toLowerCase().includes(searchQuery))
        );
      }

      // 2. Filter by type
      if (filterType !== "All") {
        filtered = filtered.filter(t => t.type === filterType);
      }

      // 3. Filter by time
      if (filterTime !== "All") {
        const now = new Date();
        filtered = filtered.filter(t => {
          const tDate = new Date(t.timestamp);
          const diffTime = Math.abs(now - tDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (filterTime === "Today") {
            return tDate.toDateString() === now.toDateString();
          } else if (filterTime === "7days") {
            return diffDays <= 7;
          } else if (filterTime === "30days") {
            return diffDays <= 30;
          }
          return true;
        });
      }

      // Update Stats Widgets in the Ledger Tab
      updateLedgerStatsWidgets();

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">📭 ไม่พบรายการคลังตามเงื่อนไขค้นหา</td></tr>`;
        return;
      }

      filtered.forEach(t => {
        const dateObj = new Date(t.timestamp);
        const dateStr = dateObj.toLocaleDateString("th-TH") + " " + dateObj.toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' });

        let typeClass = "badge-in-stock";
        let typeTh = t.type;
        if (t.type === "Issue") { typeClass = "badge-low-stock"; typeTh = "เบิกซ่อม (Issue)"; }
        else if (t.type === "Borrow") { typeClass = "badge-expired"; typeTh = "ยืมทดสอบ (Borrow)"; }
        else if (t.type === "Return") { typeClass = "badge-safe"; typeTh = "คืนของยืม (Return)"; }
        else if (t.type === "Receive") { typeClass = "badge-in-stock"; typeTh = "รับเข้า (Receive)"; }
        else if (t.type === "Audit") { typeClass = "badge-class-b"; typeTh = "นับยอด (Audit)"; }

        let borrowBadge = "";
        if (t.type === "Borrow" && t.borrowStatus === "Borrowed") {
          const isOverdue = new Date(t.borrowDueDate) < new Date();
          borrowBadge = `<span class="badge ${isOverdue ? 'badge-expired' : 'badge-near-expiry'}">กำลังยืม (คืน ${t.borrowDueDate})</span>`;
        } else if (t.type === "Return" || t.borrowStatus === "Returned") {
          borrowBadge = `<span class="badge badge-safe">คืนเรียบร้อย</span>`;
        }

        let eqText = "";
        if (t.eqSerial) {
          eqText += `เครื่อง: ${t.eqSerial}`;
          if (t.maintenanceType) {
            eqText += `<br><span style="font-size: 0.75rem; color: var(--text-muted);">${t.maintenanceType}</span>`;
          }
        }
        if (t.repairNo) {
          if (eqText) eqText += "<br>";
          eqText += `เลขซ่อม: ${t.repairNo}`;
        }
        if (t.dept) {
          if (eqText) eqText += "<br>";
          eqText += `แผนก: ${t.dept}`;
        }
        if (!eqText) eqText = "-";

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

    function updateLedgerStatsWidgets() {
      const totalEl = document.getElementById("ledger-stats-total");
      const issuesEl = document.getElementById("ledger-stats-issues");
      const receivesEl = document.getElementById("ledger-stats-receives");
      const borrowsEl = document.getElementById("ledger-stats-borrows");

      if (!totalEl) return;

      totalEl.innerText = transactions.length;

      let totalIssued = 0;
      let totalReceived = 0;
      let activeBorrows = 0;

      transactions.forEach(t => {
        if (t.type === "Issue") totalIssued += Number(t.qty) || 0;
        else if (t.type === "Receive") totalReceived += Number(t.qty) || 0;
        else if (t.type === "Borrow" && t.borrowStatus === "Borrowed") activeBorrows++;
      });

      issuesEl.innerText = totalIssued;
      receivesEl.innerText = totalReceived;
      borrowsEl.innerText = activeBorrows;
    }

    function exportTransactionsToCSV() {
      if (transactions.length === 0) return;
      
      let csvContent = "\ufeffID,Timestamp,Type,PartCode,PartName,Qty,RefDoc,RepairNo,Department,Operator,OperatorRole,EqSerial,EqModel,MaintType,Cost\n";
      transactions.forEach(t => {
        csvContent += `"${t.id}","${t.timestamp}","${t.type}","${t.partCode}","${t.partName}",${t.qty},"${t.refDoc}","${t.repairNo || ''}","${t.dept || ''}","${t.operator}","${t.operatorRole || ''}","${t.eqSerial || ''}","${t.eqModel || ''}","${t.maintenanceType || ''}",${t.cost}\n`;
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

      const requiredCounts = {};

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
      if (!tbody) return;
      tbody.innerHTML = "";

      const reorderItems = parts.filter(p => p.inStock <= p.reorderPoint);

      if (reorderItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">🎉 อะไหล่ทุกรายการมีระดับคงคลังปลอดภัย สูงกว่าจุดเตือนภัยสั่งซื้อ</td></tr>`;
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
            <button class="btn btn-primary btn-sm" onclick="loadPartIntoMemorandum('${p.code}')" style="padding: 4px 8px; font-size: 0.75rem;">
              <i data-lucide="file-plus"></i> เพิ่มลงในบันทึกข้อความ
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      lucide.createIcons();
    }

    // Thai Currency Written Text Converter
    function thaiBahtText(num) {
      if (isNaN(num) || num === null || num === undefined) return "";
      num = Math.round(num * 100) / 100;
      const parts = num.toString().split(".");
      const baht = parts[0];
      const satang = parts[1];

      const numbers = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
      const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

      function convertSection(section) {
        let result = "";
        const len = section.length;
        for (let i = 0; i < len; i++) {
          const digit = parseInt(section.charAt(i));
          const pos = len - i - 1;
          if (digit !== 0) {
            if (pos === 1 && digit === 1) {
              result += "สิบ";
            } else if (pos === 1 && digit === 2) {
              result += "ยี่สิบ";
            } else if (pos === 0 && digit === 1 && len > 1) {
              result += "เอ็ด";
            } else {
              result += numbers[digit] + positions[pos];
            }
          }
        }
        return result;
      }

      let text = "";
      if (parseInt(baht) === 0) {
        text = "ศูนย์บาท";
      } else {
        if (baht.length > 6) {
          const millionPart = baht.slice(0, -6);
          const restPart = baht.slice(-6);
          text += convertSection(millionPart) + "ล้าน" + convertSection(restPart);
        } else {
          text += convertSection(baht);
        }
        text += "บาท";
      }

      if (!satang || parseInt(satang) === 0) {
        text += "ถ้วน";
      } else {
        text += convertSection(satang) + "สตางค์";
      }
      return text;
    }

    // Memorandum State
    let memoItems = [
      { desc: "NIBP Connector A1-1", qty: 10, unit: "ชิ้น", price: 100, stock: "-", monthly: "-" },
      { desc: "NIBP Connector A4", qty: 20, unit: "ชิ้น", price: 100, stock: "-", monthly: "-" },
      { desc: "NIBP Connector A6", qty: 5, unit: "ชิ้น", price: 250, stock: "-", monthly: "-" },
      { desc: "NIBP Connector A10", qty: 20, unit: "ชิ้น", price: 50, stock: "-", monthly: "-" }
    ];

    window.loadPartIntoMemorandum = function(partCode) {
      const part = parts.find(p => p.code === partCode);
      if (!part) return;

      // Avoid duplicate adds
      const isDuplicate = memoItems.some(item => item.desc.includes(part.code));
      if (isDuplicate) {
        showToast("มีรายการนี้แล้ว", "รายการอะไหล่นี้ถูกเลือกในบันทึกข้อความแล้ว", "warning");
        return;
      }

      memoItems.push({
        desc: `รหัส ${part.code} - ${part.name}`,
        qty: part.reorderQty || 1,
        unit: "ชิ้น",
        price: part.unitPrice || 0,
        stock: part.inStock || 0,
        monthly: "-"
      });

      renderMemorandum();
      showToast("เพิ่มลงในบันทึกข้อความแล้ว", `เพิ่มรหัสอะไหล่ ${part.code} ลงในใบจัดซื้อสำเร็จ`, "success");
    }

    function addMemoItem() {
      const desc = document.getElementById("memo-item-desc").value.trim();
      const qty = Number(document.getElementById("memo-item-qty").value) || 1;
      const unit = document.getElementById("memo-item-unit").value.trim() || "ชิ้น";
      const price = Number(document.getElementById("memo-item-price").value) || 0;
      const stock = document.getElementById("memo-item-stock").value.trim() || "-";
      const monthly = document.getElementById("memo-item-monthly").value.trim() || "-";

      if (!desc) {
        showToast("ระบุรายละเอียด", "กรุณาระบุรายละเอียดหรือชื่อรายการอะไหล่", "warning");
        return;
      }

      memoItems.push({ desc, qty, unit, price, stock, monthly });

      // Clear input fields
      document.getElementById("memo-item-desc").value = "";
      document.getElementById("memo-item-qty").value = "";
      document.getElementById("memo-item-unit").value = "";
      document.getElementById("memo-item-price").value = "";
      document.getElementById("memo-item-stock").value = "";
      document.getElementById("memo-item-monthly").value = "";

      renderMemorandum();
      showToast("เพิ่มรายการแล้ว", "เพิ่มรายการลงในบันทึกข้อความสำเร็จ", "success");
    }

    window.removeMemoItem = function(index) {
      memoItems.splice(index, 1);
      renderMemorandum();
      showToast("ลบรายการแล้ว", "นำรายการออกจากใบอนุมัติจัดซื้อเรียบร้อย", "success");
    }

    function loadROPItemsIntoMemo() {
      const reorderItems = parts.filter(p => p.inStock <= p.reorderPoint);
      if (reorderItems.length === 0) {
        showToast("ไม่มีรายการ ROP ต่ำ", "อะไหล่ทุกรายการในสต๊อกอยู่ในระดับปลอดภัย", "warning");
        return;
      }

      let addedCount = 0;
      reorderItems.forEach(p => {
        const isDuplicate = memoItems.some(item => item.desc.includes(p.code));
        if (!isDuplicate) {
          memoItems.push({
            desc: `รหัส ${p.code} - ${p.name}`,
            qty: p.reorderQty || 1,
            unit: "ชิ้น",
            price: p.unitPrice || 0,
            stock: p.inStock || 0,
            monthly: "-"
          });
          addedCount++;
        }
      });

      renderMemorandum();
      showToast("ดึงข้อมูล ROP แล้ว", `ดึงรายการอะไหล่ ROP ต่ำเพิ่มเข้ามา ${addedCount} รายการ`, "success");
    }

    function clearMemoForm() {
      memoItems = [];
      document.getElementById("memo-item-desc").value = "";
      document.getElementById("memo-item-qty").value = "";
      document.getElementById("memo-item-unit").value = "";
      document.getElementById("memo-item-price").value = "";
      document.getElementById("memo-item-stock").value = "";
      document.getElementById("memo-item-monthly").value = "";
      
      // Reset checkboxes
      for(let i=1; i<=6; i++) {
        document.getElementById(`memo-chk-${i}`).checked = (i === 1);
      }
      document.getElementById("memo-chk-other-text").value = "";
      document.getElementById("memo-chk-other-text").style.display = "none";
      
      renderMemorandum();
      showToast("ล้างฟอร์มสำเร็จ", "ระบบเปลี่ยนเป็นฟอร์มขออนุมัติแบบว่างเรียบร้อยแล้ว", "success");
    }

    function renderMemorandum() {
      // 1. Sync Text Fields from Editor to View
      const textFields = [
        ["memo-edit-dept", "memo-view-dept"],
        ["memo-edit-doc-no", "memo-view-doc-no"],
        ["memo-edit-date", "memo-view-date"],
        ["memo-edit-subject", "memo-view-subject"],
        ["memo-edit-to", "memo-view-to"],
        ["memo-edit-body", "memo-view-body"],
        ["memo-edit-reason", "memo-view-reason"],
        ["memo-edit-sig-left1", "memo-view-sig-left1"],
        ["memo-edit-title-left1", "memo-view-title-left1"],
        ["memo-edit-sig-right1", "memo-view-sig-right1"],
        ["memo-edit-title-right1", "memo-view-title-right1"],
        ["memo-edit-sig-left2", "memo-view-sig-left2"],
        ["memo-edit-title-left2", "memo-view-title-left2"],
        ["memo-edit-sig-right2", "memo-view-sig-right2"],
        ["memo-edit-title-right2", "memo-view-title-right2"]
      ];

      textFields.forEach(([editId, viewId]) => {
        const editEl = document.getElementById(editId);
        const viewEl = document.getElementById(viewId);
        if (editEl && viewEl) {
          viewEl.innerText = editEl.value;
        }
      });

      // Special handling for pre-formatted committee textarea
      const commEdit = document.getElementById("memo-edit-committee");
      const commView = document.getElementById("memo-view-committee");
      if (commEdit && commView) {
        commView.innerText = commEdit.value;
      }

      // 2. Sync Checkboxes
      for (let i = 1; i <= 6; i++) {
        const editChk = document.getElementById(`memo-chk-${i}`);
        const viewChk = document.getElementById(`memo-view-chk-${i}`);
        if (editChk && viewChk) {
          viewChk.innerText = editChk.checked ? "[✓]" : "[ ]";
        }
      }

      // Checkbox other text field
      const chk6 = document.getElementById("memo-chk-6");
      const otherTxt = document.getElementById("memo-chk-other-text");
      const otherValView = document.getElementById("memo-view-chk-other-val");
      if (chk6 && otherValView) {
        if (chk6.checked && otherTxt && otherTxt.value.trim()) {
          otherValView.innerText = otherTxt.value;
        } else {
          otherValView.innerText = "........................";
        }
      }

      // 3. Render Table rows inside Memorandum View
      const memoTbody = document.getElementById("memo-view-table-body");
      if (!memoTbody) return;
      memoTbody.innerHTML = "";

      let grandTotal = 0;

      memoItems.forEach((item, index) => {
        const lineTotal = item.qty * item.price;
        grandTotal += lineTotal;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td style="border: 1px solid black; padding: 6px 4px; text-align: center;">${index + 1}</td>
          <td style="border: 1px solid black; padding: 6px 6px;">${item.desc}</td>
          <td style="border: 1px solid black; padding: 6px 4px; text-align: center;">${item.qty}</td>
          <td style="border: 1px solid black; padding: 6px 4px; text-align: center;">${item.unit}</td>
          <td style="border: 1px solid black; padding: 6px 4px; text-align: right;">${item.price.toLocaleString("th-TH")}</td>
          <td style="border: 1px solid black; padding: 6px 4px; text-align: center;">${item.stock}</td>
          <td style="border: 1px solid black; padding: 6px 4px; text-align: center;">${item.monthly}</td>
          <td style="border: 1px solid black; padding: 6px 4px; text-align: right; font-weight: bold;">${lineTotal.toLocaleString("th-TH")}</td>
        `;
        memoTbody.appendChild(tr);
      });

      // Update totals
      document.getElementById("memo-view-total-items").innerText = memoItems.length;
      document.getElementById("memo-view-total-val").innerText = grandTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 });
      document.getElementById("memo-view-total-thai").innerText = thaiBahtText(grandTotal);

      // 4. Render Table rows inside Editor Workspace
      const editorTbody = document.getElementById("editor-items-tbody");
      if (editorTbody) {
        editorTbody.innerHTML = "";
        if (memoItems.length === 0) {
          editorTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 12px;">ไม่มีรายการในเอกสาร (ฟอร์มเปล่า)</td></tr>`;
        } else {
          memoItems.forEach((item, index) => {
            const tr = document.createElement("tr");
            tr.style.borderBottom = "1px solid var(--border-color)";
            tr.innerHTML = `
              <td style="padding: 8px; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.desc}</td>
              <td style="padding: 8px; text-align: center;">${item.qty} ${item.unit}</td>
              <td style="padding: 8px; text-align: right;">฿${item.price.toLocaleString("th-TH")}</td>
              <td style="padding: 8px; text-align: right;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="removeMemoItem(${index})" style="padding: 2px 6px; background: rgba(220,38,38,0.1); color: var(--danger); border: none;">
                  <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                </button>
              </td>
            `;
            editorTbody.appendChild(tr);
          });
          lucide.createIcons();
        }
      }
    }

    // 11. Cloud & LINE Integration Core
    function saveSettings() {
      const newPwd = document.getElementById("settings-password").value.trim();
      const gasUrl = document.getElementById("settings-gas-url").value.trim();
      const lineToggle = document.getElementById("settings-line-toggle").checked;
      const lineToken = document.getElementById("settings-line-token").value.trim();
      const lineGroupId = document.getElementById("settings-line-groupid").value.trim();

      if (newPwd) {
        settings.password = newPwd;
        const progDefault = userAccounts.find(u => u.realName === "NKP Programmer (Default)");
        if (progDefault) {
          progDefault.password = newPwd;
          localStorage.setItem("nkp_users", JSON.stringify(userAccounts));
        }
      }
      settings.gasUrl = gasUrl;
      settings.lineToggle = lineToggle;
      settings.lineToken = lineToken;
      settings.lineGroupId = lineGroupId;

      localStorage.setItem("nkp_parts_settings", JSON.stringify(settings));
      showToast("บันทึกข้อมูลแล้ว", "อัปเดตระบบการตั้งค่าความปลอดภัยและเครือข่ายเรียบร้อย", "success");
      persistState();
    }

    function sendLineNotification(tx, remainingStock) {
      if (!settings.lineToggle || !settings.lineToken || !settings.lineGroupId) {
        console.log("LINE Notification omitted: Credentials/Toggle are disabled.", tx);
        return Promise.resolve({ success: true, omitted: true });
      }

      const typeLabel = tx.type === "Issue" ? "เบิกจ่ายอะไหล่ 📤" : 
                        tx.type === "Borrow" ? "ยืมอะไหล่ทดสอบ 🔍" :
                        tx.type === "Return" ? "คืนอะไหล่คลัง 📥" :
                        tx.type === "Receive" ? "รับอะไหล่เข้าคลัง ➕" : "ปรับปรุงสต๊อก ⚙️";

      const colorTheme = tx.type === "Issue" ? "#ef4444" : 
                         tx.type === "Borrow" ? "#f97316" :
                         tx.type === "Receive" ? "#22c55e" : "#14b8a6";

      const detailContents = [
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            { "type": "text", "text": "จำนวน:", "size": "sm", "color": "#555555" },
            { "type": "text", "text": tx.qty + " ชิ้น", "size": "sm", "weight": "bold", "align": "end" }
          ]
        },
        {
          "type": "box",
          "layout": "horizontal",
          "contents": [
            { "type": "text", "text": "คงคลังล่าสุด:", "size": "sm", "color": "#555555" },
            { "type": "text", "text": remainingStock + " ชิ้น", "size": "sm", "weight": "bold", "color": remainingStock <= 5 ? "#ef4444" : "#22c55e", "align": "end" }
          ]
        }
      ];

      if (tx.eqSerial) {
        detailContents.push({
          "type": "box",
          "layout": "horizontal",
          "contents": [
            { "type": "text", "text": "ซีเรียลเครื่องซ่อม:", "size": "sm", "color": "#555555" },
            { "type": "text", "text": tx.eqSerial, "size": "sm", "align": "end" }
          ]
        });
      }

      detailContents.push({
        "type": "box",
        "layout": "horizontal",
        "contents": [
          { "type": "text", "text": "ช่างเทคนิค:", "size": "sm", "color": "#555555" },
          { "type": "text", "text": tx.operator, "size": "sm", "align": "end" }
        ]
      });

      const flexMessage = {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": "คลังเครื่องมือแพทย์ รพ.นครพิงค์", "color": "#ffffff", "weight": "bold", "size": "sm" },
            { "type": "text", "text": typeLabel, "color": "#ffffff", "weight": "bold", "size": "xl", "margin": "sm" }
          ],
          "backgroundColor": colorTheme
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "contents": [
            { "type": "text", "text": tx.partName, "weight": "bold", "size": "md", "wrap": true },
            { "type": "text", "text": "รหัสอะไหล่: " + tx.partCode, "size": "xs", "color": "#888888", "margin": "xs" },
            { "type": "separator", "margin": "md" },
            {
              "type": "box",
              "layout": "vertical",
              "margin": "md",
              "spacing": "sm",
              "contents": detailContents
            }
          ]
        }
      };

      if (settings.gasUrl) {
        return fetch(settings.gasUrl, {
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
        .then(() => {
          console.log("LINE Alert sent successfully.");
          return { success: true };
        })
        .catch(err => {
          console.error("LINE Notify failed", err);
          return { success: false, error: err.message || err };
        });
      }
      return Promise.resolve({ success: false, error: "ไม่ได้ระบุ URL ของ Web App" });
    }

    async function testLineMessage() {
      if (!settings.lineToken || !settings.lineGroupId) {
        showToast("ไม่สามารถทดสอบได้", "กรุณากรอก LINE Token และ Group ID ให้ครบก่อนการกดทดสอบ", "danger");
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
      
      showToast("กำลังส่งข้อความทดสอบ", "กำลังเชื่อมต่อระบบ LINE เพื่อส่งข้อความทดสอบ...", "warning");
      const result = await sendLineNotification(mockTx, 29);
      if (result.success) {
        showToast("สำเร็จ", "ส่งข้อความแจ้งเตือน LINE ทดสอบสำเร็จแล้ว", "success");
      } else {
        showToast("ส่งข้อความล้มเหลว", `ไม่สามารถส่งแจ้งเตือน LINE ได้: ${result.error}`, "danger");
      }
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
          transactions: transactions,
          users: userAccounts
        })
      })
      .then(() => console.log("Cloud sync successful."))
      .catch(err => console.error("Cloud database sync failure", err));
    }

    function pullFromCloud() {
      if (!settings.gasUrl) return;
      fetch(settings.gasUrl)
      .then(response => response.json())
      .then(data => {
        if (data.parts && data.parts.length > 0) {
          parts = data.parts;
          localStorage.setItem("nkp_parts", JSON.stringify(parts));
        }
        if (data.transactions && data.transactions.length > 0) {
          transactions = data.transactions;
          localStorage.setItem("nkp_transactions", JSON.stringify(transactions));
        }
        if (data.users && data.users.length > 0) {
          userAccounts = data.users;
          localStorage.setItem("nkp_users", JSON.stringify(userAccounts));
          if (currentUser) {
            const updatedSelf = userAccounts.find(u => String(u.password) === String(currentUser.password));
            if (updatedSelf) {
              currentUser = updatedSelf;
              sessionStorage.setItem("nkp_current_user", JSON.stringify(currentUser));
            }
          }
        }
        updateDashboard();
        renderCatalog();
        populateTransactionSelects();
        renderTransactionsTable();
        renderPMPlans();
        renderProcurementMonitor();
        renderUserManagement();
      })
      .catch(err => console.error("Cloud pull failed", err));
    }

    function copyAppsScriptCode() {
      const preText = document.getElementById("code-content").innerText;
      navigator.clipboard.writeText(preText).then(() => {
        showToast("คัดลอกโค้ดสำเร็จ", "นำโค้ดไปวางใน Google Apps Script ใน Google Sheets ได้ทันที", "success");
      });
    }

    // 11.5. User Management Controllers
    function renderUserManagement() {
      const tbody = document.getElementById("user-management-table-body");
      if (!tbody) return;
      tbody.innerHTML = "";

      const countProg = userAccounts.filter(u => u.role === "Programmer").length;
      const countManager = userAccounts.filter(u => u.role === "Stock Manager").length;
      const countGen = userAccounts.filter(u => u.role === "General User").length;

      document.getElementById("count-users-prog").innerText = `${countProg} / 3`;
      document.getElementById("count-users-manager").innerText = `${countManager} / 3`;
      document.getElementById("count-users-gen").innerText = `${countGen} / 10`;

      userAccounts.forEach((u, index) => {
        const tr = document.createElement("tr");
        
        let statusBadge = u.status === "Active" ? 
          `<span class="badge badge-safe">เปิดใช้งาน</span>` : 
          `<span class="badge badge-expired">ปิดสิทธิ์</span>`;

        let roleBadge = "badge-c";
        if (u.role === "Programmer") roleBadge = "badge-a";
        else if (u.role === "Stock Manager") roleBadge = "badge-b";

        const toggleBtnText = u.status === "Active" ? "ปิดสิทธิ์" : "เปิดใช้";
        const toggleBtnColor = u.status === "Active" ? "var(--danger)" : "var(--success)";

        const isSelf = currentUser && String(currentUser.password) === String(u.password);
        const disableDeactivate = isSelf || (u.role === "Programmer" && userAccounts.filter(usr => usr.role === "Programmer" && usr.status === "Active").length <= 1 && u.status === "Active");

        tr.innerHTML = `
          <td><strong>${u.realName}</strong></td>
          <td><span class="badge ${roleBadge}">${u.role}</span></td>
          <td><code style="background: var(--bg-tertiary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">${u.password}</code></td>
          <td><strong>${u.loginCount || 0}</strong></td>
          <td>${statusBadge}</td>
          <td>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="toggleUserStatus(${index})" ${disableDeactivate ? "disabled style='opacity: 0.5;'" : ""} style="padding: 4px 8px; font-size: 0.75rem; color: ${toggleBtnColor};">
                ${toggleBtnText}
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }

    window.toggleUserStatus = function(index) {
      const u = userAccounts[index];
      if (!u) return;

      u.status = u.status === "Active" ? "Inactive" : "Active";
      localStorage.setItem("nkp_users", JSON.stringify(userAccounts));
      renderUserManagement();
      persistState();
      showToast("สิทธิ์ผู้ใช้ถูกปรับเปลี่ยน", `เปลี่ยนสถานะของ ${u.realName} เป็น ${u.status === "Active" ? 'เปิดใช้งาน' : 'ปิดสิทธิ์'}`, "success");
    };

    function generateUserAccount() {
      const realNameInput = document.getElementById("new-user-name");
      const roleSelect = document.getElementById("new-user-role");

      const realName = realNameInput.value.trim();
      const role = roleSelect.value;

      if (!realName) {
        alert("กรุณากรอกชื่อ-นามสกุลจริง!");
        return;
      }

      const countProg = userAccounts.filter(u => u.role === "Programmer").length;
      const countManager = userAccounts.filter(u => u.role === "Stock Manager").length;
      const countGen = userAccounts.filter(u => u.role === "General User").length;

      if (role === "Programmer" && countProg >= 3) {
        alert("ขออภัย! สิทธิ์ Programmer จำกัดสูงสุดไม่เกิน 3 คน");
        return;
      }
      if (role === "Stock Manager" && countManager >= 3) {
        alert("ขออภัย! สิทธิ์ Stock Manager จำกัดสูงสุดไม่เกิน 3 คน");
        return;
      }
      if (role === "General User" && countGen >= 10) {
        alert("ขออภัย! สิทธิ์ General User จำกัดสูงสุดไม่เกิน 10 คน");
        return;
      }

      const password = generateSecurePassword();

      userAccounts.push({
        realName: realName,
        password: password,
        role: role,
        status: "Active",
        loginCount: 0
      });

      localStorage.setItem("nkp_users", JSON.stringify(userAccounts));
      realNameInput.value = "";
      
      renderUserManagement();
      persistState();
      
      showToast("สร้างบัญชีสำเร็จ", `ผู้ใช้งาน ${realName} รหัสผ่าน: ${password}`, "success");
      alert(`สร้างผู้ใช้ใหม่เรียบร้อยแล้ว!\n\nชื่อ: ${realName}\nสิทธิ์: ${role}\nรหัสผ่าน: ${password}\n\nกรุณาจดบันทึกรหัสผ่านนี้ส่งต่อให้ผู้ใช้งาน`);
    }

    function generateSecurePassword() {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let result = "nkp-";
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (userAccounts.some(u => String(u.password) === result)) {
        return generateSecurePassword();
      }
      return result;
    }

    function saveOwnPassword() {
      const newPwd = document.getElementById("change-pwd-new").value.trim();
      const confirmPwd = document.getElementById("change-pwd-confirm").value.trim();
      const errorDiv = document.getElementById("change-pwd-error");

      if (newPwd === "") {
        errorDiv.innerText = "กรุณากรอกรหัสผ่านใหม่";
        return;
      }

      if (newPwd.length < 4) {
        errorDiv.innerText = "รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร";
        return;
      }

      if (newPwd !== confirmPwd) {
        errorDiv.innerText = "การยืนยันรหัสผ่านไม่ตรงกัน";
        return;
      }

      const isDuplicate = userAccounts.some(u => String(u.password) === String(newPwd) && String(u.password) !== String(currentUser.password));
      if (isDuplicate) {
        errorDiv.innerText = "รหัสผ่านนี้ถูกใช้โดยบัญชีอื่นแล้ว กรุณาเลือกรหัสผ่านอื่น";
        return;
      }

      const userIndex = userAccounts.findIndex(u => String(u.password) === String(currentUser.password));
      if (userIndex !== -1) {
        userAccounts[userIndex].password = newPwd;
        localStorage.setItem("nkp_users", JSON.stringify(userAccounts));
        
        currentUser.password = newPwd;
        sessionStorage.setItem("nkp_current_user", JSON.stringify(currentUser));
        
        if (currentUser.realName === "NKP Programmer (Default)") {
          settings.password = newPwd;
          localStorage.setItem("nkp_parts_settings", JSON.stringify(settings));
        }

        closeModal("modal-change-own-password");
        persistState();
        showToast("สำเร็จ", "เปลี่ยนรหัสผ่านของคุณเรียบร้อยแล้ว", "success");
        if (currentUser.role === "Programmer") {
          renderUserManagement();
        }
      } else {
        errorDiv.innerText = "เกิดข้อผิดพลาดในการค้นหาผู้ใช้";
      }
    }

    // 12. Modal Utility Triggers
    window.openModal = function(modalId) {
      document.getElementById(modalId).classList.add("active");
    }
    window.closeModal = function(modalId) {
      document.getElementById(modalId).classList.remove("active");
    }

    window.showToast = function(title, msg, type = "success") {
      const toast = document.getElementById("toast-notification");
      const card = document.getElementById("toast-content-card");
      document.getElementById("toast-title").innerText = title;
      document.getElementById("toast-message").innerText = msg;

      card.className = "toast-modal-content " + type;

      const iconContainer = document.getElementById("toast-icon-container");
      let iconColor = "#22c55e";
      let iconName = "check-circle2";
      if (type === "danger") {
        iconColor = "#ef4444";
        iconName = "x-circle";
      } else if (type === "warning") {
        iconColor = "#eab308";
        iconName = "alert-circle";
      }

      iconContainer.innerHTML = `<i data-lucide="${iconName}" style="width: 48px; height: 48px; color: ${iconColor}; filter: drop-shadow(0 0 8px ${iconColor});"></i>`;
      lucide.createIcons();
      toast.classList.add("show");
    }

    window.dismissToast = function() {
      const toast = document.getElementById("toast-notification");
      toast.classList.remove("show");
    }
