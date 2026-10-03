---
trigger: always_on
---

# Chuẩn code

- TypeScript `strict: true` ở cả frontend và backend; không dùng `any` nếu chưa có lý do ghi chú.
- Mọi body/query/params đi qua Zod; lỗi trả về `400 VALIDATION_ERROR`.
- Phản hồi thành công: `{ success: true, data, message?, total?, page?, limit? }`.
- Phản hồi lỗi: `{ success: false, error: { code, message, details? }, requestId }`; `message` tiếng Việt.
  Dùng `AppError(code, status, message)` và `errorHandler`; không tự `res.status(500).json(...)` rải rác.
- Mã lỗi theo danh mục ở mục 5.5.4 của Chương 5.
- Tìm kiếm tiếng Việt: luôn dùng chung `normalizeForSearch()` cho cả lúc ghi `searchText` và lúc nhận từ khóa.
- Kỹ năng: chuẩn hóa qua `SkillNormalizer` (alias -> tên chuẩn) ở bóc tách, lọc và `GET /api/skills`.
- Schema DB đổi qua `prisma migrate`, không sửa tay DB.
- Không log nội dung CV, email, số điện thoại.
- Frontend: gọi API qua `shared/api/httpClient.ts`; hiển thị `error.message` tiếng Việt bằng toast;
  mỗi page có trạng thái loading, rỗng và lỗi.
