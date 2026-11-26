# Sim Companies 仓库 VWAP

[下载最新版](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest) · [English](README.en.md) · [15 种语言 / Languages](docs/README.md)

玩家社区 Chrome 扩展。打开仓库即可读取所有有库存的商品和星级，在总览或商品详情里查看官方成交量加权均价（VWAP）和折后单价。默认显示昨日 VWAP、折后价和统计日期。

## 在 Chrome 使用

1. 在最新版的 **Assets** 下下载 `warehouse-vwap-v*.zip` 并解压。[最新版下载](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest)
2. 在 `chrome://extensions` 开启开发者模式，点「加载已解压的扩展程序」，选中包含 `manifest.json` 的 `warehouse-vwap` 文件夹。[Chrome 加载说明](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world?hl=zh-cn#load-unpacked)
3. 登录游戏并打开仓库。展开「仓库 VWAP」看在库商品报价，或打开商品详情查看各星级的报价。官方分品质日线需要游戏的 Supporter 权限。

升级时把新版文件覆盖到原加载目录，在原扩展卡片点「重新加载」，确认版本号后再刷新仓库页。沿用原目录可继续使用本机设置和报价缓存。

点工具栏的扩展图标可以修改全局默认折扣和统计天数。从商品详情页打开「完整设置」会定位当前商品。在设置页顶部可手动切换语言，默认跟随 Chrome 界面语言。

## 自定义报价

- 在商品详情页点折后价旁的百分比，可直接编辑商品默认折扣和 Q0 到 Q12 的折扣。留空继承，填 0 表示不打折。保存后立即用本机报价重算折后价。若只显示 VWAP，可在「显示与取数」打开折后价。
- 可按官方百科的中英文名称或商品编号搜索。总览商品名在简体中文界面显示中文，其他语言显示英文。展开「按星级设置」编辑 Q0 到 Q12。留空继承，两个字段各自按「星级 → 商品 → 全局」生效。
- 「显示与取数」可调整自动读取范围、总览报价、显示字段、价格小数位、数字格式、库存行布局和主题。关闭自动读取后仍可复用本机缓存和游戏已加载的日线。

## 统计天数怎么算

统计天数可设为 1 到 365。填 1 取昨天，填 2 取前天和昨天。范围截至最近一个已收盘的 UTC 日，设置页会预览起止日期。

多天 VWAP = Σ（日线 VWAP × 当日成交量）÷ Σ（当日成交量）。例如前天以 $8.000 的 VWAP 成交 100 单位，昨天以 $10.000 的 VWAP 成交 300 单位，合并得 $9.500。下调 5% 后是 $9.025，再按所选小数位显示。无成交日的权重为零，整个区间无成交时会给出提示。

## 报价和取数

- 日线按服务器、商品和星级保存在本机。同一统计日重新打开仓库会直接显示已读取的报价，修改折扣或天数会用缓存日线重新计算。
- UTC 00:00（北京时间 08:00）检查仍打开的仓库页面。新日线到达前保留上次报价并标出实际日期，各星级拿到新结果后独立更新。浏览器关闭或仓库页休眠时，回到仓库页会自动检查补取。
- 缺报价的库存行可以点「日线」。在游戏图表中选择 Day（日线）后，扩展会复用该星级已经加载的官方数据。
- 扩展复用游戏打开仓库时加载的库存清单。默认排队读取当前服务器所有在库商品的实际星级。「显示与取数」可以把自动读取范围改为只读打开的商品。扩展主动请求全局合用至少五分钟的间隔，各标签页共享队列和缓存。
- 取数遇到排队、会话过期、图表权限或限流时，仓库行会显示对应状态。

## 开发与反馈

克隆源码后可直接在 Chrome 加载仓库根目录。测试用 Node.js 24 运行 `npm ci` 和 `npm test`。[GitHub Actions 测试结果](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/actions/workflows/test.yml)

问题可以提交到 [Issues](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/issues/new/choose)。源码采用 [MIT 许可](LICENSE)。
