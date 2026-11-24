# CVTest -- CV Evaluation Framework

## Tài liệu đặc tả tiêu chí đánh giá CV dành cho AI Agent

**Mục đích:** Hướng dẫn AI Agent xây dựng hoặc điều chỉnh chức năng phân
tích, chấm điểm và xếp hạng CV theo Job Description (JD).\
**Nguyên tắc cốt lõi:** Không chỉ so khớp từ khóa kỹ năng. Hệ thống phải
đánh giá mức độ phù hợp với vị trí, bằng chứng về năng lực, kinh nghiệm,
kết quả công việc và mức độ rõ ràng của thông tin.

------------------------------------------------------------------------

## 1. Mục tiêu và phạm vi

CVTest là hệ thống hỗ trợ nhà tuyển dụng:

1.  Phân tích yêu cầu tuyển dụng từ JD.
2.  Trích xuất thông tin có cấu trúc từ CV.
3.  Đánh giá ứng viên theo bộ tiêu chí phù hợp với vị trí.
4.  Giải thích điểm số bằng bằng chứng cụ thể trong CV.
5.  Chỉ ra điểm mạnh, điểm còn thiếu và nội dung cần xác minh khi phỏng
    vấn.
6.  Hỗ trợ so sánh, xếp hạng ứng viên; không tự động đưa ra quyết định
    tuyển dụng cuối cùng.

Kết quả AI phải có khả năng giải thích và truy ngược về nội dung CV/JD.
Không được tự tạo thông tin hoặc suy diễn năng lực khi CV không cung cấp
bằng chứng.

## 2. Nguyên tắc thiết kế bắt buộc

-   **JD-driven:** Tiêu chí và trọng số phải được điều chỉnh theo vị trí
    tuyển dụng, không dùng một cấu hình cứng cho mọi nghề.
-   **Evidence-based:** Mỗi nhận định và điểm số phải dựa trên nội dung
    cụ thể trong CV hoặc JD.
-   **Không đồng nhất "không đề cập" với "không có":** Nếu CV không cung
    cấp thông tin, ghi nhận là thiếu bằng chứng/không đủ dữ liệu, không
    kết luận ứng viên không có năng lực.
-   **Không chấm văn phong thay cho năng lực:** CV viết trôi chảy hoặc
    dùng nhiều từ chuyên môn không tự động chứng minh ứng viên giỏi.
-   **Không suy diễn:** Không tự suy ra kỹ năng, số năm kinh nghiệm, vai
    trò, thành tích hoặc trình độ từ thông tin không đủ căn cứ.
-   **Công bằng:** Không sử dụng các thuộc tính nhạy cảm hoặc không liên
    quan đến công việc như giới tính, tuổi, chủng tộc, tôn giáo, tình
    trạng hôn nhân, ảnh đại diện, quê quán... để chấm điểm hoặc xếp
    hạng.
-   **Human-in-the-loop:** Điểm số chỉ hỗ trợ ra quyết định. Nhà tuyển
    dụng cần xem xét hồ sơ và xác minh thông tin.
-   **Nhất quán:** Cùng một JD và cùng một CV phải cho kết quả ổn định
    trong cùng cấu hình đánh giá.
-   **Có thể cấu hình:** Cho phép điều chỉnh trọng số, tiêu chí bắt buộc
    và tiêu chí ưu tiên theo từng JD.

## 3. Bộ tiêu chí chấm điểm mặc định (100 điểm)

Đây là cấu hình mặc định để khởi đầu. Agent cần thiết kế để có thể thay
đổi theo JD và nhóm nghề.

  ------------------------------------------------------------------------
  Nhóm tiêu chí                    Trọng số mặc định Nội dung đánh giá
  --------------------- ---------------------------- ---------------------
  1\. Skill Matching                              25 Mức độ đáp ứng kỹ
                                                     năng và công nghệ yêu
                                                     cầu

  2\. Experience                                  20 Mức độ liên quan và
  Relevance                                          chiều sâu kinh nghiệm

  3\. Project &                                   20 Dự án, đóng góp cá
  Achievement                                        nhân và kết quả

  4\. Soft Skills                                 15 Kỹ năng mềm có bằng
                                                     chứng trong CV

  5\. Education &                                 10 Học vấn, chứng chỉ và
  Certification                                      đào tạo liên quan

  6\. CV Quality                                  10 Độ rõ ràng, đầy đủ,
                                                     nhất quán và dễ đọc

  **Tổng**                                   **100**
  ------------------------------------------------------------------------

### 3.1. Skill Matching -- 25 điểm

Đánh giá mức độ đáp ứng yêu cầu kỹ năng trong JD:

-   Ngôn ngữ lập trình, framework, thư viện.
-   Công cụ, nền tảng, cơ sở dữ liệu và công nghệ.
-   Kỹ năng chuyên môn/nghiệp vụ.
-   Phân biệt yêu cầu bắt buộc (Required/Must-have) và ưu tiên
    (Preferred/Nice-to-have).
-   Đánh giá mức độ phù hợp theo ngữ cảnh sử dụng, không chỉ dựa trên
    việc từ khóa có xuất hiện hay không.

**Yêu cầu:** Nếu CV chỉ liệt kê một công nghệ trong danh sách Skills mà
không có mô tả sử dụng trong dự án/công việc, không nên đánh giá bằng
chứng đó ngang với kinh nghiệm đã áp dụng thực tế.

### 3.2. Experience Relevance -- 20 điểm

Đánh giá kinh nghiệm thực tế liên quan đến vị trí:

-   Số năm kinh nghiệm liên quan, nếu CV cung cấp đủ mốc thời gian.
-   Mức độ tương đồng giữa nhiệm vụ cũ và công việc trong JD.
-   Vai trò, trách nhiệm và phạm vi công việc.
-   Mức độ phức tạp của nhiệm vụ.
-   Kinh nghiệm trong ngành/lĩnh vực liên quan.
-   Quá trình phát triển về trách nhiệm hoặc chuyên môn, nếu có bằng
    chứng.

**Lưu ý:** Không mặc định ứng viên có nhiều năm kinh nghiệm hơn luôn phù
hợp hơn. Cần xem xét chất lượng và mức độ liên quan của kinh nghiệm.

### 3.3. Project & Achievement -- 20 điểm

Đánh giá bằng chứng năng lực thông qua dự án và thành tựu:

-   Dự án có liên quan đến JD.
-   Vai trò và phần việc cá nhân.
-   Công nghệ được sử dụng trong bối cảnh cụ thể.
-   Vấn đề đã giải quyết và cách tiếp cận.
-   Kết quả đầu ra hoặc tác động.
-   Thành tựu có số liệu cụ thể, nếu có.
-   Mức độ phức tạp và quy mô dự án.

Không bắt buộc mọi dự án phải có số liệu. Nếu không có số liệu, đánh giá
dựa trên mô tả công việc và kết quả định tính có căn cứ; không tự ước
lượng tác động.

### 3.4. Soft Skills -- 15 điểm

Chỉ đánh giá kỹ năng mềm khi CV có dấu hiệu/bằng chứng hỗ trợ:

-   Communication -- Giao tiếp.
-   Teamwork -- Làm việc nhóm.
-   Problem Solving -- Giải quyết vấn đề.
-   Leadership -- Lãnh đạo/điều phối.
-   Adaptability -- Khả năng thích nghi.
-   Self-learning -- Khả năng tự học.
-   Time Management -- Quản lý thời gian.

Ví dụ bằng chứng tốt: mô tả phối hợp với nhóm, xử lý vấn đề cụ thể, điều
phối công việc hoặc tự học công nghệ để hoàn thành nhiệm vụ.

Không kết luận ứng viên có kỹ năng chỉ vì CV ghi một từ khóa như
"teamwork", "leadership" mà không có ngữ cảnh. Nếu CV không có bằng
chứng, ghi "Chưa đủ thông tin để đánh giá", không tự động coi là không
có kỹ năng.

### 3.5. Education & Certification -- 10 điểm

Đánh giá mức độ liên quan của:

-   Chuyên ngành và trình độ học vấn.
-   Chứng chỉ chuyên môn.
-   Chứng chỉ ngoại ngữ nếu JD yêu cầu.
-   Khóa học/đào tạo liên quan.
-   Kiến thức nền tảng phù hợp vị trí.

Không mặc định trường học danh tiếng hoặc bằng cấp cao hơn đồng nghĩa
năng lực làm việc tốt hơn. Trọng số nhóm này cần giảm hoặc thay đổi nếu
JD không yêu cầu bằng cấp/chứng chỉ cụ thể.

### 3.6. CV Quality -- 10 điểm

Đánh giá chất lượng thông tin, không đánh giá gu thẩm mỹ cá nhân:

-   Bố cục và cấu trúc dễ đọc.
-   Thông tin quan trọng dễ tìm.
-   Mô tả kinh nghiệm/dự án rõ ràng, có ngữ cảnh.
-   Thông tin nhất quán giữa các phần.
-   Ít lỗi chính tả/ngữ pháp gây ảnh hưởng đến việc hiểu nội dung.
-   Thông tin liên hệ và các mục cần thiết có đầy đủ ở mức phù hợp.

Không trừ điểm chỉ vì CV dùng mẫu thiết kế đơn giản, không có ảnh, không
dùng màu sắc hoặc không theo một phong cách trình bày cụ thể. Không ưu
tiên thiết kế đẹp hơn bằng chứng năng lực.

## 4. Phân tích sâu mô tả ứng viên và bằng chứng năng lực

Đây là phần quan trọng để hệ thống vượt khỏi việc so khớp từ khóa.

AI cần xem xét 6 khía cạnh:

  Khía cạnh        Câu hỏi đánh giá
  ---------------- -----------------------------------------------------
  Specificity      Mô tả có cụ thể hay chỉ là câu chung chung?
  Evidence-based   Có bằng chứng hoặc ví dụ chứng minh năng lực không?
  Ownership        Có thể hiện rõ phần việc và đóng góp cá nhân không?
  Impact           Có nêu kết quả hoặc tác động của công việc không?
  Complexity       Nhiệm vụ có mức độ phức tạp nào, có căn cứ không?
  Relevance        Nội dung có liên quan đến yêu cầu của vị trí không?

### Ví dụ minh họa

**Mô tả yếu:**

> Có kiến thức về Java, Spring Boot, MySQL. Có khả năng làm việc nhóm và
> giải quyết vấn đề.

**Mô tả có bằng chứng tốt hơn:**

> Phát triển hệ thống quản lý nhân sự sử dụng Java Spring Boot và MySQL.
> Phụ trách xây dựng REST API, thiết kế database và tối ưu truy vấn. Làm
> việc cùng nhóm 4 thành viên, hoàn thành dự án đúng tiến độ.

Hai ứng viên có thể có mức độ khớp kỹ năng tương đương, nhưng mô tả thứ
hai cung cấp thêm bằng chứng về bối cảnh, vai trò, công việc và phối hợp
nhóm.

**Quy tắc:** Không chấm điểm cao chỉ vì mô tả dài hoặc dùng từ ngữ
chuyên nghiệp. Ưu tiên thông tin cụ thể, có thể kiểm chứng và liên quan
đến JD.

## 5. Career Potential -- Tiềm năng phát triển (đánh giá bổ trợ)

Có thể đánh giá riêng nếu doanh nghiệp muốn xem xét tiềm năng phát
triển, đặc biệt với vị trí Junior/Fresher:

-   Learning Progression: Dấu hiệu học hỏi và phát triển kỹ năng.
-   Responsibility Growth: Sự phát triển về trách nhiệm.
-   Technology Adaptability: Bằng chứng tiếp cận công nghệ mới.
-   Career Direction: Định hướng nghề nghiệp có liên quan đến vị trí.

**Mặc định:** Đây là phần nhận xét bổ trợ, không cộng thêm vào tổng 100
điểm để tránh tính trùng với các nhóm tiêu chí chính. Nếu doanh nghiệp
muốn đưa vào điểm tổng, cần cấu hình lại trọng số và công bố rõ cách
tính.

Chỉ đưa ra nhận định dựa trên bằng chứng trong CV. Không dự đoán chắc
chắn khả năng thành công trong tương lai.

## 6. Phân tích JD trước khi chấm CV

Trước khi đánh giá ứng viên, hệ thống cần phân tích JD thành cấu trúc:

-   Job title và cấp bậc (Intern/Junior/Middle/Senior...).
-   Required skills -- kỹ năng bắt buộc.
-   Preferred skills -- kỹ năng ưu tiên.
-   Kinh nghiệm tối thiểu và loại kinh nghiệm cần có.
-   Nhiệm vụ chính.
-   Học vấn/chứng chỉ/ngôn ngữ nếu thực sự được yêu cầu.
-   Soft skills liên quan đến công việc.
-   Các điều kiện khác có liên quan trực tiếp đến khả năng thực hiện
    công việc.

Không tự biến một yêu cầu "ưu tiên" thành điều kiện bắt buộc. Nếu JD mơ
hồ hoặc thiếu thông tin, cần ghi nhận độ không chắc chắn và tránh tự tạo
yêu cầu.

## 7. Cách tính điểm và xử lý thiếu bằng chứng

### 7.1. Chấm điểm từng nhóm

Mỗi nhóm có: - `weight`: trọng số tối đa. - `score`: điểm đạt được. -
`reason`: giải thích ngắn gọn. - `evidence`: trích dẫn hoặc vị trí nội
dung trong CV/JD làm căn cứ. - `gaps`: thông tin còn thiếu hoặc chưa
được chứng minh. - `confidence`: mức độ tin cậy của đánh giá.

Điểm tổng mặc định:

`total_score = sum(score của 6 nhóm)`

Tổng điểm tối đa là 100. Không cộng Career Potential vào điểm tổng theo
mặc định.

### 7.2. Thiếu thông tin

Phải phân biệt rõ:

-   **Not found:** Không tìm thấy thông tin trong CV.
-   **Insufficient evidence:** Có đề cập nhưng chưa đủ bằng chứng.
-   **Partially matched:** Đáp ứng một phần yêu cầu.
-   **Matched:** Có bằng chứng phù hợp.
-   **Strongly matched:** Có bằng chứng rõ, cụ thể và liên quan cao.

Không tự động gán điểm 0 cho mọi thông tin không xuất hiện. Cần có quy
tắc xử lý dữ liệu thiếu nhất quán, minh bạch; có thể đánh dấu "Not
enough information" và yêu cầu nhà tuyển dụng xem xét.

### 7.3. Không tự động loại ứng viên

Không đưa ra quyết định loại ứng viên chỉ dựa trên một điểm tổng. Nếu có
yêu cầu bắt buộc chưa được chứng minh, hãy hiển thị rõ yêu cầu đó và
trạng thái "Cần xác minh". Chỉ đánh dấu không đáp ứng khi có bằng chứng
rõ ràng, không phải chỉ vì CV không đề cập.

## 8. Định dạng kết quả đánh giá

Kết quả cần có tối thiểu các phần:

1.  Candidate overview -- Tóm tắt thông tin ứng viên.
2.  Overall score -- Tổng điểm và mức độ phù hợp.
3.  Score breakdown -- Điểm từng nhóm.
4.  Strengths -- Điểm mạnh có bằng chứng.
5.  Gaps / Weaknesses -- Điểm còn thiếu hoặc chưa được chứng minh.
6.  JD requirements analysis -- Các yêu cầu bắt buộc/ưu tiên và mức đáp
    ứng.
7.  Interview suggestions -- Câu hỏi phỏng vấn đề xuất để xác minh.
8.  Confidence & limitations -- Độ tin cậy và giới hạn dữ liệu.

### Ví dụ minh họa giao diện kết quả

**Candidate:** Nguyễn Văn A\
**Overall score:** 82/100\
**Match level:** Good Match

  Nhóm                                Điểm
  --------------------------- ------------
  Skill Matching                     23/25
  Experience Relevance               16/20
  Project & Achievement              18/20
  Soft Skills                        12/15
  Education & Certification           7/10
  CV Quality                          6/10
  **Tổng**                      **82/100**

**Điểm mạnh** - Có kinh nghiệm thực hiện dự án với Java Spring Boot. -
Có bằng chứng xây dựng REST API. - Có mô tả làm việc nhóm trong dự án.

**Điểm cần xác minh** - Chưa thể hiện rõ kết quả định lượng của dự án. -
Chưa có thông tin về chứng chỉ chuyên môn. - Mức độ đóng góp cá nhân
trong tối ưu hiệu suất cần được làm rõ.

**Đề xuất:** Có thể mời phỏng vấn kỹ thuật để xác minh vai trò và mức độ
đóng góp trong dự án.

*Toàn bộ điểm số và tên ứng viên ở ví dụ trên chỉ mang tính minh họa.*

## 9. Gợi ý câu hỏi phỏng vấn do AI tạo

Câu hỏi phải xuất phát từ khoảng trống thông tin hoặc yêu cầu quan trọng
của JD.

Ví dụ: - "Trong dự án Spring Boot, bạn trực tiếp phụ trách những module
nào?" - "Bạn đã tối ưu truy vấn MySQL bằng phương pháp nào? Có thể mô tả
trước và sau khi tối ưu không?" - "Khi làm việc nhóm, bạn xử lý xung đột
hoặc vấn đề về tiến độ như thế nào?"

Không tạo câu hỏi dựa trên giả định rằng ứng viên đã làm điều mà CV
không nêu.

## 10. Kiến trúc xử lý đề xuất

``` text
Job Description (JD)
        |
        v
JD Requirement Analysis
        |
        v
Structured Job Requirements
        |
        +------------------------------+
                                       |
CV Files                               |
   |                                   |
   v                                   |
CV Parsing & Information Extraction   |
   |                                   |
   v                                   |
Structured Candidate Profile          |
   |                                   |
   +-------------------+---------------+
                       |
                       v
             Evidence-based Evaluation
                       |
                       v
              Weighted Score Calculation
                       |
                       v
             Explanation & Gap Analysis
                       |
                       v
             Candidate Ranking / Review
                       |
                       v
              Recruiter Final Decision
```

Có thể chia xử lý thành các module: - `JDAnalyzer`: phân tích JD và tạo
bộ tiêu chí. - `CVParser`: trích xuất dữ liệu từ CV. -
`CandidateEvaluator`: đánh giá từng tiêu chí dựa trên bằng chứng. -
`ScoreCalculator`: tính điểm theo trọng số. - `EvaluationExplainer`: tạo
giải thích, điểm mạnh và khoảng trống. - `CandidateRanker`: so sánh ứng
viên theo cùng JD. - `InterviewQuestionGenerator`: tạo câu hỏi xác minh.

Tên module chỉ là gợi ý. Agent cần kiểm tra kiến trúc hiện tại của dự án
trước khi quyết định tạo mới hoặc thay đổi tên.

## 11. Yêu cầu đầu ra có cấu trúc cho AI

Nên chuẩn hóa kết quả thành JSON để backend lưu trữ và frontend hiển
thị. Ví dụ schema định hướng:

``` json
{
  "candidate_summary": "Tóm tắt dựa trên CV",
  "overall_score": 82,
  "match_level": "good_match",
  "score_breakdown": [
    {
      "category": "skill_matching",
      "score": 23,
      "max_score": 25,
      "reason": "Có các kỹ năng phù hợp với yêu cầu chính của JD.",
      "evidence": [
        {
          "source": "CV",
          "section": "Projects",
          "text": "Mô tả bằng chứng được trích từ CV"
        }
      ],
      "gaps": ["Chưa nêu rõ mức độ sử dụng một công nghệ"],
      "confidence": "high"
    }
  ],
  "strengths": [],
  "gaps_and_concerns": [],
  "requirements_analysis": [],
  "career_potential": {
    "assessment": "insufficient_evidence",
    "reason": "Chưa có đủ thông tin để nhận xét"
  },
  "interview_questions": [],
  "limitations": []
}
```

Đây là schema minh họa. Agent cần điều chỉnh kiểu dữ liệu, validation và
cấu trúc theo backend hiện tại. Nếu dùng JSON, phải đảm bảo tổng điểm và
các điểm thành phần nhất quán.

## 12. Hướng dẫn thực hiện dành cho AI Agent

Khi nhận tài liệu này, hãy làm theo thứ tự:

### Phase 1 -- Khảo sát dự án

1.  Đọc cấu trúc repository và xác định frontend, backend, database, AI
    service hiện tại.
2.  Tìm chức năng upload CV, quản lý JD, parsing và đánh giá CV đang có.
3.  Xác định luồng dữ liệu và các API/model hiện hữu.
4.  Không tự ý thay đổi công nghệ, kiến trúc hoặc xóa chức năng hiện
    tại.

### Phase 2 -- Đối chiếu và lập kế hoạch

1.  So sánh chức năng hiện tại với framework đánh giá trong tài liệu.
2.  Liệt kê phần đã có, phần còn thiếu và phần cần điều chỉnh.
3.  Đề xuất thiết kế dữ liệu, API, prompt và giao diện cần thay đổi.
4.  Nêu rõ cách tính điểm, xử lý thiếu dữ liệu và lưu bằng chứng.
5.  Trình bày kế hoạch để người dùng xem xét trước khi triển khai các
    thay đổi lớn.

### Phase 3 -- Triển khai

1.  Ưu tiên tái sử dụng code và cấu trúc hiện có.
2.  Xây dựng phân tích JD trước, sau đó phân tích CV và đánh giá.
3.  Tách riêng trích xuất dữ liệu, đánh giá bằng AI và tính điểm.
4.  Không để AI tự tính tổng điểm tùy ý; cần có logic tính điểm và kiểm
    tra nhất quán ở backend.
5.  Lưu bằng chứng, lý do, điểm thành phần và phiên bản cấu hình đánh
    giá.
6.  Cho phép cấu hình tiêu chí/trọng số theo JD.
7.  Hiển thị điểm mạnh, khoảng trống, mức độ tin cậy và câu hỏi phỏng
    vấn.

### Phase 4 -- Kiểm thử

Tối thiểu cần kiểm thử: - CV có đầy đủ thông tin và CV thiếu thông
tin. - CV liệt kê kỹ năng nhưng không có dự án chứng minh. - CV có dự án
và mô tả rõ đóng góp cá nhân. - CV có thành tựu định lượng và CV chỉ có
kết quả định tính. - JD có kỹ năng bắt buộc và kỹ năng ưu tiên. - JD
không nêu rõ một số yêu cầu. - CV không có chứng chỉ nhưng JD cũng không
yêu cầu. - CV có nội dung mâu thuẫn hoặc ngày tháng không rõ. - Tổng
điểm không vượt quá 100 và bằng tổng các điểm thành phần. - Mọi nhận
định quan trọng đều có bằng chứng hoặc được đánh dấu thiếu bằng chứng. -
Không sử dụng thuộc tính nhạy cảm để chấm điểm.

### Phase 5 -- Báo cáo hoàn thành

Sau khi triển khai, báo cáo: - Những chức năng đã thay đổi/thêm mới. -
Các file quan trọng đã sửa. - API và schema có thay đổi. - Cách chạy và
kiểm thử. - Kết quả test. - Các giới hạn còn tồn tại.

------------------------------------------------------------------------

## 13. Tiêu chí nghiệm thu

Chức năng được xem là đạt yêu cầu khi:

-   [ ] Phân tích JD thành yêu cầu bắt buộc và ưu tiên.
-   [ ] Đánh giá CV theo 6 nhóm tiêu chí mặc định.
-   [ ] Có thể thay đổi trọng số theo JD/vị trí.
-   [ ] Phân tích được vai trò, đóng góp, kết quả và độ liên quan của dự
    án.
-   [ ] Không chấm điểm chỉ dựa trên từ khóa hoặc độ dài CV.
-   [ ] Mỗi điểm số có giải thích và bằng chứng.
-   [ ] Phân biệt thông tin không có với thông tin chưa được chứng minh.
-   [ ] Có điểm mạnh, khoảng trống và câu hỏi phỏng vấn.
-   [ ] Career Potential là đánh giá bổ trợ, không cộng trùng vào tổng
    điểm mặc định.
-   [ ] Có cơ chế kiểm tra tổng điểm và dữ liệu đầu ra.
-   [ ] Không dùng thuộc tính nhạy cảm để đánh giá.
-   [ ] Kết quả hỗ trợ nhà tuyển dụng, không tự động thay thế quyết định
    của con người.

------------------------------------------------------------------------

**Thông điệp quan trọng nhất dành cho Agent:** Hãy xây dựng CVTest như
một hệ thống đánh giá mức độ phù hợp có giải thích và dựa trên bằng
chứng, không phải công cụ đếm từ khóa. Ưu tiên chất lượng bằng chứng,
mức độ liên quan đến JD, tính nhất quán và khả năng kiểm chứng của từng
nhận định.
