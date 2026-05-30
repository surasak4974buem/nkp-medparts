# ระบบบริหารคลังอะไหล่ศูนย์เครื่องมือแพทย์ โรงพยาบาลนครพิงค์
### Conforming to SMM 07-1:2024 (Section 5.1) & CMMS Standards

ระบบเว็บแอปพลิเคชันรูปแบบ Single Page Application (SPA) เพื่อการจัดการอะไหล่และอุปกรณ์ประกอบร่วมคงคลังเครื่องมือแพทย์อย่างมีประสิทธิภาพ รองรับการเข้าใช้งานแบบเรียลไทม์จากทุกมุมโลก (Cloud Sync ผ่าน Google Sheets) ปกป้องข้อมูลด้วยรหัสผ่านความปลอดภัย และมีระบบส่งสัญญาณแจ้งเตือนไปยัง **LINE OA Group** ของกลุ่มงานช่างทันทีที่มีการเบิกอะไหล่

---

## 🚀 ฟังก์ชันการใช้งานระบบ

1. **Password Security Gate**: ระบบตรวจสอบสิทธิ์เข้าถึงด้วยรหัสผ่านเริ่มต้น `NKP-medparts-2026` ก่อนอนุญาตเข้าสู่แดชบอร์ด
2. **Dashboard ภาพรวมอัจฉริยะ**:
   - แสดงผล **ABC Classification** อัตโนมัติในรูปแบบแผนภูมิโดนัท (วิเคราะห์ตามราคาต่อชิ้นและยอดคงคลังสะสม) เพื่อจัดสรรความเข้มงวดในการตรวจคลัง
   - แสดงผลวิเคราะห์ **Technical Service Cost (TSC) ต่อ Equipment Value (EV) Ratio** เพื่อระบุและแจ้งเตือนอุปกรณ์แพทย์ที่ชำรุดบ่อยจนไม่คุ้มค่าซ่อม
   - ตารางแจ้งเตือนกรณีฉุกเฉิน (ต่ำกว่าเกณฑ์ความปลอดภัย หรือใกล้หมดอายุ/หมดอายุ)
3. **คลังรายการอะไหล่ SpO2 โรงพยาบาลนครพิงค์**:
   - บรรจุข้อมูลอะไหล่สัญญาปี 2568-2569 ครบทั้ง **11 รายการ** (สายวัดเซนเซอร์และสายต่อพ่วง Masimo, Nellcor, Philips, GE, Nihon Kohden, Mindray)
   - หน้าต่าง Stock Card รายละเอียดสูง แสดงเครื่องมือที่เชื่อมโยง (Compatibility Matrix) ข้อมูลผู้เสนอราคา และตำแหน่งเก็บแยกตู้ชั้นชัดเจน
4. **ธุรกรรมคลังสินค้าครบวงจร**: บันทึกการรับเข้า (Receive), เบิกจ่ายซ่อม CM/PM (Issue), ยืมอะไหล่สลับทดสอบปัญหา (Borrow), คืนอะไหล่ยืม (Return) และการสอบยอดจริง (Audit)
5. **คาดการณ์และแผนบำรุงรักษา (PM & Forecast)**: ตารางงานแผน PM และเครื่องมือคำนวณจำนวนอะไหล่ทางการแพทย์ที่ต้องการใช้ล่วงหน้า (30/60/90 วัน) เพื่อให้สั่งซื้อได้ทันเวลาส่งมอบ (Lead Time)
6. **ระบบออกใบเสนอจัดจัดซื้อวัสดุอัตโนมัติ (PR Generator)**: ตรวจสอบชิ้นส่วนที่ลดต่ำลงมาถึงจุดสั่งซื้อ (Reorder Point) และมีคำสั่งออกบันทึกข้อความขอจัดซื้อ (ในรูปแบบเอกสารทางการพร้อมสั่งพิมพ์) ในปุ่มเดียว

---

## 🛠️ ขั้นตอนการติดตั้งและการนำขึ้นระบบ Cloud (GitHub Pages)

เนื่องจากระบบถูกเขียนขึ้นเป็น Web-Front แบบไร้เครื่องมือ Build ทำให้อัปโหลดขึ้นคลาวด์ได้ฟรีผ่าน **GitHub Pages** โดยมีขั้นตอนดังนี้:

### 1. การโฮสต์ผ่าน GitHub Pages
1. สร้าง **GitHub Repository** ใหม่บนบัญชีของคุณแบบ Public (หรือ Private ร่วมกับสิทธิ์พิเศษ)
2. อัปโหลดไฟล์โครงการทั้งหมดขึ้นไป:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `mockData.js`
3. ไปที่แถบ **Settings** ของ Repository บน GitHub -> เลือกเมนู **Pages** ด้านซ้ายมือ
4. ในส่วนของ **Build and deployment** -> เลือก Branch เป็น `main` หรือ `master` -> เลือกโฟลเดอร์เป็น `/ (root)` -> กด **Save**
5. รอไม่เกิน 1-2 นาที คุณจะได้ URL เว็บไซต์คลาวด์ความปลอดภัยสูงที่เปิดเข้าชมแบบเรียลไทม์ได้จากมือถือช่างหรือคอมพิวเตอร์ของคุณจากทุกที่ในโลก!

---

## 📊 การเชื่อมต่อฐานข้อมูล Google Sheets และ LINE OA (ใช้งานได้ฟรี 100%)

เพื่อให้ข้อมูลซิงก์กันในทีมช่างหลายคนโดยไม่มีค่าใช้จ่ายด้านฐานข้อมูล ระบบนี้จึงออกแบบมาให้ทำงานร่วมกับ **Google Sheets (เปรียบเสมือน Cloud Database)** และยิง LINE แจ้งเตือนผ่าน **Google Apps Script**

### 1. วิธีตั้งค่า Google Sheets เป็นคลังข้อมูลหลัก
1. สร้าง **Google Sheet** ขึ้นมา 1 ไฟล์บนบัญชี Google Drive ของกลุ่มงาน
2. ไปที่เมนู **ส่วนขยาย (Extensions)** -> เลือก **Apps Script**
3. ลบโค้ดเริ่มต้นออกให้หมด และนำโค้ดด้านล่างนี้ไปวางแทนที่:

```javascript
// Google Apps Script บล็อกจัดการคลังอะไหล่ศูนย์เครื่องมือแพทย์ รพ.นครพิงค์
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  
  // 1. รับค่าและซิงก์ข้อมูลคลังเก็บอะไหล่
  if (data.action === "sync") {
    // บันทึกรายการอะไหล่ลงชีตแรก
    var partSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Parts") || 
                    SpreadsheetApp.getActiveSpreadsheet().insertSheet("Parts");
    partSheet.clear();
    
    // ตั้งค่าส่วนหัวตาราง
    partSheet.appendRow(["รหัสอะไหล่", "ชื่อรายการ", "จำนวนคงเหลือ", "ราคาต่อชิ้น", "ตำแหน่งที่เก็บ", "วันหมดอายุ"]);
    data.parts.forEach(function(p) {
      partSheet.appendRow([p.code, p.name, p.inStock, p.unitPrice, p.location, p.expiryDate]);
    });
    
    return ContentService.createTextOutput(JSON.stringify({status: "success", count: data.parts.length}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // 2. ส่งแจ้งเตือน Flex Message ไปยัง LINE OA
  if (data.action === "notify") {
    var response = sendLineFlexMessage(data.message, data.token, data.groupId);
    return ContentService.createTextOutput(JSON.stringify({status: "sent", response: response}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendLineFlexMessage(flexContent, token, toId) {
  var url = "https://api.line.me/v2/bot/message/push";
  var payload = {
    "to": toId,
    "messages": [
      {
        "type": "flex",
        "altText": "🚨 แจ้งเตือนการเบิกอะไหล่ศูนย์เครื่องมือแพทย์ นครพิงค์",
        "contents": flexContent
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
  
  var response = UrlFetchApp.fetch(url, options);
  return response.getContentText();
}
```

4. กดปุ่ม **บันทึก (Save - รูปแผ่นดิสก์)**
5. คลิกปุ่ม **การทำให้ใช้งานได้ (Deploy)** -> เลือก **การทำให้ใช้งานได้ใหม่ (New deployment)**
6. ในหน้าต่างตั้งค่า:
   - เลือกประเภทการเผยแพร่เป็น: **เว็บแอป (Web app)**
   - กำหนดสิทธิ์ผู้เข้าใช้งาน (Who has access) เป็น: **"ทุกคน (Anyone)"** *(สำคัญมาก เพื่อให้เว็บแอปพลิเคชันจาก GitHub คุยส่งข้อมูลมาหาได้)*
7. กดปุ่ม **Deploy** -> คลิกให้สิทธิ์การเข้าถึงบัญชี Google Sheet ของคุณ (Authorize Access)
8. ก๊อปปี้ลิงก์ **เว็บแอป URL (Web app URL)** ที่ระบบให้มา

### 2. นำข้อมูลเชื่อมโยงเข้าสู่โปรแกรม
1. ล็อกอินเข้าแอปของคุณบนเว็บ (รหัสผ่านเริ่มต้น: `NKP-medparts-2026`)
2. คลิกไปที่แท็บ **"คลาวด์ & LINE Settings"**
3. วางลิงก์เว็บแอปที่ก๊อปปี้มาลงในช่อง **"Google Apps Script Web App URL"**
4. หากต้องการแจ้งเตือนเข้าไลน์กลุ่มช่างแพทย์ ให้ใส่ **LINE Bot Token** และ **LINE Group ID** (ได้มาจากการสมัคร LINE Developers Bot และขอรหัสกลุ่มหรือผู้ใช้งาน)
5. กดปุ่ม **"บันทึกการตั้งค่า"**
6. กดปุ่ม **"ทดสอบส่งข้อความ LINE"** เพื่อทดลองยิง Flex Message ใบแจ้งเตือนเข้ากลุ่มไลน์ได้ทันที!

---

## 📌 มาตรฐานการปฏิบัติตาม SMM 07-1:2024
แอปพลิเคชันนี้ได้รับการจัดวางองค์ประกอบข้อมูลตามข้อกำหนด SMM ดังนี้:
* **ข้อ 5.1.1** (ตรวจสอบปริมาณอะไหล่พอเพียง): หน้า Dashboard แจ้งเตือนสต๊อกต่ำ และการวิเคราะห์ ROP แบบเรียลไทม์
* **ข้อ 5.1.2** (รายงานความต้องการเพิ่มเติม): ระบบสั่งสร้างและร่างใบจัดเตรียมคำขอเสนอจัดจัดซื้อ (Simulated PR)
* **ข้อ 5.1.3** (จัดทำความถี่ประวัติเปลี่ยน): เมนูการวางแผนบำรุงรักษา (PM Planning & Forecasting Horizon)
* **ข้อ 5.1.4** (บ่งชี้และข้อมูลที่ทันสมัย): หน้าเพิ่มและแก้ไขข้อมูลอะไหล่ครบถ้วน
* **ข้อ 5.1.5** (รหัสเชื่อมต่อเครื่อง, มูลค่า TSC/EV, วันซื้อ/วันหมดอายุ): ข้อมูลทุกชิ้นมีสเปกเครื่องแพทย์ที่เข้ากันได้ ตารางวิเคราะห์ TSC/EV ดัชนีเปรียบเทียบ และคัดกรองวันเสื่อมสภาพแบบแจ้งเตือนอัตโนมัติ
