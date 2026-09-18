# CHƯƠNG 4: THIẾT KẾ TRẢI NGHIỆM NGƯỜI DÙNG (UX/UI DESIGN)
## DỰ ÁN: CVMikiri

## 4.2 Bố cục Khung (Wireframing)

### 4.2.1 Chiến lược Wireframe
Wireframe được dựng ở mức **low-fidelity → mid-fidelity** (chưa gán màu thương hiệu, chỉ dùng khối xám và ký hiệu) để đội ngũ tập trung vào **cấu trúc thông tin (Information Hierarchy)** và **luồng thao tác**, trước khi chuyển sang giai đoạn High-fidelity Prototype ở mục 4.3.

Grid hệ thống: **Bố cục 12-cột**, sidebar cố định 240px (desktop), breakpoint responsive tại 768px (tablet) chuyển sidebar thành bottom-nav rút gọn.

### 4.2.2 Wireframe màn hình "Quản lý CV" (màn hình lõi, phức tạp nhất)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Logo CVMikiri]   Job Descriptions | Quản lý CV | AI Matching | Dashboard │
├──────────────────────────────────────────────────────────────────────────┤
│ JD đang chọn: ▾ [Senior Fullstack Developer            ]  (25 ứng viên)  │
├──────────────────────────────────────────────────────────────────────────┤
│ ╔═══════════════════ DROPZONE (kéo-thả) ══════════════════════════════╗ │
│ ║        ☁  Kéo thả file PDF/DOCX vào đây, hoặc bấm để chọn (≤10MB)   ║ │
│ ╚═══════════════════════════════════════════════════════════════════╝ │
│  [file1.pdf ▓▓▓▓▓▓▓░░ 70%] [file2.docx ✔] [file3.png ✖ sai định dạng]    │
│  [file4.pdf ✖ mất kết nối — Thử lại]                                    │
├──────────────────────────────────────────────────────────────────────────┤
│ 🔍[ Tìm từ khoá...      ]  Kỹ năng:▾[React,Node.js] Kinh nghiệm ≥[__]năm │
│                                                    Tìm thấy 12 ứng viên  │
├──────────────────────────────────────────────────────────────────────────┤
│ ☐ | Họ tên        | Email          | KN | Kỹ năng          | Điểm AI| ⋮ │
│ ─────────────────────────────────────────────────────────────────────── │
│ ☑ | Nguyễn Văn An  | an@mail.com    | 4  | [React][Node.js] |  85 🟢 | ⋮ │
│ ☑ | Trần Thị Bình  | binh@mail.com  | 2  | [React]          |  62 🟡 | ⋮ │
│ ☐ | Lê Hoàng C     | c@mail.com     | 1  | [Vue]            |   -    | ⋮ │
├──────────────────────────────────────────────────────────────────────────┤
│           ▓▓▓▓ Đã chọn 2 ứng viên — [ Chạy AI Matching ▶ ] ▓▓▓▓          │  ← Floating Action Bar
└──────────────────────────────────────────────────────────────────────────┘
```
**Ghi chú thiết kế:**
- Thanh Filter (FR3) **luôn dính (sticky)** ngay dưới Dropzone khi cuộn — vì đây là hành động lặp lại nhiều nhất trong phiên làm việc.
- Floating Action Bar chỉ xuất hiện khi `selectedCount > 0`, tránh chiếm diện tích khi chưa cần.
- Cột "Điểm AI" hiển thị badge màu theo đúng ngưỡng đã định nghĩa ở US-05 (🟢≥80 / 🟡50-79 / 🔴<50 / `-` chưa chấm).

> **Ghi chú mô hình dữ liệu (quan trọng)**: Wireframe trên minh hoạ màn hình với bối cảnh "JD đang chọn" ở đầu trang để thuận tiện thao tác Lọc → Chọn → AI Matching (đúng luồng 4.1.2). Tuy nhiên cần lưu ý: theo model Prisma ở 3.3.4, `Candidate` **không có khoá ngoại tới `JobDescription`** — một CV được tải lên là dữ liệu **toàn cục**, không thuộc riêng một JD nào; chỉ `MatchResult` mới gắn một Candidate với một JobDescription cụ thể (sau khi chạy AI Matching). Vì vậy: (1) selector "JD đang chọn" ở đầu trang chỉ đóng vai trò **ngữ cảnh làm việc tạm thời** để tiện chọn ứng viên đưa vào AI Matching, không phải bộ lọc thu hẹp danh sách Candidate theo JD; (2) số "(25 ứng viên)" cạnh JD nên hiểu là *số ứng viên đã có kết quả matching với JD này*, không phải "số CV thuộc JD này"; (3) màn hình Danh sách ứng viên toàn cục (không cần chọn JD trước) vẫn phải tồn tại độc lập, đúng theo FR5.1, để đáp ứng trường hợp HR upload/xem CV trước khi có JD phù hợp.

### 4.2.3 Wireframe "AI Insight Modal / Drawer" (chi tiết kết quả matching)

```
┌───────────────────────────────────────────┐
│  Nguyễn Văn An            [ x đóng ]       │
│  ─────────────────────────────────────    │
│         ╭───────────────╮                  │
│         │   Score: 85    │  (gauge/circle)  │
│         ╰───────────────╯                  │
│  Nhận xét AI:                               │
│  "Ứng viên có nền tảng vững chắc về..."     │
│  ─────────────────────────────────────    │
│  ✅ Kỹ năng khớp     |  ❌ Kỹ năng thiếu    │
│  [Node.js][TS][PG]   |  [Docker][Redis]     │
│  ─────────────────────────────────────    │
│  [ 📄 Xem CV gốc ]   [ 🗑 Xoá ứng viên ]     │
└───────────────────────────────────────────┘
```
**Ghi chú thiết kế:** Chia rõ 2 cột đối lập màu (xanh lá / đỏ nhạt) cho `matchedSkills` vs `missingSkills` — tận dụng nguyên lý **Gestalt về sự tương phản** giúp Hiring Manager quét thông tin trong < 5 giây, đúng mục tiêu của Persona 2 (3.1.2).

### 4.2.4 Wireframe "Dashboard / Bảng xếp hạng"

```
┌──────────────────────────────────────────────────────────────────┐
│  Bảng xếp hạng: Senior Fullstack Developer        [Xuất báo cáo]  │
├──────────────────────────────────────────────────────────────────┤
│ [Biểu đồ cột: phân bổ điểm  <50 | 50-70 | 70-85 | >85]  (Recharts)│
├──────────────────────────────────────────────────────────────────┤
│  #1  🟢 85  Nguyễn Văn An    Node.js, TS, PostgreSQL    [Xem >]   │
│  #2  🟡 62  Trần Thị Bình    React, TS                  [Xem >]   │
└──────────────────────────────────────────────────────────────────┘
```
> **Ghi chú khắc phục mâu thuẫn hợp đồng (bug-risk, đã sửa lại)**: Bản trước đổi bucket biểu đồ thành 3 nhóm `<50 / 50–79 / ≥80` để "khớp" badge, nhưng làm sai lệch với **hợp đồng FR5.5 và endpoint `GET /api/jobs/:id/stats` đã đặc tả** ở PRD Chương 3 (3.3.1), vốn trả về đúng **4 nhóm**: `Dưới 50`, `50-70`, `70-85`, `Trên 85`. Nếu chỉ sửa phía wireframe mà không sửa API thật, backend triển khai theo PRD sẽ trả 4 nhóm nhưng UI chỉ có chỗ hiển thị 3 nhóm → dữ liệu bị dồn sai hoặc mất mát khi vẽ biểu đồ.
>
> **Hướng xử lý đã chọn**: theo phương án *"giữ 4 nhóm trong wireframe và ánh xạ badge riêng"* — biểu đồ phân bố quay lại đúng 4 bucket theo hợp đồng API hiện có (**không cần sửa backend**), còn **badge màu của từng dòng ứng viên** (🟢≥80 / 🟡50-79 / 🔴<50) tiếp tục dùng đúng 3 ngưỡng đã định nghĩa ở US-05/4.2.2 — đây là **hai lớp thông tin độc lập phục vụ hai mục đích khác nhau**: biểu đồ mô tả phân bố tổng thể theo đúng response `stats`, badge mô tả xếp loại nhanh cho từng cá nhân theo đúng response `leaderboard`. Hai lớp này **không bắt buộc phải trùng khớp ranh giới** — ví dụ một CV điểm 82 sẽ rơi vào bucket biểu đồ "70-85" nhưng vẫn hiển thị badge 🟢 ở dòng riêng của nó; đây là hành vi được kỳ vọng (by design), cần được ghi chú rõ trong tài liệu bàn giao Frontend để tránh hiểu nhầm là lỗi hiển thị.

### 4.2.5 Nguyên tắc bố cục xuyên suốt
| Nguyên tắc | Áp dụng trong CVMikiri |
| :--- | :--- |
| **Progressive Disclosure** | Thông tin chi tiết (rawText, lịch sử matching) chỉ hiện trong Drawer, không làm rối bảng danh sách chính |
| **Ưu tiên vùng nhìn F-Pattern** | Cột quan trọng nhất (Họ tên, Điểm AI) đặt bên trái/giữa bảng, thao tác phụ (⋮) đặt cuối hàng |
| **Feedback tức thời** | Mọi hành động async (upload, filter, matching) đều có trạng thái loading/success/error riêng biệt, không dùng 1 spinner chung cho cả trang |
| **Empty state có hướng dẫn** | Khi chưa có JD/CV nào, hiển thị minh hoạ + CTA rõ ràng thay vì bảng trắng trơn |

> **Khuyến nghị theo dõi riêng**: Biểu đồ phân bố (4 bucket, đúng FR5.5/`GET /api/jobs/:id/stats`) và badge màu từng dòng (3 ngưỡng, đúng US-05) là **hai lớp thông tin độc lập, không cần và không nên gộp chung ngưỡng** — xem phân tích chi tiết tại 4.2.4. Không cần sửa FR5.5 hay endpoint `stats` hiện có; chỉ cần ghi rõ trong tài liệu bàn giao Frontend rằng đây là hai cách phân loại khác mục đích để tránh QA/Dev hiểu nhầm là lỗi.

---

