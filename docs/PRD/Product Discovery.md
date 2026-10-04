# CHƯƠNG 3: AI TRONG PHÂN TÍCH YÊU CẦU & SẢN PHẨM
## DỰ ÁN: CVMikiri — HỆ THỐNG KIỂM TRA, SÀNG LỌC VÀ CHẤM ĐIỂM CV THÔNG MINH

---

## 3.1 Khám phá Sản phẩm (Product Discovery)

### 3.1.1 Bối cảnh & Tuyên bố vấn đề (Problem Statement)
Trong kỷ nguyên tuyển dụng số, mỗi chiến dịch tuyển dụng cho các vị trí kỹ thuật và chuyên môn có thể nhận về từ hàng trăm đến hàng nghìn CV trong một khoảng thời gian ngắn. Quy trình tuyển dụng truyền thống đang đối mặt với các nút thắt cổ chai (bottlenecks) nghiêm trọng:
1. **Lãng phí thời gian và nguồn lực**: Bộ phận HR/Recruiter phải dành trung bình 5 đến 10 phút để đọc lướt một bản CV, trong đó hơn 70% số lượng ứng viên nộp hồ sơ không đáp ứng đủ các tiêu chí kỹ năng tối thiểu của Job Description (JD).
2. **Hiện tượng mệt mỏi nhận thức (Cognitive Fatigue) & Đánh giá thiên kiến (Human Bias)**: Khi phải đọc lượng lớn hồ sơ liên tục, nhà tuyển dụng dễ đánh giá thiếu nhất quán, dễ thiên kiến bởi cách trình bày, định dạng hoặc bỏ sót những ứng viên thực sự tiềm năng.
3. **Giới hạn của các bộ lọc từ khóa truyền thống (Keyword-based ATS)**: Các hệ thống ATS cổ điển chỉ tìm kiếm từ khóa cứng (exact string match). Nếu ứng viên ghi "Golang" thay vì "Go", hoặc "NodeJS" thay vì "Node.js", bộ lọc sẽ loại bỏ ứng viên đó một cách sai lệch vì thiếu hiểu biết về ngữ cảnh chuyên môn (Contextual Understanding).

> **Tuyên bố vấn đề:**
> *"Các nhà tuyển dụng và bộ phận nhân sự cần một giải pháp sàng lọc hồ sơ ứng viên nhanh chóng, chi phí thấp, kết hợp giữa việc lọc thô tức thời theo tiêu chí cứng và khả năng phân tích ngữ nghĩa sâu sắc bằng AI để xếp hạng độ phù hợp của CV với JD một cách khách quan, minh bạch và chính xác."*

---

### 3.1.2 Chân dung người dùng (User Personas)

#### Persona 1: HR Specialist / Tech Recruiter
* **Họ tên**: Nguyễn Thu Hà (27 tuổi)
* **Vai trò**: Chuyên viên tuyển dụng nhân sự công nghệ
* **Mục tiêu**:
  * Đọc nhanh 200–300 CV/tuần để tìm ra top 10–15 ứng viên xuất sắc nhất gửi cho Hiring Manager.
  * Tự động hóa khâu bóc tách thông tin liên hệ, kinh nghiệm, kỹ năng của ứng viên mà không cần nhập liệu thủ công.
* **Nỗi đau (Pain Points)**:
  * Choáng ngợp bởi số lượng CV định dạng hỗn loạn (PDF nhiều cột, DOCX bảng biểu).
  * Khó khăn trong việc đánh giá các kỹ năng công nghệ mới do không có nền tảng lập trình sâu.
  * Tốn quá nhiều thời gian cho việc sàng lọc sơ bộ thay vì dành thời gian phỏng vấn và chăm sóc ứng viên.

#### Persona 2: Hiring Manager / Tech Lead
* **Họ tên**: Trần Quốc Bảo (34 tuổi)
* **Vai trò**: Trưởng phòng Công nghệ / Kỹ thuật
* **Mục tiêu**:
  * Nhận được danh sách ứng viên đã được sàng lọc chuẩn xác theo các tiêu chí kỹ thuật trong JD.
  * Xem nhanh lý do tại sao ứng viên được đánh giá cao: ứng viên mạnh ở điểm nào, thiếu hụt kỹ năng quan trọng nào.
* **Nỗi đau (Pain Points)**:
  * Thất vọng khi nhận về các CV "qua vòng HR" nhưng thiếu hụt trầm trọng các kỹ năng cốt lõi.
  * Mất nhiều thời gian phỏng vấn những ứng viên có thông tin phóng đại trên CV.

---

### 3.1.3 Tuyên ngôn giá trị & Tầm nhìn sản phẩm (Value Proposition & Vision)
* **Tầm nhìn sản phẩm (Product Vision)**:
  Trở thành trợ lý sàng lọc hồ sơ tuyển dụng AI thông minh, hiệu quả và tối ưu chi phí nhất dành cho doanh nghiệp, chuẩn hóa quy trình tuyển dụng từ tiếp nhận hồ sơ thô đến bảng xếp hạng ứng viên chi tiết.
* **Tuyên ngôn giá trị cốt lõi (Unique Value Proposition)**:
  * **Mô hình sàng lọc 2 tầng (Two-tier Hybrid Screening)**:
    * *Tầng 1 (Rule-based Filtering)*: Lọc tức thời, chi phí $0 dựa trên kinh nghiệm, từ khóa và kỹ năng cứng.
    * *Tầng 2 (Gemini Generative AI Matching)*: Phân tích ngữ nghĩa chuyên sâu, hiểu rõ mối liên hệ giữa các kỹ năng thực tế trong CV và yêu cầu JD, chấm điểm minh bạch kèm giải trình chi tiết.
  * **Xử lý đa định dạng & Đa ngữ**: Trích xuất tối ưu các định dạng PDF, DOCX và xử lý chuẩn xác tiếng Việt có dấu.

---

### 3.1.4 Mô hình Lean Canvas CVMikiri

| Khối Lean Canvas | Nội dung chi tiết |
| :--- | :--- |
| **1. Problem (Vấn đề)** | - Sàng lọc thủ công tốn kém 5-10 phút/CV.<br>- ATS truyền thống lọc cứng nhắc, thiếu hiểu biết ngữ cảnh.<br>- Mệt mỏi nhận thức gây thiên kiến đánh giá. |
| **2. Customer Segments (Khách hàng)** | - Chuyên viên nhân sự (HR Recruiter).<br>- Trưởng bộ phận chuyên môn (Hiring Managers).<br>- Các công ty Headhunter & Startup tuyển dụng liên tục. |
| **3. Unique Value Proposition (UVP)** | "Nền tảng kiểm tra & lọc CV thông minh kết hợp bộ lọc quy tắc tức thời và AI Gemini phân tích ngữ nghĩa sâu, giúp rút ngắn 80% thời gian tuyển dụng." |
| **4. Solution (Giải pháp)** | - Quản lý JD tập trung.<br>- Upload hàng loạt PDF/DOCX & bóc tách tự động.<br>- Bộ lọc rule-based tức thì.<br>- Gemini AI Matching: Chấm điểm 0-100, liệt kê kỹ năng khớp & kỹ năng thiếu. |
| **5. Channels (Kênh phân phối)** | - Nền tảng Web App nội bộ doanh nghiệp.<br>- Diễn đàn tuyển dụng, cộng đồng HR Tech, LinkedIn. |
| **6. Revenue Streams (Doanh thu)** | - Triển khai On-premise / Private Cloud cho doanh nghiệp.<br>- Thuê bao SaaS theo số lượng CV xử lý/tháng. |
| **7. Cost Structure (Chi phí)** | - Chi phí gọi Google Gemini API.<br>- Chi phí hạ tầng Cloud (PostgreSQL, VPS hosting, Storage lưu CV).<br>- Chi phí phát triển và bảo trì phần mềm. |
| **8. Key Metrics (Chỉ số đo lường)** | - Thời gian trung bình sàng lọc 1 CV.<br>- Tỷ lệ chính xác trích xuất thông tin.<br>- Tỷ lệ ứng viên qua AI matching được nhận phỏng vấn thực tế. |
| **9. Unfair Advantage (Lợi thế cạnh tranh)** | - Kiến trúc tối ưu chi phí: Lọc thô miễn phí trước khi gọi LLM.<br>- Tận dụng mô hình Gemini xử lý ngữ cảnh dài và tiếng Việt vượt trội với chi phí cực thấp. |

---

### 3.1.5 Mục tiêu & Chỉ số thành công (Product Goals & KPIs/OKRs)

#### Mục tiêu (Objectives) & Kết quả then chốt (Key Results - OKRs)
* **Mục tiêu 1: Cắt giảm tối đa thời gian tiền xử lý hồ sơ**
  * *KR 1.1*: Giảm ít nhất 75% thời gian lọc sơ bộ từ 8 phút/CV xuống dưới 2 phút/CV.
  * *KR 1.2*: Thời gian phản hồi cho bộ lọc quy tắc (Rule-based) đạt dưới 100ms trên tập dữ liệu 500 CV.
* **Mục tiêu 2: Đảm bảo độ tin cậy và chính xác của AI**
  * *KR 2.1*: Độ chính xác trích xuất các trường cơ bản (Họ tên, Email, Số điện thoại) đạt ≥ 92%.
  * *KR 2.2*: Tỷ lệ lỗi sinh định dạng (JSON schema error) từ Gemini API khi matching đạt dưới 1%.
* **Mục tiêu 3: Tối ưu hóa chi phí AI**
  * *KR 3.1*: 100% các lệnh gọi AI chỉ thực hiện trên tập ứng viên đã vượt qua bộ lọc cứng (Rule-based filter) do HR chủ động chọn, tiết kiệm tối thiểu 60% chi phí token so với việc quét AI toàn bộ.

---

