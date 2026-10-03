---
trigger: always_on
---

# Quy tắc kiến trúc

## Phân tầng backend (không đi ngược chiều)
Routes -> Controllers -> Services -> Repositories / Adapters
- Controller: parse Zod, gọi Service, trả DTO. KHÔNG import Prisma.
- Service: nghiệp vụ. KHÔNG import `express`.
- Repository: nơi duy nhất dùng Prisma.

## Cấu trúc
- Backend theo module: `src/modules/{jobs,candidates,matching,skills,stats,health}`.
- Frontend theo feature: `src/features/<feature>/{components,hooks,store,api}`, page ở `src/pages`.

## Dịch vụ ngoài luôn qua interface
- Gemini: chỉ gọi qua `AIMatchingProvider`, không gọi trực tiếp từ nơi khác.
- Lưu tệp: qua `FileStorage`.

## Bất biến quan trọng
- `GEMINI_API_KEY` chỉ ở backend `.env`, không bao giờ vào frontend, log hoặc response.
- AI Matching chỉ chạy trên `candidateIds` do người dùng chọn; không có chế độ chấm toàn bộ.
- Không phục vụ thư mục `uploads` công khai; tải/xem CV qua `GET /api/candidates/:id/file`.
- Không trả `rawText`, `searchText`, `fileUrl` trong API danh sách.
- Lỗi AI không được thay bằng "kết quả mặc định" (như score 0): phải thành trạng thái FAILED có mã lỗi.
- Xóa ứng viên: xóa DB trước, xóa tệp sau.
- Chạy matching qua hàng đợi có giới hạn song song (`MATCH_CONCURRENCY`), không bắn song song hàng loạt.
