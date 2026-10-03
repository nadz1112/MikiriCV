---
trigger: always_on
---

# Bối cảnh dự án CVMikiri

CVMikiri là web app full-stack kiểm tra, sàng lọc và chấm điểm CV theo Job Description.

## Stack (đã chốt ở Chương 3 và 5)
- Frontend: React 18, Vite, TypeScript, Tailwind CSS, Zustand, React Router, react-dropzone, Recharts
- Backend: Node.js, Express, TypeScript, Multer, pdf-parse, mammoth, Zod
- Database: PostgreSQL qua Prisma ORM
- AI: Google Gemini (qua interface `AIMatchingProvider`)

## Nguồn chân lý
- Yêu cầu: `docs/Chuong3_*` (PRD). Nếu UX mâu thuẫn API thì lấy đặc tả API làm chuẩn.
- Thiết kế kỹ thuật: `docs/Chuong5_CVMikiri_ThietKeHeThong.md` (kiến trúc, schema, API, pattern).
- Tài liệu cũ nhắc MySQL/Claude/SQLite là LỖI THỜI — không dùng.

## Ngôn ngữ
- Tài liệu, thông điệp lỗi và toàn bộ chữ hiển thị cho người dùng: tiếng Việt có dấu.
- Tên biến, hàm, file, commit: tiếng Anh.

## Ngoài phạm vi MVP
Đăng nhập/phân quyền, OCR, gửi email tự động, tích hợp LinkedIn/TopCV/VietnamWorks.
Không thêm tính năng ngoài danh sách FR đã có nếu chưa được yêu cầu.
