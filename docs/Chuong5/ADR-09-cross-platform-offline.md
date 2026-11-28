# ADR-09: Kiến trúc Đa nền tảng (PWA + Capacitor) và Ngoại tuyến (Offline-First)

## Trạng thái

Đã chấp nhận (Mở rộng sau MVP).

## Bối cảnh

Sau giai đoạn MVP Web SPA, CVMikiri cần hoạt động mượt mà trên cả trình duyệt máy tính, PWA cài đặt được và ứng dụng di động gốc (iOS/Android qua Capacitor), đồng thời duy trì khả năng xem và chuẩn bị tác vụ khi thiết bị mất kết nối mạng.

## Quyết định

1. **Một codebase giao diện duy nhất**:
   - Giữ `React 18 + Vite + TypeScript + Tailwind CSS` làm lõi cho Web, PWA (`manifest.webmanifest` + `sw.js`) và Mobile App (`capacitor.config.ts`).
   - Sử dụng `useIsMobileViewport()` (`max-width: 767px`) và `BottomNav` (ENTERPRISE: Tổng quan / JD / CV / AI Studio / Tài khoản; ADMIN: Tổng quan / Doanh nghiệp / Tài khoản) để chuyển đổi giữa bố cục Bảng nhiều cột trên Desktop và Thẻ dọc + Sheet trên điện thoại di động, bao gồm cả `AccountPage` (`/account`) và `CompaniesPage` (`/admin/companies`).
2. **Xác thực hai chế độ (Dual-Mode Auth)**:
   - Trình duyệt Web/PWA tiếp tục sử dụng hoàn toàn cookie `httpOnly`, `SameSite=Lax` (không lộ JWT trong JSON body).
   - Ứng dụng Native Mobile gửi `X-Client-Platform: mobile-native` để nhận cặp JWT qua TLS, lưu `accessToken` trong RAM và `refreshToken` trong Keychain/Keystore phần cứng qua `secureTokenStorage`, gửi `Authorization: Bearer <token>`. Backend vẫn kiểm tra đầy đủ `tokenVersion`, `isActive` và `mustChangePassword` với PostgreSQL.
3. **Lưu trữ & Bảo mật Ngoại tuyến (`IndexedDB`)**:
   - Toàn bộ dữ liệu cache (`jobs_cache`, `candidates_cache`, `dashboard_cache`, `leaderboards_cache`, `subscription_cache`, `personal_usage_cache`, `matching_draft`, `outbox_queue`) được phân vùng và kiểm tra chặt theo `userId`.
   - `candidates_cache` danh sách loại bỏ bắt buộc `rawText`, `searchText` và `fileUrl`.
   - Service Worker (`sw.js`) chỉ cache tài nguyên tĩnh App Shell, **bỏ qua tuyệt đối** mọi đường dẫn `/api/*` và `/uploads/*`.
   - Tệp CV gốc chỉ được lưu ngoại tuyến (`pinned_cvs`, tối đa 20 hồ sơ / 50MB, TTL 7 ngày) khi HR chủ động bấm **"Lưu xem ngoại tuyến"** trên từng ứng viên.
   - Khi đăng xuất, đổi mật khẩu hoặc nhận `401 UNAUTHENTICATED`, `resetWorkspace()` xóa sạch 100% dữ liệu `IndexedDB`, `secureTokenStorage` và tệp cache tạm.
4. **Hàng đợi Đồng bộ (`OutboxQueue`), Quản trị Thanh toán & AI Matching**:
   - Hỗ trợ xếp hàng Upload CV (`POST /api/candidates/upload` với `Idempotency-Key`) và Tạo/Sửa JD (`POST /api/jobs` với `Idempotency-Key`, `PUT /api/jobs/:id` với `X-Unmodified-Since` phát hiện xung đột `409 CONFLICT`) để tự đồng bộ khi có mạng lại.
   - Không giả lập điểm AI Matching ngoại tuyến: khi mất mạng, nút chạy Gemini AI, đổi mật khẩu và các thao tác ghi quản trị gói/token/đơn giá AI bị khóa kèm thông báo tiếng Việt, trong khi lựa chọn JD và ứng viên được giữ bền vững.
