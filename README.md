# 网盘 netdisk

基于 Next.js 15（App Router）+ TypeScript + Tailwind CSS 的全栈个人网盘。

## 功能特性

- 🗂️ 文件管理：上传 / 下载 / 新建文件夹 / 重命名 / 移动 / 删除
- 👥 多账号隔离：每个账号独立空间，互不可见
- 💾 配额限制：每个账号默认 500MB 空间（超额上传返回 413）
- 🔗 分享链接：生成 123 云盘风格的分享页，支持图片 / 视频 / 音频 / PDF / 文本 / Markdown 在线预览，可设置有效期（永久 / 1 天 / 7 天 / 30 天），可撤销
- 🔐 登录鉴权：HMAC 签名的 httpOnly Cookie + 有状态会话，SHA-256 密码哈希
- 🛠️ 管理后台：账号管理、文件总览、登录日志、会话管理、全局设置（含「禁止注册」开关）

## 技术栈

- Next.js 15（App Router）
- TypeScript
- Tailwind CSS
- 文件系统存储（`diskdata/` 目录：元数据 / 文件内容 / 账号 / 会话 / 日志）

## 本地运行

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

默认管理员账号见 `diskdata/users.json`（首次运行自动初始化）。

> 注意：`diskdata/` 目录包含运行时产生的用户数据与上传文件，已在 `.gitignore` 中排除，不会进入版本库。
