# Hướng Dẫn Cài Đặt, Nạp Dữ Liệu Mẫu & Kịch Bản Demo Toàn Diện — CVMikiri

Tài liệu này dành cho **Tester / QA / Người demo** nhằm hướng dẫn từng bước:
1. Tải, nạp và chạy bộ **Database mẫu (tài khoản, doanh nghiệp, JD, 20 CV thật & CV biên, kết quả AI, ví token)**.
2. Cài đặt và chạy thử trên **Web, PWA và ứng dụng Android (`.apk`) trên điện thoại thật**.
3. Thực hiện **kịch bản demo toàn bộ chức năng theo luồng** — từ các thao tác nhỏ nhất (validation, hiện/ẩn mật khẩu, lọc từ khóa) đến các chức năng chính (Upload CV, Sàng lọc 2 tầng, Quản lý JD/User) và **các tính năng nổi bật** (Đánh giá CVTest 6 nhóm tiêu chí có bằng chứng, Trọng số tùy chỉnh, Ví token & Đối soát Admin, Đa nền tảng Mobile & Ngoại tuyến Offline-First).

---

## Phần 1. Chuẩn bị môi trường & Nạp Database mẫu

### 1.1. Yêu cầu tiên quyết
- **Node.js** >= 20 (đã kiểm thử với v24.18.0) và **npm** >= 10.
- **PostgreSQL 16+** (khuyến nghị **17/18** nếu import trực tiếp `demo-seed.sql`, hoặc dùng Docker qua `docker-compose.yml`).
- **Google Gemini API Key** (chỉ bắt buộc khi muốn chạy nút chấm AI trực tiếp hoặc chạy `seed:demo`; nếu import `demo-seed.sql`, tester có thể xem sẵn 32 kết quả AI đã chấm thật mà chưa cần key ngay).

### 1.2. Cấu hình biến môi trường Backend (`backend/.env`)
Sao chép `backend/.env.example` thành `backend/.env` và cập nhật tối thiểu các trường sau:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mikiricv?schema=public"

# Google Gemini AI
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
GEMINI_MODEL="gemini-3.6-flash"
AI_BILLING_MODE=FREE

# Lưu trữ CV: "local" (lưu tại ./uploads) hoặc "cloudinary" (bắt buộc nếu chạy seed:demo)
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
MAX_FILES_PER_REQUEST=20

# CORS cho Web & Mobile APK/PWA
CORS_ORIGIN=http://localhost:5173
MOBILE_CORS_ORIGINS=capacitor://localhost,https://localhost,http://localhost

# Bảo mật JWT (bắt buộc >= 32 ký tự và 2 secret phải KHÁC NHAU)
JWT_ACCESS_SECRET=replace-with-a-random-access-secret-at-least-32-chars
JWT_REFRESH_SECRET=replace-with-a-different-refresh-secret-at-least-32
COOKIE_SECURE=false

# Tài khoản Admin khi chạy prisma:seed
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=ChangeThis_Admin_123
SEED_DEMO_PASSWORD=Optional_Demo_Password_123
```

> **Lưu ý khi test trên điện thoại thật qua Wi-Fi LAN:**
> Nếu mở frontend bằng IP LAN (ví dụ `http://192.168.1.10:5173`) hoặc từ APK (`http://localhost` / `capacitor://localhost`), cần thêm origin vào `CORS_ORIGIN` hoặc `MOBILE_CORS_ORIGINS` (cách nhau bằng dấu phẩy `,`), ví dụ:
> `CORS_ORIGIN=http://localhost:5173,http://192.168.1.10:5173`

### 1.3. Ba cách nạp Database mẫu (chọn 1 trong 3)

#### Cách 1: Import trực tiếp `backend/prisma/demo-seed.sql` (Nhanh nhất — Khuyến nghị cho Tester)
File `backend/prisma/demo-seed.sql` đã chứa sẵn toàn bộ 7 doanh nghiệp, 12 tài khoản HR + 1 Admin, 14 JD, 29 CV (20 CV thật + 9 CV phụ/edge case), 32 kết quả AI Matching thật, ví Token 2 chu kỳ, lịch sử AI Usage, phiếu `UNKNOWN` chờ đối soát và Billing Audit — **không tốn quota Gemini khi nạp**.

**Bước 1 — Cài dependencies và tạo cấu trúc bảng bằng Prisma:**
```bash
npm run install:all
docker compose up -d postgres
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
```

**Bước 2 — Import file `backend/prisma/demo-seed.sql`:**
- Nếu dùng **PostgreSQL local (v17/v18)**:
```powershell
psql "postgresql://postgres:postgres@localhost:5432/mikiricv" -f backend/prisma/demo-seed.sql
```
- Nếu dùng **Docker container `postgres` (PostgreSQL 16 trong `docker-compose.yml`)**:
  > Lưu ý: `demo-seed.sql` được xuất từ `pg_dump 18.3` nên có dòng `SET transaction_timeout = 0;` và `\restrict ...`. Với PostgreSQL 16, lọc bỏ 2 dòng này khi pipe vào `psql`:
```powershell
Get-Content backend/prisma/demo-seed.sql | Where-Object { $_ -notmatch '^SET transaction_timeout' -and $_ -notmatch '^\\restrict' } | docker exec -i mikiricv-postgres-1 psql -U postgres -d mikiricv
```
*(Thay `mikiricv-postgres-1` bằng tên container thực tế xem từ `docker compose ps`.)*

**Bước 3 — Đặt lại mật khẩu Admin khớp `.env` (khuyến nghị):**
```bash
npm --prefix backend run prisma:seed
```
Lệnh này **không xóa dữ liệu demo**, chỉ cập nhật email/mật khẩu tài khoản `ADMIN` theo `SEED_ADMIN_EMAIL` & `SEED_ADMIN_PASSWORD` trong `backend/.env` để bạn đăng nhập Admin ngay (và nếu có `SEED_DEMO_PASSWORD` sẽ tạo thêm 2 tài khoản test đổi mật khẩu bắt buộc `hr.alpha@example.test` / `hr.beta@example.test`).

---

#### Cách 2: Chạy script `seed:demo` (Tải mới 20 CV từ Google Drive + Chấm AI thật trực tiếp)
Dùng khi muốn tự sinh mới dữ liệu và đẩy 20 CV thật lên Cloudinary + gọi trực tiếp `GEMINI_API_KEY`:
1. Cấu hình `STORAGE_DRIVER=cloudinary` cùng `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` và `GEMINI_API_KEY` hợp lệ trong `backend/.env`.
2. Chạy:
```bash
npm --prefix backend run prisma:migrate
npm --prefix backend run seed:demo
```
Script `backend/src/scripts/seed-full-demo.ts` sẽ tự động:
- Tải 20 CV PDF thật từ Google Drive, trích xuất văn bản/kỹ năng/kinh nghiệm/học vấn và upload lên Cloudinary.
- Tạo 7 doanh nghiệp, 12 HR, 14 JD, 29 CV và chạy 32 lượt chấm điểm AI Matching qua Gemini.

---

#### Cách 3: Seed tối thiểu (`prisma:seed`)
Chỉ tạo 1 Admin (`SEED_ADMIN_EMAIL`) và (nếu có `SEED_DEMO_PASSWORD` ở môi trường dev) 2 HR tối giản (`hr.alpha@example.test`, `hr.beta@example.test`, có cờ `mustChangePassword = true`):
```bash
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

---

### 1.4. Danh sách Tài khoản mẫu (sau khi nạp `demo-seed.sql` hoặc `seed:demo`)

Mật khẩu chung của toàn bộ tài khoản HR trong bộ demo là: **`Test@123`**

| Vai trò | Doanh nghiệp | Gói / Chu kỳ | Email đăng nhập | Trạng thái & Mục đích test |
| --- | --- | --- | --- | --- |
| `ADMIN` | Toàn hệ thống | — | `admin@example.com` *(hoặc `SEED_ADMIN_EMAIL`)* | Hoạt động — Dashboard quản trị, Quản lý doanh nghiệp, Đối soát token, Quản lý User |
| `ENTERPRISE` | **Mikiri Talent Hub** | `PLUS` (`YEARLY`) | `hr.main@mikiricv.vn` | Hoạt động — Tài khoản HR chính (7 JD `JD01..JD07`, 20 CV Google Drive, +500.000 token thưởng) |
| `ENTERPRISE` | **Mikiri Talent Hub** | `PLUS` (`YEARLY`) | `hr.support@mikiricv.vn` | Hoạt động — HR thứ 2 cùng công ty (`Senior DevOps & Cloud Engineer`), kiểm tra cô lập/chia sẻ theo `ownerId` |
| `ENTERPRISE` | **NovaTech Solutions** | `PLUS` (`MONTHLY`) | `hr@novatech.vn` | Hoạt động — Có `MatchingJob` `FAILED`, **1 phiếu token `UNKNOWN` (9.800 token)** chờ Admin đối soát |
| `ENTERPRISE` | **NovaTech Solutions** | `PLUS` (`MONTHLY`) | `recruiter@novatech.vn` | Hoạt động — HR thứ 2 của NovaTech |
| `ENTERPRISE` | **VietRetail Group** | `FREE` (`MONTHLY`) | `hr@vietretail.vn` | Hoạt động — **Test giới hạn gói `FREE`** (100.000 token, upload từng CV đơn lẻ ≤ 2 trang, chấm 1 CV/lần, khóa trọng số & export) |
| `ENTERPRISE` | **VietRetail Group** | `FREE` (`MONTHLY`) | `tuyendung@vietretail.vn` | **Đã vô hiệu hóa (`isActive = false`)** — Test chặn đăng nhập tài khoản bị khóa |
| `ENTERPRISE` | **Saigon Logistics JSC** | `PLUS` (`YEARLY`) | `hr@saigonlogistics.vn` | Hoạt động — Có CV `WARNING` (*Hoàng Gia Bảo*, thiếu SĐT) và **1 phiếu `UNKNOWN` (9.600 token)** |
| `ENTERPRISE` | **Saigon Logistics JSC** | `PLUS` (`YEARLY`) | `ops.hr@saigonlogistics.vn` | Hoạt động — **Chưa từng đăng nhập** (`lastLoginAt = null`) |
| `ENTERPRISE` | **BuildAxis Engineering** | `FREE` (`MONTHLY`) | `hr@buildaxis.vn` | Hoạt động — Tài khoản gói `FREE` thứ 2 |
| `ENTERPRISE` | **EduSpring Academy** | `PLUS` (`MONTHLY`) | `hr@eduspring.vn` | Hoạt động — **Gói sắp hết hạn (còn 3 ngày)** hiện cảnh báo ở Admin Dashboard; có **CV ảnh scan `FAILED`** (*Scan_Teacher_CV_01.pdf*) |
| `ENTERPRISE` | **EduSpring Academy** | `PLUS` (`MONTHLY`) | `talent@eduspring.vn` | **Đang bị khóa brute-force** (`failedLoginCount = 5`, `lockedUntil` +2 giờ) |
| `ENTERPRISE` | **Finora Capital** | `PLUS` (`MONTHLY`) | `hr@finora.vn` | **Gói đã hết hạn 5 ngày trước** + tài khoản bị vô hiệu hóa |

> **Tài khoản test "Bắt buộc đổi mật khẩu lần đầu" (`mustChangePassword = true`):**
> Chạy `npm --prefix backend run prisma:seed` khi có `SEED_DEMO_PASSWORD` để tạo `hr.alpha@example.test` và `hr.beta@example.test`, **hoặc** đăng nhập Admin vào `/admin/users` tạo 1 tài khoản HR mới / bấm Đặt lại mật khẩu để test luồng ép đổi mật khẩu.

---

### 1.5. Danh sách JD mẫu & Trọng số CVTest

Tài khoản `hr.main@mikiricv.vn` sở hữu sẵn **7 JD thực tế** đa ngành:
1. **JD01 — Java Backend Developer** *(Có trọng số tùy chỉnh: Kỹ năng 35, Kinh nghiệm 25, Dự án 20, Kỹ năng mềm 8, Học vấn 7, Chất lượng CV 5)*
2. **JD02 — Digital Marketing Executive** *(Trọng số mặc định)*
3. **JD03 — Nhân viên kế toán tổng hợp**
4. **JD04 — Chuyên viên hành chính nhân sự tổng hợp** *(Có trọng số tùy chỉnh: 25 / 25 / 15 / 18 / 10 / 7)*
5. **JD05 — Nhân viên logistics – chứng từ xuất nhập khẩu**
6. **JD06 — Kỹ sư xây dựng – giám sát thi công**
7. **JD07 — Giáo viên tiếng Anh**

Ngoài ra còn **7 JD phụ** thuộc các doanh nghiệp khác (`Node.js & TypeScript Backend Engineer`, `Senior DevOps & Cloud Engineer`, `Chuyên viên Performance Marketing (Bán lẻ)`, `Chuyên viên Điều phối Xuất nhập khẩu Đường biển`, `Kỹ sư Hiện trường Kết cấu Dân dụng`, `Giáo viên Tiếng Anh Giao tiếp Thiếu niên`, `Chuyên viên Phân tích Tài chính Doanh nghiệp`).

---

### 1.6. Bộ 20 CV mẫu (Link tải trực tiếp từ Google Drive để test Upload CV)

Tester có thể tải về máy tính hoặc điện thoại các file CV PDF dưới đây để kiểm thử tính năng Upload CV đơn lẻ/hàng loạt, trích xuất dữ liệu và chấm điểm AI:

| # | Tên file CV | Ngành / Vị trí gợi ý | Link tải trực tiếp |
| --- | --- | --- | --- |
| 1 | `BuiNgocMai_CareNest_cv.pdf` | Hành chính Nhân sự / Kế toán | [Tải PDF](https://drive.google.com/uc?export=download&id=1ASy27WzP0t1Ao2D0FoLloT40Jpj9VvLS) |
| 2 | `DangHoaiNam_BuildAxis_cv.pdf` | Kỹ sư xây dựng | [Tải PDF](https://drive.google.com/uc?export=download&id=1t-DF1Dy07BhcRAqJ6mPnSJft6SR7xsgS) |
| 3 | `DinhThaoVy_TravelCove_cv.pdf` | Marketing / Tiếng Anh | [Tải PDF](https://drive.google.com/uc?export=download&id=1qK1GKVJB2ckWcjS0shrmlEG3bjdq3xty) |
| 4 | `DoKhanhLinh_LexBridge_cv.pdf` | Hành chính Nhân sự / Kế toán | [Tải PDF](https://drive.google.com/uc?export=download&id=1w5NxpJ58fSDH9Qv4mYWCTq6jvqBeyeQS) |
| 5 | `HoGiaHan_BrandMosaic_cv.pdf` | Digital Marketing | [Tải PDF](https://drive.google.com/uc?export=download&id=1ZOVbv09uPN3rvMblzzZodT6fPnkTPyJI) |
| 6 | `LeHoangPhuc_CloudVertex_cv.pdf` | Backend Developer | [Tải PDF](https://drive.google.com/uc?export=download&id=14brWmWzV2HbBiIU3M-lq8RB_y7X5kn1m) |
| 7 | `LeMinhChau_EduSpring_cv.pdf` | Giáo viên tiếng Anh | [Tải PDF](https://drive.google.com/uc?export=download&id=1vth4QHDTBzxEn8dXSacdtpueGf2FRAPA) |
| 8 | `LyThuTrang_RetailBloom_cv.pdf` | Digital Marketing / Bán lẻ | [Tải PDF](https://drive.google.com/uc?export=download&id=1NbyWbLhKggoNOYXDnfqNzTxz9L_nj26q) |
| 9 | `MaiTuanKiet_MotionWorks_cv.pdf` | Logistics / Sáng tạo | [Tải PDF](https://drive.google.com/uc?export=download&id=1zxyXaFRUcgJ3Af300R3bX71Rnmf-dg2G) |
| 10 | `NguyenHaiAn_Finora_cv.pdf` | Kế toán / Tài chính | [Tải PDF](https://drive.google.com/uc?export=download&id=1z2oNX5L1-78bay5UN33ivNYpe2W7XLtT) |
| 11 | `PhamNgocAnh_BrightWeb_cv.pdf` | IT / Backend | [Tải PDF](https://drive.google.com/uc?export=download&id=1jhHL9AGecK0VtKulC6qQRx8anCAFvfMa) |
| 12 | `PhamQuocBao_OceanStay_cv.pdf` | Nhân sự / Giáo dục | [Tải PDF](https://drive.google.com/uc?export=download&id=1kHv8u9GjvfAQmb5OwEMoz4UF32uZe8tX) |
| 13 | `PhanAnhThu_SupplyNest_cv.pdf` | Logistics / Chuỗi cung ứng | [Tải PDF](https://drive.google.com/uc?export=download&id=1_57MtkDaomH6ugz5xKK7bDR6oyAVLaSd) |
| 14 | `PhanThuHa_LedgerPoint_cv.pdf` | Kế toán tổng hợp | [Tải PDF](https://drive.google.com/uc?export=download&id=1ingxHqlkc-YqEEHIdNfbfjM-2S1sZHxD) |
| 15 | `TranBichNgoc_HarborLink_cv.pdf` | Logistics – Xuất nhập khẩu | [Tải PDF](https://drive.google.com/uc?export=download&id=1poMHpQb5jnx7UgftbH-xWf_TM8tjlDHY) |
| 16 | `TranMinhDuc_NovaTech_cv.pdf` | Java Backend Developer | [Tải PDF](https://drive.google.com/uc?export=download&id=10lxdNkNcCPNvx0ExuDIwxL_BlSkiVBEf) |
| 17 | `TruongDucHoa_AgriVista_cv.pdf` | Logistics / Xây dựng | [Tải PDF](https://drive.google.com/uc?export=download&id=197L2N_m6PXGPl5ebDQ00QwEYDABKLQa8) |
| 18 | `TruongMyDuyen_QualityGate_cv.pdf` | QA / IT | [Tải PDF](https://drive.google.com/uc?export=download&id=1ybmHKKF8upnV1nGe01xYlxhyYA3N0SrL) |
| 19 | `VoThanhTam_BistroLane_cv.pdf` | IT / F&B | [Tải PDF](https://drive.google.com/uc?export=download&id=1Pc3FzJ7yokgOk7ZxAtdybUZ49KzknriN) |
| 20 | `VuNhatMinh_VoltField_cv.pdf` | Kỹ sư / Marketing | [Tải PDF](https://drive.google.com/uc?export=download&id=1GRk0_BkUXWTfNQcvOxri2kdounPVf1ln) |

**Chuẩn bị thêm 4 file kiểm thử biên (Edge Cases) trên máy Tester:**
1. Một file **DOCX hợp lệ** (tạo bằng Word/Google Docs xuất `.docx`, ghi tên, email, SĐT Việt Nam `09...`, "3 năm kinh nghiệm React, TypeScript, PostgreSQL", "Đại học Bách Khoa").
2. Một file **sai định dạng** (ví dụ đổi tên `.jpg`/`.txt` hoặc chọn file `.png`) để kiểm tra bộ lọc Upload.
3. Một file **PDF > 10 MB** để kiểm tra thông báo vượt dung lượng.
4. Một file **PDF chỉ chứa ảnh scan** (chụp màn hình lưu thành PDF không có text layer) hoặc **PDF 3+ trang** (test giới hạn tối đa 2 trang ở tài khoản gói `FREE`).

---

## Phần 2. Kịch bản Demo & Kiểm thử chi tiết theo từng Luồng

Thực hiện tuần tự từ **Luồng 0 → Luồng 8** để kiểm thử đầy đủ mọi tính năng từ nhỏ nhất đến nổi bật.

---

### Luồng 0: Khởi chạy hệ thống & Health Check
1. Chạy đồng thời Backend và Frontend từ thư mục gốc:
   ```bash
   npm run dev
   ```
2. **Kiểm tra API sống:** Mở trình duyệt truy cập `http://localhost:4000/api/health`.
   - **Kỳ vọng:** Trả về HTTP `200` với JSON `{ "status": "ok", "service": "CVMikiri Backend API", "time": "..." }`.
3. **Kiểm tra Frontend:** Truy cập `http://localhost:5173`.
   - **Kỳ vọng:** Chưa đăng nhập → tự động điều hướng về `/login`.

---

### Luồng 1: Xác thực, Bảo mật & Cô lập dữ liệu đa doanh nghiệp
*Từ thao tác nhỏ nhất trên form đăng nhập đến phân quyền RBAC và cô lập Tenant.*

1. **Validation form & Toggle mật khẩu (Tính năng nhỏ):**
   - Tại `/login`, để trống Email hoặc nhập `abc` → bấm **Đăng nhập**.
   - **Kỳ vọng:** Báo lỗi tiếng Việt ngay dưới ô Email (`Vui lòng nhập email hợp lệ`), không gửi request thừa.
   - Bấm biểu tượng con mắt tại ô mật khẩu → kiểm tra chuyển đổi hiện/ẩn mật khẩu.
2. **Tài khoản bị khóa brute-force & vô hiệu hóa:**
   - Thử đăng nhập `talent@eduspring.vn` / `Test@123`.
     - **Kỳ vọng:** Từ chối đăng nhập, hiển thị thông báo tài khoản đang bị khóa tạm thời.
   - Thử đăng nhập `tuyendung@vietretail.vn` / `Test@123`.
     - **Kỳ vọng:** Từ chối đăng nhập vì tài khoản đã bị Admin vô hiệu hóa (`isActive = false`).
   - Thử nhập sai mật khẩu 5 lần liên tiếp với một tài khoản test phụ (ví dụ `recruiter@novatech.vn`) → lần thứ 6 nhập đúng vẫn bị khóa tạm (`LOGIN_MAX_ATTEMPTS=5`, `LOGIN_LOCK_MINUTES=15`).
3. **Đăng nhập thành công & Phân quyền điều hướng:**
   - Đăng nhập `admin@example.com` → **Kỳ vọng:** Điều hướng vào `/admin/dashboard`; trên thanh menu chỉ có 3 mục Admin (`Dashboard`, `Quản lý doanh nghiệp`, `Quản lý tài khoản`); **không** thấy chip Token HR và không truy cập được `/candidates`, `/jobs`, `/matching` (truy cập thẳng sẽ báo không có quyền).
   - Đăng xuất (`Menu người dùng → Đăng xuất`).
   - Đăng nhập `hr.main@mikiricv.vn` / `Test@123` → **Kỳ vọng:** Điều hướng về `/`, thấy chip **Token còn ...** trên Navbar; truy cập thử `/admin/dashboard` sẽ bị chặn quyền.
4. **Kiểm tra cô lập dữ liệu (Tenant Isolation — Quan trọng):**
   - Trong phiên `hr.main@mikiricv.vn`, ghi nhận thấy 7 JD (`JD01..JD07`) và 20 CV.
   - Đăng xuất, đăng nhập `hr@vietretail.vn` / `Test@123` → chỉ thấy 1 JD (`Chuyên viên Performance Marketing (Bán lẻ)`) và 2 CV của VietRetail; tuyệt đối **không** thấy JD/CV của Mikiri Talent Hub hay NovaTech.
   - Copy một URL/ID CV của Mikiri gọi trực tiếp `/api/candidates/<id>/file` từ trình duyệt đang đăng nhập VietRetail → **Kỳ vọng:** API từ chối (`403`/`404`), không lộ file hay thông tin.

---

### Luồng 2: Quản trị viên (`ADMIN`) — Giám sát, Doanh nghiệp, Token & Tài khoản
Đăng nhập tài khoản `ADMIN` (`admin@example.com`).

#### 2.1. Dashboard quản trị (`/admin/dashboard`)
1. Thử bộ lọc nhanh **Khoảng thời gian AI** (`7 ngày`, `30 ngày`, `Tất cả`) và bộ lọc ngày tùy chỉnh **Từ ngày / Đến ngày → Áp dụng → Xóa lọc ngày**.
2. Kiểm tra biểu đồ **Xu hướng sử dụng token** (Token đầu vào / Token đầu ra) và thử lọc theo từng **Doanh nghiệp**.
3. Kiểm tra khối **Gói sắp hết hạn**:
   - **Kỳ vọng:** Hiển thị **EduSpring Academy** (hết hạn trong vòng 3 ngày tới), bấm vào link sẽ chuyển sang `/admin/companies?companyId=...`.
4. Kiểm tra **Top doanh nghiệp sử dụng token**: thanh tiến trình sắp xếp giảm dần theo tổng token.

#### 2.2. Quản lý Doanh nghiệp & Tài chính Token (`/admin/companies` — Tính năng nổi bật)
1. **Tìm kiếm, sắp xếp & phân trang:**
   - Gõ không dấu vào ô tìm doanh nghiệp (ví dụ `saigon` hoặc `mikiri`) → tìm ra ngay `Saigon Logistics JSC` / `Mikiri Talent Hub`.
   - Click tiêu đề cột (`Doanh nghiệp`, `JD`, `CV`, `Matching`, `Token đã dùng`, `Đăng nhập cuối`) để đổi chiều sắp xếp `↑ / ↓`.
2. **Chi tiết 1 doanh nghiệp & Tab Gói dịch vụ:**
   - Click vào tên **VietRetail Group** (đang gói `FREE`) → mở tab **Gói dịch vụ**:
     - Chọn `Gói doanh nghiệp`: `PLUS`, `Chu kỳ thanh toán`: `Theo tháng`, nhập `Lý do thay đổi` ≥ 3 ký tự → bấm **Lưu gói doanh nghiệp** (hoặc giữ nguyên nếu muốn test tiếp gói `FREE` ở Luồng 5/6).
   - Mở mục thu gọn **Cấu hình dịch vụ**:
     - Mở **Tính giá PLUS / doanh nghiệp / tháng**: nhập chi phí vận hành + chi phí AI + biên lợi nhuận (%) → xem **Giá gợi ý** làm tròn 1.000đ → bấm **Áp dụng giá gợi ý vào biểu mẫu** (kiểm tra giá trong form tự điền nhưng chưa lưu cho tới khi nhập lý do và bấm Lưu).
     - Xem khối **Chi phí sử dụng Gemini**: hiển thị model đang cấu hình (`gemini-3.6-flash`) và chế độ miễn phí/trả phí.
   - Mở **Lịch sử thay đổi gói và đơn giá** (`BillingAuditPanel`): xem nhật ký chi tiết 7+ sự kiện thay đổi gói/giá đã seed sẵn.
3. **Tab Tài khoản HR & Đối soát phiếu `UNKNOWN` (Nổi bật):**
   - Chọn doanh nghiệp **NovaTech Solutions** (hoặc **Saigon Logistics JSC**) → chuyển sang tab **Tài khoản HR**.
   - Kiểm tra bảng **Token các tài khoản**: hiển thị rõ `Hạn mức`, `Đã dùng`, `Tạm giữ`, `Còn lại`, `Kết thúc chu kỳ`. Thử tick chọn 1 tài khoản để thấy nút **Khóa tài khoản / Mở khóa**.
   - Bấm **Lịch sử** ở tài khoản `Lê Thị Thảo` (`hr@novatech.vn`) → mở mục **Lịch sử token và chi phí AI của tài khoản** → mở phần **Cần đối soát**:
     - **Kỳ vọng:** Thấy phiếu trạng thái **Chưa xác định kết quả** (`UNKNOWN`, 9.800 token).
     - Bấm **Đối soát** → chọn:
       - *Quyết toán token thực tế* (nhập Token đầu vào/trả lời/suy luận + Lý do), **hoặc**
       - *Xác nhận AI chưa xử lý — hoàn tạm giữ* + Lý do → bấm **Xác nhận đối soát**.
     - **Kỳ vọng:** Token tạm giữ của HR được giải phóng/quyết toán chính xác, cập nhật sổ cái ngay lập tức.
4. **Tab Sử dụng AI:** Xem tổng `Token đầu vào`, `Token đầu ra`, `Token suy luận`, `Chi phí Gemini đã ghi nhận (USD)` và 2 biểu đồ đường/cột theo ngày.

#### 2.3. Quản lý Tài khoản (`/admin/users`)
1. Lọc theo **Trạng thái** (`Tất cả`, `Hoạt động`, `Đã khóa`) và tìm kiếm theo tên/email/công ty.
2. **Tạo tài khoản HR mới & Kiểm tra validation mật khẩu tạm:**
   - Bấm tạo tài khoản → thử nhập mật khẩu yếu (`abcdefg`, `12345678`) → kiểm tra thông báo lỗi chi tiết tại form.
   - Bấm nút **Tạo mật khẩu ngẫu nhiên** → thử nút hiện/ẩn mật khẩu → nhập tên công ty mới hoặc chọn từ danh sách gợi ý → Lưu.
   - **Kỳ vọng:** Hiển thị hộp mật khẩu tạm 1 lần để Admin copy gửi cho HR; tài khoản mới có cờ `mustChangePassword = true`.
3. **Sửa thông tin (`Sửa`), Đặt lại mật khẩu (`Đặt lại mật khẩu`), Khóa/Mở khóa và Xóa cascade:**
   - Thử đổi tên hiển thị 1 tài khoản test → lưu → kiểm tra cập nhật.
   - Thử **Xóa** một tài khoản test vừa tạo → xác nhận hộp thoại cảnh báo cascade (số JD & CV sẽ bị xóa cùng tài khoản).
4. **Kiểm tra luồng Đổi mật khẩu bắt buộc (từ tài khoản vừa tạo):**
   - Đăng xuất Admin → đăng nhập bằng tài khoản HR mới tạo ở bước 2 → **Kỳ vọng:** Bị điều hướng cứng vào `/account?tab=security` (tab Hồ sơ & Gói bị vô hiệu hóa cho tới khi đổi xong mật khẩu mới). Sau khi đổi thành công → tự mở toàn bộ quyền truy cập.

---

### Luồng 3: HR — Bảng điều khiển Tổng quan (`/`)
Đăng nhập tài khoản HR chính: **`hr.main@mikiricv.vn`** / **`Test@123`**.

1. Kiểm tra **4 thẻ KPI** trên cùng: Tổng số JD (7), Tổng số CV (20), Số CV phù hợp / Đã đánh giá, Tỷ lệ/Điểm trung bình.
2. Kiểm tra **Biểu đồ phân bổ điểm (ScoreDistributionChart)** theo 4 dải điểm.
3. Trong vùng **Bảng xếp hạng theo JD**, chuyển dropdown qua lại giữa **JD01 — Java Backend Developer** và **JD05 — Nhân viên logistics – chứng từ xuất nhập khẩu**:
   - **Kỳ vọng:** Danh sách ứng viên xếp hạng giảm dần theo điểm AI, đổi màu badge theo 3 ngưỡng chuẩn:
     - 🟢 **≥ 80**: Rất phù hợp
     - 🟡 **50 – 79**: Khá phù hợp
     - 🔴 **< 50**: Cần cân nhắc
4. Chuyển sang tab **Danh mục CV**, gõ từ khóa vào ô tìm kiếm nhanh để lọc danh sách CV ngay tại Dashboard.
5. Click xem chi tiết 1 ứng viên trên bảng xếp hạng để mở nhanh **CandidateInsightDrawer**.

---

### Luồng 4: HR — Quản lý JD & Trọng số CVTest (`/jobs`)
Tiếp tục với **`hr.main@mikiricv.vn`** (`PLUS`) và đối chiếu thêm với **`hr@vietretail.vn`** (`FREE`).

1. **Tìm kiếm nhanh JD:** Gõ `java` hoặc `ke toan` (không dấu) vào thanh tìm kiếm → kiểm tra bộ đếm `Hiển thị X / 7 vị trí tuyển dụng` và nút `X` xóa từ khóa.
2. **Xem chi tiết JD (Drawer):** Click vào 1 thẻ JD (`JD01 — Java Backend Developer`) → xem thống kê tổng CV đã chấm, điểm cao nhất/trung bình và thử nút **Lọc CV theo JD** (điều hướng sang `/candidates` gắn sẵn ngữ cảnh JD đó).
3. **Tạo JD mới & Trọng số 6 nhóm tiêu chí CVTest (Tính năng nổi bật):**
   - Bấm **Tạo JD mới**:
     - Thử để trống tiêu đề/kỹ năng → bấm Lưu → kiểm tra Zod báo lỗi từng trường bằng tiếng Việt.
     - Nhập tiêu đề (ví dụ `Frontend React Engineer`), mô tả công việc, kỹ năng bắt buộc (chọn gợi ý hoặc gõ + dấu phẩy/Enter), kỹ năng ưu tiên, số năm kinh nghiệm.
     - Mở mục **Cấu hình trọng số đánh giá (6 nhóm tiêu chí)**: *Khớp kỹ năng, Kinh nghiệm liên quan, Dự án & thành tựu, Kỹ năng mềm, Học vấn & chứng chỉ, Chất lượng CV*.
     - Thử chỉnh tổng trọng số khác 100 (ví dụ 95) → **Kỳ vọng:** Báo lỗi `Tổng trọng số 6 nhóm tiêu chí phải đúng bằng 100` và không cho lưu.
     - Chỉnh lại tổng đúng bằng `100` (hoặc bấm đặt lại mặc định `25/20/20/15/10/10`) → bấm Lưu.
   - **Đối chiếu trên gói FREE:** Đăng nhập `hr@vietretail.vn` → mở Tạo/Sửa JD → kiểm tra phần trọng số **bị khóa** kèm biểu tượng ổ khóa (chỉ gói `PLUS` mới được tùy biến trọng số).
4. **Sửa & Xóa JD:** Thử sửa tiêu đề JD vừa tạo; sau đó bấm Xóa và xác nhận xóa cascade.

---

### Luồng 5: HR — Quản lý CV & Sàng lọc Tầng 1 (`/candidates`)
Thao tác với **`hr.main@mikiricv.vn`** (`PLUS`) để test đầy đủ và kiểm tra giới hạn tại **`hr@vietretail.vn`** (`FREE`) + **`hr@eduspring.vn`**.

1. **Upload CV (Kéo thả / Chọn tệp):**
   - Thử kéo thả file **sai định dạng** (`.png`/`.txt`) → bị từ chối ngay tại Dropzone với thông báo tiếng Việt.
   - Thử file **> 10 MB** → báo `Sai định dạng/Quá 10MB: Tệp vượt quá giới hạn 10 MB`.
   - Thử upload **nhiều tệp PDF + DOCX cùng lúc** (tối đa 20 tệp trên gói `PLUS`):
     - **Kỳ vọng:** Thanh tiến trình từng file chạy lên 100%, bóc tách tên, email, SĐT, số năm kinh nghiệm, học vấn, kỹ năng chuẩn hóa (`SkillNormalizer`, ví dụ `ReactJS` → `React`).
   - Upload lại **chính tệp đó lần thứ 2** → kiểm tra cơ chế phát hiện trùng lặp nội dung (`contentHash`) hoặc xử lý không sinh rác.
   - **Kiểm tra giới hạn gói `FREE` (`hr@vietretail.vn`):** Chọn 2 file cùng lúc hoặc chọn 1 PDF dài > 2 trang → **Kỳ vọng:** Báo rõ gói `FREE` chỉ upload 1 tệp mỗi lần và tối đa 2 trang / ~3.000 ký tự.
2. **Trạng thái trích xuất `WARNING` / `FAILED` & Thử lại trích xuất:**
   - Đăng nhập `hr@eduspring.vn` → thấy `Scan_Teacher_CV_01.pdf` có trạng thái **Trích xuất thất bại (`FAILED`)** kèm thông báo không đọc được văn bản (ảnh scan/mật khẩu).
   - Đăng nhập `hr@saigonlogistics.vn` → thấy *Hoàng Gia Bảo* có trạng thái **Cảnh báo (`WARNING`)** (*Đã đọc nội dung nhưng chưa tìm thấy số điện thoại*).
   - Thử bấm nút **Thử lại trích xuất (`Re-extract`)** trên dòng hồ sơ cảnh báo/thất bại để kiểm tra luồng trích xuất lại.
3. **Sàng lọc Tầng 1 — Rule-based Filtering (<100ms, $0) trên `hr.main@mikiricv.vn`:**
   - **Tìm kiếm tiếng Việt không dấu:** Gõ `tran minh duc` hoặc `xuat nhap khau` → **Kỳ vọng:** Trả về đúng *Trần Minh Đức* hoặc các CV Logistics nhờ `normalizeForSearch()`.
   - **Lọc theo kỹ năng:** Chọn `Java`, `Spring Boot` → chuyển đổi giữa chế độ **Có ít nhất 1 kỹ năng (`any`)** và **Đủ tất cả kỹ năng (`all`)** → quan sát kết quả thu hẹp chính xác.
   - **Lọc số năm kinh nghiệm tối thiểu:** Tăng lên `3` năm → chỉ giữ CV có ≥ 3 năm kinh nghiệm.
   - **Áp tiêu chí nhanh từ JD:** Ở góc trên phải, chọn `JD đang chọn: JD01 — Java Backend Developer` → bấm **Áp tiêu chí JD** → thanh lọc tự điền đúng kỹ năng & kinh nghiệm của JD01.
   - **Lọc trạng thái trích xuất (`SUCCESS`/`WARNING`/`FAILED`), sắp xếp & phân trang**, sau đó bấm **Đặt lại bộ lọc**.
4. **Xem CV gốc bảo mật & Bảo vệ riêng tư:**
   - Mở `CandidateInsightDrawer` của 1 ứng viên → bấm **Xem tệp CV gốc** → kiểm tra tải qua endpoint được xác thực `/api/candidates/:id/file` (trên các CV tự upload mới khi `STORAGE_DRIVER=local`, hoặc Cloudinary nếu có cấu hình).
   - Kiểm tra network tab (DevTools) cho `GET /api/candidates`: xác nhận response danh sách **không** chứa `rawText`, `searchText`, hay đường dẫn ổ đĩa `fileUrl`.
5. **FloatingActionBar (Luồng chuyển tiếp sang AI Matching):**
   - Tick chọn 2–3 ứng viên trên bảng → thanh hành động nổi **FloatingActionBar** xuất hiện ở đáy màn hình với số lượng đã chọn → bấm nút chuyển sang **AI Matching Studio** → tự động mang các ứng viên đã chọn sang `/matching`.

---

### Luồng 6: HR — AI Matching Studio & Đánh giá CVTest dựa trên bằng chứng (`/matching` — Tính năng nổi bật)

1. **Nguyên tắc chọn ứng viên rõ ràng (Không có chế độ chấm toàn bộ):**
   - Vào `/matching`, chọn JD (ví dụ `JD01 — Java Backend Developer`). Bấm thử **Tìm kiếm ứng viên** hoặc bật công tắc **Chỉ hiện CV chưa chấm** để lọc nhanh các CV chưa đánh giá.
   - Chú ý chỉ các CV trích xuất được mới tích chọn được; CV `FAILED` không cho chấm AI (khi thử trong job batch sẽ ghi `SKIPPED` với lý do `CANDIDATE_NOT_READABLE`).
2. **Chạy AI Matching hàng loạt bất đồng bộ (`PLUS` — `hr.main@mikiricv.vn`):**
   - Chọn 2–3 CV (hoặc upload 1–2 CV mới rồi chọn) → bấm nút chạy AI Matching → Modal xác nhận hiển thị rõ tên JD, số CV đã chọn → bấm **Xác nhận chấm điểm**.
   - **Kỳ vọng:**
     - Nếu là chạy hàng loạt trên `PLUS`, xuất hiện **Tiến trình đánh giá hàng loạt (`MatchingJobProgressPanel`)** cập nhật tiến độ `processed/total` real-time.
     - Có nút **Dừng đánh giá** (`CANCELLED`) khi đang chạy; nếu có item lỗi (ví dụ hết RPM/timeout) sẽ hiện trạng thái lỗi thật kèm nút **Thử lại các hồ sơ lỗi (`N`)** — **tuyệt đối không tự tạo điểm 0 giả**.
     - Sau khi xong, chip **Token còn ...** trên Navbar tự động cập nhật giảm đúng số `input + output + thinking` token thực tế đã dùng.
3. **Xem Báo cáo AI Insight chuẩn CVTest (`CandidateInsightDrawer` — Điểm nhấn nổi bật):**
   - Bấm vào dòng kết quả của **Trần Minh Đức** ở `JD01`:
     - Phần đầu: Điểm tổng 0–100, Badge mức phù hợp, **Nhận xét phân tích từ Gemini AI**.
     - **Phân tích theo 6 nhóm tiêu chí**: hiển thị điểm từng nhóm (`score/maxScore`), badge trạng thái (`Đáp ứng tốt` / `Đáp ứng` / `Đáp ứng một phần` / `Thiếu bằng chứng` / `Chưa tìm thấy`), độ tin cậy (`Tin cậy cao/trung bình/thấp`), giải thích, và **trích dẫn bằng chứng (`evidence`)** chỉ rõ `source` + `section` + câu trích nguyên văn từ CV/JD.
     - **Điểm mạnh có bằng chứng** & **Điểm cần xác minh (gapsAndConcerns)**.
     - **Phân tích yêu cầu theo JD (`requirementsAnalysis`)**: từng yêu cầu gắn nhãn `Bắt buộc` / `Ưu tiên` và trạng thái đáp ứng.
     - **Tiềm năng phát triển (`Career Potential`)**: ghi rõ chỉ là nhận xét bổ trợ, không cộng vào tổng 100 điểm.
     - **Câu hỏi phỏng vấn gợi ý** thiết kế riêng cho ứng viên đó + ghi chú *Human-in-the-loop*.
     - **Gestalt Visual Contrast**: 2 cột đối chiếu xanh/đỏ (*Kỹ năng khớp* vs *Kỹ năng còn thiếu*).
     - **Văn bản trích xuất thô (Raw Text)** dạng Accordion + nút **Sao chép text**.
4. **Đối chiếu trải nghiệm Gói `FREE` (`hr@vietretail.vn`):**
   - Chọn > 1 ứng viên → hệ thống tự giới hạn **chỉ chọn được 1 CV mỗi lần chạy**.
   - Mở Insight Drawer của *Trần Ngọc Hân* → **Kỳ vọng:** Chỉ hiển thị Điểm, Nhận xét tóm tắt, **3 điểm nổi bật**, Đối chiếu Kỹ năng khớp/thiếu và **thẻ mời nâng cấp Gói PLUS** (ẩn phân tích 6 nhóm chuyên sâu và câu hỏi phỏng vấn).
5. **Xuất báo cáo so sánh Excel & In/PDF (Gói `PLUS`):**
   - Tại bảng kết quả `/matching`, bấm **Xuất Excel** → tải về file `.xlsx` so sánh các ứng viên của JD đang chọn.
   - Bấm **In / Lưu PDF** → mở giao diện in/lưu PDF.
   - Kiểm tra trên `hr@vietretail.vn` (`FREE`): hai nút này bị **vô hiệu hóa** và hiện chú thích *Xuất báo cáo so sánh dành cho gói PLUS*.

---

### Luồng 7: HR — Tài khoản, Ví Token cá nhân & Lịch sử (`/account`)
1. Bấm vào chip **Token còn ...** trên Navbar → mở thẳng `/account?tab=plan`.
2. **Tab Hồ sơ (`?tab=profile`):** Xem Họ tên, Email, Công ty (chỉ đọc).
3. **Tab Bảo mật (`?tab=security`):** Thử đổi mật khẩu (kiểm tra lỗi nếu nhập sai mật khẩu cũ hoặc mật khẩu mới không đủ chữ + số + tối thiểu 8 ký tự).
4. **Tab Gói & token (`?tab=plan`):**
   - Kiểm tra khối **Gói của công ty** (`FREE` hoặc `PLUS`, ngày hết hạn, CV mỗi lần chạy, trang PDF/CV, ký tự/CV, phí dịch vụ). Nếu là `FREE`, bấm nút **Nâng cấp** → mở hộp thoại so sánh quyền lợi `FREE` vs `PLUS` (`AccountDialogs`).
   - Kiểm tra khối **Token cá nhân**: Đã dùng, Còn lại, Hạn mức, thanh progress bar, ngày đặt lại chu kỳ, và hover/focus vào **`Đang giữ: X token ⓘ`** để xem tooltip giải thích cơ chế tạm giữ khi gọi AI.
   - Kiểm tra dòng ước tính: `≈ N CV có thể xử lý` (dựa trên trung bình lịch sử cá nhân hoặc mức tham khảo 2.000 token/CV).
   - Kiểm tra bảng **Lịch sử sử dụng của tôi** + phân trang Trước/Sau (hỗ trợ cả thẻ Mobile Card trên màn hình nhỏ).

---

### Luồng 8: Đa nền tảng Di động (Android APK / PWA) & Chế độ Ngoại tuyến (`Offline-First` — Tính năng nổi bật)

> **Lưu ý công nghệ:** CVMikiri dùng React Web + Tailwind + Capacitor 7, nên trên điện thoại thật bạn test bằng **file Android `.apk`** hoặc **PWA trên trình duyệt di động** (không dùng Expo Go).

#### 8.1. Cài đặt & Kết nối lên điện thoại Android thật (APK)
1. **Lấy file APK:** `frontend/release/CVMikiri-debug.apk` (hoặc tạo lại bằng `powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1`).
2. **Cài APK lên điện thoại Android:**
   - Cách A (Cáp USB): Bật *USB Debugging* trên điện thoại Android, chạy:
     ```powershell
     adb install -r frontend/release/CVMikiri-debug.apk
     adb reverse tcp:4000 tcp:4000
     ```
     *(Nếu dùng `adb reverse`, trong app nhập địa chỉ máy chủ là `http://localhost:4000/api`.)*
   - Cách B (Wi-Fi LAN): Chép file `CVMikiri-debug.apk` qua Zalo/Drive/USB vào điện thoại và bấm cài đặt (*Cho phép cài từ nguồn không xác định*).
     - Tìm IP LAN máy tính chạy backend bằng `ipconfig` (ví dụ `192.168.1.10`).
     - Đảm bảo tường lửa Windows mở cổng `4000` (hoặc tạm cho phép Node.js qua Private Network) và `MOBILE_CORS_ORIGINS` trong `backend/.env` đã có `http://localhost,https://localhost,capacitor://localhost`.
3. **Cấu hình máy chủ ngay trong app APK (không cần build lại):**
   - Mở app **CVMikiri** trên điện thoại → tại màn hình Đăng nhập, mở mục **Cấu hình máy chủ API** ở phía dưới thẻ đăng nhập.
   - Nhập `http://192.168.1.10:4000/api` (hoặc `http://localhost:4000/api` nếu cắm USB `adb reverse`, hoặc URL HTTPS tunnel nếu dùng ngrok/cloudflared).
   - Bấm **Kiểm tra kết nối** → hiện `Kết nối thành công tới .../health` → bấm **Lưu máy chủ** → đăng nhập `hr.main@mikiricv.vn` / `Test@123`.

*(Ngoài APK, bạn có thể test PWA trên Android Chrome / iOS Safari: chạy `npm --prefix frontend run dev:lan`, mở URL HTTPS tunnel hoặc LAN trên trình duyệt điện thoại → chọn **Thêm vào màn hình chính**).*

#### 8.2. Kiểm thử Giao diện Di động (Mobile-First UX)
1. Quan sát thanh điều hướng đáy **`BottomNav`** hiển thị 4 tab chính (`Bảng điều khiển`, `JD`, `CV`, `AI Matching`) vừa ngón tay cái, Navbar trên cùng thu gọn kèm chip Token.
2. Vào **Quản lý CV** (`/candidates`), **Kết quả Matching** (`/matching`), **Lịch sử Tài khoản** (`/account?tab=plan`), hoặc **Quản lý doanh nghiệp** (`/admin/companies` khi đăng nhập Admin):
   - **Kỳ vọng:** Toàn bộ bảng rộng tự động chuyển sang **Mobile Cards** đọc dọc gọn gàng, **không** bị tràn ngang màn hình (`overflow-x`).
3. Mở **CandidateInsightDrawer** / **JobDetailDrawer**: hiển thị dạng **Bottom Sheet / Full-height Drawer** mượt mà với padding đáy an toàn (`safe-area-inset-bottom`).
4. Ở `/candidates`, bấm **Xem tệp CV gốc** hoặc tại `/matching`, bấm **Xuất Excel**:
   - **Kỳ vọng:** Trên app APK, file được tải về bộ nhớ an toàn và kích hoạt **Native Share Sheet** của Android để mở bằng trình đọc PDF/Excel hoặc chia sẻ.

#### 8.3. Kiểm thử Ngoại tuyến (`Offline-First`) & Tự động đồng bộ (`Outbox Sync`)
Trong app (hoặc Chrome DevTools → Network → Offline, hoặc **bật Chế độ máy bay trên điện thoại**) khi đang đăng nhập `hr.main@mikiricv.vn`:

1. **Duyệt dữ liệu & Không mất phiên khi mất mạng:**
   - Truy cập nhanh qua Dashboard, `/jobs`, `/candidates`, `/matching`, `/account?tab=plan` khi đang có mạng để cache dữ liệu vào IndexedDB.
   - Sau đó **bật Chế độ máy bay (ngắt hoàn toàn Wi-Fi / 4G)** và thử đóng mở lại app hoặc chuyển trang:
     - **Kỳ vọng:** App **không** bị đá về `/login`; thanh **`NetworkStatusBanner`** màu vàng xuất hiện trên cùng: *"Đang ở chế độ ngoại tuyến — Bạn vẫn có thể xem dữ liệu đã lưu và chuẩn bị nháp JD/CV"*.
     - Các danh sách JD, Ứng viên, Bảng xếp hạng, Lịch sử Token gần nhất vẫn hiển thị đầy đủ; thử **tìm kiếm tiếng Việt không dấu** tại `/candidates` khi mất mạng vẫn lọc chính xác ở client!
2. **Ghim CV xem ngoại tuyến (`Pin CV`):**
   - Trước khi tắt mạng (khi còn online), mở Insight Drawer của 1 ứng viên (ví dụ *Trần Minh Đức*) → bấm nút **Lưu xem ngoại tuyến** → chuyển sang **Đã lưu ngoại tuyến**.
   - Bật Chế độ máy bay → mở lại ứng viên đó → bấm **Xem tệp CV gốc** → **Kỳ vọng:** Vẫn xem/mở được thông tin và tệp PDF đã ghim ngay cả khi mất mạng! (Nếu thử mở CV *chưa ghim* khi mất mạng sẽ báo cần kết nối mạng).
3. **Khóa nút chạy AI Matching khi ngoại tuyến:**
   - Khi đang mất mạng, vào `/matching` → **Kỳ vọng:** Nút chạy chấm điểm AI và Xuất Excel bị vô hiệu hóa kèm thông báo rõ không có mạng — **không** giả mạo kết quả hay trừ token nhầm.
4. **Chuẩn bị ngoại tuyến & Tự động đồng bộ khi có mạng (Outbox Queue):**
   - Khi đang mất mạng:
     - Vào `/jobs` → **Tạo JD mới** (ví dụ `Mobile QA Offline Draft`) → bấm Lưu → **Kỳ vọng:** Thông báo đã lưu vào hàng đợi đồng bộ, Banner báo `(1 mục chờ đồng bộ)`.
     - Vào `/candidates` → chọn thêm 1 file CV PDF → **Kỳ vọng:** File được đưa vào **Hàng đợi ngoại tuyến (`queued_offline`)**, Banner tăng lên `(2 mục chờ đồng bộ)`.
   - **Tắt Chế độ máy bay (bật lại Wi-Fi):**
     - **Kỳ vọng:** Banner tự chuyển xanh *"Đang đồng bộ 2 mục dữ liệu ngoại tuyến lên máy chủ..."*, tự đẩy JD và CV lên backend với `Idempotency-Key` chống tạo trùng, sau đó biến mất và danh sách tự làm mới có mặt dữ liệu mới!
   - *(Kiểm thử nâng cao — Xung đột `409 CONFLICT`):* Sửa cùng 1 JD từ trình duyệt PC trước, sau đó sửa JD đó trên điện thoại khi đang offline bằng dữ liệu cũ rồi bật lại mạng → Banner hiện cảnh báo đỏ có **1 Job Description xung đột phiên bản với máy chủ** kèm nút xử lý **Hủy bản nháp xung đột**.
5. **Xóa sạch dữ liệu ngoại tuyến khi Đăng xuất (Bảo mật):**
   - Bấm **Đăng xuất** → mở `Application → IndexedDB` (hoặc quay lại offline) → **Kỳ vọng:** Toàn bộ cache JD, CV, CV đã ghim (Blob PDF/DOCX), Outbox và Token đều bị xóa sạch 100%, không bao giờ rò rỉ sang tài khoản tiếp theo đăng nhập trên cùng thiết bị.

---

## Phần 3. Checklist Nghiệm thu nhanh cho Tester

| Nhóm tính năng | Hạng mục kiểm thử | Đạt (✓) |
| --- | --- | :---: |
| **Database & Seed** | Import `demo-seed.sql` hoặc `seed:demo` thành công, đủ 7 công ty & 14 JD | [ ] |
| **Auth & Security** | Validate form, khóa brute-force 5 lần, chặn tài khoản khóa, ép đổi mật khẩu | [ ] |
| **Tenant Isolation** | HR công ty A không thấy/tải được JD, CV, file gốc của công ty B | [ ] |
| **Admin Dashboard** | Lọc 7d/30d/all/ngày, biểu đồ token, cảnh báo gói sắp hết hạn (`EduSpring`) | [ ] |
| **Admin Companies** | Sửa cấu hình gói, máy tính giá PLUS, gán gói, khóa HR, đối soát `UNKNOWN`, Audit | [ ] |
| **Admin Users** | Tạo User + mật khẩu ngẫu nhiên, Sửa, Reset mật khẩu, Xóa cascade | [ ] |
| **HR Dashboard** | 4 KPI, biểu đồ 4 mức điểm, đổi JD xem Leaderboard, tìm CV | [ ] |
| **Quản lý JD** | Tìm kiếm không dấu, Tạo/Sửa/Xóa, Trọng số CVTest (=100, khóa ở `FREE`) | [ ] |
| **Quản lý CV** | Upload 1 (`FREE`) / hàng loạt (`PLUS`), lỗi >10MB/scan/`FAILED`, lọc không dấu & skill `any/all`, xem file bảo mật | [ ] |
| **AI Matching Studio** | Chọn rõ ràng, Job bất đồng bộ (Hủy/Retry lỗi thật), Insight Drawer (`FREE` vs `PLUS` 6 tiêu chí + bằng chứng), Xuất Excel/PDF | [ ] |
| **Account & Token** | Chip `Token còn X` đổi màu, tooltip `Tạm giữ`, ước tính CV, lịch sử cá nhân | [ ] |
| **Android APK / PWA** | Cài `CVMikiri-debug.apk`, cấu hình Server URL tại Login, BottomNav, Mobile Cards, Share file | [ ] |
| **Offline-First** | Giữ phiên khi mất mạng, lọc CV offline, Ghim CV, Outbox tự đồng bộ, khóa AI khi offline, xóa cache khi logout | [ ] |
