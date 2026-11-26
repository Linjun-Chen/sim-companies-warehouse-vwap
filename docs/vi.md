# Sim Companies VWAP kho hàng

[Chọn ngôn ngữ](README.md)

Xem giá bình quân gia quyền theo khối lượng giao dịch (VWAP) và đơn giá sau giảm của hàng trong kho theo từng cấp chất lượng. Theo mặc định, kỳ tính là ngày hôm trước theo UTC. Biểu đồ ngày chính thức theo cấp chất lượng yêu cầu quyền Supporter trong trò chơi.

## Cài đặt và cập nhật

1. Tải `warehouse-vwap-v*.zip` trong mục **Assets** rồi giải nén. [Bản phát hành mới nhất](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. Mở `chrome://extensions`, bật **Chế độ dành cho nhà phát triển** và chọn **Tải tiện ích đã giải nén**. Chọn thư mục `warehouse-vwap` có tệp `manifest.json`.
3. Đăng nhập vào trò chơi và mở kho hàng. Mở rộng mục **VWAP kho hàng** để xem giá của các mặt hàng tồn kho, hoặc mở trang sản phẩm để xem giá theo cấp chất lượng.

Để cập nhật, chép đè các tệp mới vào thư mục đang dùng. Nhấn biểu tượng tải lại trên thẻ của tiện ích đã cài, sau đó làm mới trang kho hàng. Dùng lại thư mục cũ sẽ giữ cài đặt và giá đã lưu trong bộ nhớ đệm.

## Mức giảm giá và ngôn ngữ

Ở trang sản phẩm, nhấn vào tỷ lệ phần trăm bên cạnh đơn giá sau giảm. Bạn có thể đặt mức giảm mặc định cho sản phẩm và mức giảm riêng từ Q0 đến Q12. Để trống sẽ dùng cài đặt ở cấp trên. Nhập 0 để áp dụng giá không giảm. Giá được tính lại ngay khi lưu.

Tiện ích mặc định theo ngôn ngữ hiển thị của Chrome. Mở tiện ích trên thanh công cụ rồi vào **Tất cả cài đặt → Ngôn ngữ** để thay đổi.
