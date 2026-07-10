# CLAUDE.md

## Code navigation: dùng CodeGraph thay vì đọc từng file

Dự án này đã được index bằng CodeGraph (`.codegraph/codegraph.db`, 325 files). Khi cần
hiểu code, **ưu tiên truy vấn CodeGraph trước** để định vị symbol và quan hệ giữa chúng,
chỉ mở đọc trọn file khi thực sự cần xem chi tiết implementation.

### Quy trình
1. Định vị bằng `codegraph query` / `callers` / `callees` / `impact`.
2. Đọc đúng file:dòng mà CodeGraph trỏ tới (dùng Read với offset), không quét cả thư mục.
3. Sau khi sửa code, chạy `codegraph sync` để cập nhật index.

### Lệnh thường dùng
```bash
codegraph query "<tên>" -l 10        # tìm symbol (function/class/method/route...)
codegraph query "<tên>" -k function  # lọc theo loại node
codegraph callers "<symbol>"         # ai gọi symbol này
codegraph callees "<symbol>"         # symbol này gọi những gì
codegraph impact "<symbol>" -d 2     # đổi symbol này thì ảnh hưởng tới đâu
codegraph affected <file...>         # test nào bị ảnh hưởng bởi file thay đổi
codegraph files --filter <dir>       # cấu trúc file trong index
codegraph status                     # thống kê index
codegraph sync                       # đồng bộ thay đổi sau khi sửa code
```
Thêm `-j` / `--json` cho output máy đọc được.

### Khi nào vẫn đọc file trực tiếp
- Cần xem toàn bộ logic một hàm/khối mà CodeGraph đã trỏ tới (mở đúng file:dòng).
- File chưa được index (config, docs, asset) hoặc CodeGraph không trả kết quả phù hợp.


## Bắt buộc kiểm chứng sau khi sửa backend

Sau **mỗi lần sửa code backend** (thư mục `backend/`), phải chạy và đảm bảo **cả hai** lệnh
dưới đây thực thi thành công trước khi coi là hoàn thành. Chạy từ trong thư mục `backend/`.

### 1. `mvn clean install` — build + test phải PASS
```bash
cd backend
mvn clean install
```
- Chỉ coi là thành công khi kết thúc bằng `BUILD SUCCESS` (exit code 0) và **không có test nào fail**.
- Nếu `BUILD FAILURE` hoặc có test đỏ: đọc log/`target/surefire-reports/`, tìm root cause và
  sửa cho tới khi xanh. Không được bỏ qua test đỏ hay skip test để lách qua.

### 2. `mvn spring-boot:run` — app phải khởi động sạch
```bash
cd backend
mvn spring-boot:run
```
- Lệnh này chạy server **vô thời hạn** (không tự thoát). "Thành công" nghĩa là app **boot sạch**:
  thấy dòng `Started VehicleManagementApiApplication in <N>s` và **không có exception khi khởi động**
  (không có `APPLICATION FAILED TO START`, không stack trace lúc bootstrap).
- Cách kiểm chứng mà không bị treo turn: chạy nền và chờ tín hiệu boot rồi tự dừng, ví dụ ghi log
  ra file rồi chờ chuỗi khởi động xuất hiện; nếu thấy `APPLICATION FAILED TO START` thì fail.
  Sau khi xác nhận boot xong phải **kill tiến trình** (không để server chạy lay lắt).

Chỉ báo "đã xong" khi cả hai lệnh trên đều đạt. Nếu một trong hai fail thì tiếp tục sửa, không dừng.


## Cấm sửa migration đã chạy thành công xuống DB

Các file migration Flyway (`backend/src/main/resources/db/migration/V*.sql`) **đã apply thành công**
xuống database là **bất biến (immutable)** — tuyệt đối **không được sửa nội dung, đổi tên, hay xóa**.

- Flyway lưu checksum của từng migration đã chạy trong bảng `flyway_schema_history`. Sửa một file
  đã apply sẽ làm lệch checksum → `flyway validate` fail và app **không khởi động được**
  (`Migration checksum mismatch`).
- Cần thay đổi schema/dữ liệu? **Luôn tạo migration MỚI** với version cao hơn kế tiếp
  (ví dụ đang có tới `V47__...` thì thêm `V48__<mô_tả>.sql`), không đụng vào các V cũ.
- Chỉ được sửa một migration khi nó **chưa từng apply xuống bất kỳ DB nào** (mới thêm trong cùng
  nhánh chưa merge/deploy, chưa nằm trong `flyway_schema_history`). Nếu không chắc → coi như đã chạy
  và tạo file mới.
- Không "sửa cho đẹp", format lại, hay đổi khoảng trắng trên migration cũ vì mọi thay đổi byte đều
  đổi checksum.






