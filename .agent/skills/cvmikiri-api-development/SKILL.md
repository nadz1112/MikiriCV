---
name: cvmikiri-api-development
description: Implement or fix CVMikiri Express API endpoints, Zod validation, service logic, repository queries, and response DTOs. Use for backend feature work rather than a read-only audit.
---

# Phát triển API CVMikiri

Đọc `AGENTS.md`, các quy tắc liên quan trong `.agent/rules/` và endpoint gần nhất trước khi sửa. Tài liệu có thể mô tả cấu trúc đích; xác định đường gọi thực tế trong code, không di chuyển module chỉ để khớp tài liệu.

## Điểm bắt đầu

- Router: `backend/src/routes/`; controller: `backend/src/controllers/`; nghiệp vụ: `backend/src/services/`.
- Repository, schema và mapper ứng viên: `backend/src/modules/candidates/`.
- Xác thực/phân quyền: `backend/src/middlewares/auth.middleware.ts`.
- Lỗi chuẩn: `backend/src/common/errors/app-error.ts` và `backend/src/middlewares/error.middleware.ts`.
- Kiểu dữ liệu lưu trữ: `backend/prisma/schema.prisma`; đọc quan hệ và hành vi cascade trước khi đổi thao tác xóa.

## Thực hiện

1. Theo dấu route đến truy vấn và caller frontend. Kiểm tra body, query, params bằng schema Zod hiện có; frontend dùng Zod khác phiên bản backend nên không sao chép API schema thiếu kiểm tra.
2. Đặt chặn role trước thao tác và kiểm tra ownership cho từng ID, kể cả danh sách ID. ADMIN có phạm vi đọc rộng hơn ENTERPRISE nhưng không đồng nghĩa được upload CV, tạo JD hay chạy matching.
3. Giữ phân tầng route/controller/service/repository; không đưa Prisma vào controller mới. Giới hạn sửa trong tính năng được yêu cầu.
4. Trả DTO theo allowlist thay vì spread bản ghi Prisma. Tái sử dụng `candidate.mapper.ts` và `common/mappers/user.mapper.ts` khi phù hợp. Nội dung CV chỉ xuất hiện trong detail có quyền; không trả trường nội bộ hay đường dẫn tệp.
5. Dùng `AppError` và định dạng lỗi hiện có, thông báo tiếng Việt. Khi đổi hợp đồng response, cập nhật caller và kiểu frontend liên quan.

## Kiểm tra và bàn giao

- Chọn test hiện có trong `backend/tests/` tương ứng. Với thay đổi quyền, kiểm tra cả role hợp lệ và tài khoản không sở hữu tài nguyên; không chỉ kiểm tra happy path.
- PowerShell: `npm.cmd --prefix backend test -- tests/<ten-test>.test.ts`; build backend: `npm.cmd --prefix backend run build`.
- Dùng fixture/mock theo test hiện có. Không seed, reset DB hoặc chạy migration trên DB dev như một bước kiểm tra mặc định. Thay đổi schema cần nêu rõ tác động và phạm vi được phép trước khi áp dụng vào DB.
- Báo hành vi thay đổi, lệnh thực sự đã chạy và giới hạn kiểm chứng; không coi mock test là bằng chứng đã thử HTTP trên DB thật.
