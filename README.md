# CVMikiri — Hệ Thống Kiểm Tra, Sàng Lọc & Chấm Điểm CV Bằng AI

Hệ thống sàng lọc hồ sơ tuyển dụng thông minh 2 tầng:
1. **Tầng 1 (Rule-based Filtering)**: Lọc tức thời (<100ms) dựa trên kỹ năng, số năm kinh nghiệm và từ khóa tự do, chi phí $0.
2. **Tầng 2 (Gemini Generative AI Matching)**: Đối soát ngữ nghĩa sâu sắc giữa CV và Job Description (JD) bằng Google Gemini AI, chấm điểm 0–100, chỉ rõ điểm mạnh và kỹ năng còn thiếu.

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

Đăng nhập ADMIN bằng email/mật khẩu đã đặt trong `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD`. Tạo ENTERPRISE trong mục **Quản lý tài khoản**; tài khoản này phải đổi mật khẩu tạm ở lần đăng nhập đầu. Các bản ghi JD/CV mới do ENTERPRISE tạo được gắn owner ở backend. ADMIN xem dữ liệu tổng thể và chỉ có giao diện quản lý tài khoản trong phiên bản này.

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
UPLOAD_DIR="./uploads"
```

---

### 3. Đồng bộ Cơ sở dữ liệu PostgreSQL (Prisma)
Sau khi cấu hình `DATABASE_URL` trong `backend/.env`:
```bash
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
