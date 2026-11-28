# CVMikiri — Hệ Thống Kiểm Tra, Sàng Lọc & Chấm Điểm CV Bằng AI (Đa Nền Tảng & Ngoại Tuyến)

**CVMikiri** là ứng dụng full-stack **Web + PWA + Mobile (Android APK / Capacitor)** hỗ trợ bộ phận tuyển dụng và quản trị viên kiểm tra, sàng lọc và đánh giá mức độ phù hợp của CV theo Job Description (JD) bằng quy trình 2 tầng:

1. **Tầng 1 (Rule-based Screening — $0, <100ms):** Tự động đọc PDF/DOCX (`pdf-parse`, `mammoth`), bóc tách thông tin liên hệ, học vấn, số năm kinh nghiệm, chuẩn hóa kỹ năng qua `SkillNormalizer` và lọc tức thời tiếng Việt có/không dấu (`normalizeForSearch()`).
2. **Tầng 2 (AI Matching chuẩn CVTest với Google Gemini `gemini-3.6-flash`):** Chấm điểm 0–100 dựa trên 6 nhóm tiêu chí có trọng số tùy chỉnh (gói `PLUS`), đối chiếu từng yêu cầu bắt buộc/ưu tiên của JD kèm **trích dẫn bằng chứng (`evidence`)**, phát hiện điểm cần xác minh (`Red flags`), đánh giá tiềm năng phát triển, gợi ý câu hỏi phỏng vấn và xuất báo cáo Excel/PDF.

---

## ✨ Tính năng nổi bật

- **Đa doanh nghiệp & Phân quyền chặt chẽ (`ADMIN` / `ENTERPRISE`):**
  - `ADMIN`: Giám sát hệ thống tại `/admin/dashboard`, quản trị doanh nghiệp/gói dịch vụ/token/đối soát phiếu `UNKNOWN` tại `/admin/companies`, và quản lý tài khoản HR tại `/admin/users`. Mọi dữ liệu JD/CV đều cô lập theo tài khoản/doanh nghiệp.
  - `ENTERPRISE` (HR): Quản lý JD (`/jobs`), Kho CV & lọc Tầng 1 (`/candidates`), AI Matching Studio (`/matching`), Bảng điều khiển (`/`) và Hồ sơ/Ví token cá nhân (`/account`).
- **Chuẩn đánh giá CVTest dựa trên bằng chứng & Trọng số tùy chỉnh:** Tùy biến trọng số 6 nhóm tiêu chí (tổng = 100%) trên từng JD (gói `PLUS`), hiển thị bằng chứng trích dẫn từ CV/JD và giữ nguyên trạng thái `FAILED` khi AI lỗi (không giả điểm).
- **Hệ thống Gói doanh nghiệp (`FREE` / `PLUS`) & Ví Token cá nhân:**
  - Tạm giữ (`RESERVE`) – quyết toán token thực tế (`SETTLE`) – giải phóng (`RELEASE`) trong transaction ACID; hỗ trợ `Idempotency-Key` chống trừ token hai lần và công cụ đối soát phiếu `UNKNOWN` cho Admin.
- **Đa nền tảng (Web, PWA, Android APK) & Ngoại tuyến (`Offline-First`):**
  - Giao diện Mobile-First (`BottomNav`, Mobile Cards thay thế bảng rộng, Bottom Sheet/Drawer, chia sẻ file gốc qua Native Share).
  - Hoạt động khi mất mạng nhờ **Service Worker + IndexedDB**: giữ phiên đăng nhập ngoại tuyến, duyệt & lọc tiếng Việt offline, **ghim CV để xem PDF/DOCX ngoại tuyến**, và hàng đợi **Outbox Sync** (tạo nháp JD, xếp hàng upload CV khi mất mạng, tự đồng bộ kèm `Idempotency-Key` & phát hiện xung đột `409` khi có mạng trở lại). Tự động xóa toàn bộ cache ngoại tuyến khi đăng xuất.

---

## 🏗️ Kiến Trúc Công Nghệ

- **Frontend & Mobile:** React 18, Vite, TypeScript (`strict: true`), Tailwind CSS, Zustand, React Router, React-Dropzone, Recharts, PWA (`manifest.webmanifest` + `sw.js`), IndexedDB, **Capacitor 7** (`@capacitor/android`, `@capacitor/network`, `@capacitor/filesystem`, `@capacitor/share`).
- **Backend:** Node.js, Express, TypeScript (`strict: true`), Prisma ORM, Google Gemini (`@google/generative-ai`, mặc định `gemini-3.6-flash`), Multer, `pdf-parse`, `mammoth`, Zod, `bcrypt`, JWT (`httpOnly` cookie cho Web/PWA và Bearer token cho Native Mobile).
- **Database & Storage:** PostgreSQL 16+ (ACID, Cascade Delete), lưu trữ CV cục bộ (`local`) hoặc Cloudinary (`cloudinary`), chỉ phục vụ tệp qua endpoint được xác thực `GET /api/candidates/:id/file`.

---

## 📁 Cấu Trúc Dự Án (Monorepo)

```text
MikiriCV/
├── docs/
│   ├── HuongDan_Demo_Va_KiemThu_CVMikiri.md  # Hướng dẫn nạp DB mẫu & kịch bản demo chi tiết cho Tester
│   ├── Chuong5/                               # Đặc tả kiến trúc, DB, API & ADR-08, ADR-09
│   └── Chuong3_* / PRD/                       # Tài liệu yêu cầu PRD
├── scripts/
│   └── build-android-apk.ps1                  # Script build nhanh file Android Debug APK
├── backend/                                   # RESTful API Service (Express + Prisma + Gemini)
│   ├── prisma/
│   │   ├── schema.prisma                      # PostgreSQL schema
│   │   ├── seed.ts                            # Seed ADMIN & tài khoản dev tối thiểu
│   │   └── demo-seed.sql                      # Dump PostgreSQL bộ dữ liệu demo đầy đủ
│   ├── src/
│   │   ├── config/                            # Biến môi trường, Prisma DB
│   │   ├── controllers/                       # Xử lý HTTP Request/Response + Zod
│   │   ├── services/                          # Nghiệp vụ JD, Candidate, Matching, Subscription, Admin
│   │   ├── modules/                           # AI Provider, CV Extraction, Skills, Storage, Idempotency
│   │   ├── middlewares/                       # Auth (Web Cookie / Mobile Bearer), CSRF, Upload, Error handler
│   │   ├── routes/                            # API Endpoints (/api/*)
│   │   └── scripts/                           # seed-full-demo.ts, export-demo-sql.ts, maintenance
│   └── .env.example
├── frontend/                                  # React 18 + Vite + PWA + Capacitor
│   ├── public/                                # manifest.webmanifest, sw.js, icons/
│   ├── src/
│   │   ├── shared/
│   │   │   ├── platform/                      # Runtime detection, API server config, Native file viewer/exporter
│   │   │   ├── offline/                       # IndexedDB cache, Outbox syncQueue, networkStore, normalizeVi
│   │   │   └── pwa/                           # Đăng ký Service Worker
│   │   ├── features/                          # auth, candidates, jobs, matching, subscription
│   │   ├── components/                        # common (Navbar, BottomNav, NetworkStatusBanner), dashboard
│   │   └── pages/                             # Dashboard, Jobs, Candidates, Matching, Account, Admin pages
│   ├── android/                               # Native Android Capacitor project
│   ├── release/                               # Thư mục xuất file CVMikiri-debug.apk
│   └── capacitor.config.ts
├── docker-compose.yml                         # PostgreSQL (+ profile full cho Docker)
└── package.json                               # Root scripts điều khiển Monorepo
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Cài đặt Dependencies & Cấu hình môi trường
```bash
npm run install:all
```

Sao chép `backend/.env.example` thành `backend/.env` và cập nhật:
- `DATABASE_URL`: Chuỗi kết nối PostgreSQL (`postgresql://postgres:postgres@localhost:5432/mikiricv?schema=public`).
- `GEMINI_API_KEY` & `GEMINI_MODEL=gemini-3.6-flash` (AI Matching).
- `STORAGE_DRIVER=local` (lưu tại `backend/uploads`) hoặc `cloudinary` (kèm `CLOUDINARY_*`).
- `CORS_ORIGIN` & `MOBILE_CORS_ORIGINS`: Khai báo origin cho Web LAN / PWA / APK (`capacitor://localhost,https://localhost,http://localhost`).
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`: 2 chuỗi ngẫu nhiên **khác nhau**, mỗi chuỗi ≥ 32 ký tự.
- `SEED_ADMIN_EMAIL` & `SEED_ADMIN_PASSWORD`: Tài khoản Quản trị viên.

### 2. Khởi tạo Database & Nạp Dữ Liệu Mẫu (3 cách)

Khởi chạy PostgreSQL và migrate schema trước:
```bash
docker compose up -d postgres
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
```

Chọn **1 trong 3 cách** nạp dữ liệu:

1. **Cách 1 — Import nhanh `backend/prisma/demo-seed.sql` (Khuyến nghị cho Tester, không cần gọi Gemini):**
   - Với PostgreSQL local (v17/v18):
     ```powershell
     psql "postgresql://postgres:postgres@localhost:5432/mikiricv" -f backend/prisma/demo-seed.sql
     npm --prefix backend run prisma:seed
     ```
   - Với Docker container PostgreSQL 16 (lọc bỏ 2 dòng cú pháp PG 18):
     ```powershell
     Get-Content backend/prisma/demo-seed.sql | Where-Object { $_ -notmatch '^SET transaction_timeout' -and $_ -notmatch '^\\restrict' } | docker exec -i mikiricv-postgres-1 psql -U postgres -d mikiricv
     npm --prefix backend run prisma:seed
     ```
2. **Cách 2 — Chạy script tải 20 CV Google Drive & chấm AI thật trực tiếp:** *(yêu cầu `STORAGE_DRIVER=cloudinary` và `GEMINI_API_KEY`)*
   ```bash
   npm --prefix backend run seed:demo
   ```
3. **Cách 3 — Seed tối thiểu (chỉ tạo Admin + 2 tài khoản dev nếu có `SEED_DEMO_PASSWORD`):**
   ```bash
   npm --prefix backend run prisma:seed
   ```

> Chi tiết danh sách toàn bộ tài khoản mẫu (`admin@example.com`, `hr.main@mikiricv.vn` / `Test@123`, v.v.), 14 JD, 20 CV mẫu và kịch bản test từng luồng xem tại:
> 👉 **[docs/HuongDan_Demo_Va_KiemThu_CVMikiri.md](docs/HuongDan_Demo_Va_KiemThu_CVMikiri.md)**

### 3. Khởi chạy hệ thống
```bash
npm run dev
```
- **Frontend (Web/PWA):** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:4000](http://localhost:4000)
- **Health Check:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 📱 Chạy Thử Trên Điện Thoại Thật (Android APK & PWA)

> Vì giao diện CVMikiri được xây dựng bằng React 18 + Tailwind DOM + Capacitor 7 (không phải React Native), **Expo Go không chạy trực tiếp được**. Hãy test trực tiếp trên điện thoại thật bằng **Android `.apk`** hoặc **PWA**.

### Cách 1: Cài đặt & chạy file Android `.apk` (Capacitor Native)
1. **Đóng gói file APK** (yêu cầu JDK 17/21 và Android SDK — script tự dò tự động):
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1
   ```
   File APK sau khi build nằm tại: **`frontend/release/CVMikiri-debug.apk`** (và `frontend/android/app/build/outputs/apk/debug/app-debug.apk`).
2. **Cài lên điện thoại Android:**
   - Qua USB (bật *USB Debugging*):
     ```powershell
     adb install -r frontend/release/CVMikiri-debug.apk
     adb reverse tcp:4000 tcp:4000
     ```
   - Hoặc copy `CVMikiri-debug.apk` sang điện thoại để cài trực tiếp.
3. **Trỏ địa chỉ Backend ngay trong app (không cần build lại APK):**
   - Mở app **CVMikiri** → tại màn hình Đăng nhập, bấm mở mục **Cấu hình máy chủ API**:
     - Nếu cắm cáp USB (`adb reverse`): giữ hoặc nhập `http://localhost:4000/api`.
     - Nếu chạy qua Wi-Fi LAN: nhập `http://<IP_LAN_MÁY_TÍNH>:4000/api` (nhớ mở port 4000 trên Windows Firewall).
     - Nếu dùng Android Emulator: mặc định là `http://10.0.2.2:4000/api`.
     - Nếu dùng HTTPS tunnel (`cloudflared` / `ngrok`): nhập `https://<domain-tunnel>/api`.
   - Bấm **Kiểm tra kết nối** → **Lưu máy chủ** → Đăng nhập để test toàn bộ chức năng & chế độ **Offline-First**.

### Cách 2: Chạy dạng PWA (Android Chrome & iOS Safari)
1. Khởi chạy backend (`npm --prefix backend run dev`) và frontend lắng nghe LAN:
   ```bash
   npm --prefix frontend run dev:lan
   ```
2. Mở trình duyệt trên điện thoại (qua HTTPS tunnel hoặc LAN) và chọn **Thêm vào màn hình chính (Add to Home Screen)** để cài thành ứng dụng độc lập.

---

## 📄 Trích xuất CV, Bảo mật & Gói Token

### Trích xuất CV và dữ liệu AI
- Backend trích xuất văn bản bằng `pdf-parse` (PDF có text layer) và `mammoth` (DOCX); chưa hỗ trợ OCR cho ảnh scan.
- `FieldParser` (`backend/src/modules/candidates/field-parser.ts`) nhận diện họ tên, email, SĐT Việt Nam, số năm kinh nghiệm (`0–30`), học vấn (các dòng bằng cấp/trường đại học/cao đẳng/thạc sĩ/kỹ sư) và kỹ năng chuẩn hóa từ `skill-dictionary.ts`.
- API danh sách/tìm kiếm không trả về `rawText`, `searchText`, `fileUrl`. Tệp CV gốc chỉ tải qua `GET /api/candidates/:id/file` sau khi kiểm tra quyền sở hữu.
- Khi ngoại tuyến hoặc nhà cung cấp AI lỗi, hệ thống không bao giờ trả điểm 0 giả mạo — lỗi AI hiển thị rõ trạng thái `FAILED` kèm mã lỗi.

### Cấu hình Gói doanh nghiệp & Token cá nhân

| Cấu hình mặc định | FREE | PLUS |
| --- | ---: | ---: |
| Token mỗi tài khoản mỗi chu kỳ | 100.000 | 3.000.000 |
| Chu kỳ token | 30 ngày | 30 ngày |
| Số tài khoản HR trong công ty | Không giới hạn | Không giới hạn |
| CV tối đa mỗi yêu cầu matching | 1 | 200 |
| Giới hạn trang PDF / ký tự CV | 2 trang (~3.000 ký tự) | Đầy đủ |
| Trọng số 6 nhóm tiêu chí & Export Excel/PDF | Khóa | Mở khóa |
| Token output tối đa mỗi CV (gồm thinking) | 4.096 | 8.192 |

- **Triển khai & Migration:**
  ```powershell
  cd backend
  npx prisma migrate deploy
  npm run prisma:generate
  npm run build
  ```

---

## 🧪 Kiểm thử & Build

```bash
# Kiểm thử & Build Frontend
npm --prefix frontend test
npm --prefix frontend run build

# Kiểm thử & Build Backend
npm --prefix backend test
npm --prefix backend run build

# Chạy thêm bài test tích hợp Token Billing với PostgreSQL thật
cd backend
$env:RUN_BILLING_INTEGRATION='1'
npm test
```

*(Chi tiết kiến trúc & các quyết định thiết kế xem thêm tại [docs/Chuong5/](docs/Chuong5/) — bao gồm `ADR-08-authentication-tenant.md` và `ADR-09-cross-platform-offline.md`.)*
