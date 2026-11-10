# Ghép dashboard vào nền FR2

## API và quyền truy cập

Các endpoint dưới đây yêu cầu phiên đăng nhập và giữ nguyên cookie JWT, CSRF của FR2.

| Endpoint | Hành vi |
| --- | --- |
| `GET /api/dashboard/stats` | Tổng JD, CV, lượt đánh giá, tỷ lệ đạt từ 70 điểm, điểm trung bình và 5 đánh giá mới nhất. |
| `GET /api/jobs/:id/stats` | Thống kê và 4 nhóm điểm của JD được phép truy cập: dưới 50, 50–70, 71–85, trên 85. |
| `GET /api/matching/leaderboard/:jobDescriptionId` | Bảng xếp hạng theo JD, chỉ trả DTO ứng viên gọn. |
| `GET /api/candidates/:id` | Chi tiết ứng viên gồm văn bản trích xuất và kết quả matching được phép xem; không trả đường dẫn lưu trữ, searchText hay contentHash. |
| `DELETE /api/candidates/:id` | Xóa bản ghi thuộc phạm vi truy cập, cascade kết quả matching, rồi dọn file bên trong UPLOAD_DIR. File không tồn tại không làm thất bại thao tác xóa DB. |

ADMIN xem dữ liệu toàn hệ thống. ENTERPRISE xem CV có `ownerId` là tài khoản hiện tại và JD có cả `ownerId`, `createdById` là tài khoản hiện tại. Thống kê, leaderboard và kết quả matching trong chi tiết CV lọc cả phía ứng viên lẫn JD; không tổng hợp điểm của tài khoản khác. Tài nguyên ngoài phạm vi trả 404. ID mới được kiểm tra UUID.

Dashboard dùng DTO danh sách FR2, tìm kiếm phía server và phân trang 20 hồ sơ/trang. Tổng thống kê lấy từ API tổng hợp, không đếm số bản ghi của trang hiện tại. Sau xóa, dashboard tải lại thống kê, biểu đồ và danh sách; nếu trang cuối hết dữ liệu thì trở về trang hợp lệ. Drawer lấy văn bản khi mở chi tiết; xem file qua `/api/candidates/:id/file` có kiểm tra quyền. Luồng upload, `Idempotency-Key`, trạng thái extraction và tải file của FR2 được giữ nguyên.

## Rà soát migration

Tích hợp này **không sửa schema và không thêm/sửa migration FR2**. Dashboard chỉ đọc các bảng hiện có; không cần migration riêng.

Kết quả kiểm tra chỉ đọc trên database local trong phiên tích hợp:

- Database: `mikiricv`, schema `public`, `localhost:5432`.
- Database ghi nhận migration `20261101125738_y` của nhánh dashboard.
- Repo FR2 chứa `20261006000000_init`, `20261007000000_auth_tenant`, `20261013093705_add_job_created_by`, `20261020000000_candidates_fr2`, `20261031144310_add_trgm_index`.
- `prisma migrate status` báo không có migration chung. Chưa chạy migrate, reset, db push hay migrate resolve.
- Preflight xác nhận database local hiện có 0 JD, 0 CV, 0 kết quả matching và chưa có bảng users/idempotency_keys. Backend FR2 sẽ chưa chạy đầy đủ trên database này cho đến khi schema/lịch sử được đối soát.

Database này **chưa sẵn sàng chạy chuỗi migration FR2 trực tiếp**: migration init sẽ tạo lại các bảng đã có. `prisma generate` chỉ tạo client, không cập nhật database.

### Database đã dùng lịch sử FR2

Chạy `npm run prisma:preflight` và `npm --prefix backend exec -- prisma migrate status`. Nếu lịch sử khớp và tất cả migration đã áp dụng, chỉ cần `npm run prisma:generate` rồi khởi động ứng dụng. Không cần tạo migration dashboard.

### Database đã dùng lịch sử dashboard hoặc lịch sử khác

1. Sao lưu PostgreSQL và thư mục UPLOAD_DIR, kiểm tra khả năng khôi phục trên bản sao riêng. Lưu lại lịch sử `_prisma_migrations`, số bản ghi và quan hệ CV/JD/matching trước khi đối soát.
2. Trên bản sao, so sánh cấu trúc thật với init FR2 trước khi lập phương án baseline. Migration dashboard cho phép NULL ở các mảng `requiredSkills`, `skills`, `matchedSkills`, `missingSkills`, trong khi SQL init FR2 yêu cầu NOT NULL. Cần kiểm tra dữ liệu NULL và xử lý rõ ràng trước khi coi hai schema tương đương.
3. Lập phương án chuyển lịch sử migration hoặc chuyển dữ liệu sang database FR2 mới. Không đánh dấu 5 migration là đã áp dụng khi bảng/cột chưa tồn tại. Không đổi/xóa các migration đã được dùng ở môi trường FR2 chỉ để làm local hết báo lệch.
4. Migration auth gán CV/JD cũ cho tài khoản hệ thống `legacy-system-owner` bị vô hiệu hóa. Migration người tạo để `createdById` của JD cũ là NULL; migration FR2 để `searchText` cũ là chuỗi rỗng. Phải lập ánh xạ chủ sở hữu/người tạo và backfill searchText bằng cùng `normalizeForSearch()` của ứng dụng; không tự cấp toàn bộ hồ sơ cũ cho một doanh nghiệp. ADMIN vẫn có thể xem hồ sơ cũ.
5. Kiểm tra quyền tạo extension `pg_trgm`. Xác nhận các đường dẫn file cũ vẫn nằm trong UPLOAD_DIR và có file tương ứng. Không di chuyển hoặc xóa tệp nguồn trước khi kiểm tra hoàn tất.
6. Kiểm tra số bản ghi, foreign key/cascade, đăng nhập và cách ly dữ liệu giữa hai doanh nghiệp trên bản sao. Chỉ áp dụng kế hoạch đã kiểm chứng lên database thật sau khi có backup và lịch sử migration thống nhất.

`npm run prisma:preflight` chỉ đọc lịch sử, bảng/cột và số lượng dữ liệu; không tự baseline hoặc áp dụng migration. Phần đối soát database thật còn cần thực hiện riêng theo kết quả kiểm tra, không được thay bằng `prisma migrate reset`.

## Kiểm tra

- TypeScript/build backend và frontend.
- Test HTTP kiểm tra phiên đăng nhập, phạm vi tenant/admin, chi tiết, xóa, DTO leaderboard và các mốc điểm 49/50/70/71/85/86/100.
- Test frontend kiểm tra tổng thống kê, phân trang, tìm kiếm server, tải chi tiết, endpoint file và tải lại dữ liệu sau xóa.
- Giữ các test đăng nhập/phân quyền có sẵn của FR2.

Các test dùng database mock; không thay thế kiểm thử migration trên bản sao PostgreSQL có dữ liệu thật. Cơ chế matching/Gemini có sẵn của FR2 không được viết lại trong tích hợp này.

## File bàn giao

Thêm:

- `backend/src/modules/dashboard/dashboard.repository.ts`
- `backend/src/services/dashboard.service.ts`
- `backend/src/controllers/dashboard.controller.ts`
- `backend/src/routes/dashboard.routes.ts`
- `backend/scripts/migration-preflight.mjs`
- `backend/tests/dashboard-access.test.ts`
- `frontend/src/components/dashboard/CandidateInsightDrawer.tsx`
- `frontend/src/components/dashboard/DeleteConfirmModal.tsx`
- `frontend/src/components/dashboard/ScoreDistributionChart.tsx`
- `frontend/src/services/dashboardApi.ts`
- `frontend/src/pages/DashboardPage.test.tsx`
- `docs/dashboard-fr2-integration.md`

Sửa:

- `backend/src/modules/candidates/candidate.repository.ts`
- `backend/src/services/candidate.service.ts`
- `backend/src/services/job.service.ts`
- `backend/src/controllers/candidate.controller.ts`
- `backend/src/controllers/matching.controller.ts`
- `backend/src/routes/index.ts`
- `backend/src/routes/candidate.routes.ts`
- `backend/src/routes/job.routes.ts`
- `backend/src/routes/matching.routes.ts`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/components/common/Navbar.tsx`
- `frontend/src/services/candidateApi.ts`
- `frontend/src/services/jobApi.ts`
- `frontend/src/types/index.ts`
- `frontend/src/features/candidates/components/FilterBar.tsx` (bỏ import không dùng để TypeScript build được)
- `backend/package.json`, `package.json`, `README.md`
