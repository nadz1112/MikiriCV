---
name: cvmikiri-permission-audit
description: Audit CVMikiri ADMIN and ENTERPRISE permissions, account isolation, session invalidation, and private API responses against a requested specification. Use for a permissions audit; use the existing PR review skill for diff-only reviews.
---

# Kiểm tra phân quyền CVMikiri

Đây là quy trình kiểm tra chỉ đọc. Không tự sửa code, merge, migration hoặc thay đổi dữ liệu. Đọc `AGENTS.md` và đặc tả người dùng cung cấp; nếu đặc tả không có, phân biệt hành vi được chứng minh trong code với yêu cầu chưa được xác định.

## Thu thập bằng chứng

1. Kiểm tra route backend, thứ tự middleware, controller, service và truy vấn repository. Đối chiếu guard, navbar và thao tác frontend; chỉ ẩn UI không chứng minh API an toàn.
2. Lập ma trận cho từng thao tác: chưa đăng nhập, ADMIN, ENTERPRISE sở hữu, ENTERPRISE khác chủ. Với dữ liệu tenant, xác minh ownership của mọi ID trong params/body/query, nested resource và bulk request. Phân biệt `ownerId` với metadata `createdById`/`uploadedById`; kiểm tra khả năng null thay vì suy từ tên cột.
3. Điểm vào: `backend/src/routes/{user,admin,auth,job,candidate,matching}.routes.ts`, `middlewares/auth.middleware.ts`, service liên quan và `backend/prisma/schema.prisma`.
4. Kiểm tra các hạn chế admin theo đặc tả: tạo JD, upload CV, chạy matching phải bị chặn cả API và UI. Kiểm tra URL trực tiếp ngoài menu.
5. Theo dấu DTO của list/detail/leaderboard: không lộ passwordHash, tokenVersion, fileUrl, searchText, contentHash; list/leaderboard không có rawText. File gốc phải đi qua endpoint có auth và ownership, không static uploads.
6. Kiểm tra trạng thái khóa/tokenVersion trên mỗi request, lock/reset password làm phiên cũ mất hiệu lực, bảo vệ tài khoản quản trị theo đặc tả, và AiUsage còn lịch sử sau xóa tài khoản.

## Chạy kiểm tra an toàn

- Đọc setup của test trước khi chạy để biết có đụng DB hay provider thật. Các test liên quan nằm trong `backend/tests/`, route/UI test nằm trong `frontend/src/`.
- PowerShell: `npm.cmd --prefix backend test`, `npm.cmd --prefix frontend test`, `npm.cmd run build`. Không có script typecheck riêng ở package hiện tại; build đã gọi tsc, hãy mô tả chính xác lệnh đã chạy.
- Không gọi endpoint ghi dữ liệu trên DB thật để chứng minh 403/404. Dùng mock test hoặc môi trường test cách ly; HTTP dev chỉ đọc bằng phiên dev đã được cung cấp hợp lệ. Không in token, mật khẩu hoặc nội dung `.env` vào báo cáo.

## Báo cáo

Với từng yêu cầu, ghi ĐẠT / THIẾU / SAI / CHƯA XÁC MINH kèm `file:dòng`, test hoặc HTTP thực sự quan sát được. Khi không có test, ghi rõ "chưa có test"; code đúng chưa đồng nghĩa đã kiểm thử runtime.

Xếp vấn đề theo tác động: rò dữ liệu/vượt quyền trước, thiếu chức năng sau. Mỗi vấn đề có tình huống cụ thể, bằng chứng và đề xuất ngắn chưa áp dụng. Tách điều chưa xác minh và kết quả lệnh thất bại do môi trường khỏi lỗi sản phẩm.
