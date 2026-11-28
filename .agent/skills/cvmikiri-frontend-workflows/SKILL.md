---
name: cvmikiri-frontend-workflows
description: Fix CVMikiri React forms, dialogs, filters, role-specific pages, and asynchronous loading or background refresh. Use for UI behavior and state bugs, including canceled requests and stale data.
---

# Luồng frontend CVMikiri

Đọc page, component, hook, store và API caller của luồng cần sửa. Frontend có cả `features/*` và các `services`/`store` dùng chung; kiểm tra import thực tế để tránh sửa nhầm một bản không được dùng.

## Thành phần cần tái sử dụng

- Form tài khoản: `frontend/src/pages/admin/UsersPage.tsx`.
- Modal: `frontend/src/components/common/ModalPortal.tsx`; đọc props và test trước khi thêm dialog.
- Client API: `frontend/src/services/api.ts`; `shared/api/httpClient.ts` dùng lại client này. Không tạo interceptor refresh token riêng cho từng feature.
- Cập nhật nền: `frontend/src/shared/hooks/useAutoRefresh.ts`.
- Auth/role: `frontend/src/features/auth/`, route guard trong `frontend/src/App.tsx` và navbar trong `components/common/Navbar.tsx`.

## Quyết định khi sửa

- Giữ hành vi riêng của ADMIN và ENTERPRISE: ẩn thao tác không có quyền, kiểm tra URL trực tiếp, không dùng ẩn nút thay cho bảo vệ API. Khi sửa admin, kiểm tra luồng doanh nghiệp liên quan không đổi ngoài yêu cầu.
- Form sửa có dữ liệu ban đầu và lỗi tại trường. Mật khẩu hiện có là hash: chỉ hỗ trợ xem/ẩn mật khẩu mới đang nhập, không tìm cách lấy lại mật khẩu cũ từ API.
- Với form thuộc luồng chỉ đóng bằng dấu X, giữ chính sách đó cho backdrop/Escape theo ModalPortal; không đưa quy tắc đóng này vào mọi loại dialog nếu chưa đọc hành vi hiện có.
- Tách bản nháp khỏi dữ liệu nền. Polling không ghi đè nội dung đang nhập, bộ lọc, trang hoặc selection; kiểm tra lại selection sau khi xóa ứng viên để matching không dùng ID cũ.
- Cleanup request bằng AbortSignal; cancellation không tạo toast lỗi, refresh phiên hay màn hình lỗi. Ngăn response cũ ghi đè response mới khi thay query/range hoặc chuyển trang.
- Dùng hook refresh chung khi cần cập nhật admin. Giữ giới hạn request song song, dừng khi tab ẩn/offline và cleanup timer/listener; tránh polling trùng giữa page và hook.
- Phân biệt loading ban đầu, cập nhật nền, empty, lỗi thật và pending mutation. Chỉ tự đóng form sau khi thao tác thành công nếu luồng yêu cầu; lỗi giữ bản nháp để sửa/thử lại.

## Kiểm tra

Chọn test Vitest/Testing Library gần tính năng; kiểm tra hành vi nhìn thấy được, ưu tiên tương tác qua label/role. Với lỗi bất đồng bộ, mô phỏng request chậm, hủy hoặc focus bằng mock/fake timer khi cần. Kiểm tra cả hai role nếu thay điều kiện quyền.

- Test chọn lọc: `npm.cmd --prefix frontend test -- src/<duong-dan-test>.test.tsx`.
- Build/typecheck frontend: `npm.cmd --prefix frontend run build`.
- Chỉ khẳng định đã thử trình duyệt hoặc cập nhật giữa hai phiên thật nếu thực sự đã thực hiện.
