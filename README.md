# CVMikiri — Hệ Thống Kiểm Tra, Sàng Lọc & Chấm Điểm CV Bằng AI

Hệ thống sàng lọc hồ sơ tuyển dụng thông minh 2 tầng:
1. **Tầng 1 (Rule-based Filtering)**: Lọc tức thời (<100ms) dựa trên kỹ năng, số năm kinh nghiệm và từ khóa tự do, chi phí $0.
2. **Tầng 2 (Gemini Generative AI Matching)**: Đánh giá kỹ năng và số năm kinh nghiệm đã trích xuất theo Job Description (JD) bằng Google Gemini AI, chấm điểm 0–100 và chỉ rõ kỹ năng còn thiếu. Thông tin cá nhân và văn bản CV được giữ tại backend.

---

## 🏗️ Kiến Trúc Công Nghệ

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS + Zustand + Lucide Icons + React-Dropzone.
- **Backend**: Node.js + Express + TypeScript + Prisma ORM + Google Gemini SDK + Multer + Zod.
- **Database**: PostgreSQL (chuẩn ACID, quan hệ Cascade Delete, Unique Composite Index).
- **AI Engine**: Google Gemini API (`gemini-3.5-flash` hoặc `gemini-3.5-pro`).

---

## 📁 Cấu Trúc Dự Án (Monorepo)

```text
MikiriCV/
├── docs/                                  # Toàn bộ tài liệu đặc tả
│   ├── PRD_Chuong_3_CVMikiri.md          # Tài liệu PRD Chương 3 chi tiết
│   └── Chuyen_4-CVKimiri.md               # Yêu cầu kỹ thuật gốc
├── backend/                               # RESTful API Service (Express + Prisma + Gemini)
│   ├── prisma/
│   │   └── schema.prisma                  # PostgreSQL schema
│   ├── src/
│   │   ├── config/                        # Cấu hình biến môi trường, Prisma & Gemini SDK
│   │   ├── controllers/                   # Xử lý HTTP Request/Response
│   │   ├── services/                      # Nghiệp vụ: Bóc tách file, Lọc rule-based, Gọi AI
│   │   ├── routes/                        # API Endpoints (/api/jobs, /api/candidates, /api/matching)
│   │   ├── middlewares/                   # Multer upload, Zod validator, Error handler
│   │   ├── types/                         # Interfaces & DTOs
│   │   ├── utils/                         # Heuristics bóc tách Text PDF/DOCX & Parser JSON AI
│   │   ├── app.ts                         # Express setup & CORS
│   │   └── server.ts                      # Entry point cổng 4000
│   ├── uploads/                           # Thư mục lưu tệp CV tải lên
│   └── .env.example
├── frontend/                              # Giao diện người dùng (Vite + React SPA)
│   ├── src/
│   │   ├── components/                    # UI Components (Navbar, Cards, Modals, Dropzone)
│   │   ├── pages/                         # Dashboard, Jobs, Candidates, Matching
│   │   ├── services/                      # Axios API clients
│   │   ├── store/                         # Quản lý state bằng Zustand
│   │   ├── types/                         # Models & Data Types
│   │   ├── App.tsx                        # Router & Layout
│   │   └── main.tsx                       # Entry point cổng 5173
│   └── vite.config.ts                     # Cấu hình Proxy gọi sang Backend
├── package.json                           # Root scripts điều khiển Monorepo
└── README.md
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Xác thực và seed quản trị viên

Đăng nhập bằng cookie HTTP-only, vì vậy frontend và API cần cùng site hoặc CORS origin phải được cấu hình chính xác. Sao chép `backend/.env.example` thành `backend/.env`, rồi đặt hai secret JWT ngẫu nhiên khác nhau (ít nhất 32 ký tự), `COOKIE_SECURE=true` khi chạy HTTPS, cùng `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` riêng của môi trường. Không dùng các giá trị ví dụ ở production.

Migration mới tạo tài khoản hệ thống `legacy-owner@system.invalid` đã bị vô hiệu hóa và gán JD/CV hiện có cho tài khoản này. Những dữ liệu cũ chỉ được tài khoản ADMIN đang hoạt động xem; chúng không tự động được trao cho doanh nghiệp mới.

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:migrate
npm --prefix backend run prisma:seed
```

Đăng nhập ADMIN bằng email/mật khẩu đã đặt trong `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`. Tạo ENTERPRISE trong mục **Quản lý tài khoản**; tài khoản này phải đổi mật khẩu tạm ở lần đăng nhập đầu. Các bản ghi JD/CV mới do ENTERPRISE tạo được gắn owner ở backend. ADMIN xem dữ liệu tổng thể, bao gồm danh sách CV và người tải lên.

Để tạo 2 tài khoản ENTERPRISE và JD/CV mẫu khi phát triển, đặt `SEED_DEMO_PASSWORD` rồi chạy seed trong `NODE_ENV=development` hoặc `test`. Tài khoản demo `hr.alpha@example.test` và `hr.beta@example.test` dùng mật khẩu đó và bắt buộc đổi mật khẩu lần đầu. Seed không tạo tài khoản demo trong production.

Mọi lần đăng nhập và request ghi cần header `X-Requested-With: CVMikiri`; frontend tự gửi header này. `docker-compose.yml` chỉ khởi chạy PostgreSQL; API vẫn chạy qua `npm run dev`.

### 1. Cài đặt Dependencies
Từ thư mục gốc dự án:
```bash
npm run install:all
```
*(Hoặc `cd backend && npm install` và `cd frontend && npm install`)*

---

### 2. Cấu hình Môi trường (Backend)
Mở tệp `backend/.env` và cập nhật thông tin:
```env
PORT=4000
NODE_ENV=development

# Chuỗi kết nối PostgreSQL của bạn
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/mikiricv?schema=public"

# Khóa API Google Gemini
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
GEMINI_MODEL="gemini-3.5-flash"

# Giới hạn dung lượng tải lên
MAX_FILE_SIZE_MB=10
MAX_FILES_PER_REQUEST=20
UPLOAD_DIR="./uploads"
```

---

### 3. Đồng bộ Cơ sở dữ liệu PostgreSQL (Prisma)
Sau khi cấu hình `DATABASE_URL` trong `backend/.env`:
```bash
docker compose up -d postgres
# Tạo các bảng trong PostgreSQL
npm run prisma:migrate

# Hoặc tạo Prisma Client
npm run prisma:generate
```

---

### 4. Khởi chạy Hệ thống
Chạy đồng thời cả Backend (Port 4000) và Frontend (Port 5173) chỉ với 1 lệnh:
```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:4000](http://localhost:4000)
- **Health Check API**: [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🔁 Chạy dự án trong những lần sau

Sau khi đã cài dependencies, tạo `backend/.env`, seed tài khoản ban đầu và chạy migration lần đầu, các lần phát triển tiếp theo chỉ cần:

```bash
# Từ thư mục gốc dự án
docker compose up -d postgres
npm run dev
```

Mở frontend tại [http://localhost:5173](http://localhost:5173). Không cần chạy lại `npm run install:all` hoặc `npm run prisma:seed` mỗi lần khởi động. PostgreSQL chạy nền trong Docker và dữ liệu được giữ trong volume `mikiricv-postgres`.

Để dừng frontend/backend, nhấn `Ctrl+C` ở terminal chạy `npm run dev`. Có thể để PostgreSQL chạy nền; nếu muốn dừng cả database:

```bash
docker compose stop postgres
```

Khi có thay đổi schema hoặc pull code có migration mới, chạy các lệnh sau trước khi khởi động app:

```bash
npm run prisma:migrate
npm run prisma:generate
```

Nếu cần tạo lại tài khoản hoặc dữ liệu mẫu trong môi trường phát triển, chạy `npm --prefix backend run prisma:seed` theo hướng dẫn cấu hình seed ở trên. Lệnh seed không cần thiết cho các lần chạy thường ngày.

Để dọn các khóa idempotency đã hết hạn, chạy tùy chọn:

```bash
npm --prefix backend run cleanup:idempotency
```

## Trích xuất CV và dữ liệu gửi tới AI

Khi tải CV lên, backend đọc văn bản PDF bằng `pdf-parse` (PDF.js) hoặc DOCX bằng `mammoth`. Bước này không gọi Gemini. File ảnh scan chưa có lớp văn bản hiện chưa được OCR.

Các trường được nhận diện bằng quy tắc trong `backend/src/modules/candidates/field-parser.ts`:

- Họ tên: ưu tiên tên file sau khi bỏ tiền tố CV/Resume; nếu không phù hợp thì dùng dòng văn bản đầu tiên có vẻ hợp lệ. Đây là ước lượng, có thể cần kiểm tra lại.
- Email và số điện thoại Việt Nam: dùng biểu thức chính quy.
- Kinh nghiệm: tìm số năm gần cụm “kinh nghiệm” hoặc “experience”, trong khoảng 0–30; không tìm thấy thì mặc định 0, không có nghĩa chắc chắn ứng viên chưa có kinh nghiệm.
- Kỹ năng: đối chiếu tên và tên viết tắt với từ điển tại `backend/src/modules/skills/skill-dictionary.ts`. Kỹ năng ngoài từ điển có thể bị bỏ sót; bộ lọc vẫn cho phép nhập tự do để tìm trong văn bản đã trích xuất.
- Học vấn: hiện chưa có bộ trích xuất, mặc định để trống.

Khi chạy AI Matching, chỉ danh sách kỹ năng đã chuẩn hóa theo từ điển và số năm kinh nghiệm của các CV được chọn được gửi cùng JD tới Gemini. Tên, email, điện thoại, tên file, đường dẫn, học vấn và toàn bộ văn bản CV không được đưa vào prompt. Kết quả vì vậy chỉ đánh giá dữ liệu chuyên môn đã trích xuất, chưa phản ánh đầy đủ dự án hoặc thành tích trong CV. JD vẫn được gửi nguyên nội dung; tránh ghi thông tin cá nhân vào JD. Các kết quả chấm cũ không tự được chấm lại.

“Xử lý nội bộ” ở đây là xử lý tại máy chạy backend. Nếu backend chạy trên máy của bạn thì dữ liệu được xử lý tại máy đó; nếu triển khai lên máy chủ thì file và dữ liệu cá nhân được lưu tại máy chủ, không phải chỉ trong trình duyệt. CV gốc và văn bản trích xuất vẫn được giữ trong kho file/PostgreSQL của hệ thống, và tải file phải qua endpoint được xác thực `/api/candidates/:id/file`.

Cảnh báo PDF.js “Ignoring invalid character … in hex string” là cảnh báo về cấu trúc nội bộ của PDF. Bộ đọc đã được đặt mức log lỗi để tránh lặp cảnh báo này; đây không phải sửa lại file PDF. File không đọc được hoặc không có văn bản vẫn được đánh dấu trích xuất thất bại để người dùng kiểm tra.

## Gói doanh nghiệp và token cá nhân

Migration `20261125000000_account_token_billing` thay cơ chế lượt CV dùng chung bằng token thực tế của từng HR. Dữ liệu CV/JD, kết quả matching và lịch sử AI cũ được giữ nguyên. Chu kỳ token đầu tiên bắt đầu tại thời điểm migration đối với doanh nghiệp hiện có; lượt CV cũ không được quy đổi thành token ước đoán.

| Cấu hình ban đầu | FREE | PLUS |
| --- | ---: | ---: |
| Token mỗi tài khoản mỗi chu kỳ | 100.000 | 3.000.000 |
| Chu kỳ token | 30 ngày | 30 ngày |
| Số tài khoản | Không giới hạn | Không giới hạn |
| CV mỗi yêu cầu matching | 1 | 200 |
| Token output tối đa mỗi CV, gồm thinking | 4.096 | 8.192 |

Các giá trị trên là cấu hình khởi tạo, admin có thể sửa tại Dashboard quản trị. Gói và thời hạn đăng ký thuộc doanh nghiệp; mỗi HR có ví, token đã dùng, tạm giữ, còn lại và lịch sử riêng. Token cấp thêm/thu hồi áp dụng cho chu kỳ hiện tại, không tự chuyển sang chu kỳ sau. Đổi gói giữ nguyên token đã dùng và đang tạm giữ. Đổi thời lượng chu kỳ có hiệu lực từ lần làm mới tiếp theo. Migration `20261126000000_unlimited_company_accounts` bỏ giới hạn tài khoản và thêm giá tháng cấp doanh nghiệp; giữ nguyên tài khoản, ví và lịch sử. FREE bằng 0; migration `20261126010000_demo_company_monthly_price` đặt PLUS mặc định 100.000đ/doanh nghiệp/tháng, chỉ thay giá cũ 299.000đ và lưu audit, giữ giá đã tùy chỉnh. Giả định demo: vận hành 70.000đ/tháng, Gemini miễn phí, biên lợi nhuận 30%; chưa phải chi phí đã đo. Công cụ tính giá PLUS dùng chi phí toàn doanh nghiệp và biên lợi nhuận do admin nhập, chỉ điền bản nháp trước khi lưu có lý do, không tự thay giá đang áp dụng.

Trước mỗi lần sinh nội dung, provider đếm token đầu vào của prompt/schema; backend khóa bản ghi và tạm giữ input cộng output tối đa trong transaction. Thiếu token trả `TOKEN_QUOTA_EXCEEDED`. Backend quyết toán input, output và thinking thực tế, đồng thời giải phóng tạm giữ trong cùng transaction. Lỗi JSON hoặc lỗi lưu báo cáo vẫn ghi nhận token provider đã sử dụng, đồng thời yêu cầu matching vẫn báo thất bại.

Nếu timeout, mất kết nối hoặc thiếu metadata token, phiếu chuyển sang `UNKNOWN` và tiếp tục giữ token. Admin xem mục **Điều chỉnh / Lịch sử → Đối soát** để nhập token thực tế hoặc hoàn tạm giữ khi provider xác nhận không xử lý. Phiếu `HELD`/`STARTED` bị gián đoạn chỉ được đối soát sau 10 phút. Các thao tác có lý do và người thực hiện trong sổ cái. Backend không tự gọi lại một lần sinh nội dung có kết quả chưa rõ; retry an toàn chỉ áp dụng cho bước đếm token.

Mục **Chi phí sử dụng Gemini** lấy đúng model và chế độ từ backend. `AI_BILLING_MODE=FREE` tự ghi chi phí 0 cho lần gọi mới, không cần nhập đơn giá; token vẫn tính vào hạn mức HR. Chế độ PAID dùng đơn giá đầu vào và đầu ra (gồm suy luận) theo đúng model, ưu tiên phiên bản admin rồi cấu hình môi trường. Mỗi lần gọi giữ bản chụp giá lúc tạm giữ; thay giá không tính lại lịch sử. Chưa có đơn giá trả phí thì chi phí là `null`, không suy đoán bằng 0. Dashboard cộng chi phí đã ghi nhận và báo số lần chưa xác định, không hiển thị tiền mô phỏng như chi phí thực tế. Giá trị này không phải hóa đơn/thuế của Google. RPM/TPM/RPD là giới hạn dự án Gemini, độc lập với hạn mức token HR theo chu kỳ và giá bán FREE/PLUS.

Trang HR `/account` gồm Hồ sơ (chỉ xem), Bảo mật và Gói & token. Đường dẫn đổi mật khẩu cũ của HR chuyển đến `/account?tab=security`; ADMIN vẫn dùng trang đổi mật khẩu cũ. Chip token mở `/account?tab=plan`. Bảng so sánh FREE/PLUS chỉ xuất hiện trong hộp thoại khi chọn Nâng cấp hoặc Xem gói từ thông báo lỗi hạn mức.

API HR: `GET /api/subscription` (gói công ty và số dư cá nhân), `/api/subscription/balance` (response nhẹ cho chip token), `/api/subscription/plans` (quyền lợi hai gói theo cấu hình thật), `/api/subscription/history?page=1` (lịch sử của chính người gọi, 20 dòng/trang). `/api/subscription/company` là đường dẫn tương thích, chỉ trả thông tin gói và token của người gọi, không trả danh sách tài khoản. API admin giữ nguyên. Lịch sử HR không trả sổ cái nội bộ, đơn giá hay số dư của người khác; JD không còn truy ra được từ dữ liệu cũ được hiển thị là chưa có thông tin. Mỗi dòng tương ứng một lần xử lý CV. Ước tính số CV dựa trên mức token trung bình của chính tài khoản, dùng mức tham khảo 2.000 token/CV khi chưa có mẫu phù hợp; không dùng ước tính này để chặn yêu cầu.

Client gửi `Idempotency-Key` cho `/api/matching/run` và `/api/matching/jobs`; phải giữ nguyên khóa và nội dung khi gửi lại cùng một yêu cầu. Biên nhận matching được lưu riêng, không bị dọn cùng khóa upload hết hạn. Client giữ khóa khi mất phản hồi mạng; gửi lại sẽ nhận biên nhận cũ. Chủ động chấm lại sau khi đã nhận kết quả là yêu cầu mới và tính token mới. Mã item của matching chạy nền ngăn gọi provider/trừ token lại sau khi runner khởi động lại.

Áp dụng migration khi triển khai (không dùng reset database):

```powershell
cd backend
npx prisma migrate deploy
npm run prisma:generate
npm run build
```

Kiểm thử tích hợp dùng PostgreSQL từ `BILLING_TEST_DATABASE_URL` hoặc `backend/.env`, tạo schema `billing_test_<uuid>` riêng và xóa đúng schema đó sau kiểm thử. Provider AI được mock, không gọi Gemini thật. Cần tài khoản DB có quyền tạo/xóa schema:

```powershell
cd backend
$env:RUN_BILLING_INTEGRATION='1'
npm test
```
