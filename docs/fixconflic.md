Mình đã đọc mã nguồn và so sánh nhánh hiện tại feature/dashboard với feature/fr2-upload-cv.

Hai nhánh phát triển theo hai hướng khác nhau; feature/dashboard chưa bao gồm các chức năng mới của FR2.

1. Quan hệ giữa hai nhánh
- Nhánh hiện tại: feature/dashboard — commit 3ddb039.
- Nhánh đối chiếu: feature/fr2-upload-cv — commit 1e8ddf4.
- Hai nhánh có 4 commit riêng phía dashboard, 15 commit riêng phía FR2.
- So sánh hai đầu nhánh: 108 file khác nhau, 3.461 dòng thêm và 8.709 dòng bớt theo chiều FR2 → dashboard. Đây là khác biệt giữa hai nhánh, không có nghĩa dashboard chủ động xóa toàn bộ phần đó.
Kết quả dựa trên các ref đang có trong máy, chưa fetch remote.

2. Tổng quan dự án

Dự án là hệ thống sàng lọc CV theo JD:
- Frontend: React, TypeScript, Vite, Tailwind, Zustand.
- Backend: Express, TypeScript, Prisma.
- Dữ liệu: PostgreSQL.
- Xử lý CV: đọc PDF/DOCX, trích thông tin bằng quy tắc.
- Matching: gửi nội dung CV và JD sang Gemini, lưu điểm và nhận xét.
3. Khác biệt chức năng
Hạng mục	feature/dashboard hiện tại	feature/fr2-upload-cv
Dashboard	Thống kê tổng, biểu đồ phân bố điểm, leaderboard theo JD, drawer xem nhận xét AI	Dashboard cơ bản hơn
API thống kê	Thêm /api/dashboard/stats và /api/jobs/:id/stats	Chưa có hai API này
Đăng nhập, tài khoản	Chưa có luồng đăng nhập và bảo vệ route	Có JWT qua cookie, đổi mật khẩu, quản trị tài khoản
Phân quyền dữ liệu	Truy vấn dữ liệu chung	Có ADMIN/ENTERPRISE và phạm vi dữ liệu theo tài khoản
Upload CV	Upload nhiều file, đọc và lưu trực tiếp	Thêm kiểm tra MIME/chữ ký file, trạng thái trích xuất và cơ chế gửi lại request
Chống tạo trùng khi retry	Chưa có	Dùng Idempotency-Key để trả lại kết quả request đã xử lý
Lọc ứng viên	Từ khóa, kỹ năng theo kiểu “có ít nhất một”, kinh nghiệm	Thêm chuẩn hóa tìm kiếm không dấu, kỹ năng any/all, trạng thái trích xuất, phân trang, sắp xếp
Xem file CV	Phục vụ trực tiếp qua /uploads	Qua endpoint kiểm tra quyền /api/candidates/:id/file
Chi tiết/xóa ứng viên	Có route GET chi tiết và DELETE	Router candidates chưa khai báo hai route này
Kiểm thử	Không có script test trong package hiện tại	Có Vitest và một số test auth/tenant, frontend


Phần dashboard mới nằm chủ yếu ở DashboardPage.tsx, dashboard.service.ts và job.service.ts (line 36).

4. Khác biệt schema và API cần chú ý

Schema hiện tại chỉ có JobDescription, Candidate, MatchResult. FR2 có thêm:
- User, vai trò tài khoản và các quan hệ sở hữu/người tạo/người upload.
- ExtractionStatus: SUCCESS, WARNING, FAILED.
- searchText, extractionMessage, contentHash.
- IdempotencyKey và các index phục vụ tìm kiếm.
Hai nhánh cũng có lịch sử migration khác nhau, nên không thể chỉ sao chép giao diện rồi dùng nguyên backend/schema hiện tại.

Một số điểm không tương thích khi ghép:
- Dashboard gọi API chi tiết và xóa ứng viên; FR2 chưa có route tương ứng.
- Dashboard cần rawText cho drawer; danh sách ứng viên FR2 dùng DTO gọn và không trả trường này.
- Dashboard hiện tải toàn bộ ứng viên; FR2 trả danh sách phân trang kèm total, page, limit.
- API thống kê dashboard hiện đếm dữ liệu toàn hệ thống, chưa nhận người dùng để lọc theo quyền.
- Upload dashboard chưa gửi Idempotency-Key, trong khi FR2 yêu cầu header này.
Có thể xem luồng hiện tại tại candidate.service.ts và candidate.routes.ts.

5. Nhận xét và hướng ghép

Nếu mục tiêu là kết hợp hai nhánh, mình đề xuất lấy FR2 làm nền, đưa phần dashboard sang, vì FR2 đã có nền tảng tài khoản, phân quyền và xử lý CV đầy đủ hơn. Khi đó cần:
1. Thêm API thống kê có lọc theo quyền tài khoản.
2. Bổ sung API chi tiết/xóa ứng viên với kiểm tra quyền.
3. Điều chỉnh dashboard theo DTO và phân trang FR2.
4. Giữ cơ chế upload, idempotency và truy cập file của FR2.
5. Rà soát migration trước khi áp dụng lên database đang có dữ liệu.