# 老板 5 分钟部署指南

> 把"云端版 Beira 清关跟单系统"部署到你自己的电脑上，工人可以登录并使用。

## 第 1 步：下载 beira-cloud

整个文件夹已经从对话里下载好了，放在你的工作目录里：

```
C:\Users\1\WorkBuddy AI\2026-08-04-17-27-47\beira-cloud\
```

如果是打包下载的，可以解压到任意位置（比如 `D:\beira-cloud\`）。

## 第 2 步：装依赖 + 启动服务器

打开 PowerShell 或 CMD：

```powershell
cd "C:\Users\1\WorkBuddy AI\2026-08-04-17-27-47\beira-cloud"
npm install
npm start
```

应该看到：
```
🚀 Beira Cloud · 老大手动跑版
   URL:    http://localhost:3000
```

**不要关掉这个窗口。** 服务器在这里跑。

## 第 3 步：开 Cloudflare Tunnel（给你公网 URL）

打开**另一个** PowerShell 窗口：

```powershell
# 先装 cloudflared
winget install Cloudflare.cloudflared

# 启动隧道（自动分配一个临时 URL）
cloudflared tunnel --url http://localhost:3000
```

输出里会有一行类似：
```
https://jolly-mongoose-1234.trycloudflare.com
```

**复制这个 URL**，发给工人。工人就是这个地址进系统。

## 第 4 步：登录

打开浏览器，访问：
- 自己电脑：`http://localhost:3000`
- 工人在贝拉港：`https://jolly-mongoose-1234.trycloudflare.com`（替换为你的实际地址）

输入账号：
- 管理员：`admin` / `admin123`（你自己用，能看收入/利润）
- 工人：`worker1` / `pass123`（工人用，看不到收入/利润）
- 备用：`worker2` / `pass123`

## 第 5 步：第一次登录后立刻做这件事

登录后点右上角"数据管理" → "加载演示数据"按钮 → 注入 6 客户 + 6 提单的演示数据。这样你登录就能看到所有功能（指挥台、押金、ETA 筛选等）。

## 工人登录后看到啥

- 进系统 → 看到指挥台
- 看到客户的提单（老板那边录的所有数据）
- 可以录入新数据（实时同步到老板这边）
- **看不到清关费收入、看不到毛利**

工人和你用同一个 URL，看到同一份数据。你录的工人能看，工人录的你能看。

## 日常使用注意事项

### ✅ 必做
- **每天早上**：检查服务器窗口还在不在运行（Tab 上应该还看到 `node server.js`）
- **每次重启电脑**：重新跑 `npm start` + `cloudflared tunnel --url http://localhost:3000`（URL 会变，重新发给工人）
- **每周一次**：备份 `data/store.json` 到 U 盘 / 云盘

### ⚠️ 不要做
- **不要删 `data/store.json`**（数据全没了）
- **不要把这个文件夹移到 `C:\Program Files\`**（路径里有空格会出问题）

## 常见问题

### Q1: 我电脑重启了，工人说登不上？
A: 重新跑 `npm start` 和 cloudflared，每个都会新窗口拿到 1 个新 URL。重新发给工人。

### Q2: 工人看到的地址每天都变，没办法固定？
A: 是的，cloudflared 临时 URL 每次启动都变。想要固定地址需要：
- 注册 Cloudflare 账号 + 你的域名 → 一条 named tunnel 即可固定
- 或者等你升级到 Railway 部署（3 周后），那里有固定地址

### Q3: 我可以同时多个工人登录吗？
A: 可以，每个工人用自己的账号登录（worker1 / worker2）。所有数据共享。

### Q4: 工人录错了怎么办？
A: 工人登录了能看到所有数据（包括自己录的错的）。他可以编辑。如果数据错得太大，可以让你登录后从"数据管理"→ "导入" 之前备份的 JSON 文件。

### Q5: 数据会丢吗？
A: 不会丢失，除非：
- 你手动删 `data/store.json`
- 硬盘物理损坏（这就是为啥要每天备份）
- 我加了自动备份：每次写之前会先存一份到 `store.bak.json`（覆盖最近一次）

### Q6: 我能在不同电脑上看吗？
A: 服务器数据存在**这台电脑**上。换台电脑看不到。解决方案：
- 用 OneDrive / 坚果云同步 `data/` 文件夹（最简单）
- 或者等你升级到 Railway + 真云端（3 周后）

## 出问题了？

发我现在，立即排查。常见错误：
1. **端口 3000 被占用**：跑 `set PORT=3010` 再 `npm start`
2. **cloudflared 下载慢**：换镜像或直接下载 https://github.com/cloudflare/cloudflared/releases/latest 选择 Windows amd64
3. **工人说中文乱码**：浏览器请用 UTF-8 编码（默认应该没问题）
4. **想加新工人**：告诉我用户名+密码，我加进 `server.js` 重启

## 升级路径（3 周后）

**当前**：跑在老大手提电脑上  
**下一步**：跑在 Railway 云容器上  
**最终**：PostgreSQL + 真后端 + 自动备份 + 固定域名

但这是后面才说的事，先把这版本用起来跑通业务。
