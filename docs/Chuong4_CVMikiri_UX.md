# CHƯƠNG 4: THIẾT KẾ TRẢI NGHIỆM NGƯỜI DÙNG (UX/UI DESIGN)
## DỰ ÁN: CVMikiri — HỆ THỐNG KIỂM TRA, SÀNG LỌC VÀ CHẤM ĐIỂM CV THÔNG MINH

> Chương này kế thừa trực tiếp phạm vi sản phẩm (3.2.2), các Yêu cầu chức năng FR1–FR5 và User Stories US-01 → US-06 đã xác lập ở Chương 3, cụ thể hoá thành: (4.1) Luồng người dùng chi tiết cho từng tác vụ, (4.2) Bố cục khung màn hình (wireframe) mức low-fidelity, (4.3) Quy trình dựng bản mẫu tương tác (prototype), và (4.4) Quy trình dùng AI để tự đánh giá và tinh chỉnh thiết kế trước khi bàn giao cho Frontend Developer.

---

## 4.1 Luồng Người dùng (User Flow)

### 4.1.1 Nguyên tắc thiết kế luồng
Toàn bộ luồng người dùng của CVMikiri được thiết kế theo nguyên tắc **"Lọc rẻ trước — Chấm AI sau"** (Two-tier Hybrid Screening đã nêu ở 3.1.3), nhằm đảm bảo:
* Người dùng luôn thao tác trên **tập ứng viên đã được thu hẹp** trước khi tốn chi phí gọi AI.
* Không có bước nào là "ngõ cụt" (dead-end) — mỗi màn hình luôn có lối ra rõ ràng (quay lại, tiếp tục, hoặc CTA chính).
* Trạng thái lỗi (file sai định dạng, AI timeout, JD trống) đều được xử lý ngay tại bước phát sinh, không đẩy người dùng ra khỏi luồng.

### 4.1.2 Luồng tổng quan cấp cao (Master Flow)

```mermaid
flowchart TD
    A([Truy cập CVMikiri]) --> B{Đã có JD nào chưa?}
    B -- Chưa có --> C[Màn hình Job Descriptions rỗng]
    C --> D[US-01: Tạo JD mới]
    B -- Đã có --> E[Danh sách JD]
    D --> E
    E --> F[Chọn 1 JD làm ngữ cảnh làm việc]
    F --> G[Màn hình Quản lý CV của JD đó]
    G --> H{Đã có CV chưa?}
    H -- Chưa --> I[US-02: Kéo-thả Upload CV]
    H -- Rồi --> J[US-03: Áp Bộ lọc Rule-based]
    I --> J
    J --> K[Chọn tập ứng viên qua checkbox]
    K --> L[US-04: Bấm 'Chạy AI Matching']
    L --> M[Theo dõi tiến trình xử lý theo lô]
    M --> N[US-05: Xem Bảng xếp hạng / Dashboard]
    N --> O{Ra quyết định}
    O -- Phù hợp --> P[Giữ ứng viên trong Bảng xếp hạng, tiến hành liên hệ mời phỏng vấn ngoài hệ thống]
    O -- Chưa đạt --> Q[US-06: Xoá ứng viên không phù hợp]
    O -- Cần xem thêm --> N
    P --> R([Kết thúc phiên làm việc])
    Q --> N
```
> **Ghi chú phạm vi (đã hiệu chỉnh)**: Nhánh "Phù hợp" ở bản trước dẫn tới hành động "Đánh dấu / Xuất danh sách mời phỏng vấn" — đây là chức năng **chưa được định nghĩa** ở bất kỳ FR nào trong phạm vi MVP (3.2.2.A) và cũng không có API endpoint tương ứng ở 3.5.2. Để tránh Frontend triển khai một CTA không có backend contract, Master Flow chỉ dừng ở việc **giữ nguyên ứng viên trong Bảng xếp hạng** (hành vi mặc định, không cần thêm FR) — việc liên hệ mời phỏng vấn được thực hiện ngoài hệ thống ở giai đoạn MVP. Chức năng "Đánh dấu / Shortlist" và "Xuất báo cáo Excel/PDF" đã được đặt đúng chỗ trong roadmap mở rộng (Wave 1: Shortlist management; Wave 3: Export) và **cần được bổ sung FR, API, định dạng xuất, cùng trạng thái lỗi tương ứng** trước khi đưa vào bất kỳ luồng thiết kế nào ở các phiên bản sau.

### 4.1.3 Luồng chi tiết theo từng User Story

#### a) Luồng FR1 / US-01 — Tạo, Xem, Sửa & Xoá JD
> **Ghi chú phạm vi**: FR1 không chỉ dừng ở tạo mới (FR1.1) mà còn bắt buộc phải có xem danh sách/chi tiết (FR1.2), xoá (FR1.3) và sửa (FR1.4). Luồng dưới đây bổ sung đầy đủ các nhánh Xem — Sửa — Xoá còn thiếu, để bản thiết kế cung cấp đủ hành vi cần triển khai và kịch bản QA tương ứng với các Gherkin Scenario ở US-01 (bao gồm cả kịch bản "Xoá JD đã có MatchResult").

```mermaid
flowchart TD
    A[Màn hình Danh sách JD] --> B[Nhấn 'Tạo JD mới']
    B --> C[Mở Modal/Form JD - chế độ Tạo mới]
    C --> D[Nhập Tiêu đề, Mô tả, Kỹ năng, Kinh nghiệm tối thiểu]
    D --> E{Validate Zod phía Client}
    E -- Lỗi --> F[Hiển thị inline error dưới từng trường]
    F --> D
    E -- Hợp lệ --> G[POST /api/jobs]
    G --> H{Server phản hồi}
    H -- 201 --> I[Toast thành công + Đóng modal + Prepend vào danh sách]
    H -- 4xx/5xx --> J[Toast lỗi tiếng Việt + Giữ nguyên dữ liệu form]

    A --> K[Click vào 1 dòng JD]
    K --> L[Mở Trang/Drawer Chi tiết JD: Tiêu đề, Mô tả đầy đủ, Kỹ năng, Số ứng viên đã gắn]
    L --> M{Chọn hành động}
    M -- Sửa --> N[Mở Modal JD - chế độ Sửa, prefill dữ liệu cũ]
    N --> O{Validate Zod phía Client}
    O -- Lỗi --> P[Hiển thị inline error]
    P --> N
    O -- Hợp lệ --> Q[PUT /api/jobs/:id]
    Q --> R{Server phản hồi}
    R -- 200 --> S[Toast 'Cập nhật JD thành công' + Đóng modal + Cập nhật dòng trong danh sách]
    R -- 4xx/5xx --> T[Toast lỗi + Giữ nguyên dữ liệu form]

    M -- Xoá --> U[Modal xác nhận: hiển thị số MatchResult sẽ bị xoá cascade nếu có]
    U -- Huỷ --> L
    U -- Xác nhận --> V[DELETE /api/jobs/:id]
    V --> W{Server phản hồi}
    W -- 200 --> X[Toast 'Đã xoá JD và các kết quả matching liên quan' + Đóng Drawer + Xoá khỏi danh sách]
    W -- 4xx/5xx --> Y[Toast lỗi, không đóng Drawer, giữ nguyên dữ liệu]
```
* **Điểm chạm cảm xúc (Emotional touchpoint)**: Toast "Tạo Job Description thành công" xuất hiện góc phải dưới, tự ẩn sau 3s, không chặn thao tác tiếp theo — giữ nhịp làm việc liên tục cho HR đang xử lý nhiều JD cùng lúc.
* **Ràng buộc QA quan trọng**: Modal xác nhận xoá JD **phải hiển thị rõ số lượng `MatchResult` sẽ bị cascade xoá** trước khi người dùng bấm xác nhận, đúng theo Gherkin "Xóa Job Description và các kết quả liên quan" (3.4/US-01) — tránh xoá nhầm dữ liệu chấm điểm đã tốn chi phí AI.
* Nhánh Sửa (FR1.4) tái sử dụng cùng Modal/Form với nhánh Tạo, chỉ khác ở việc prefill dữ liệu và gọi `PUT` thay vì `POST` — giúp giảm chi phí phát triển UI trùng lặp.

#### b) Luồng FR2 / US-02 — Upload & Trích xuất CV hàng loạt
> **Ghi chú rủi ro lỗi (bug risk) đã khắc phục**: Bản luồng trước chỉ xử lý lỗi validate phía client (sai định dạng/quá dung lượng) và lỗi trích xuất phía backend, nhưng **bỏ sót nhánh khi chính request `POST upload` thất bại** — do mất mạng, timeout, hoặc server trả 4xx/5xx trước khi kịp xử lý file. Khi đó một file đang ở trạng thái `uploading` sẽ không có lối chuyển tiếp, khiến progress bar treo vô thời hạn — vi phạm nguyên tắc "mỗi file là một đơn vị trạng thái độc lập". Sơ đồ dưới đây bổ sung trạng thái `failed` cho riêng lỗi request, kèm khả năng retry theo từng file.

```mermaid
flowchart TD
    A[Kéo-thả hoặc Click chọn nhiều file] --> B[Client kiểm tra nhanh: đuôi file + dung lượng]
    B -- File không hợp lệ --> C[failed - Đánh dấu đỏ ngay trong danh sách, lý do: 'Sai định dạng/Quá 10MB', KHÔNG gửi lên server]
    B -- File hợp lệ --> D[pending → Thêm vào hàng đợi upload]
    D --> E[uploading → hiển thị progress bar riêng từng file]
    E --> F[POST /api/candidates/upload theo lô]
    F --> G{Request có hoàn tất được không?}
    G -- Mất mạng/Timeout --> H[failed - 'Mất kết nối, chưa gửi được file' + nút Thử lại]
    G -- 4xx/5xx từ server --> I[failed - Hiển thị thông báo lỗi tiếng Việt cụ thể theo response + nút Thử lại]
    G -- 2xx thành công --> J[Backend: pdf-parse / mammoth trích xuất text]
    J --> K{Trích xuất thành công?}
    K -- Có --> L[parsed → Regex bóc tách Họ tên/Email/SĐT/Kinh nghiệm/Kỹ năng]
    K -- Lỗi/PDF scan --> M[warning → Gắn cờ cảnh báo 'Không đọc được nội dung']
    L --> N[Lưu Candidate vào DB]
    M --> N
    N --> O[Cập nhật icon tick xanh / cảnh báo vàng cho từng file trong UI]
    H -- Bấm 'Thử lại' --> D
    I -- Bấm 'Thử lại' --> D
    O --> P[Toast tổng kết: 'Đã xử lý N/M hồ sơ thành công, X thất bại']
    H --> P
    I --> P
```
* **Máy trạng thái từng file (per-file state machine)**: `pending → uploading → (parsed | warning | failed)`. Trạng thái `failed` được tách riêng theo 2 nguồn gốc (validate client vs. lỗi request/network) để thông báo đúng nguyên nhân, nhưng đều dẫn tới cùng một hành vi phục hồi: **nút "Thử lại" cho riêng file đó**, không bắt người dùng upload lại toàn bộ lô.
* **Nguyên tắc UX quan trọng**: mỗi file trong hàng đợi là một **đơn vị trạng thái độc lập**, tránh tình huống 1 file lỗi (dù lỗi định dạng, lỗi trích xuất, hay lỗi mạng/server) làm treo hoặc chặn toàn bộ lô 50 file.
* **Ràng buộc QA bổ sung**: Toast tổng kết ở bước cuối phải phản ánh đúng cả số lượng **thất bại do request** lẫn thất bại do định dạng/trích xuất (vd: "Đã xử lý 42/50 hồ sơ thành công, 8 thất bại") — tránh việc chỉ đếm theo FR2.6 (báo lỗi định dạng) mà bỏ sót lỗi tầng network.

#### c) Luồng FR3 / US-03 — Lọc Rule-based (real-time, < 100ms)
```mermaid
flowchart LR
    A[Người dùng gõ từ khoá / chọn kỹ năng / kéo slider kinh nghiệm] --> B[Debounce 200-300ms]
    B --> C[Áp dụng filter tại chỗ trên state đã tải/gọi GET có query]
    C --> D[Cập nhật bảng dữ liệu + đếm 'Tìm thấy N ứng viên phù hợp']
    D --> E{Người dùng chọn checkbox ứng viên}
    E --> F[Thanh hành động nổi (Floating Action Bar) xuất hiện: 'Đã chọn N ứng viên — Chạy AI Matching']
```
* Vì FR3 không tốn phí AI, giao diện phải phản hồi **tức thời** — không hiển thị spinner cho thao tác lọc, chỉ debounce nhẹ để tránh gọi API dồn dập khi gõ nhanh.

#### d) Luồng FR4 / US-04 — AI Matching (Gemini/Claude)
> **Ghi chú khắc phục 2 vấn đề đã phát hiện ở 4.4.5**: (1) bổ sung thao tác **Dừng/Huỷ giữa chừng** ngay sau khi batch bắt đầu chạy, để không lãng phí token khi người dùng chọn nhầm một lô lớn (đúng NFR3/Mục tiêu 3 — tối ưu chi phí AI); (2) sửa lại thông báo tổng kết để **phản ánh đúng số lượng thành công/thất bại thực tế**, thay vì luôn báo "N/N" ngay cả khi có ứng viên rơi vào nhánh lỗi sau retry.

```mermaid
flowchart TD
    A[Floating Action Bar: 'Chạy AI Matching cho N ứng viên'] --> B[Modal xác nhận: hiện JD đang chọn + số CV + ước tính thời gian]
    B --> C[Xác nhận chạy]
    C --> D[Backend chia batch 3-5 CV/lượt để tránh Rate Limit]
    D --> E["UI hiển thị trạng thái từng dòng: 'Đang phân tích...' + nút 'Dừng' thay thế nút 'Chạy AI Matching'"]
    E --> F{Người dùng bấm 'Dừng'?}
    F -- Có --> G[Ngừng enqueue các CV chưa được gửi batch, đánh dấu 'Đã huỷ'; các batch đang chạy dở vẫn được hoàn tất bình thường]
    F -- Không --> H{Kết quả từng CV trả về}
    H -- Thành công --> I[Cập nhật cột Điểm AI + badge màu ngay dòng đó; +1 vào success_count]
    H -- Lỗi JSON / Timeout --> J[Retry tự động tối đa 2 lần]
    J --> H
    J -- Vẫn lỗi sau retry --> K["Badge 'Lỗi phân tích' + nút 'Thử lại thủ công'; +1 vào failed_count"]
    G --> L[Tổng hợp: success_count / failed_count / cancelled_count]
    I --> L
    K --> L
    L --> M{failed_count > 0 hoặc cancelled_count > 0?}
    M -- Không --> N["Toast: 'Hoàn tất đánh giá N/N ứng viên'"]
    M -- Có --> O["Toast: 'Đã đánh giá success_count/tổng; failed_count hồ sơ lỗi, cancelled_count đã huỷ' + nút 'Thử lại các hồ sơ lỗi'"]
```
* **Thiết kế chống chờ đợi vô nghĩa**: vì việc chấm điểm hàng loạt có thể mất 10-30 giây, UI cập nhật **theo từng dòng** ngay khi có kết quả (progressive rendering) thay vì bắt người dùng nhìn một spinner toàn màn hình.
* **Thao tác Dừng/Huỷ (Critical fix)**: nút "Dừng" chỉ ngăn các CV **chưa được đưa vào batch** — các CV thuộc batch đang gọi API dở dang vẫn hoàn tất để tránh trạng thái nửa vời khó xử lý phía backend. Giao diện cần phân biệt rõ 3 trạng thái cuối cùng của một ứng viên sau khi dừng: đã chấm xong (thành công/lỗi) hoặc "Đã huỷ" (chưa kịp gọi AI).
* **Toast tổng kết chính xác (bug-risk fix)**: không còn cố định là "N/N" — công thức hiển thị luôn dựa trên `success_count`, `failed_count`, `cancelled_count` thực tế, ví dụ: *"Đã đánh giá 8/10; 2 hồ sơ lỗi"* hoặc *"Đã đánh giá 6/10; 3 hồ sơ lỗi, 1 đã huỷ"*. Nút "Thử lại các hồ sơ lỗi" cho phép gom chạy lại đồng thời tất cả CV đang ở trạng thái lỗi mà không cần chọn lại thủ công từng dòng.

#### e) Luồng FR5 / US-05, US-06 — Dashboard, Chi tiết & Xoá
```mermaid
flowchart TD
    A[Vào Bảng xếp hạng của 1 JD] --> B[Danh sách sắp xếp giảm dần theo score]
    B --> C[Click vào 1 ứng viên]
    C --> D[Mở Drawer chi tiết: Summary AI + Matched/Missing skills + xem lại file gốc]
    D --> E{Hành động tiếp theo}
    E -- Đóng --> B
    E -- Xoá ứng viên --> F[Modal xác nhận cảnh báo: sẽ xoá N MatchResult liên quan]
    F -- Huỷ --> D
    F -- Xác nhận --> G[DELETE /api/candidates/:id]
    G --> H[Xoá file vật lý + cascade DB]
    H --> I[Toast xác nhận + Cập nhật lại danh sách + Drawer tự đóng]
```

### 4.1.4 Bảng ánh xạ Luồng ↔ Màn hình ↔ FR
| Luồng | Màn hình chính | FR liên quan | Trạng thái lỗi cần xử lý |
| :--- | :--- | :--- | :--- |
| Tạo/Xem/Sửa/Xoá JD | `Job Descriptions` + Chi tiết JD | FR1 | Thiếu trường bắt buộc, trùng tiêu đề, lỗi khi PUT/DELETE, xoá JD đang có MatchResult |
| Upload CV | `Quản lý CV` (Dropzone) | FR2 | Sai định dạng, quá 10MB, file scan không đọc được, **mất mạng/timeout/4xx-5xx khi gửi request upload** |
| Lọc CV | `Quản lý CV` (Filter Bar) | FR3 | Không có kết quả khớp |
| AI Matching | `AI Matching Studio` | FR4 | Rate limit 429, JSON lỗi định dạng, **người dùng bấm Dừng giữa batch**, toast tổng kết phải phản ánh đúng số thành công/thất bại/đã huỷ |
| Dashboard/Chi tiết | `Bảng xếp hạng (Dashboard)` | FR5 | Chưa có ứng viên nào được chấm điểm |

---

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
│  [Biểu đồ cột: phân bổ điểm  <50 | 50–79 | ≥80]         (Recharts)│
├──────────────────────────────────────────────────────────────────┤
│  #1  🟢 85  Nguyễn Văn An    Node.js, TS, PostgreSQL    [Xem >]   │
│  #2  🟡 62  Trần Thị Bình    React, TS                  [Xem >]   │
└──────────────────────────────────────────────────────────────────┘
```
> **Ghi chú đồng bộ ngưỡng (đã sửa)**: Bản trước dùng bucket biểu đồ `<50 | 50-70 | 70-85 | >85`, khác với ngưỡng badge `🟢≥80 / 🟡50-79 / 🔴<50` đã định nghĩa ở US-05 và mục 4.2.2 — khiến điểm 70–85 vừa nằm trong 1 bucket biểu đồ chung nhưng lại thuộc 2 màu badge khác nhau (🟡 nếu <80, 🟢 nếu ≥80), không thể biểu diễn nhất quán trên cùng dashboard. Biểu đồ nay dùng **đúng 3 ngưỡng như badge**: `<50`, `50–79`, `≥80`, đảm bảo một điểm số luôn thuộc về đúng một bucket và một màu badge duy nhất ở mọi nơi trong UI.
>
> **Ghi chú đồng bộ dữ liệu mẫu (đã sửa)**: Bản trước đưa "Lê Hoàng C" (đang hiển thị `-` — chưa chấm điểm — ở wireframe 4.2.2) vào hạng #1 với điểm 88 tại đây, khiến hai màn hình mock cùng lúc thể hiện một ứng viên vừa "chưa có kết quả" vừa "đã có kết quả". Dữ liệu mẫu ở Dashboard nay chỉ lấy từ đúng 2 ứng viên **đã được chấm điểm** trong ví dụ ở 4.2.2 (Nguyễn Văn An, Trần Thị Bình), để hai wireframe phản ánh cùng một trạng thái dữ liệu nhất quán. Nếu cần minh hoạ trạng thái "sau khi chấm thêm", phải ghi rõ đây là **snapshot khác thời điểm** (trước/sau khi chạy AI Matching), không dùng chung một bộ mock ngầm định là cùng lúc.

### 4.2.5 Nguyên tắc bố cục xuyên suốt
| Nguyên tắc | Áp dụng trong CVMikiri |
| :--- | :--- |
| **Progressive Disclosure** | Thông tin chi tiết (rawText, lịch sử matching) chỉ hiện trong Drawer, không làm rối bảng danh sách chính |
| **Ưu tiên vùng nhìn F-Pattern** | Cột quan trọng nhất (Họ tên, Điểm AI) đặt bên trái/giữa bảng, thao tác phụ (⋮) đặt cuối hàng |
| **Feedback tức thời** | Mọi hành động async (upload, filter, matching) đều có trạng thái loading/success/error riêng biệt, không dùng 1 spinner chung cho cả trang |
| **Empty state có hướng dẫn** | Khi chưa có JD/CV nào, hiển thị minh hoạ + CTA rõ ràng thay vì bảng trắng trơn |

> **Khuyến nghị theo dõi riêng**: Đặc tả gốc FR5.5 (PRD Chương 3, 3.3.1) định nghĩa bucket biểu đồ là `Dưới 50 / 50-70 / 70-85 / Trên 85`, khác với 3 ngưỡng badge `<50 / 50-79 / ≥80` dùng xuyên suốt Chương 4. Khuyến nghị cập nhật lại FR5.5 trong tài liệu yêu cầu để dùng chung đúng 3 ngưỡng với badge, tránh hai nguồn đặc tả cùng tồn tại và gây nhầm lẫn khi Frontend/Backend triển khai `GET /api/jobs/:id/stats`.

---

## 4.3 Tạo Bản mẫu (Prototyping)

### 4.3.1 Mục tiêu giai đoạn Prototype
Chuyển từ wireframe tĩnh (4.2) sang **bản mẫu tương tác được (clickable prototype)** để:
1. Kiểm chứng luồng người dùng (4.1) có "chạy mượt" trên thực tế thao tác hay không, phát hiện sớm các bước thừa.
2. Thu thập phản hồi của Persona 1 & 2 (giả lập hoặc thật) trước khi Frontend Developer viết code chính thức.
3. Làm tài liệu bàn giao trực quan, đối chiếu song song với đặc tả RESTful API đã có sẵn tại **mục 3.5.2 (PRD_CVMikiri.md)** và mô hình dữ liệu Prisma tại **mục 3.3.4**. Nếu nhóm có duy trì thêm các file `ARCHITECTURE.md` / `API.md` riêng biệt trong repository mã nguồn, cần trỏ Prototype tới đúng phiên bản mới nhất của các file đó; nếu chưa tồn tại, mục 3.5.2 đóng vai trò là nguồn tham chiếu API chính thức duy nhất cho tới khi các file này được tạo.

### 4.3.2 Công cụ & Mức độ trung thực (Fidelity)
| Giai đoạn | Công cụ đề xuất | Mức fidelity | Đầu ra |
| :--- | :--- | :--- | :--- |
| Prototype nhanh nội bộ | Figma (frame liên kết bằng Prototype mode) | Mid-fidelity, đúng màu thương hiệu, chưa cần animation phức tạp | Link Figma chia sẻ cho HR/Lead review |
| Prototype chức năng thật | Component React thật dựng trên Storybook hoặc route riêng `/proto` trong app Vite hiện có | High-fidelity, dữ liệu giả (mock JSON) | Có thể click thật, dùng lại được component khi code chính thức |

> **Khuyến nghị cho CVMikiri**: vì stack đã có sẵn React + Tailwind + Zustand (theo 3.2.1), nên **bỏ qua công cụ thiết kế ngoài và dựng prototype ngay bằng chính component thật với dữ liệu mock** (`mockCandidates.json`, `mockJobs.json`). Cách này giúp tái sử dụng 80–90% code khi chuyển sang tích hợp API thật, tiết kiệm thời gian dựng lại UI hai lần.

### 4.3.3 Kịch bản click-test (Clickable Flow Script)
Bản mẫu tương tác cần đảm bảo đi hết được **kịch bản thử nghiệm** sau, tương ứng trực tiếp các Gherkin Scenario đã viết ở 3.4:

```mermaid
journey
    title Kịch bản Click-test: Từ tạo JD đến ra quyết định phỏng vấn
    section Chuẩn bị
      Tạo JD mới: 5: HR
      Upload 5 CV: 4: HR
    section Sàng lọc
      Lọc theo kỹ năng + kinh nghiệm: 5: HR
      Chọn 3 ứng viên tiềm năng: 5: HR
    section Đánh giá AI
      Chạy AI Matching: 3: HR
      Chờ kết quả từng dòng: 3: HR
    section Ra quyết định
      Mở chi tiết ứng viên #1: 5: Hiring Manager
      So sánh Matched/Missing skills: 5: Hiring Manager
      Xoá ứng viên không đạt: 4: Hiring Manager
```
*(Thang điểm 1–5 mô phỏng mức độ hài lòng kỳ vọng tại mỗi bước — dùng làm baseline để so sánh với kết quả usability test thật sau này.)*

### 4.3.4 Trạng thái cần dựng đầy đủ trong Prototype
Không chỉ dựng "happy path", bản mẫu bắt buộc bao gồm các **trạng thái biên** để tránh việc Frontend Developer phải tự đoán khi code:
* Empty state (chưa có JD / chưa có CV nào).
* Loading state (đang upload, đang chạy AI matching theo từng dòng).
* Error state (file sai định dạng, AI trả lỗi JSON, mất kết nối mạng).
* Success state (toast, badge cập nhật).
* Trạng thái responsive tối thiểu ở breakpoint tablet (768px).

### 4.3.5 Quy trình bàn giao Prototype
```mermaid
flowchart LR
    A[Dựng Prototype bằng component React + mock data] --> B[Demo nội bộ / gửi link cho stakeholder]
    B --> C[Thu thập phản hồi định tính]
    C --> D[4.4 AI Design Review]
    D --> E{Đạt tiêu chí Heuristic?}
    E -- Chưa --> A
    E -- Đạt --> F[Thay mock data bằng API thật theo đặc tả 3.5.2 - PRD_CVMikiri.md]
    F --> G[Bàn giao cho QA kiểm thử theo Gherkin ở 3.4]
```
> **Ghi chú (đã sửa)**: Bản trước tham chiếu `API.md` như một file đích để tích hợp, nhưng file này chưa xác nhận tồn tại trong repository tại thời điểm viết Chương 4. Để người triển khai luôn có tài liệu đích cụ thể, bước "Thay mock data bằng API thật" trỏ trực tiếp tới đặc tả endpoint đã có sẵn ở **mục 3.5.2 của `PRD_CVMikiri.md`** (Nhóm 1: `/api/jobs`, Nhóm 2: `/api/candidates`, Nhóm 3: `/api/matching`). Nếu về sau nhóm tách riêng `API.md`/`ARCHITECTURE.md` thành file độc lập, cần cập nhật lại tham chiếu này để trỏ đúng phiên bản file đang tồn tại.

---

## 4.4 AI Đánh giá Thiết kế (AI Design Review)

### 4.4.1 Mục đích
Trước khi chuyển Prototype (4.3) thành sản phẩm code chính thức, nhóm sử dụng AI (Claude) như một **"reviewer thiết kế cấp hai"** — độc lập với người đã tự thiết kế — nhằm phát hiện sớm các vấn đề về khả dụng (usability), khả năng tiếp cận (accessibility) và tính nhất quán trước khi tốn công sức phát triển.

> **Lưu ý phạm vi**: AI Design Review đóng vai trò **bổ sung**, không thay thế việc test người dùng thật với Persona 1 & 2. AI giỏi ở việc quét lỗi có tính hệ thống (thiếu trạng thái, vi phạm heuristic phổ biến) nhưng không thay được cảm nhận trải nghiệm thực tế của HR/Recruiter.

### 4.4.2 Quy trình đưa thiết kế vào AI Review

```mermaid
flowchart TD
    A[Chụp ảnh / xuất mô tả từng màn hình Wireframe-Prototype] --> B[Đóng gói kèm ngữ cảnh: Persona, FR liên quan, Luồng ở 4.1]
    B --> C[Gửi Prompt review tới Claude API]
    C --> D[Nhận báo cáo: Điểm mạnh / Vấn đề / Mức độ nghiêm trọng / Đề xuất sửa]
    D --> E[Đội Product/Design phân loại: Sửa ngay - Backlog - Bỏ qua có lý do]
    E --> F[Cập nhật Wireframe/Prototype]
    F -->|Lặp lại nếu còn vấn đề Critical| A
```

### 4.4.3 Khung tiêu chí đánh giá (dựa trên 10 Heuristics của Nielsen)
AI được yêu cầu chấm từng màn hình theo khung 10 nguyên tắc khả dụng kinh điển, áp riêng cho ngữ cảnh CVMikiri:

| # | Heuristic (Nielsen) | Câu hỏi kiểm tra áp dụng cho CVMikiri |
| :-- | :--- | :--- |
| 1 | Hiển thị trạng thái hệ thống | Người dùng có luôn biết file đang upload/parse ở bước nào không? |
| 2 | Khớp giữa hệ thống & thế giới thực | Thuật ngữ "Kỹ năng khớp/thiếu" có dễ hiểu hơn "matchedSkills/missingSkills" không? |
| 3 | Quyền kiểm soát & tự do của người dùng | Có thể huỷ giữa chừng khi đang chạy AI Matching 50 CV không? |
| 4 | Nhất quán & theo chuẩn | Badge màu điểm số (🟢🟡🔴) có dùng nhất quán ở cả bảng danh sách và Drawer chi tiết không? |
| 5 | Phòng tránh lỗi | Nút "Xoá JD" có bắt buộc modal xác nhận khi JD đã có MatchResult không? |
| 6 | Nhận biết hơn là ghi nhớ | Khi mở Drawer chi tiết, JD đang so sánh có được nhắc lại rõ ràng không? |
| 7 | Linh hoạt & hiệu quả sử dụng | HR xử lý 200-300 CV/tuần có thao tác chọn hàng loạt (select-all, shift-click) không? |
| 8 | Thẩm mỹ & thiết kế tối giản | Bảng dữ liệu có bị quá tải cột không cần thiết ở màn hình mặc định không? |
| 9 | Giúp người dùng nhận diện, chẩn đoán, phục hồi lỗi | Thông báo lỗi "429 Too Many Requests" có được dịch thành ngôn ngữ nghiệp vụ dễ hiểu không? |
| 10 | Trợ giúp & tài liệu | Có tooltip giải thích ý nghĩa điểm số 0-100 ngay lần đầu người dùng thấy không? |

### 4.4.4 Mẫu Prompt gửi AI Review (đưa vào Claude API)

```text
Bạn là một chuyên gia UX Reviewer cấp cao, có kinh nghiệm đánh giá sản phẩm B2B SaaS
cho ngành HR Tech. Hãy đánh giá màn hình dưới đây của sản phẩm CVMikiri.

Bối cảnh:
- Người dùng chính: HR Recruiter (xử lý 200-300 CV/tuần) và Hiring Manager.
- Mục tiêu màn hình: {{ tên màn hình, ví dụ "Quản lý CV" }}
- Luồng liên quan: {{ mô tả từ mục 4.1 tương ứng }}
- Mô tả/ảnh chụp wireframe: {{ đính kèm mô tả từ 4.2 hoặc ảnh Figma }}

Yêu cầu đánh giá:
1. Chấm điểm 1-5 cho từng mục trong 10 Heuristics của Nielsen, giải thích ngắn gọn lý do.
2. Liệt kê tối đa 5 vấn đề nghiêm trọng nhất (Critical/High/Medium) kèm đề xuất sửa cụ thể.
3. Chỉ ra nếu có mâu thuẫn giữa màn hình này với Yêu cầu chức năng FR đã cung cấp.
4. Không bịa ra vấn đề nếu thông tin không đủ để đánh giá — hãy nêu rõ những gì cần bổ sung.

Trả lời bằng tiếng Việt, súc tích, dùng bảng cho phần chấm điểm.
```

### 4.4.5 Ví dụ Báo cáo AI Design Review (minh hoạ cho màn hình "Quản lý CV")

| Heuristic | Điểm (1-5) | Nhận xét |
| :--- | :--- | :--- |
| 1. Hiển thị trạng thái hệ thống | 4 | Progress bar theo từng file rõ ràng; cần thêm trạng thái "đang trích xuất text" tách biệt với "đang upload" |
| 3. Quyền kiểm soát & tự do | 2 | **Vấn đề**: chưa có nút "Huỷ" khi đang chạy AI Matching hàng loạt — nếu chọn nhầm 50 CV, người dùng buộc phải đợi hết |
| 7. Linh hoạt & hiệu quả | 3 | Chưa thấy tuỳ chọn "Chọn tất cả" trong bảng — bất tiện khi HR muốn chấm AI cho toàn bộ danh sách đã lọc |
| 9. Nhận diện & phục hồi lỗi | 3 | Thông báo "sai định dạng" tốt, nhưng khi AI lỗi 429 cần thông điệp kiểu "Hệ thống đang xử lý quá nhiều hồ sơ cùng lúc, vui lòng thử lại sau ít phút" thay vì mã lỗi kỹ thuật |

**Vấn đề nghiêm trọng nhất được AI gắn cờ (Critical):**
> *"Floating Action Bar hiện chỉ có nút 'Chạy AI Matching', không có cách nào huỷ một tác vụ AI Matching đang chạy dở cho hàng loạt CV. Với NFR2 (tối ưu chi phí AI), việc gọi nhầm 1 lô lớn không thể huỷ giữa chừng gây lãng phí token trực tiếp — nên bổ sung nút 'Dừng' xuất hiện thay thế nút Chạy trong lúc xử lý."*

> **Cập nhật trạng thái xử lý**: Vấn đề Critical này đã được đưa ngược lại vào luồng chính ở mục 4.1.3(d) — bổ sung nút "Dừng" thay thế nút "Chạy AI Matching" trong lúc xử lý, cùng với việc sửa lại thông báo tổng kết để phản ánh đúng số ứng viên thành công/lỗi/đã huỷ thay vì luôn báo "N/N". Đây là ví dụ cho quy tắc ở 4.4.6: một phát hiện Critical từ AI Review **phải** được đưa ngược lại vào bản luồng chính thức trước khi coi là "đã đóng", không chỉ dừng ở mức ghi nhận trong báo cáo.

### 4.4.6 Quy tắc phân loại & xử lý phản hồi từ AI
| Mức độ | Tiêu chí | Hành động |
| :--- | :--- | :--- |
| **Critical** | Chặn hoàn thành tác vụ chính (FR1-FR5) hoặc vi phạm NFR đã cam kết | Sửa ngay trước khi code Frontend chính thức |
| **High** | Gây khó chịu rõ rệt cho Persona chính nhưng có thể dùng tạm được | Đưa vào Sprint gần nhất |
| **Medium** | Cải thiện trải nghiệm nhưng không ảnh hưởng luồng chính | Đưa vào Backlog (có thể gộp Wave 1-4 ở roadmap) |
| **Bỏ qua có lý do** | AI hiểu sai ngữ cảnh nghiệp vụ hoặc đề xuất vượt phạm vi MVP (3.2.2.B) | Ghi chú lý do từ chối để tránh review viên sau lặp lại câu hỏi |

### 4.4.7 Giới hạn của AI Design Review (cần lưu ý khi áp dụng)
* AI đánh giá dựa trên **mô tả/ảnh chụp tĩnh**, không "cảm" được độ trễ thực tế, độ mượt animation hay cảm giác cầm nắm trên thiết bị thật.
* Kết quả review phụ thuộc nhiều vào **chất lượng ngữ cảnh cung cấp** (Persona, FR, luồng) — thiếu ngữ cảnh sẽ khiến AI đưa ra góp ý chung chung, không đặc thù cho HR Tech.
* Không dùng AI Review để **thay thế** hoàn toàn bước kiểm thử người dùng thật (usability testing) trước khi ra mắt bản chính thức — đây vẫn là bước bắt buộc trước khi Go-live.

---

## TỔNG KẾT CHƯƠNG 4
Chương 4 đã cụ thể hoá các yêu cầu chức năng và User Stories của Chương 3 thành: luồng thao tác chi tiết theo từng FR (4.1), bố cục khung màn hình lõi (4.2), quy trình dựng bản mẫu tương tác tái sử dụng trực tiếp component React (4.3), và một vòng lặp đánh giá thiết kế có sự hỗ trợ của AI dựa trên 10 Heuristics của Nielsen (4.4). Đầu ra của chương này là cơ sở trực tiếp để đội Frontend triển khai giao diện thật, thay thế mock data bằng các API đã đặc tả tại mục 3.5.2.
