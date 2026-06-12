/**
 * NKP-Part: API Connector to Google Apps Script Web App
 */

const NKPApi = {
  // Get API Web App URL from LocalStorage
  getApiUrl() {
    return localStorage.getItem('nkp_api_url') || '';
  },

  // Save API URL
  setApiUrl(url) {
    localStorage.setItem('nkp_api_url', url);
  },

  // Test connection to the Web App
  async testConnection() {
    const url = this.getApiUrl();
    if (!url) throw new Error("กรุณาตั้งค่า Google Apps Script Web App URL ก่อน");
    
    try {
      // Perform a test GET request for inventory
      const response = await fetch(`${url}?action=getInventory`, {
        method: 'GET',
        mode: 'cors'
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const result = await response.json();
      return result.success;
    } catch (err) {
      console.error("API Test Connection failed:", err);
      throw err;
    }
  },

  // Generic fetch helper for GET requests
  async fetchGet(action) {
    const url = this.getApiUrl();
    if (!url) throw new Error("กรุณาตั้งค่า Google Apps Script Web App URL ในหน้าตั้งค่า");
    
    try {
      const response = await fetch(`${url}?action=${action}`, {
        method: 'GET',
        mode: 'cors',
        headers: {
          'Accept': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || result.message || "Failed to fetch data");
      return result.data;
    } catch (err) {
      console.error(`GET request failed [${action}]:`, err);
      throw err;
    }
  },

  // Generic helper for POST requests
  async fetchPost(payload) {
    const url = this.getApiUrl();
    if (!url) throw new Error("กรุณาตั้งค่า Google Apps Script Web App URL ในหน้าตั้งค่า");
    
    try {
      // Google Apps Script requires content-type text/plain or application/x-www-form-urlencoded 
      // when using CORS simple request, but posting JSON stringified works beautifully
      const response = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || result.error || "Failed to submit data");
      return result;
    } catch (err) {
      console.error(`POST request failed:`, err);
      throw err;
    }
  },

  // API operations
  getInventory() { return this.fetchGet("getInventory"); },
  getReceiving() { return this.fetchGet("getReceiving"); },
  getTransactions() { return this.fetchGet("getTransactions"); },
  getStockCounts() { return this.fetchGet("getStockCounts"); },

  addPart(partData) {
    return this.fetchPost({ action: "addPart", ...partData });
  },

  updatePart(partData) {
    return this.fetchPost({ action: "updatePart", ...partData });
  },

  receivePart(receivingData) {
    return this.fetchPost({ action: "receivePart", ...receivingData });
  },

  requisitionPart(reqData) {
    return this.fetchPost({ action: "requisitionPart", ...reqData });
  },

  returnPart(returnData) {
    return this.fetchPost({ action: "returnPart", ...returnData });
  },

  stockCount(countData) {
    return this.fetchPost({ action: "stockCount", ...countData });
  }
};
