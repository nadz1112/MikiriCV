# **CVMikiri — Tài liệu Yêu cầu (Requirements Specification)**

## **1\. Tổng quan dự án**

|  |  |
| ----- | ----- |
| **Tên dự án** | CVMikiri — Hệ thống kiểm tra & lọc CV |
| **Mục tiêu** | Giúp nhà tuyển dụng upload, trích xuất dữ liệu, lọc và chấm điểm mức độ phù hợp của CV ứng viên với một Job Description (JD) bằng AI |
| **Loại ứng dụng** | Web app full-stack (SPA \+ REST API) |
| **Frontend** | Vite \+ React 18 \+ TypeScript |
| **Backend** | Node.js \+ Express \+ TypeScript |
| **Database** | MySQL |
| **AI Engine** | Anthropic Claude API (matching CV ↔ JD) |

## **2\. Yêu cầu chức năng (Functional Requirements)**

### **FR1 — Quản lý Job Description (JD)**

* FR1.1: Tạo JD mới gồm: tiêu đề, mô tả công việc, danh sách kỹ năng yêu cầu, số năm kinh nghiệm tối thiểu.  
* FR1.2: Xem danh sách JD đã tạo.  
* FR1.3: Xóa JD.  
* FR1.4 (tùy chọn mở rộng): Sửa JD.

### **FR2 — Upload & trích xuất CV**

* FR2.1: Cho phép upload nhiều file CV cùng lúc, định dạng **PDF** và **DOCX**.  
* FR2.2: Giới hạn dung lượng file (mặc định 10MB/file, cấu hình được).  
* FR2.3: Tự động trích xuất text thô từ file.  
* FR2.4: Tự động nhận diện các trường cơ bản: họ tên (từ tên file hoặc nội dung), email, số điện thoại, kỹ năng, số năm kinh nghiệm.  
* FR2.5: Lưu file gốc để có thể xem/tải lại sau.  
* FR2.6: Báo lỗi rõ ràng nếu file sai định dạng hoặc quá dung lượng.

### **FR3 — Lọc CV (rule-based, nhanh, miễn phí)**

* FR3.1: Lọc theo từ khóa tự do (tìm trong toàn bộ nội dung CV).  
* FR3.2: Lọc theo danh sách kỹ năng (khớp 1 hoặc nhiều kỹ năng).  
* FR3.3: Lọc theo số năm kinh nghiệm tối thiểu.  
* FR3.4: Kết hợp nhiều điều kiện lọc cùng lúc.

### **FR4 — Chấm điểm phù hợp bằng AI (AI Matching)**

* FR4.1: Chọn một JD và một hoặc nhiều CV (thường là danh sách đã lọc ở FR3) để chạy matching.  
* FR4.2: Gọi gemini API để phân tích và trả về: điểm số 0–100, nhận xét ngắn gọn, danh sách kỹ năng khớp, danh sách kỹ năng còn thiếu.  
* FR4.3: Lưu kết quả matching vào database, gắn với cặp (CV, JD).  
* FR4.4: Nếu chạy lại matching cho cùng cặp CV–JD, ghi đè kết quả cũ (upsert).  
* FR4.5: Xử lý lỗi khi AI trả về dữ liệu không hợp lệ (không phải JSON đúng định dạng).

### **FR5 — Dashboard & danh sách ứng viên**

* FR5.1: Hiển thị danh sách ứng viên đã upload, kèm thông tin cơ bản.  
* FR5.2: Hiển thị bảng xếp hạng ứng viên theo điểm phù hợp (giảm dần) cho một JD cụ thể.  
* FR5.3: Xem chi tiết một ứng viên: thông tin trích xuất, nội dung CV, lịch sử kết quả matching với các JD khác nhau.  
* FR5.4: Xóa ứng viên (và các kết quả matching liên quan bị xóa theo — cascade).  
* FR5.5 (tùy chọn mở rộng): Biểu đồ thống kê (số CV theo thời gian, phân bố điểm số...).

## **3\. Yêu cầu phi chức năng (Non-Functional Requirements)**

| Mã | Yêu cầu |
| ----- | ----- |
| NFR1 | **Bảo mật API key**: API key của Anthropic chỉ tồn tại ở backend (`.env`), không bao giờ lộ ra frontend/client. |
| NFR2 | **Hiệu năng**: Lọc rule-based (FR3) phải chạy tức thời trên tập dữ liệu vài trăm CV; AI matching (FR4) chỉ chạy trên tập đã lọc để giảm chi phí & độ trễ. |
| NFR3 | **Khả năng mở rộng**: Database dùng Prisma để có thể đổi từ SQLite sang PostgreSQL chỉ bằng cách đổi `DATABASE_URL` \+ provider, không đổi code. |
| NFR4 | **Xử lý lỗi**: Mọi lỗi (parse file, gọi AI, validate input) phải trả về thông báo lỗi rõ ràng bằng tiếng Việt, không làm crash server. |
| NFR5 | **Giới hạn dung lượng upload**: cấu hình qua biến môi trường `MAX_FILE_SIZE_MB`. |
| NFR6 | **Type-safety**: Toàn bộ codebase dùng TypeScript, bật `strict mode`. |
| NFR7 | **Khả năng triển khai**: Có thể chạy độc lập frontend/backend hoặc container hóa (Docker) khi cần deploy production. |
| NFR8 | **Khả năng đọc dữ liệu tiếng Việt**: Trích xuất và xử lý đúng CV chứa tiếng Việt có dấu. |

## **4\. Yêu cầu hệ thống (Environment Requirements)**

* **Node.js**: \>= 18.x  
* **npm**: \>= 9.x  
* **Hệ điều hành**: Windows / macOS / Linux (không phụ thuộc OS)  
* **Anthropic API Key**: bắt buộc để dùng tính năng AI Matching (FR4)  
* **Dung lượng ổ đĩa**: đủ chỗ lưu file CV upload (thư mục `backend/uploads`)

## **5\. Danh sách thư viện / Dependencies**

### **5.1 Frontend (`frontend/package.json`)**

**dependencies**

| Package | Phiên bản | Mục đích |
| ----- | ----- | ----- |
| react, react-dom | ^18.3.1 | UI library |
| react-router-dom | ^6.28.0 | Routing SPA |
| axios | ^1.7.9 | Gọi REST API |
| zustand | ^5.0.2 | State management nhẹ |
| react-hook-form | ^7.54.0 | Quản lý form (tạo JD, filter...) |
| recharts | ^2.13.3 | Biểu đồ dashboard |
| lucide-react | ^0.462.0 | Icon |
| clsx | ^2.1.1 | Gộp className có điều kiện |
| date-fns | ^4.1.0 | Xử lý ngày giờ |
| react-dropzone | ^14.3.5 | Kéo-thả upload file CV |
| react-hot-toast | ^2.4.1 | Thông báo (toast) |

**devDependencies**

| Package | Phiên bản | Mục đích |
| ----- | ----- | ----- |
| vite | ^6.0.1 | Build tool |
| @vitejs/plugin-react | ^4.3.4 | Hỗ trợ React trong Vite |
| typescript | ^5.6.3 | Type-checking |
| @types/react, @types/react-dom | ^18.3.x | Type định nghĩa React |
| tailwindcss, postcss, autoprefixer | ^3.4.15 / ^8.4.49 / ^10.4.20 | Styling |
| eslint \+ plugin react-hooks/react-refresh | ^9.15.0 | Linting |

### **5.2 Backend (`backend/package.json`)**

**dependencies**

| Package | Phiên bản | Mục đích |
| ----- | ----- | ----- |
| express | ^4.21.1 | Web framework |
| cors | ^2.8.5 | Cho phép frontend gọi API cross-origin |
| dotenv | ^16.4.5 | Đọc biến môi trường `.env` |
| multer | ^1.4.5-lts.1 | Upload file (CV) |
| pdf-parse | ^1.1.1 | Trích xuất text từ PDF |
| mammoth | ^1.8.0 | Trích xuất text từ DOCX |
| @prisma/client | ^5.22.0 | ORM client truy vấn database |
| @anthropic-ai/sdk | ^0.32.1 | Gọi Claude API cho AI Matching |
| zod | ^3.23.8 | Validate dữ liệu đầu vào |
| uuid | ^11.0.3 | Sinh tên file duy nhất khi upload |

**devDependencies**

| Package | Phiên bản | Mục đích |
| ----- | ----- | ----- |
| typescript | ^5.6.3 | Type-checking |
| tsx | ^4.19.2 | Chạy TS trực tiếp khi dev (watch mode) |
| prisma | ^5.22.0 | CLI migrate/generate schema database |
| @types/express, @types/cors, @types/multer, @types/node, @types/pdf-parse, @types/uuid | mới nhất tương ứng | Type định nghĩa cho các lib JS thuần |

### **5.3 Root workspace**

| Package | Phiên bản | Mục đích |
| ----- | ----- | ----- |
| concurrently | ^9.1.0 | Chạy song song `npm run dev` cho cả frontend & backend |

## **6\. Biến môi trường bắt buộc (`backend/.env`)**

PORT=4000  
NODE\_ENV=development

DATABASE\_URL="file:./dev.db"

ANTHROPIC\_API\_KEY=sk-ant-xxxxxxxxxxxxxxxx  
ANTHROPIC\_MODEL=claude-sonnet-4-6

MAX\_FILE\_SIZE\_MB=10  
UPLOAD\_DIR=./uploads

## **7\. Data Model tóm tắt (yêu cầu về dữ liệu)**

* **Candidate**: id, fullName, email, phone, rawText, skills\[\], yearsOfExperience, education, fileName, fileUrl, createdAt  
* **JobDescription**: id, title, description, requiredSkills\[\], minExperience, createdAt  
* **MatchResult**: id, candidateId (FK), jobDescriptionId (FK), score, summary, matchedSkills\[\], missingSkills\[\], createdAt — **unique theo cặp (candidateId, jobDescriptionId)**

**8\. Giới hạn & phạm vi ngoài dự án (Out of scope — bản đầu)**

* Không bao gồm xác thực/phân quyền người dùng (đăng nhập) ở phiên bản đầu.  
* Không bao gồm gửi email tự động cho ứng viên.  
* Không bao gồm xử lý CV dạng ảnh scan (OCR) — chỉ hỗ trợ PDF text-based và DOCX.  
* Không bao gồm tích hợp với các nền tảng tuyển dụng bên thứ ba (LinkedIn, VietnamWorks...).

**9\. Tiêu chí hoàn thành (Definition of Done — MVP)**

* Tạo/xem/xóa JD hoạt động đầy đủ qua UI.  
* Upload nhiều CV, hệ thống parse và lưu đúng dữ liệu cơ bản.  
* Lọc CV theo từ khóa/kỹ năng/kinh nghiệm cho kết quả đúng.  
* Chạy AI Matching trả về điểm số \+ nhận xét hợp lệ, lưu vào DB.  
* Dashboard hiển thị bảng xếp hạng ứng viên theo điểm cho từng JD.  
* Toàn bộ API có xử lý lỗi, không crash server khi input sai.

