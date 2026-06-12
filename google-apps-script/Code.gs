/**
 * NKP-Part: Google Apps Script Backend API
 * Uses Google Sheets as a Database for Medical Equipment Spare Parts Inventory Management.
 */

// Initialize and get the Active Spreadsheet
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Auto-initialize sheets and headers if they do not exist
function initDatabase() {
  var ss = getSpreadsheet();
  
  var sheets = {
    "MasterParts": [
      'รหัสอะไหล่', 'OEM Part No', 'ชื่ออะไหล่ / ยี่ห้อ', 'ผู้ผลิต / ผู้แทนจำหน่าย', 
      'รุ่นเครื่องมือที่ใช้ร่วมกัน', 'ตำแหน่งจัดเก็บ', 'จำนวนคงเหลือ', 'Min', 'ROP', 'Max', 
      'ราคา/หน่วย(บาท)', 'วันที่จัดซื้อล่าสุด', 'Shelf Life / วันหมดอายุ', 'สถานะ', 
      'อะไหล่วิกฤต', 'กลุ่ม ABC', 'ปีงบประมาณ'
    ],
    "Receiving": [
      'วันที่รับ', 'เลขเอกสารจัดซื้อ / ใบส่งของ', 'ผู้ขาย / ผู้แทนจำหน่าย', 'รหัสอะไหล่', 
      'ชื่ออะไหล่', 'จำนวนที่รับ', 'ราคา/หน่วย(บาท)', 'Lot / Serial No.', 
      'วันหมดอายุ(ถ้ามี)', 'ตำแหน่งจัดเก็บ', 'ผลการตรวจสภาพ', 'ผู้รับ'
    ],
    "Transactions": [
      'เลขที่ใบเบิก', 'วันที่เบิก', 'เลขที่ใบสั่งงาน (Work Order)', 'ประเภทงาน', 
      'หมายเลขครุภัณฑ์เครื่องมือ', 'ชื่อเครื่องมือ', 'หน่วยงานเจ้าของเครื่องมือ', 'ผู้เบิก', 
      'รหัสอะไหล่', 'ชื่ออะไหล่', 'จำนวนที่ขอเบิก', 'จำนวนที่จ่ายจริง', 'จำนวนที่คืน', 
      'วันที่คืน', 'สภาพอะไหล่ที่คืน', 'ผู้คืน', 'ผู้รับคืน', 'สถานะ'
    ],
    "StockCounts": [
      'วันที่ตรวจนับ', 'รอบการตรวจนับ', 'รหัสอะไหล่', 'ชื่ออะไหล่', 'ตำแหน่งจัดเก็บ', 
      'หน่วยนับ', 'ยอดตามทะเบียน', 'ยอดนับจริง', 'ผลต่าง(+/–)', 
      'พบใกล้หมดอายุ / เสื่อมสภาพ', 'สาเหตุของผลต่าง / การดำเนินการ', 
      'ผู้ตรวจนับ 1', 'ผู้ตรวจนับ 2', 'หัวหน้างานเครื่องมือแพทย์ (ผู้รับรอง)'
    ]
  };
  
  for (var name in sheets) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(sheets[name]);
      // Format headers: bold & colored background
      var range = sheet.getRange(1, 1, 1, sheets[name].length);
      range.setFontWeight("bold");
      range.setBackground("#E8F0FE");
      sheet.setFrozenRows(1);
    }
  }
}

// Helper: convert sheet data to array of objects
function getSheetData(sheetName) {
  initDatabase();
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  var headers = values[0];
  var data = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    obj.rowNum = i + 1; // Store sheet row index (1-based)
    data.push(obj);
  }
  return data;
}

// Helper: send JSON response
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
                       .setMimeType(ContentService.MimeType.JSON);
}

// GET Requests
function doGet(e) {
  try {
    initDatabase();
    var action = e.parameter.action;
    
    if (action === "getAllData") {
      return jsonResponse({
        success: true,
        data: {
          inventory: getSheetData("MasterParts"),
          receiving: getSheetData("Receiving"),
          transactions: getSheetData("Transactions"),
          stockCounts: getSheetData("StockCounts")
        }
      });
    }
    else if (action === "getInventory") {
      return jsonResponse({ success: true, data: getSheetData("MasterParts") });
    } 
    else if (action === "getReceiving") {
      return jsonResponse({ success: true, data: getSheetData("Receiving") });
    } 
    else if (action === "getTransactions") {
      return jsonResponse({ success: true, data: getSheetData("Transactions") });
    } 
    else if (action === "getStockCounts") {
      return jsonResponse({ success: true, data: getSheetData("StockCounts") });
    } 
    else {
      return jsonResponse({ success: false, message: "Invalid action" });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// POST Requests
function doPost(e) {
  try {
    initDatabase();
    var postData;
    
    if (e.postData.type === "application/json") {
      postData = JSON.parse(e.postData.contents);
    } else {
      postData = e.parameter;
    }
    
    var action = postData.action;
    var ss = getSpreadsheet();
    
    if (action === "addPart") {
      var sheet = ss.getSheetByName("MasterParts");
      var data = getSheetData("MasterParts");
      
      // Check duplicate primary key
      var partId = postData.partId.trim();
      for (var i = 0; i < data.length; i++) {
        if (data[i]['รหัสอะไหล่'].toString().toLowerCase() === partId.toLowerCase()) {
          return jsonResponse({ success: false, message: "รหัสอะไหล่นี้มีอยู่แล้วในระบบ" });
        }
      }
      
      sheet.appendRow([
        partId,
        postData.oemNo || "",
        postData.name || "",
        postData.supplier || "",
        postData.compatibleModels || "",
        postData.location || "",
        Number(postData.initialQty || 0),
        Number(postData.minStock || 0),
        Number(postData.rop || 0),
        Number(postData.maxStock || 0),
        Number(postData.price || 0),
        postData.purchaseDate || "",
        postData.expiryDate || "",
        postData.status || "ใหม่",
        postData.isCritical || "ไม่ใช่",
        postData.abcGroup || "C",
        postData.budgetYear || ""
      ]);
      return jsonResponse({ success: true, message: "ลงทะเบียนอะไหล่สำเร็จ" });
    }
    
    else if (action === "updatePart") {
      var sheet = ss.getSheetByName("MasterParts");
      var data = getSheetData("MasterParts");
      var partId = postData.partId.trim();
      var foundRow = -1;
      
      for (var i = 0; i < data.length; i++) {
        if (data[i]['รหัสอะไหล่'].toString().toLowerCase() === partId.toLowerCase()) {
          foundRow = data[i].rowNum;
          break;
        }
      }
      
      if (foundRow === -1) {
        return jsonResponse({ success: false, message: "ไม่พบรหัสอะไหล่นี้ในคลัง" });
      }
      
      // Update columns: columns are 1-indexed
      sheet.getRange(foundRow, 2).setValue(postData.oemNo || "");
      sheet.getRange(foundRow, 3).setValue(postData.name || "");
      sheet.getRange(foundRow, 4).setValue(postData.supplier || "");
      sheet.getRange(foundRow, 5).setValue(postData.compatibleModels || "");
      sheet.getRange(foundRow, 6).setValue(postData.location || "");
      sheet.getRange(foundRow, 8).setValue(Number(postData.minStock || 0));
      sheet.getRange(foundRow, 9).setValue(Number(postData.rop || 0));
      sheet.getRange(foundRow, 10).setValue(Number(postData.maxStock || 0));
      sheet.getRange(foundRow, 11).setValue(Number(postData.price || 0));
      sheet.getRange(foundRow, 12).setValue(postData.purchaseDate || "");
      sheet.getRange(foundRow, 13).setValue(postData.expiryDate || "");
      sheet.getRange(foundRow, 14).setValue(postData.status || "ใหม่");
      sheet.getRange(foundRow, 15).setValue(postData.isCritical || "ไม่ใช่");
      sheet.getRange(foundRow, 16).setValue(postData.abcGroup || "C");
      sheet.getRange(foundRow, 17).setValue(postData.budgetYear || "");
      
      return jsonResponse({ success: true, message: "อัปเดตข้อมูลอะไหล่สำเร็จ" });
    }
    
    else if (action === "receivePart") {
      var recSheet = ss.getSheetByName("Receiving");
      var partSheet = ss.getSheetByName("MasterParts");
      var partData = getSheetData("MasterParts");
      
      var partId = postData.partId.trim();
      var foundRow = -1;
      var currentQty = 0;
      
      for (var i = 0; i < partData.length; i++) {
        if (partData[i]['รหัสอะไหล่'].toString().toLowerCase() === partId.toLowerCase()) {
          foundRow = partData[i].rowNum;
          currentQty = Number(partData[i]['จำนวนคงเหลือ'] || 0);
          break;
        }
      }
      
      if (foundRow === -1) {
        return jsonResponse({ success: false, message: "ไม่สามารถรับเข้าได้: ไม่พบรหัสอะไหล่นี้ในทะเบียนอะไหล่ กรุณาลงทะเบียนอะไหล่ก่อน" });
      }
      
      var qtyToReceive = Number(postData.qty || 0);
      var pricePerUnit = Number(postData.price || 0);
      
      // 1. Log in Receiving Sheet
      recSheet.appendRow([
        postData.date || new Date().toISOString().split('T')[0],
        postData.docNo || "",
        postData.supplier || "",
        partId,
        postData.partName || "",
        qtyToReceive,
        pricePerUnit,
        postData.lotNo || "",
        postData.expiryDate || "",
        postData.location || "",
        postData.checkResult || "ผ่าน",
        postData.receiver || ""
      ]);
      
      // 2. Update Qty and Latest Purchase info in MasterParts Sheet
      partSheet.getRange(foundRow, 7).setValue(currentQty + qtyToReceive); // Add Qty
      partSheet.getRange(foundRow, 11).setValue(pricePerUnit); // Update latest Price
      partSheet.getRange(foundRow, 12).setValue(postData.date || new Date().toISOString().split('T')[0]); // Update latest purchase date
      
      return jsonResponse({ success: true, message: "บันทึกการรับอะไหล่เข้าคลังสำเร็จ" });
    }
    
    else if (action === "requisitionPart") {
      var txSheet = ss.getSheetByName("Transactions");
      var partSheet = ss.getSheetByName("MasterParts");
      var partData = getSheetData("MasterParts");
      
      var partId = postData.partId.trim();
      var foundRow = -1;
      var currentQty = 0;
      
      for (var i = 0; i < partData.length; i++) {
        if (partData[i]['รหัสอะไหล่'].toString().toLowerCase() === partId.toLowerCase()) {
          foundRow = partData[i].rowNum;
          currentQty = Number(partData[i]['จำนวนคงเหลือ'] || 0);
          break;
        }
      }
      
      if (foundRow === -1) {
        return jsonResponse({ success: false, message: "ไม่พบรหัสอะไหล่นี้ในคลัง" });
      }
      
      var qtyToDeduct = Number(postData.qtyApproved || 0);
      if (currentQty < qtyToDeduct) {
        return jsonResponse({ success: false, message: "ยอดคงเหลือในคลังไม่พอเบิก (คงเหลือ: " + currentQty + " ชิ้น)" });
      }
      
      // 1. Log Transaction
      txSheet.appendRow([
        postData.reqNo || ("REQ-" + Date.now()),
        postData.date || new Date().toISOString().split('T')[0],
        postData.workOrder || "",
        postData.jobType || "งานซ่อม",
        postData.equipNo || "",
        postData.equipName || "",
        postData.department || "",
        postData.requester || "",
        partId,
        postData.partName || "",
        Number(postData.qtyRequested || 0),
        qtyToDeduct,
        0,  // Returned Qty initially 0
        "", // Returned Date
        "", // Returned Status
        "", // Returned Person
        "", // Receiver
        "เบิกจ่ายสำเร็จ"
      ]);
      
      // 2. Deduct inventory
      partSheet.getRange(foundRow, 7).setValue(currentQty - qtyToDeduct);
      
      return jsonResponse({ success: true, message: "เบิกจ่ายอะไหล่สำเร็จ" });
    }
    
    else if (action === "returnPart") {
      var txSheet = ss.getSheetByName("Transactions");
      var partSheet = ss.getSheetByName("MasterParts");
      var partData = getSheetData("MasterParts");
      var txData = getSheetData("Transactions");
      
      var reqNo = postData.reqNo.trim();
      var partId = postData.partId.trim();
      
      // Find Transaction
      var foundTxRow = -1;
      var qtyCheckedOut = 0;
      var currentReturned = 0;
      
      for (var i = 0; i < txData.length; i++) {
        if (txData[i]['เลขที่ใบเบิก'].toString() === reqNo && txData[i]['รหัสอะไหล่'].toString().toLowerCase() === partId.toLowerCase()) {
          foundTxRow = txData[i].rowNum;
          qtyCheckedOut = Number(txData[i]['จำนวนที่จ่ายจริง'] || 0);
          currentReturned = Number(txData[i]['จำนวนที่คืน'] || 0);
          break;
        }
      }
      
      if (foundTxRow === -1) {
        return jsonResponse({ success: false, message: "ไม่พบใบเบิกนี้ในคลังธุรกรรม" });
      }
      
      // Find Part
      var foundPartRow = -1;
      var currentQty = 0;
      for (var j = 0; j < partData.length; j++) {
        if (partData[j]['รหัสอะไหล่'].toString().toLowerCase() === partId.toLowerCase()) {
          foundPartRow = partData[j].rowNum;
          currentQty = Number(partData[j]['จำนวนคงเหลือ'] || 0);
          break;
        }
      }
      
      if (foundPartRow === -1) {
        return jsonResponse({ success: false, message: "ไม่พบข้อมูลอะไหล่ที่จะรับคืนในคลัง" });
      }
      
      var qtyToReturn = Number(postData.qtyReturn || 0);
      if (qtyToReturn > qtyCheckedOut) {
        return jsonResponse({ success: false, message: "จำนวนที่ส่งคืนมากกว่าจำนวนที่เบิกไปจริง (เบิกไป: " + qtyCheckedOut + ")" });
      }
      
      // 1. Update Transaction
      txSheet.getRange(foundTxRow, 13).setValue(qtyToReturn);
      txSheet.getRange(foundTxRow, 14).setValue(postData.returnDate || new Date().toISOString().split('T')[0]);
      txSheet.getRange(foundTxRow, 15).setValue(postData.returnCondition || "ปกติ");
      txSheet.getRange(foundTxRow, 16).setValue(postData.returner || "");
      txSheet.getRange(foundTxRow, 17).setValue(postData.receiver || "");
      txSheet.getRange(foundTxRow, 18).setValue("คืนเสร็จสมบูรณ์");
      
      // 2. Return quantity to inventory (only normal condition parts can go back to ready stock)
      if (postData.returnCondition === "ปกติ") {
        partSheet.getRange(foundPartRow, 7).setValue(currentQty + qtyToReturn);
      }
      
      return jsonResponse({ success: true, message: "รับคืนอะไหล่เข้าคลังสำเร็จ" });
    }
    
    else if (action === "stockCount") {
      var scSheet = ss.getSheetByName("StockCounts");
      var partSheet = ss.getSheetByName("MasterParts");
      var partData = getSheetData("MasterParts");
      
      var partId = postData.partId.trim();
      var foundPartRow = -1;
      var currentQty = 0;
      var loc = "";
      
      for (var i = 0; i < partData.length; i++) {
        if (partData[i]['รหัสอะไหล่'].toString().toLowerCase() === partId.toLowerCase()) {
          foundPartRow = partData[i].rowNum;
          currentQty = Number(partData[i]['จำนวนคงเหลือ'] || 0);
          loc = partData[i]['ตำแหน่งจัดเก็บ'] || "";
          break;
        }
      }
      
      if (foundPartRow === -1) {
        return jsonResponse({ success: false, message: "ไม่พบอะไหล่นี้ในทะเบียนสินค้า" });
      }
      
      var actualQty = Number(postData.actualQty || 0);
      var diff = actualQty - currentQty;
      
      // 1. Append Stock count log
      scSheet.appendRow([
        postData.date || new Date().toISOString().split('T')[0],
        postData.countCycle || "รายเดือน (กลุ่ม A)",
        partId,
        postData.partName || "",
        loc,
        postData.unit || "ชิ้น",
        currentQty,
        actualQty,
        diff,
        postData.expiredDetails || "",
        postData.reason || "",
        postData.counter1 || "",
        postData.counter2 || "",
        postData.supervisor || ""
      ]);
      
      // 2. Adjust inventory count to actual count
      partSheet.getRange(foundPartRow, 7).setValue(actualQty);
      
      return jsonResponse({ success: true, message: "บันทึกผลการตรวจนับและอัปเดตยอดคงคลังสำเร็จ" });
    }
    
    else {
      return jsonResponse({ success: false, message: "Invalid action" });
    }
    
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}
