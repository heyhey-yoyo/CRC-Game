# v0.7.0 Public Preview 上线清单

## 必须完成

- [ ] `npm ci` 与 lockfile 一致
- [ ] `npm run release:check` 全部通过
- [ ] `SITE_URL` 为正式 HTTPS 域名
- [ ] `dist/build-info.json` 版本和 commit 正确
- [ ] 未提交 `.env`、Token、Cookie、日志、患者数据或浏览器存档
- [ ] Cloudflare 预览环境响应头检查通过
- [ ] 404、重定向、PWA 安装、离线启动和升级提示通过
- [ ] 桌面 1440px、窄桌面 960px、手机 390px 无横向溢出
- [ ] 100%、125%、150% 缩放可完成关键流程
- [ ] 键盘完成导航、对话框、假设选择和地图区域选择
- [ ] W0→W2→W4→W6→W8 流程通过
- [ ] IndexedDB 存档、导出、导入、重置通过
- [ ] 科学边界、隐私、参考资料页面可访问
- [ ] 医学内容基线日期和证据卡一致
- [ ] 创建带说明的 Git tag：`v0.7.0-public-preview`

## 建议完成

- [ ] 邀请至少一名肿瘤学/转化研究背景审阅者做内容复核
- [ ] 邀请至少三名目标玩家做观察测试
- [ ] 使用真实低端设备测试快进和 Canvas 性能
- [ ] 使用 Firefox、Safari、Edge 做手工 smoke test
- [ ] 使用屏幕阅读器完成一次核心流程
- [ ] 在 Cloudflare Web Analytics 启用前重新评估隐私声明；默认保持关闭

## 暂不应宣称

- “临床模拟器”
- “患者疗效预测”
- “完整六章正式版”
- “经过临床验证”
- “所有浏览器和辅助技术均已认证”
