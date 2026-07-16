---
name: vehicle-parking-management-ui
description: Thiết kế, triển khai và rà soát giao diện web quản lý bãi xe, xe ra/vào, camera, sự kiện, cảnh báo, nhân viên, báo cáo, billing và cấu hình. Dùng khi tạo hoặc chỉnh sửa admin/operator UI cần responsive desktop-mobile, font tiếng Việt đúng, container thống nhất, component/token dùng chung, bảng dữ liệu, bộ lọc, form, modal, trạng thái loading/empty/error/offline và mật độ hiển thị phù hợp.
---

# Thiết kế giao diện quản lý bãi xe

## Mục tiêu

Tạo UI nghiệp vụ gọn, dễ quét, đọc tiếng Việt tốt và dùng được thật trên desktop lẫn mobile. Ưu tiên nhận biết nhanh biển số, xe, cổng/làn, thời điểm, trạng thái xác thực, camera và cảnh báo.

## Quy trình bắt buộc

1. Khảo sát framework, shell/layout, token, component UI và các page hiện có trước khi sửa.
2. Tìm hoặc tạo component dùng chung trước khi sửa từng page: `AdminPage`, `AdminPageHeader`, `FilterBar`, `DataSurface`, `ResponsiveTable`, `MobileCardList`, `Pagination`, `EmptyState`.
3. Không để từng page tự đặt `max-width`, padding ngoài, font-size, height control hoặc màu nền riêng nếu đã có token/component chung.
4. Thiết kế mobile-first: hoàn thiện layout ở 360px, 390px, 768px, 1024px, 1280px trước khi coi desktop xong.
5. Kiểm tra dữ liệu dài: biển số dài, tên người dài, site/zone dài, lỗi API, mất realtime/camera, empty state và permission-denied.
6. Chạy kiểm tra phù hợp dự án sau khi sửa: format/diff check, test liên quan, build hoặc compile. Nếu build fail do môi trường, nêu rõ bước đã pass và nguyên nhân fail.

## Font và tiếng Việt

- Dùng một font sans-serif hỗ trợ tiếng Việt đầy đủ cho toàn UI. Với `next/font`, phải load subset `vietnamese` nếu font hỗ trợ.
- Map `body`, `display` và các biến font chung về cùng font UI. Chỉ dùng mono riêng khi thật sự cần; không dùng mono cho label tiếng Việt nếu font mono không hỗ trợ dấu tốt.
- Biển số, ID, thời gian và số liệu dùng `font-variant-numeric: tabular-nums` thay vì đổi sang font khác.
- Không để source chứa mojibake như `Ã`, `Â`, `â€”`, `â€¦`, `áº`, `á»`. Nếu thấy UI hiển thị kiểu `nháº`, kiểm tra encoding dữ liệu/source trước khi chỉnh CSS.
- Không dùng font-size quá nhỏ để nhét nội dung; hãy giảm số cột, đổi layout hoặc rút gọn nhãn.

## Typography chuẩn

Thiết lập token và dùng xuyên suốt. Mobile cần dễ đọc hơn desktop compact.

| Mục đích | Mobile | Desktop | Ghi chú |
|---|---:|---:|---|
| Caption/metadata phụ | 12px / 16px | 12px / 16px | Không dùng cho nội dung cần quyết định |
| Body/table/filter | 14px / 20px | 13-14px / 18-20px | Mặc định cho admin UI |
| Input/select/button | 16px / 22px | 14px / 20px | Mobile 16px để tránh iOS zoom |
| Card title/section title | 16px / 24px | 16-18px / 24-26px | Giữ tối đa 2 dòng |
| Page title | 22-24px / 30px | 28-32px / 36-40px | Không dùng title quá lớn trên CRUD |
| KPI chính | 24-30px / 32px | 28-36px / 40px | Chỉ dùng cho số liệu quan trọng |

Quy tắc:

- Một card chỉ dùng tối đa 3 cấp chữ: title, body, metadata.
- Label form dùng 13-14px, weight 500-600, đặt trên input.
- Placeholder không được thay label.
- Badge/status dùng 12-13px, có icon/text; không chỉ truyền trạng thái bằng màu.

## Layout và container

Tất cả admin/operator page phải đi qua container chung.

- `AdminPage`: `width: 100%`, `min-width: 0`, căn giữa, padding responsive.
- Padding chuẩn: mobile 16px, tablet 20px, desktop 24px.
- Gap section: mobile 16-20px, desktop 20-24px.
- Page rộng như dashboard, monitoring, events, tables: max khoảng `104rem`/`1600px`.
- Page form/detail tuần tự: dùng cùng `AdminPage`, chỉ giới hạn chiều rộng phần form bên trong nếu cần.
- Không dùng lại các wrapper riêng kiểu `container mx-auto py-8`, `admin-mobile-page mx-auto max-w-*`, `platform-page max-w-*` nếu dự án đã có container admin chung.

Mỗi page theo khung:

1. `AdminPageHeader`: eyebrow/breadcrumb, title, description ngắn, actions.
2. `FilterBar`/toolbar: search, site/zone, thời gian, trạng thái, reset.
3. `Content`: KPI, camera, table/card list, form hoặc detail.
4. `Pagination/Footer`: tổng bản ghi, page size, next/prev.

## Responsive breakpoints

- `<640px`: single column, actions full-width hoặc 2 cột tối đa, filter stack, table chuyển card/list hoặc cuộn ngang có chủ đích.
- `640-1023px`: 2 cột cho KPI/card, filter wrap, sidebar vẫn là drawer nếu không đủ rộng.
- `1024-1279px`: sidebar có thể cố định, content 2-3 cột, table rút bớt cột phụ.
- `>=1280px`: dashboard/table đầy đủ, ưu tiên mật độ dữ liệu nhưng vẫn giữ khoảng trắng đủ quét.

Không để horizontal overflow ngoài ý muốn ở `body/main`. Nếu table cần rộng, bọc bằng scroll container riêng và giữ action chính nhìn thấy.

## Control, touch target và spacing

- Touch target mobile tối thiểu 44px. Button/input/select mobile cao 40-44px; desktop 36-40px.
- Icon-only button phải có accessible name, tooltip nếu cần và kích thước hit area không dưới 40px.
- Button nhóm action: mobile stack hoặc full-width; desktop inline.
- Card padding: mobile 16px, desktop 16-20px; form/card rộng có thể 24px trên desktop.
- Radius: control 6-8px, card/modal 8-12px; không trộn quá nhiều radius.
- Dùng màu token (`bg-card`, `bg-muted`, `border-border`, semantic status). Không hard-code `bg-white`, `text-gray-*`, `border-gray-*` trong admin surface nếu theme đã có token.

## Component patterns

### Header và actions

- Header dùng grid/flex responsive: text trước, actions sau.
- Action chính rõ ràng; action phụ dùng outline/ghost.
- Trên mobile, actions không được ép chen ngang title.

### Filter bar

- Search input chiếm full width mobile, flex-grow desktop.
- Select/date/status wrap theo dòng; không cố định width quá lớn trên mobile.
- Nút `Xóa lọc`/`Làm mới` phải dễ chạm, không icon-only nếu chưa rõ.
- Filter bar có nền/surface chung và không làm layout nhảy khi loading.

### Data table và mobile list

- Desktop table: header cao khoảng 40-44px, row 44-52px, cell padding 12px.
- Cột mặc định cho xe: biển số, ảnh/snapshot, loại/đối tượng, thời gian, cổng/làn/site, trạng thái, thao tác.
- Căn trái chữ; căn phải số liệu; không căn giữa toàn bộ bảng.
- Mobile: ưu tiên card/list với các trường chính:
  - biển số hoặc tên đối tượng;
  - trạng thái;
  - thời gian;
  - cổng/làn/site;
  - action chính.
- Nếu chưa làm card/list, cho table scroll ngang trong `overflow-x-auto`, không để page body scroll ngang.
- Truncate dữ liệu dài có tooltip/title hoặc detail view; không để một cell phá layout.

### KPI và realtime card

- Mobile: KPI 1 cột hoặc 2 cột khi số liệu ngắn; không ép 4 cột.
- Tablet: 2-3 cột; desktop: 4 cột nếu đủ rộng.
- Mỗi KPI có label, value, note ngắn, icon/tone nhất quán.
- Realtime/offline state phải hiển thị rõ `Đang nhận realtime`, `Mất kết nối`, `Dữ liệu trễ`, `Đang polling`.

### Form và modal

- Form mobile một cột; desktop chỉ chia cột khi field ngắn và cùng ngữ cảnh.
- Error hiển thị ngay dưới field; toast chỉ là bổ sung.
- Modal ngắn rộng 480-640px desktop; mobile gần full-width với padding 16px.
- Quy trình dài dùng drawer/page riêng thay vì modal chật.
- Hành động nguy hiểm cần xác nhận và tone destructive rõ.

### Empty, loading, error, permission

- Loading dùng skeleton giữ kích thước gần content thật.
- Empty state có icon, title, mô tả và action tiếp theo nếu có.
- Error state nêu việc gì fail và cách thử lại.
- Permission-denied không để trống; giải thích vai trò/phạm vi cần thiết.

## Nghiệp vụ bãi xe

### Dashboard/monitoring

- Đặt lane/camera/realtime và cảnh báo hiện thời ở vùng ưu tiên.
- Hiển thị KPI: xe trong bãi, lượt vào, lượt ra, sức chứa, cảnh báo chưa xử lý.
- Timeline sự kiện phải có biển số, hướng vào/ra, người/xe liên quan, cổng/làn, thời gian.
- Không auto-rotate làm mất ngữ cảnh người vận hành.

### Xe, lịch sử ra/vào, tìm biển số

- Biển số là điểm neo thị giác: weight 600-700, tabular nums, dễ copy.
- Search biển số phải đủ lớn trên mobile, có placeholder ví dụ và hỗ trợ nhập thiếu dấu gạch/chấm.
- Ảnh/snapshot phải có fallback rõ nếu lỗi hoặc chưa có dữ liệu.
- Trạng thái `Trong bãi`, `Đã ra`, `Không xác định`, `Cần kiểm tra` phải khác nhau bằng label + màu + icon.

### Camera, cổng và cảnh báo

- Cổng/camera online/offline phải nhìn thấy trong 1-2 giây.
- Cảnh báo critical không bị chôn trong table; cần surface riêng hoặc badge nổi bật.
- Dữ liệu live phải phân biệt với dữ liệu polling/cache.

## Accessibility

- Duy trì focus visible và thứ tự tab hợp lý.
- Icon-only button phải có `aria-label`.
- Form control phải có label thật.
- Màu trạng thái phải đạt tương phản WCAG AA và có text tương ứng.
- Toast/modal không được che dữ liệu giám sát quan trọng quá lâu.

## Checklist hoàn thành

- Tất cả page cùng dùng container/header/token chung.
- Font tiếng Việt hiển thị đúng, không fallback lẫn lộn và không có mojibake trong source.
- Mobile 360px không overflow body; actions/filter có thể chạm dễ.
- Font mobile không nhỏ hơn 14px cho nội dung chính và 16px cho form control nếu có nhập liệu.
- Dashboard/KPI/table/filter/form/modal dùng breakpoint hợp lý, không ép desktop layout xuống mobile.
- Loading/empty/error/offline/permission-denied đầy đủ.
- Không hard-code màu/spacing/font trùng lặp khi có thể đưa vào token hoặc component chung.
- Đã chạy kiểm tra phù hợp và ghi rõ mọi giới hạn môi trường nếu có.
