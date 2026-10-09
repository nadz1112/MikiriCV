# ADR-08: JWT cookie và cô lập tenant

## Trạng thái

Đã chấp nhận.

## Quyết định

- Hai vai trò `ADMIN` và `ENTERPRISE`; không có tự đăng ký.
- Access JWT 15 phút và refresh JWT 7 ngày dùng secret khác nhau, chỉ được gửi qua cookie `httpOnly`, `SameSite=Lax`; refresh cookie giới hạn ở `/api/auth`. Production bắt buộc `COOKIE_SECURE=true`.
- Payload có `sub`, `role` và `tokenVersion`. Middleware xác thực chữ ký, hạn, trạng thái tài khoản và phiên bản token với PostgreSQL.
- Refresh xoay token version; đổi mật khẩu, đặt lại mật khẩu và khóa tài khoản thu hồi token cũ.
- Mọi request ghi yêu cầu `X-Requested-With: CVMikiri`; CORS chỉ cho phép origin trong `CORS_ORIGIN` và bật credentials.
- `JobDescription` và `Candidate` có `ownerId`. Enterprise luôn truy vấn theo owner ở service; ADMIN được xem tổng dữ liệu. Match result được bảo vệ qua owner của JD/Candidate.
- Tệp CV chỉ tải qua endpoint đã xác thực; không mount thư mục uploads công khai (ADR-06).

## Migration dữ liệu MVP

Migration `20261007000000_auth_tenant` tạo một bản ghi `legacy-owner@system.invalid` bị vô hiệu hóa, rồi gán các JD/CV cũ vào tài khoản đó trước khi đặt `ownerId` NOT NULL. Tài khoản ADMIN có thể xem các dữ liệu cũ; không doanh nghiệp nào tự nhận quyền sở hữu dữ liệu trước đó.

## Hệ quả

- Phải cấu hình hai JWT secret đủ dài trước khi backend khởi động; secret không được đưa vào frontend hoặc log.
- Cookie auth yêu cầu frontend gửi header CSRF tùy biến và request credentials.
- Lưu tệp hiện tại vẫn dùng filesystem cục bộ; triển khai nhiều instance cần shared storage.
