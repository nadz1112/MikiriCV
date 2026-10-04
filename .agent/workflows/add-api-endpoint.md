---
description: Thêm một endpoint backend theo đúng kiến trúc phân tầng của CVMikiri
---

1. Xác định FR và endpoint trong mục 5.5.2 của `docs/Chuong5_CVMikiri_ThietKeHeThong.md`. Nếu chưa có, dừng lại và đề xuất bổ sung tài liệu trước.
2. Tạo/cập nhật Zod schema ở `modules/<module>/<module>.schema.ts` cho body, query, params.
3. Thêm hàm vào `<module>.repository.ts` (nơi duy nhất dùng Prisma).
4. Thêm nghiệp vụ vào `<module>.service.ts`; ném `AppError` với mã lỗi theo mục 5.5.4.
5. Thêm Mapper/DTO để không lộ trường nội bộ (`rawText`, `fileUrl`, `searchText`).
6. Thêm handler vào `<module>.controller.ts` bọc bằng `asyncHandler`, rồi đăng ký trong `<module>.routes.ts`.
7. Kiểm tra: dữ liệu hợp lệ, dữ liệu sai (400 tiếng Việt), không tồn tại (404), và không rò thông tin nội bộ.
8. Liệt kê các file đã thêm/sửa.
