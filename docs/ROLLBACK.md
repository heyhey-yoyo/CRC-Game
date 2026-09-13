# 回滚指南

## 方法一：Cloudflare Pages 回滚部署

适用于代码已上线但发现页面、内容或缓存问题。

1. 进入 Cloudflare Dashboard → Workers & Pages → 当前项目 → Deployments。
2. 找到最近一个已验证正常的生产部署。
3. 选择回滚或重新部署该版本。
4. 打开正式域名确认 `build-info.json` 已恢复。
5. 如果 Service Worker 仍显示新版本，关闭所有站点标签页后重新打开；必要时在浏览器站点设置中清除该站点缓存。

## 方法二：Git revert

```bash
git log --oneline
git revert <有问题的提交哈希>
git push origin main
```

Cloudflare Git 集成会自动构建回滚提交。不要用强制推送覆盖历史。

## 方法三：从已验证提交重建静态产物

在独立检出目录中取得明确的已验证提交，按 `README.md` 安装锁定依赖并运行 `npm run release:check`。检查生成的 `dist/build-info.json`，将该提交对应的 `dist/` 用于单独的 Direct Upload 项目。构建输出是 `dist/`，不依赖未标明来源的历史交付包。现有 Git 集成项目优先使用前两种回滚方式，避免改变部署模式。

## 内容包单独回滚

若问题只来自医学内容：

1. 恢复 `data/` 中上一个版本；
2. 同步恢复 `contentVersion`、`medicalBaseline` 和相关证据卡；
3. 运行内容校验和固定种子测试；
4. 递增应用补丁版本以使 Service Worker 更新缓存；
5. 发布并验证旧存档仍能载入。
