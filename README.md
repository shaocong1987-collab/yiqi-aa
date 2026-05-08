# 一起A了吧

《一起A了吧》是一个手机端优先的本地 AA 记账与结算工具。

当前版本已经迁移为：

- React
- TypeScript
- Vite
- Tailwind CSS
- PWA manifest + Service Worker
- IndexedDB 本地保存
- Vitest 结算测试

旧的零构建静态原型保留在 `legacy-static/`。

## 运行方式

本项目内已安装便携 Node/npm：

```text
.tools/node-v24.14.0-win-x64
```

PowerShell 运行：

```powershell
cd C:\Users\Administrator\Desktop\自娱自乐的AI\Codex
$env:Path = "C:\Users\Administrator\Desktop\自娱自乐的AI\Codex\.tools\node-v24.14.0-win-x64;" + $env:Path
npm run dev -- --port 5173
```

打开：

```text
http://127.0.0.1:5173
```

手机局域网试用：

```powershell
npm run dev -- --host 0.0.0.0 --port 5173
```

然后手机打开电脑局域网地址，例如：

```text
http://192.168.1.17:5173
```

注意：局域网 HTTP 可以试用网页，但多数手机浏览器不会允许 PWA 离线安装。

## PWA 离线安装

PWA 离线能力需要 HTTPS，`http://192.168.1.17:5173` 这种局域网 HTTP 地址通常不能注册 Service Worker。

### GitHub Pages 部署

项目已包含 GitHub Pages 自动发布工作流：

```text
.github/workflows/pages.yml
```

推荐流程：

1. 在 GitHub 新建一个仓库，例如 `yiqi-aa`。
2. 把本项目上传到仓库。不要上传：
   - `node_modules/`
   - `.tools/`
   - `dist/`
3. 打开仓库 `Settings -> Pages`。
4. `Build and deployment` 的 `Source` 选择 `GitHub Actions`。
5. 推送到 `main` 分支后，等待 `Actions` 里的 `Deploy to GitHub Pages` 运行完成。
6. 页面地址通常是：

```text
https://你的用户名.github.io/仓库名/
```

例如：

```text
https://yourname.github.io/yiqi-aa/
```

手机用这个 HTTPS 地址打开一次，看到“离线访问已准备好”后：

- Android Chrome：菜单 -> 添加到主屏幕 / 安装应用
- iPhone Safari：分享 -> 添加到主屏幕

安装后，电脑关闭也能从手机主屏幕打开。数据仍然保存在手机浏览器本地 IndexedDB，建议定期导出 JSON 备份。

### 手动构建

```powershell
npm run build
```

也可以把 `dist/` 手动部署到任意 HTTPS 静态站点，例如：

- Vercel
- Netlify
- GitHub Pages
- 自己的 HTTPS 服务器

## 常用命令

```powershell
npm test
npm run build
```

## 当前已支持

- 应用内 5 页面导航：
  - 活动列表
  - 活动设置
  - 费用列表
  - 新增/编辑费用
  - 结算结果
- 活动基础信息编辑
- 多活动本地保存、切换和移除
- 家庭添加和删除
- 成员添加和删除
- 新增家庭时自动创建 3 位大人成员
- 常用家庭/成员组合保存、快速添加、改名、更新和移除
- 费用新增、编辑、删除
- 搜索费用
- 按类别筛选
- 按付款人筛选
- 充值赠送折算
- 按家庭 A
- 按人头 A
- 只和几个人 A
- 这笔先不 A
- 主结算建议
- 家庭内部参考结算
- 简洁版总结和详细版总结
- 复制总结
- JSON 导入和导出
- IndexedDB 本地保存
- PWA 离线应用壳
- 结算核心测试

## 当前未支持

- 更细的导入错误定位
- Playwright 端到端测试
- 更精细的移动端录入动线

## 明天续作入口

先读取 `项目开发日志.md`，再重点看：

- `src/settlement.ts`
- `src/App.tsx`
- `src/storage.ts`
- `src/settlement.test.ts`
