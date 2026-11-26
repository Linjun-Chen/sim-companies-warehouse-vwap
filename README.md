# Sim Companies 仓库 VWAP

[English](README.en.md)

玩家社区 Chrome 扩展。在仓库商品详情页显示各库存星级的官方成交量加权均价（VWAP）和折后单价。自动识别 Q0 到 Q12。默认显示昨日 VWAP、折后价和统计日期。

## 在 Chrome 使用

1. 从 [Releases](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/releases/latest) 下载 `warehouse-vwap-v*.zip` 并解压。在 `chrome://extensions` 开启开发者模式，选择「加载已解压的扩展程序」，选中包含 `manifest.json` 的 `warehouse-vwap` 文件夹。克隆源码后也可以直接加载仓库根目录。
2. 升级时把新版文件覆盖到原加载目录，在原扩展卡片点「重新加载」，再刷新游戏页面。扩展会迁移原有的全局折扣和仍在本机的日线缓存。
3. 点工具栏扩展图标可修改默认下调幅度和统计天数。在仓库商品页点「完整设置」会直接打开当前商品的规则。设置页顶部可切换简体中文、English 或跟随 Chrome，工具栏面板和仓库报价会随之更新。

## 自定义报价

- 可按官方百科的中英文名称或商品编号搜索。展开「按星级设置」编辑 Q0 到 Q12。留空继承，两个字段各自按「星级 → 商品 → 全局」生效。
- 统计天数可设为 1 到 365。填 1 只取昨天，填 2 合并前天和昨天。设置会预览确切的 UTC 日期范围。多天 VWAP 按各日成交量加权，报价说明会显示选定日期内有成交的天数。
- 「显示与取数」可调整报价显示、价格小数位、库存行布局和主题。关闭自动读取后仍可复用游戏已加载的日线。

## 报价和取数

- 日线按服务器、商品和星级保存在本机。同一统计日重新打开仓库会直接显示已读取的报价，修改折扣或天数会用缓存日线重新计算。
- UTC 00:00（北京时间 08:00）检查仍打开的仓库商品页。新日线到达前保留上次报价并标出实际日期，各星级拿到新结果后独立更新。浏览器关闭或仓库页休眠时，回到仓库页会自动检查补取。
- 缺报价的库存行可以点「日线」。在游戏图表中选择 Day（日线）后，扩展会复用该星级已经加载的官方数据。
- 开启自动读取时，只查询打开的仓库商品及其实际库存星级。扩展主动请求全局合用至少五分钟的间隔。首次需要申请图表令牌，随后逐档读取，保持仓库标签页打开即可。
- 原生分品质图表需要 Supporter 权限。界面区分排队、令牌过期、登录、权限拒绝、限流、数据格式异常和指定日期内无成交。

## 开发与反馈

用 Node.js 24 运行 `npm ci` 和 `npm test`。Chrome 加载扩展时无需安装测试依赖。提交和 PR 可在 [Actions](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/actions/workflows/test.yml) 查看测试结果。

问题可以提交到 [Issues](https://github.com/Linjun-Chen/sim-companies-warehouse-vwap/issues/new/choose)。源码采用 [MIT 许可](LICENSE)。
