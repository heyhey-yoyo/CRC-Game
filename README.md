# 肠境：免疫围城

一个可部署到 Cloudflare Pages 的静态教育策略游戏。玩家在不完整证据下形成机制假设，选择受约束的治疗路径，并在 W2、W4、W6、W8 事件节点重新判断疾病控制、生态风险和治疗可持续性。

> 本项目仅用于教育与游戏。不对应真实患者，不提供剂量、处方、诊断或疗效预测，也不能替代指南、MDT、临床试验或医疗专业人员。

## 主要功能

- 单个 20–30 分钟病例：在不完整证据下形成机制假设（最多 3 个），选择受约束的治疗路径
- 在 W2、W4、W6、W8 事件节点重新判断疾病控制、生态风险与治疗可持续性，W8 后做三维复盘与同种子反事实路径比较
- 存档自动保存在本机浏览器，可导出备份、导入恢复，旧版本存档自动迁移
- 当前为 Public Preview：只有一个病例，不等于 GDD 所规划的六章完整产品
- 科学上是机制教学模型：适应证和路径结构由公开证据约束；内部数值是无量纲游戏参数，不是临床模型

## 界面风格

页面采用 `ydchen-portfolio` 的暖米白、浅灰与赤陶色视觉系统，使用衬线标题和扁平化面板；病例结构、游戏流程、Canvas 生态图和医学边界保持不变。

本项目为普通项目类。页眉桌面 72px、手机（≤640px）64px；方章 48×48px / 40×40px，标题衬线 18px/400/1.3、手机 16px，副标题无衬线 12px/400/1.4；标志与标题间距 12px，标题与副标题间距 2px。

页眉内容区最大宽度 1280px（含两侧各 16px 内边距），整体居中；品牌和标题靠左，操作区靠右，窄屏换行后仍保持该对齐。品牌页眉在文档顶部正常排布，随页面滚走，不固定或吸顶；表格内部表头、侧边工具和手机底部导航可按功能保留。

正文采用统一系统无衬线字体，默认 16px / 1.6；标题采用 Georgia、Times New Roman、Songti SC、STSong 衬线族。数字与代码可使用 SFMono-Regular、Consolas、Liberation Mono、Microsoft YaHei 等宽族。按钮和输入通常 15px，辅助文字 12–14px，密集科学数据允许有理由的局部调整。页面底色 #f3eee5、正文 #24221f、赤陶强调 #a94f31，柔和底色上的强调文字 #823a25；科学分类色、热图、作品主题与状态色保留必要区分度。

## 数据与隐私

默认没有账号、广告、分析 SDK、第三方追踪器或自动云上传。游戏进度自动保存在本机浏览器，只有用户主动导出时才产生文件；可导出存档备份、导入恢复，旧版本存档会自动迁移到新格式。清理浏览器网站数据或更换设备可能导致进度丢失。

## 本地运行

需要 Node.js 20 或更高版本。浏览器测试使用项目内固定版本的 Playwright。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run validate:content
npm test
npm run build
```

首次运行浏览器测试时：

```bash
npm run test:browser:install
npm run test:browser
```

旧的 Python 冒烟脚本与其依赖清单仅作为兼容参考保留；默认质量门禁和 Cloudflare 构建只使用上述项目内的 Node/Playwright 流程。

完整发布检查：

```bash
npm run release:check
```

## 部署

生产构建：

```bash
SITE_URL=https://你的正式域名 npm run build
```

产物位于 `dist/`。设置 `SITE_URL` 后，构建器会生成：

- `sitemap.xml`
- 带正式域名的 `robots.txt`
- Canonical 和 Open Graph URL
- `build-info.json`
- 完整 SHA-256 校验清单

Cloudflare Pages 推荐设置：

- Production branch：`main`
- Build command：`npm run build`
- Build output directory：`dist`
- Environment variable：`SITE_URL=https://你的正式域名`
- Node.js：22

## License

- 程序：MIT，见 `LICENSE`
- 原创内容与机制文档：CC BY 4.0，见 `CONTENT-LICENSE.md`
- 外部资料仍受其原始许可和版权约束

---

> AI 编程代理请阅读 [AGENTS.md](./AGENTS.md) 了解代码架构、测试策略与开发约定。

---

## 维护与兼容

手机首页保留方法与参考资料入口，修正网格子项的宽度约束；首页粒子采用暖色，保留独立高对比模式。

应用更新会等待新版接管后刷新；准备较慢时显示等待提示，更新失败可重试。证据正文、字段名和来源链接采用适合浅色背景的文字颜色。

更新按钮仅在新版 Service Worker 实际接管后刷新；超过 8 秒只提示等待，通信失败可重试。证据卡与辅助文字提高对比度，方法页和游戏页共用品牌页眉。导出链接延迟回收；新增真实界面存档重载、同文件二次导入及更新竞态浏览器测试。

生产构建为样式链接附加内容摘要，并同步 Service Worker 预缓存地址和缓存名，避免 CDN 同名旧样式残留；独立 HTML 仍内嵌样式。构建回归覆盖全部说明页和离线资源一致性。

游戏工作区去掉固定页眉占位，桌面侧边导航独立布局；手机底部导航保持可用。

检查命令与技术约束见 [AGENTS.md](./AGENTS.md)。上述浏览器验证描述对应 2026-09-13 的维护验收；后续修改仍须重新验证。

## AI 维护提醒

> **⚠️ 任何修改此项目的 AI 代理（Claude Code、Cursor、Copilot 等）都必须同步更新本文件与 [AGENTS.md](./AGENTS.md)。**
>
> - 修改医学相关内容必须遵守「临床事实 / 机制证据 / 游戏抽象」三类分离边界并同步更新证据登记
> - 发布新版本时同步更新四处版本字符串（`package.json`、`js/app.js`、`js/sim-engine.js`、`data/content-manifest.json`）
