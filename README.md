# Beira Cloud · 老大手动跑版

> 把 V3 单文件跟单系统**5 分钟**变成工人能在网址登录用的版本。

## 这是什么

- 一个 Node.js 服务器，把你电脑上的 V3 HTML 变成工人可以登录用的网址
- 数据存在 `./data/store.json`（一个 JSON 文件），跟你的 V3 完全一样的格式
- 通过 Cloudflare Tunnel（免费、零配置）把 `localhost:3000` 暴露到公网
- 工人进 URL → 输账号密码 → 进系统

**总成本：0 元**  
**总开发：已经写完**  
**总部署时间：3 条命令**

## 上线步骤（老大你自己 5 分钟搞定）

### 1. 启动服务器（在你电脑上）

```bash
cd beira-cloud
npm install      # 装依赖，~5s
npm start        # 启动服务器，监听 http://localhost:3000
```

会看到：
```
🚀 Beira Cloud · 老大手动跑版
   URL:    http://localhost:3000
   Health: http://localhost:3000/api/health
   Data:   C:\...\beira-cloud\data\store.json
```

### 2. 暴露公网（用 Cloudflare Tunnel 免费的）

下载 `cloudflared`（单文件 exe，不需要安装）：

```bash
# Windows (PowerShell)
winget install Cloudflare.cloudflared

# 或者直接下载
# https://github.com/cloudflare/cloudflared/releases/latest
```

启动隧道，**另开一个窗口**跑：

```bash
cloudflared tunnel --url http://localhost:3000
```

会输出类似：
```
Your quick Tunnel has been created!
+-------------------------------------------+
|  https://random-name-here.trycloudflare.com |
+-------------------------------------------+
```

**把这个 URL 复制发给工人。** 临时地址，名字随机，每次重启会变。第一次用足够。

### 3. 工人进系统

工人打开 `https://random-name-here.trycloudflare.com`：
- 输入 `worker1 / pass123` → 登录 → 看到你的实时数据
- 输入 `admin / admin123` → 你自己用

## 3 个默认账号

| 用户名 | 密码 | 权限 |
|---|---|---|
| `admin` | `admin123` | 看全部数据、可以改所有字段、看到收入和利润 |
| `worker1` | `pass123` | 看全部数据、改成本/录入字段、**看不到**清关费收入和利润 |
| `worker2` | `pass123` | 同 worker1，备用账号 |

## 改密码 / 加账号

打开 `server.js`，改 `USERS` 对象：

```js
const USERS = {
  admin:   { password: '新密码',  role: 'admin',  display: '老板', displayPt: 'Chefe' },
  worker1: { password: '新密码',  role: 'worker', display: '工人', displayPt: 'Operário' },
  worker3: { password: '新密码',  role: 'worker', display: '小张', displayPt: 'Zhang' },
};
```

保存后 `Ctrl+C` 关掉服务器，再 `npm start` 重启即生效。

## 数据备份

数据在 `./data/store.json`：

```bash
# 每天拷一份
cp data/store.json data/backup-$(date +%Y-%m-%d).json
```

写入数据时**自动备份到 `data/store.bak.json`**。

## 你能立即看到的所有 V3 功能

- ✅ 6 客户 / 6 提单 / 25 柜 / 11 陆运（演示数据）
- ✅ 指挥台 6 KPI 卡 + 跳转 + 过滤 banner
- ✅ 提单一览：状态多选、客户筛选、关键字搜索、ETA 日期范围
- ✅ 货柜押金：状态切换、4 个凭证上传
- ✅ 中葡双语切换（PT 完整同步）
- ✅ 工人 vs 老板权限遮蔽（worker 看不到成本/利润）
- ✅ 移动端响应式

工人录完数据，**立刻同步到你这边**；你在指挥台做的所有操作，工人也能看到。

## 几个提醒

1. **老大电脑不能关**：服务器跑在你电脑上，电脑睡了就断网。日常使用时让电脑别进睡眠。
2. **数据不会自动备份到云端**：数据存在 `data/store.json`，建议每天复制到 OneDrive / 坚果云 / U 盘。
3. **地址每次变**：`*.trycloudflare.com` 是临时地址，每次重启 cloudflared 都变。想固定地址需要注册 Cloudflare 账号 + 域名（这个等你 3 周后升级再说）。
4. **演示数据**：admin 登录后，进"数据管理"页面点"加载演示数据"就能注入 6 客户 + 6 提单演示数据。

## 想要持久化地址 / 自动部署？

3 周后告诉你，我可以帮你切到 Railway + SQLite + 真后端：
- 真后端：worker 一直在（不用老大电脑）
- 固定地址：`https://beira.yourdomain.com`
- 自动备份：数据库每日备份到 S3

但那是 3 周后的事，先用这个版本跑通业务流程。

## 不想要了？

```bash
# 1. 关掉服务器窗口（Ctrl+C）
# 2. 关掉 cloudflared 窗口（Ctrl+C）
# 3. 删掉 beira-cloud 目录
```

数据也没了（除非你已经备份到别处）。

## 项目结构

```
beira-cloud/
├── package.json        依赖（只 2 个：express + cookie-parser）
├── server.js           后端（约 130 行，4 个 API + 静态托管）
├── README.md           本文件
├── DEPLOY.md           老板 5 分钟部署指南
├── public/
│   └── index.html      V3 改造版（仅 5 处改动：saveData/loadData/doLogin/logout/启动）
├── data/
│   ├── store.json      数据文件（自动创建）
│   └── store.bak.json  上次写之前的备份（每次写自动覆盖）
└── test/
    └── server.test.js  E2E 验证（`node --test test/`）
```

## API 端点（4 个）

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | /api/login | 公开 | `{username, password}` → 设 cookie + 返用户 |
| POST | /api/logout | 已登录 | 清 cookie |
| GET | /api/me | 已登录 | 返当前用户 |
| GET | /api/data | 已登录 | 返全部数据 JSON |
| POST | /api/data | 已登录 | 写全部数据 JSON（自动备份） |

## License

内部使用 · 中资清关公司专用
