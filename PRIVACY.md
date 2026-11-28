# Warehouse VWAP Privacy Policy · 仓库 VWAP 隐私政策

Applies to Sim Companies Warehouse VWAP 1.3.3, an independent Chrome extension maintained by Linjun-Chen.

### Data and purpose

The extension reads the active game company and realm, in-stock product IDs and grades, product names, and the official daily chart data needed to show warehouse price references. Inventory quantities are used on the page to identify which products are in stock. The extension uses the player's settings to compute discounted prices.

To retrieve missing prices, the extension sends read-only HTTPS requests to Sim Companies using the browser's existing game session. A game-issued chart token is kept in Chrome's session storage and sent only to Sim Companies for chart requests. Game account passwords are entered through Sim Companies.

### Storage and sharing

Preferences, product labels, quote cache and request timing are kept in local extension storage. The quote cache covers the last two completed UTC dates. Older quotes are discarded during the next cache update. Temporary chart credentials are cleared with the Chrome session. Users can change preferences in Settings or remove the extension to delete its local storage.

Sim Companies is the only remote destination for the requests described above. The developer receives no user data. The extension operates without analytics or advertising and does not sell user data. It uses data only to display warehouse prices and follows the Limited Use requirements of the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use).

Contact the maintainer through the [project's GitHub issues page](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/issues).

## 简体中文

本政策适用于 Linjun-Chen 维护的独立 Chrome 扩展 Sim Companies 仓库 VWAP 1.3.3。

### 数据及用途

扩展读取当前游戏公司和服务器、库存商品编号和星级、商品名称以及用于显示仓库参考价格的官方日线。库存数量在页面上用于判断商品有无库存。扩展根据玩家设置计算折后价。

为读取缺失报价，扩展借助浏览器现有的游戏登录会话，向 Sim Companies 发出只读 HTTPS 请求。游戏签发的图表令牌保存在 Chrome 会话存储中，仅发送给 Sim Companies 用来读取图表。游戏密码由玩家在 Sim Companies 登录页面填写。

### 保存与共享

偏好设置、商品名称、报价缓存和请求时间保存在本机的扩展存储中。报价缓存覆盖最近两个已收盘的 UTC 日期，较早的数据在下次处理缓存时清除。图表临时令牌随 Chrome 会话结束而清除。用户可在设置页修改偏好，也可卸载扩展以删除其本机存储。

上文所述请求仅发送给 Sim Companies。开发者不会收到用户数据。扩展不做分析追踪、不展示广告，也不出售用户数据。扩展仅为展示仓库价格处理数据，并遵守 [Chrome 网上应用店用户数据政策](https://developer.chrome.com/docs/webstore/program-policies/limited-use)的用途限制要求。

可通过 [项目的 GitHub Issues](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/issues) 联系维护者。
