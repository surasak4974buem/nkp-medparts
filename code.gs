// Google Apps Script สำหรับระบบฐานข้อมูลคลังอะไหล่แพทย์และแจ้งเตือน LINE OA โรงพยาบาลนครพิงค์
// วิธีใช้งาน: นำโค้ดทั้งหมดนี้ไปวางใน "ส่วนขยาย" -> "Apps Script" ของไฟล์ Google Sheets ของคุณ

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = JSON.parse(e.postData.contents);
  
  // 1. ตรวจสอบว่าเป็น Webhook จาก LINE หรือไม่ (จะมี events)
  if (data.events && data.events.length > 0) {
    try {
      var event = data.events[0];
      var source = event.source || {};
      var sourceType = source.type; // "user", "group", or "room"
      var sourceId = "";
      
      if (sourceType === "group") {
        sourceId = source.groupId;
      } else if (sourceType === "room") {
        sourceId = source.roomId;
      } else {
        sourceId = source.userId;
      }
      
      var messageText = "";
      if (event.message && event.message.type === "text") {
        messageText = event.message.text;
      }
      
      // บันทึกลงใน Sheet "LINE_IDs" เพื่อให้ช่างเข้ามาดูและก๊อปปี้ได้ง่ายๆ
      var idSheet = ss.getSheetByName("LINE_IDs") || ss.insertSheet("LINE_IDs");
      if (idSheet.getLastRow() === 0) {
        idSheet.appendRow(["วันเวลา", "ประเภทห้องแชต", "ID (นำไปกรอกในช่องตั้งค่า)", "ข้อความล่าสุด"]);
      }
      
      // ตรวจสอบไม่ให้บันทึก ID ซ้ำซ้อนติดๆ กันในตาราง
      var lastRow = idSheet.getLastRow();
      var isDuplicate = false;
      var formattedDate = Utilities.formatDate(new Date(), "Asia/Bangkok", "d/M/yyyy, HH:mm:ss");
      if (lastRow > 1) {
        var lastId = idSheet.getRange(lastRow, 3).getValue();
        if (lastId === sourceId) {
          isDuplicate = true;
          // อัปเดตวันเวลาและข้อความล่าสุดในแถวเดิม
          idSheet.getRange(lastRow, 1).setValue(formattedDate);
          idSheet.getRange(lastRow, 4).setValue(messageText);
        }
      }
      
      if (!isDuplicate) {
        idSheet.appendRow([formattedDate, sourceType, sourceId, messageText]);
      }
      
      console.log("LINE Webhook logged successfully: Type=" + sourceType + ", ID=" + sourceId);
    } catch (err) {
      console.log("Error handling LINE Webhook: " + err.toString());
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "webhook_logged"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 2. การซิงก์ข้อมูลฐานข้อมูลคลัง
  if (data.action === "sync") {
    // 1. ซิงก์ชีตข้อมูลอะไหล่ (Parts)
    var partsSheet = ss.getSheetByName("Parts") || ss.insertSheet("Parts");
    partsSheet.clear();
    if (data.parts && data.parts.length > 0) {
      var partsHeaders = Object.keys(data.parts[0]);
      partsSheet.appendRow(partsHeaders);
      var partsRows = data.parts.map(function(p) {
        return partsHeaders.map(function(h) {
          return typeof p[h] === 'object' ? JSON.stringify(p[h]) : p[h];
        });
      });
      partsSheet.getRange(2, 1, partsRows.length, partsHeaders.length).setValues(partsRows);
    }
    
    // 2. ซิงก์ชีตประวัติการทำรายการคลัง (Transactions)
    var txSheet = ss.getSheetByName("Transactions") || ss.insertSheet("Transactions");
    txSheet.clear();
    if (data.transactions && data.transactions.length > 0) {
      var txHeaders = Object.keys(data.transactions[0]);
      txSheet.appendRow(txHeaders);
      var txRows = data.transactions.map(function(t) {
        return txHeaders.map(function(h) {
          return typeof t[h] === 'object' ? JSON.stringify(t[h]) : t[h];
        });
      });
      txSheet.getRange(2, 1, txRows.length, txHeaders.length).setValues(txRows);
    }

    // 3. ซิงก์ชีตรายชื่อและสิทธิ์ผู้ใช้งาน (Users)
    var usersSheet = ss.getSheetByName("Users") || ss.insertSheet("Users");
    usersSheet.clear();
    if (data.users && data.users.length > 0) {
      var usersHeaders = Object.keys(data.users[0]);
      usersSheet.appendRow(usersHeaders);
      var usersRows = data.users.map(function(u) {
        return usersHeaders.map(function(h) {
          return typeof u[h] === 'object' ? JSON.stringify(u[h]) : u[h];
        });
      });
      usersSheet.getRange(2, 1, usersRows.length, usersHeaders.length).setValues(usersRows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 3. การส่งข้อความแจ้งเตือน LINE
  if (data.action === "notify") {
    var lineResult = sendLineNotify(data.message, data.token, data.groupId);
    
    try {
      var logSheet = ss.getSheetByName("LINE_Logs") || ss.insertSheet("LINE_Logs");
      if (logSheet.getLastRow() === 0) {
        logSheet.appendRow(["วันเวลา", "ผู้รับ (Group/User ID)", "ผลการทำงาน", "รายละเอียดข้อความ"]);
      }
      
      var statusText = "ส่งสำเร็จ";
      if (lineResult.indexOf("error") !== -1 || lineResult.indexOf("message") !== -1) {
        statusText = "ล้มเหลว: " + lineResult;
      }
      
      var formattedDate = Utilities.formatDate(new Date(), "Asia/Bangkok", "d/M/yyyy, HH:mm:ss");
      logSheet.insertRowBefore(2);
      logSheet.getRange(2, 1, 1, 4).setValues([[formattedDate, data.groupId, statusText, JSON.stringify(data.message)]]);
    } catch(err) {
      console.log("Error logging LINE status to Sheet: " + err.toString());
    }

    return ContentService.createTextOutput(JSON.stringify({status: "sent", result: lineResult}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = {};
  
  var partsSheet = ss.getSheetByName("Parts");
  if (partsSheet) {
    result.parts = getSheetDataJson(partsSheet);
  }
  
  var txSheet = ss.getSheetByName("Transactions");
  if (txSheet) {
    result.transactions = getSheetDataJson(txSheet);
  }

  var usersSheet = ss.getSheetByName("Users");
  if (usersSheet) {
    result.users = getSheetDataJson(usersSheet);
  }
  
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ฟังก์ชันช่วยดึงข้อมูลจากชีตแปลงเป็น JSON Array
function getSheetDataJson(sheet) {
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  
  var headers = rows[0];
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var val = row[j];
      // ลองตรวจเช็กว่าค่าในช่องนั้นเป็น JSON string ของ Array/Object หรือไม่
      if (typeof val === 'string' && (val.indexOf('[') === 0 || val.indexOf('{') === 0)) {
        try {
          val = JSON.parse(val);
        } catch(e) {}
      }
      obj[headers[j]] = val;
    }
    data.push(obj);
  }
  return data;
}

function sendLineNotify(flexMessage, token, groupId) {
  var url = "https://api.line.me/v2/bot/message/push";
  var payload = {
    "to": groupId,
    "messages": [
      {
        "type": "flex",
        "altText": "🚨 แจ้งเตือนการทำรายการคลังอะไหล่เครื่องมือแพทย์ รพ.นครพิงค์",
        "contents": flexMessage
      }
    ]
  };
  
  var options = {
    "method": "post",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  try {
    console.log("Sending push notification to: " + groupId);
    var response = UrlFetchApp.fetch(url, options);
    var resText = response.getContentText();
    console.log("LINE Response Code: " + response.getResponseCode());
    console.log("LINE Response Body: " + resText);
    return resText;
  } catch (err) {
    console.log("Error in UrlFetchApp: " + err.toString());
    return JSON.stringify({error: err.toString()});
  }
}
