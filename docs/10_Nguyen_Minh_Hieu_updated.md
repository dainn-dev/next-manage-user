

## **2. Tên đề tài đăng ký** 

**_Hệ thống nhận diện biển số xe tự động tích hợp quản lý kiểm soát ra vào và phân tích lưu thông phương tiện tại đơn vị_** 

## **3. Mục tiêu nghiên cứu** 

## **_Mục tiêu tổng quát:_** 

Xây dựng hệ thống phần mềm tích hợp ứng dụng thị giác máy tính (YOLOv8 + OCR) để tự động nhận diện biển số xe ra vào cổng trong thời gian thực; kết hợp quản lý danh sách cấp phép phương tiện, kiểm soát tự động trạng thái cho phép/từ chối/cảnh báo, theo dõi lịch sử lưu thông, phân quyền truy cập đa cấp và hỗ trợ ra quyết định quản lý thông qua mô-đun phân tích dữ liệu và tổng hợp báo cáo tự động bằng AI (LLM) — hướng đến tự động hóa toàn diện quy trình kiểm soát an ninh phương tiện tại cơ quan/trường học. 

## **_Mục tiêu cụ thể:_** 

**-** Khảo sát và phân tích yêu cầu nghiệp vụ trong công tác kiểm soát an ninh, quản lý xe ra vào và quy trình đăng ký/cấp phép lưu thông phương tiện tại đơn vị khảo sát. 

**-** Ứng dụng mô hình YOLOv8 để phát hiện và định vị vùng biển số xe trong khung hình camera; kết hợp EasyOCR/PaddleOCR để trích xuất chuỗi ký tự biển số, đạt độ chính xác mục tiêu ≥90% trên tập dữ liệu thực tế bao gồm các điều kiện ánh sáng ban đêm, biển số bẩn/mờ và góc chụp lệch. 

- Thiết kế và xây dựng ứng dụng web phục vụ hai nhóm người dùng: 

(1) Nhân viên bảo vệ: xem luồng camera trực tiếp, theo dõi sự kiện ra/vào theo thời gian thực, nhận cảnh báo tức thì khi phát hiện biển số không có trong hệ thống; 

(2) Quản trị viên: có nhiệm vụ quản lý danh sách cấp phép, phân quyền người dùng, xem lịch sử và xuất báo cáo. Hệ thống tự động phân loại phương tiện thành ba trạng thái: Được phép (xe nội bộ) / Khách đã đăng ký / Cảnh báo xe lạ. 

**-** Xây dựng quy trình tiếp nhận và đồng bộ dữ liệu đăng ký cấp phép từ các nguồn dữ liệu đầu vào (Excel, CSV, Google Sheets), hỗ trợ chuẩn hóa và xác thực dữ liệu phương tiện. 

**-** Thiết kế cơ sở dữ liệu PostgreSQL theo mô hình quan hệ chuẩn hóa, bao gồm các thực thể: phương tiện (biển số, loại xe, chủ sở hữu), cấp phép (loại, thời hạn, phạm vi), sự kiện ra/vào (timestamp, ảnh chụp, kết quả nhận diện), người dùng hệ thống và nhật ký thao tác. Tích hợp Redis để caching danh sách cấp phép, đảm bảo thời gian đối soát < 100ms. 

**-** Xây dựng mô-đun phân tích dữ liệu lưu thông với các chức năng: thống kê lưu lượng xe theo giờ/ngày/tuần/tháng dưới dạng biểu đồ tương tác; tính tỷ lệ xe nội bộ/khách/xe lạ; phân tích thời gian lưu xe trung bình; phát hiện bất thường như biển số xuất hiện nhiều lần bất thường trong ngày, xe vào nhưng không ra sau khoảng thời gian quy định, hoặc biển số không có trong danh sách được phép. 

**-** Tích hợp mô-đun AI sử dụng LLM (thông qua API) để: tự động tổng hợp và diễn giải dữ liệu lưu thông thành văn bản báo cáo có ngữ nghĩa (hàng ngày/tuần/tháng); phát hiện và mô tả các sự kiện bất thường đáng chú ý; hỗ trợ truy vấn dữ liệu bằng ngôn ngữ tự nhiên (ví dụ: "Xe nào ra vào nhiều nhất tuần này?"). Đây là tính năng tăng cường, không phải thành phần cốt lõi của hệ thống. 

**-** Triển khai, kiểm thử và đánh giá hệ thống thông qua các tiêu chí về độ chính xác nhận diện biển số, tốc độ xử lý, tính ổn định và mức độ đáp ứng yêu cầu thực tế. 

## **4. Nội dung, phạm vi nghiên cứu** 

## **_Nội dung nghiên cứu:_** 

**-** Đề tài tập trung nghiên cứu và xây dựng hệ thống nhận diện biển số xe và quản lý cấp phép ra vào tại đơn vị cơ quan. Nội dung nghiên cứu gồm: 

**-** Nghiên cứu cơ sở lý thuyết về nhận dạng hình ảnh, thị giác máy tính (Computer Vision), các mô hình học sâu nhận diện biển số (YOLOv8, Fast OCR) và kiến trúc hệ thống quản lý an ninh. 

**-** Khảo sát hiện trạng quản lý xe ra vào tại đơn vị; phân tích yêu cầu nghiệp vụ và các hạn chế của phương pháp thủ công (ùn tắc giờ cao điểm, nhầm lẫn dữ liệu, mất thời gian kiểm tra). 

**-** Thiết kế kiến trúc hệ thống xử lý luồng (Stream processing) kết hợp web app, kết nối camera IP nhận diện biển số và điều khiển Barrier tự động. 

**-** Xây dựng quy trình chuẩn hóa và xác thực danh sách xe được cấp phép ra vào (xe cán bộ, sinh viên/nhân viên, khách liên hệ công tác). 

**-** Thiết kế cơ sở dữ liệu quản lý thông tin chủ xe, biển số, lịch sử ra/vào, ảnh chụp sự kiện và trạng thái cấp phép. 

- Xây dựng mô-đun phân tích dữ liệu thống kê lượt xe ra vào, thời gian cao điểm, cảnh 

- báo biển số không có trong hệ thống cấp phép. 

**-** Xây dựng Dashboard trực quan hóa dữ liệu lưu thông theo thời gian thực cho bộ phận an ninh và ban quản lý. 

**-** Tích hợp mô-đun AI (LLM) hỗ trợ sinh báo cáo tổng hợp tình hình an ninh/lưu thông hàng tuần, hàng tháng. 

- Triển khai, kiểm thử thực địa và đánh giá hệ thống. 

## **_Phạm vi nghiên cứu:_** 

**-** Đề tài tập trung xây dựng hệ thống nhận diện biển số và quản lý ra vào cho phương tiện ô tô và xe máy tại các cổng ra vào của một đơn vị cơ quan/trường học. Dữ liệu bao gồm hình ảnh biển số thu nhận từ camera, thông tin đăng ký cấp phép xe và lịch sử sự kiện ra/vào. **-** Hệ thống được thử nghiệm trong phạm vi một cơ quan/trường học cụ thể. Đề tài không đi sâu vào việc chế tạo phần cứng barrier vật lý hay phát triển giải pháp quản lý giao thông đô thị quy mô lớn. 

## **5. Phương pháp nghiên cứu / Công nghệ dự kiến sử dụng** 

## **_Phương pháp nghiên cứu:_** 

**Phương pháp nghiên cứu tài liệu:** Thu thập, tổng hợp các công trình nghiên cứu về xử lý ảnh, nhận diện biển số xe Việt Nam, mô hình YOLO, OCR và kiến trúc hệ thống IoT/Camera surveillance. 

**Phương pháp khảo sát và phân tích nghiệp vụ:** Khảo sát hạ tầng camera, quy trình kiểm soát xe ra vào tại đơn vị, phân tích yêu cầu đối soát cấp phép. 

**Phương pháp xử lý ảnh và AI:** Huấn luyện/tinh chỉnh mô hình nhận diện vị trí biển số (YOLO) và mô hình trích xuất ký tự (OCR) thích ứng với điều kiện ánh sáng, góc chụp thực tế. 

**Phương pháp phân tích và thiết kế hệ thống:** Thiết kế cơ sở dữ liệu, API kết nối xử lý thời gian thực, giao diện giám sát cho bảo vệ và quản trị viên. 

**Phương pháp thực nghiệm:** Đánh giá độ chính xác nhận diện trên tập dữ liệu thực tế (biển số bẩn, mờ, ban đêm) và hiệu năng đối soát cấp phép ra vào. 

## **_Công nghệ dự kiến:_** 

- **Nhận diện & Xử lý ảnh:** Python, OpenCV, YOLOv8, EasyOCR / PaddleOCR. 

- **Frontend:** React, Tailwind CSS, Apache ECharts (Trực quan hóa dashboard). 

   - **Backend:** Node.js (Express) hoặc Python (FastAPI). 

   - **Cơ sở dữ liệu:** PostgreSQL (Lưu trữ dữ liệu quan hệ), Redis (Caching dữ liệu kiểm 

- soát nhanh). 

   - **Trí tuệ nhân tạo:** Mô hình ngôn ngữ lớn (LLM) thông qua API (Hỗ trợ tổng hợp báo 

cáo). 

- **Xác thực & Phân quyền:** JSON Web Token (JWT). 

## **6. Sản phẩm dự kiến** 

Sau khi hoàn thành, đề tài dự kiến đạt được các sản phẩm sau: 

1. Báo cáo nghiên cứu đề tài tốt nghiệp hoàn chỉnh. 

2. Mô-đun AI nhận diện biển số xe thời gian thực từ luồng camera với độ chính xác cao. 

3. Hệ thống phần mềm quản lý ra vào, cho phép kiểm tra tự động trạng thái cấp phép (cho phép / từ chối / cảnh báo xe lạ). 

4. Mô-đun quản lý danh sách xe được cấp phép (thêm, xóa, sửa, nhập dữ liệu từ Excel/CSV). 

5. Dashboard trực quan hóa thống kê lượt xe ra vào, biểu đồ lưu lượng theo thời gian và báo cáo xe tồn đọng trong đơn vị. 

6. Mô-đun AI hỗ trợ tự động sinh báo cáo tổng hợp tình hình lưu thông phục vụ công tác quản lý. 

Bổ sung thêm tài liệu tham khảo 

