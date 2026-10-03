---
description: Thêm một trang frontend (từng trang một) khớp cấu trúc hiện có
---

1. Xác nhận trang cần làm và các endpoint nó dùng trong mục 5.5.2 của Chương 5 (và wireframe ở Chương 4).
2. Tạo `features/<feature>/api` (hàm gọi API qua `httpClient`) và kiểu dữ liệu dùng chung.
3. Tạo store Zustand theo feature nếu cần giữ bộ lọc/lựa chọn; tạo custom hook (ví dụ `useCandidates`, `useMatchingJob`).
4. Tạo component trình bày trong `features/<feature>/components`; tái dùng `ScoreBadge`, `EmptyState`, `ConfirmDialog` ở `shared/components`.
5. Tạo page ở `src/pages` và đăng ký route; chỉ thêm một mục vào router/navbar, không sửa trang khác.
6. Đảm bảo có trạng thái loading, rỗng, lỗi (toast tiếng Việt) và validate form bằng tiếng Việt.
7. Liệt kê các file đã thêm/sửa.
