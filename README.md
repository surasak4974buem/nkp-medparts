# NKP-Part: ระบบบริหารจัดการคลังอะไหล่เครื่องมือแพทย์ โรงพยาบาลนครพิงค์

ระบบบริหารจัดการคลังอะไหล่เครื่องมือแพทย์ออนไลน์ (**NKP-Part**) พัฒนาขึ้นเพื่อยกระดับการควบคุมคลังอะไหล่ตามระเบียบปฏิบัติมาตรฐาน **WI-MED-007** ของโรงพยาบาลนครพิงค์ โดยย้ายข้อมูลจากเอกสารแบบฟอร์มเดิม (FM-MED-007-01 ถึง 04) มาไว้บนระบบออนไลน์ที่มีการวิเคราะห์แดชบอร์ดสรุปผลและตัวชี้วัด (KPIs) แบบเรียลไทม์

ระบบนี้มีสถาปัตยกรรมแบบ Serverless Static Web Application:
- **Frontend**: พัฒนาด้วย HTML, CSS (Vanilla), และ JavaScript โฮสต์อยู่บน **GitHub Pages**
- **Database Backend**: ใช้ **Google Sheets** เป็นฐานข้อมูล เชื่อมโยงผ่าน API Proxy ด้วย **Google Apps Script**

---

## แผนผังการไหลของข้อมูล (Data Flow Diagrams - DFD)

### DFD Level 0 (Context Diagram)
แสดงขอบเขตความสัมพันธ์ระหว่างระบบและผู้ใช้ภายนอกระบบหลัก ได้แก่ ช่างเครื่องมือแพทย์, เจ้าหน้าที่คลังอะไหล่ และหัวหน้างานเครื่องมือแพทย์

```mermaid
graph LR
    Tech([ช่างเครื่องมือแพทย์]) -->|1. ยื่นใบเบิกอะไหล่ / 2. คืนอะไหล่| System((ระบบบริหารคลังอะไหล่ <br/> NKP-Part))
    System -->|3. อะไหล่ / สถานะการเบิกจ่าย| Tech

    Staff([เจ้าหน้าที่คลังอะไหล่]) -->|4. ลงทะเบียนอะไหล่ / 5. บันทึกรับเข้า / 6. ตรวจนับคลัง| System
    System -->|7. ยอดคงคลัง / แจ้งเตือน ROP / รายงานคงคลัง| Staff

    Supervisor([หัวหน้างานเครื่องมือแพทย์]) -->|8. อนุมัติการเบิก / อนุมัติแผนจัดซื้อ| System
    System -->|9. แดชบอร์ดสรุป / รายงานประจำเดือน / ตัวชี้วัด KPIs| Supervisor
```

### DFD Level 1
รายละเอียดของ 5 กระบวนการการแลกเปลี่ยนและจัดการข้อมูลในคลังสินค้า

```mermaid
graph TD
    subgraph Processes
        P1[1.0 จัดการข้อมูลทะเบียนอะไหล่]
        P2[2.0 บันทึกรับอะไหล่เข้าคลัง]
        P3[3.0 เบิกจ่ายและรับคืนอะไหล่]
        P4[4.0 ตรวจนับและคำนวณ KPI]
        P5[5.0 แดชบอร์ดและรายงานสรุป]
    end

    subgraph Data Stores
        DS1[(DS-01 ทะเบียนอะไหล่ <br/> MasterParts)]
        DS2[(DS-02 ประวัติรับเข้า <br/> Receiving)]
        DS3[(DS-03 ประวัติการเคลื่อนไหว <br/> Transactions)]
        DS4[(DS-04 ประวัติการตรวจนับ <br/> StockCounts)]
    end

    Staff([เจ้าหน้าที่คลัง]) -->|ข้อมูลอะไหล่ใหม่| P1
    P1 -->|บันทึก/ปรับปรุง| DS1
    DS1 -->|ข้อมูลอะไหล่ปัจจุบัน| P1

    Staff -->|ข้อมูลใบส่งของ/ผู้ขาย| P2
    P2 -->|บันทึกรับเข้า| DS2
    P2 -->|อัปเดตยอดคงคลัง| DS1

    Tech([ช่างเครื่องมือแพทย์]) -->|ใบเบิกอะไหล่ + ใบสั่งงาน| P3
    P3 -->|บันทึกเบิก-จ่าย/คืน| DS3
    P3 -->|ตัดยอดคงคลัง/คืนยอด| DS1

    Staff -->|ข้อมูลตรวจนับจริง| P4
    P4 -->|บันทึกผลการตรวจนับ| DS4
    P4 -->|ปรับปรุงยอดต่าง| DS1
    P4 -->|คำนวณ Inventory Accuracy| P5

    DS1 -->|ดึงสถานะอะไหล่| P5
    DS2 -->|ดึงยอดรับเข้า| P5
    DS3 -->|ดึงยอดเบิกจ่าย| P5
    DS4 -->|ดึงประวัติตรวจนับ| P5

    P5 -->|แดชบอร์ด/รายงาน/การแจ้งเตือน| Supervisor([หัวหน้างาน])
```

---

## แผนภาพความสัมพันธ์ของข้อมูล (ER Diagram)

โครงสร้างฐานข้อมูลแบ่งออกเป็น 4 ตารางหลักที่เชื่อมต่อกันด้วยความสัมพันธ์แบบ **1-to-Many (1:N)** ผ่านทางฟิลด์ `รหัสอะไหล่` (Foreign Key)

```mermaid
erDiagram
    MasterParts ||--o{ Receiving : "รับอะไหล่เข้าคลัง"
    MasterParts ||--o{ Transactions : "เบิกจ่าย/คืนอะไหล่"
    MasterParts ||--o{ StockCounts : "ตรวจนับจำนวนคลัง"

    MasterParts {
        string partId PK "รหัสอะไหล่"
        string oemNo "OEM Part Number"
        string name "ชื่ออะไหล่ / ยี่ห้อ"
        string supplier "ผู้จัดจำหน่าย"
        string compatibleModels "รุ่นที่ใช้ร่วมกัน"
        string location "ตำแหน่งจัดเก็บ"
        int currentQty "จำนวนคงเหลือ"
        int minStock "จำนวน Min"
        int rop "จุดสั่งซื้อ ROP"
        int maxStock "จำนวน Max"
        decimal price "ราคาต่อหน่วย"
        date purchaseDate "วันที่ซื้อล่าสุด"
        date expiryDate "วันหมดอายุ"
        string status "สถานะ (ใหม่/Refurbished)"
        string isCritical "อะไหล่วิกฤต (ใช่/ไม่ใช่)"
        string abcGroup "กลุ่ม ABC (A/B/C)"
        string budgetYear "ปีงบประมาณ"
    }

    Receiving {
        date date PK "วันที่รับ"
        string docNo PK "เลขใบส่งของ"
        string supplier "ผู้ขาย"
        string partId FK "รหัสอะไหล่"
        string partName "ชื่ออะไหล่"
        int qty "จำนวนที่รับ"
        decimal price "ราคาต่อหน่วย"
        string lotNo "Lot / Serial No"
        date expiryDate "วันหมดอายุ"
        string location "จุดจัดเก็บ"
        string checkResult "ผลการตรวจสภาพ"
        string receiver "ผู้รับเข้า"
    }

    Transactions {
        string reqNo PK "เลขที่ใบเบิก"
        date date "วันที่เบิก"
        string workOrder "เลขใบสั่งงาน WO"
        string jobType "ประเภทงาน (ซ่อม/PM)"
        string equipNo "เลขครุภัณฑ์"
        string equipName "ชื่อเครื่องมือ"
        string department "หน่วยงาน"
        string requester "ช่างผู้เบิก"
        string partId FK "รหัสอะไหล่"
        string partName "ชื่ออะไหล่"
        int qtyRequested "จำนวนขอเบิก"
        int qtyApproved "จำนวนจ่ายจริง"
        int qtyReturned "จำนวนคืนคลัง"
        date returnDate "วันที่คืน"
        string returnCondition "สภาพอะไหล่คืน"
        string returner "ผู้คืน"
        string receiver "ผู้รับคืน"
        string status "สถานะรายการ"
    }

    StockCounts {
        date date PK "วันที่ตรวจนับ"
        string countCycle "รอบการตรวจ"
        string partId FK "รหัสอะไหล่"
        string partName "ชื่ออะไหล่"
        string location "จุดเก็บ"
        string unit "หน่วยนับ"
        int systemQty "ยอดในระบบ"
        int actualQty "ยอดนับจริง"
        int diff "ผลต่าง"
        string expiredDetails "เสื่อมสภาพ/หมดอายุ"
        string reason "สาเหตุและการแก้ไข"
        string counter1 "ผู้ตรวจนับ 1"
        string counter2 "ผู้ตรวจนับ 2"
        string supervisor "หัวหน้างานผู้รับรอง"
    }
```

---

## ขั้นตอนการติดตั้งระบบ (Setup Instructions)

### ขั้นตอนที่ 1: การตั้งค่า Google Sheets และ API Web App
1. สร้างไฟล์ **Google Sheet** เปล่าใน Google Drive ของคุณ
2. ไปที่เมนู **Extensions > Apps Script**
3. คัดลอกซอร์สโค้ดทั้งหมดในไฟล์ `google-apps-script/Code.gs` ไปวางในโครงการสคริปต์
4. กดปุ่ม **Deploy > New Deployment** ที่ด้านบนขวา
5. ตั้งค่าการดีพลอยดังนี้:
   - **Select type:** เลือกประเภทเป็น **Web App**
   - **Execute as:** เลือกเป็น **Me** (อีเมล Google ของคุณ)
   - **Who has access:** เลือกเป็น **Anyone** (จำเป็นเพื่อให้หน้าเว็บส่งคำขอผ่าน HTTP Client-side ได้)
6. กดปุ่ม **Deploy** และกดยืนยันสิทธิ์อนุญาตความปลอดภัย (Authorize Access)
7. คัดลอก **Web App URL** ที่ได้ (ตัวอย่าง: `https://script.google.com/macros/s/XXXXX/exec`)

### ขั้นตอนที่ 2: ตั้งค่าใช้งานและทดสอบใน Web Application
1. เปิดหน้าเว็บ NKP-Part Web App (หลังจาก Deploy บน GitHub Pages สำเร็จ)
2. ไปที่แถบเมนู **ตั้งค่าระบบ API** (Sidebar ด้านล่างสุด)
3. วาง Web App URL ที่ได้ลงในช่องกรอกข้อมูล จากนั้นกด **บันทึกการเชื่อมต่อ**
4. กด **ทดสอบการเชื่อมต่อ API** เพื่อให้สคริปต์จำลองสร้างตารางและหัวข้อฐานข้อมูลบน Google Sheets ของคุณอัตโนมัติ
5. เริ่มใช้งานระบบ (เพิ่มอะไหล่หลักในหน้าระเบียน, รับเข้า, และทำการเบิกจ่ายได้ทันที)

---

## การ Deploy เว็บไซต์ออนไลน์ผ่าน GitHub Pages

โปรเจกต์นี้รองรับการ Deploy ไปยัง **GitHub Pages** อัตโนมัติผ่านระบบ **GitHub Actions** ทุกครั้งที่คุณทำรายการ `git push` ไปยังสาขา `main`

### การตั้งค่าเริ่มต้นบน GitHub:
1. ไปที่แท็บ **Settings** ในหน้าคลังเก็บโค้ด (Repository) ของคุณบน GitHub
2. ไปที่เมนู **Pages** ที่เมนูด้านซ้าย
3. ในส่วนของ **Build and deployment > Source** ให้เปลี่ยนค่าเป็น **GitHub Actions**
4. ทุกครั้งที่พุชโค้ด ไฟล์การทำงานใน `.github/workflows/deploy.yml` จะทำการสร้างหน้าเว็บไซต์ออนไลน์ให้อัตโนมัติ
