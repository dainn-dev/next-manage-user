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
