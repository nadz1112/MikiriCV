---
description: Thay đổi schema Prisma và tạo migration an toàn
---

1. Đối chiếu thay đổi với mục 5.4 của Chương 5; nếu khác thiết kế, nêu rõ lý do và cập nhật tài liệu.
2. Sửa `backend/prisma/schema.prisma`.
3. Chạy `npx prisma migrate dev --name <ten-migration>`.
4. Với index đặc biệt (ví dụ `pg_trgm` cho `searchText`), dùng `--create-only`, chỉnh file SQL rồi mới áp dụng.
5. Chạy `npx prisma generate` và sửa các chỗ TypeScript bị ảnh hưởng.
6. Kiểm tra cascade: xóa JD/ứng viên thì dữ liệu liên quan bị xóa đúng.
7. Không sửa migration đã được commit; tạo migration mới thay thế.
