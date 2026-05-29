# 生词云 Word Cloud

一个用词云方式展示生词本的多用户 Web 应用。

- 录入单词、翻译、是否已掌握，并可调整词云字号权重
- 词云页可在"原词 / 翻译"之间一键切换默认显示
- 按"已会 / 未会 / 全部"过滤，已会单词可淡化显示
- 多用户独立词库，JWT 鉴权
- 后端：Node.js 20 + Express + Mongoose + MongoDB
- 前端：原生 HTML/CSS/ES Modules + [wordcloud2.js](https://github.com/timdream/wordcloud2.js)（CDN）

## 目录结构

```
word-cloud/
├── server/        # Express 后端 + API
│   ├── server.js
│   ├── config/db.js
│   ├── models/{User,Word}.js
│   ├── middleware/auth.js
│   ├── routes/{auth,words}.js
│   ├── ecosystem.config.cjs   # PM2 配置
│   └── .env.example
└── public/        # 静态前端，由 Express 直接托管
    ├── index.html    # 词云主页
    ├── login.html    # 登录/注册
    ├── manage.html   # 单词管理
    ├── css/style.css
    └── js/{api,auth-page,cloud,manage}.js
```

## 本地开发

### 准备环境

- Node.js >= 20
- 本地或远程 MongoDB（推荐 7.x）

### 启动

```bash
cd server
cp .env.example .env.development   # 按需修改 MONGO_URI / JWT_SECRET
npm install
npm run dev                         # NODE_ENV=development + node --watch
```

打开 <http://127.0.0.1:1234>，先注册一个账号再使用。

### 环境变量

`server.js` 会按 `NODE_ENV` 依次寻找：`.env.<env>.local` → `.env.<env>` → `.env.local` → `.env`，加载最先命中的一个。

- `npm run dev`：注入 `NODE_ENV=development`，加载 `.env.development`
- `npm start` / PM2：注入 `NODE_ENV=production`，加载 `.env.production`

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `NODE_ENV` | 运行环境，决定加载哪个 env 文件 | `development` |
| `PORT` | 监听端口 | `1234` |
| `MONGO_URI` | MongoDB 连接串 | `mongodb://127.0.0.1:27017/word_cloud` |
| `JWT_SECRET` | JWT 签名密钥（**必须改成长随机字符串**） | — |
| `JWT_EXPIRES_IN` | JWT 有效期 | `7d` |
| `CORS_ORIGIN` | 允许跨域的来源（同源部署可留空） | — |

> `.env.development` / `.env.production` 已在 `.gitignore` 中，包含连接串等敏感信息，请勿提交。

## API 概览

所有 `/api/words/*` 都需要 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/auth/register` | 注册并返回 token |
| `POST` | `/api/auth/login` | 登录并返回 token |
| `GET` | `/api/words?known=true\|false` | 列表（可按"是否已会"过滤） |
| `POST` | `/api/words` | 新增 `{word, translation?, known?, weight?}` |
| `PUT` | `/api/words/:id` | 修改任意字段 |
| `PATCH` | `/api/words/:id/known` | 切换 `known` |
| `DELETE` | `/api/words/:id` | 删除 |
| `GET` | `/api/health` | 健康检查 |

## VPS 部署（AlmaLinux 9 / RHEL 9 示例）

> Rocky Linux 9、CentOS Stream 9、RHEL 9 同此流程；CentOS 7 把 `dnf` 换成 `yum` 即可。
> 数据库默认使用 **MongoDB Atlas** 云服务（无需本机装 Mongo），自建 Mongo 见文末附录。

### 0. 前置准备（一定要先做）

部署前先把这两件事确认下来，否则后面 PM2 启动一定失败：

1. **MongoDB Atlas 连接串**
   - 在 [Atlas 控制台](https://cloud.mongodb.com/) → 集群 **Connect → Drivers** 复制完整 `mongodb+srv://` 模板
   - **Network Access** 添加 VPS 公网 IP（或临时 `0.0.0.0/0`）
   - **Database Access** 确认应用账号对目标库有 `readWrite` 权限
   - 本机先 `nslookup <你的cluster>.<hash>.mongodb.net` 验证主机名能解析，避免拼错 hostname
2. **端口规划**：Node 进程将监听 `127.0.0.1:1234`（不对外），外部统一走 Nginx 的 80/443。
   如果 443 已被其他服务占用（如 VPN 面板、其他网站），可以跳过 HTTPS 那一步，或参考第 6 步的备选方案。

### 1. 安装基础环境

```bash
# 系统升级 + 基础工具
sudo dnf update -y
sudo dnf install -y curl git tar gcc-c++ make policycoreutils-python-utils

# Node.js 20（NodeSource RPM 源）
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v && npm -v          # 期望 v20.x

# PM2 进程守护
sudo npm install -g pm2

# Nginx 反向代理
sudo dnf install -y nginx
sudo systemctl enable --now nginx
```

### 2. 防火墙 + SELinux

**防火墙二选一**：

- **方案 A（推荐）：使用 VPS 服务商的云端安全组 / 防火墙规则**
  在云控制台放开入站 `22 / 80 / 443`，**不要开 `1234`**。本机无需装 firewalld，重启不丢规则。
- **方案 B：本机 firewalld**（很多云镜像默认未安装）

  ```bash
  sudo dnf install -y firewalld
  sudo systemctl enable --now firewalld
  sudo firewall-cmd --permanent --add-service=ssh
  sudo firewall-cmd --permanent --add-service=http
  sudo firewall-cmd --permanent --add-service=https
  sudo firewall-cmd --reload
  ```

**SELinux**（先看再说）：很多云镜像（如本次的 AlmaLinux 9.8）默认 `SELinux is disabled`，那就什么都不用做。**仅当 `getenforce` 返回 `Enforcing` 时**，才需要放行 Nginx 访问本机端口，否则会 502 Bad Gateway：

```bash
getenforce                                                  # Disabled / Permissive / Enforcing
sudo setsebool -P httpd_can_network_connect 1               # 仅 Enforcing 时执行
```

> 不论选哪种防火墙方案，都不要把 `1234` 端口直接暴露到公网，让 Node 只监听 `127.0.0.1`，外部统一走 Nginx。

### 3. 部署代码

```bash
sudo mkdir -p /opt/word-cloud
sudo chown $USER:$USER /opt/word-cloud
git clone https://github.com/kanxuehe/word-cloud.git /opt/word-cloud
cd /opt/word-cloud/server

cp .env.example .env.production
# 生成强随机 JWT 密钥，并贴到 .env.production 的 JWT_SECRET= 后面
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
vi .env.production                        # 填写 MONGO_URI、JWT_SECRET 等
chmod 600 .env.production                 # 含密钥，缩权限避免被其他用户读到

npm ci --omit=dev
```

> 使用 Atlas 时记得在 Atlas 控制台 **Network Access** 把这台 VPS 的公网 IP 加入白名单，
> 并在 **Database Access** 给应用账号授予对应库的 `readWrite` 权限。

### 4. 用 PM2 守护进程

> 用 `root` 运行更省事；若用非 root 用户，记得 `pm2 startup systemd -u $USER --hp $HOME` 并按提示执行 sudo 命令。

```bash
cd /opt/word-cloud/server
pm2 start ecosystem.config.cjs            # 已内置 NODE_ENV=production
pm2 save                                  # 把当前进程列表写入 dump.pm2
pm2 startup systemd                       # 设置开机自启；按提示复制执行 sudo env PATH=... 那条命令
pm2 status                                # word-cloud 应为 online
```

**自检（必看）**：`pm2 logs word-cloud --lines 20 --nostream` 应该能看到这三行，缺一不可：

```text
[env] loaded .env.production (NODE_ENV=production)
[db] MongoDB connected: word_cloud
[server] listening on http://127.0.0.1:1234
```

只有 `[server] listening` 出现才说明端口真的起来了；如果只看到前两行卡住，多半是 Mongo 连不上（看 Atlas Network Access 白名单 / 用户名密码 / URL encode）。再走一次接口自检：

```bash
curl -s http://127.0.0.1:1234/api/health   # 期望：{"ok":true}
```

常用命令：

```bash
pm2 logs word-cloud                        # 实时日志（带 stderr）
pm2 restart word-cloud                     # 重启
pm2 reload word-cloud                      # 零停机重载（reload 后端口约 3~4s 才重新监听）
```

### 5. Nginx 反向代理

AlmaLinux 9 的 `nginx.conf` 默认 include `/etc/nginx/conf.d/*.conf`，但 `nginx.conf` 本体里**自带一个默认 `server` 块**指向 `/usr/share/nginx/html`：

```nginx
server {
    listen       80;
    listen       [::]:80;
    server_name  _;
    root         /usr/share/nginx/html;
    ...
}
```

注意它**没有** `default_server` 关键字，所以即使我们再写一个 `listen 80 default_server`，`nginx -t` 不会报 `duplicate default_server`，但会有 `conflicting server name "_" on 0.0.0.0:80, ignored` 警告，**而且这个内置 server 仍会以非默认方式存在**：当 Nginx 内部 router 选错时，请求会落到它身上、命中 `/usr/share/nginx/html` 静态目录、返回 `nginx error!` 404 页面，让人摸不着头脑。**最干净的做法是把它注释掉**。

**先写入 word-cloud 反代配置**：

```bash
sudo tee /etc/nginx/conf.d/word-cloud.conf > /dev/null <<'EOF'
server {
    listen 80 default_server;
    server_name _;                         # 用域名时改成 your-domain.com，并删掉 default_server

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:1234;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

**注释掉 `nginx.conf` 自带的 80 server 块**（注释前先备份，便于回滚）：

```bash
# 看下要注释的行号，默认 AlmaLinux 9 的镜像是 38..56 行
sudo grep -nE 'server *\{|listen |server_name |^\s*\}' /etc/nginx/nginx.conf

sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%s)
sudo sed -i '38,56s/^/# /' /etc/nginx/nginx.conf

sudo nginx -t && sudo systemctl reload nginx
```

> 如果 `nginx -t` 仍然报 conflicting server name 警告，说明默认 server 块没在 38..56 行（被改过），自行调整行号即可，或者干脆手工编辑把它注释掉。

验证外网链路通：

```bash
curl -s http://你的公网IP/api/health       # 期望：{"ok":true}
```

### 6. HTTPS（强烈建议，但有备选方案）

JWT 走明文 Header，**没 HTTPS 等于裸奔**。下面三种 HTTPS 方案任选其一：

#### 方案 6A：Certbot 直接签证书（首选，需要域名 + 443 端口空闲）

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# 自动改写上面的 nginx 配置，新增 443 server 块并配置自动续期
```

#### 方案 6B：Cloudflare 套 CDN（443 被其他服务占用时的最佳选择）

适合 VPS 上同时跑着代理面板、其他网站等占用 443 的场景：

1. 把域名 NS 解析切到 Cloudflare
2. 添加 A 记录：`your-domain.com` → VPS 公网 IP，**开启代理（橙色云）**
3. Cloudflare SSL/TLS → 加密模式选 **Flexible**（CF↔浏览器 HTTPS，CF↔源站 HTTP）
4. 完成。本机 Nginx 保持 80，不用动 443，也不用装 Certbot

> 提升一档：在 Nginx 上加自签证书 + CF 选 Full（strict）模式，源站到 CF 也加密。

#### 方案 6C：先 HTTP，后续再升级

如果只是自用、域名暂时没有，可以先这样跑着：

```bash
# 直接 http://你的公网IP 访问即可
```

⚠️ **风险提示**：HTTP 模式下 JWT 在网络上是明文的，公共 Wi-Fi 等不可信网络环境会有被嗅探的风险。仅建议家庭/移动数据等可信环境下短期使用，长期使用务必切到 6A 或 6B。

### 7. 日常更新（一键脚本 `deploy.sh`）

仓库根目录提供了 `deploy.sh`，做了四件事：`git pull --ff-only` → 检测到 `package-lock.json` 变了才 `npm ci --omit=dev`（否则跳过） → `pm2 reload --update-env` → 10 秒内重试 `/api/health` 直到通过。

**VPS 上一行搞定**：

```bash
cd /opt/word-cloud && ./deploy.sh
```

**本地一行触发**（需要 ssh 免密，或临时用 `sshpass -p <pwd>` 前缀）：

```bash
ssh root@<vps-ip> 'cd /opt/word-cloud && ./deploy.sh'
```

可在本地 `~/.zshrc` 加个 alias 把 push + 远程 deploy 串成一条命令：

```bash
alias wc-deploy='git push && ssh root@<vps-ip> "cd /opt/word-cloud && ./deploy.sh"'
```

可用环境变量覆盖默认值：`APP_DIR`（默认 `/opt/word-cloud`） / `PM2_NAME`（默认 `word-cloud`） / `HEALTH_URL`（默认 `http://127.0.0.1:1234/api/health`）。

> 健康检查为什么要 10 秒重试？因为 `pm2 reload` 是先 fork 新进程再 kill 旧进程，新进程从冷启动到 `MongoDB connected` + `listening on :1234` 大约 3~4 秒，期间端口短暂不可用。重试 10 次 × 1s 既能兜住正常 reload，又能在真正起不来时尽早报错并自动 tail PM2 日志。

### 附录：自建 MongoDB（不使用 Atlas 时）

```bash
# 添加 MongoDB 7 官方源
sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo > /dev/null <<'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

sudo dnf install -y mongodb-org
sudo systemctl enable --now mongod
```

锁紧配置：编辑 `/etc/mongod.conf`，确认 `net.bindIp: 127.0.0.1` 且 `security.authorization: enabled`，然后用 `mongosh` 创建应用用户并把 `MONGO_URI` 指向 `mongodb://<user>:<pwd>@127.0.0.1:27017/word_cloud`。

## 安全要点

- `.env*` 系列文件已在 `.gitignore`，**JWT_SECRET 必须用至少 32 字节的随机串**
- 密码以 bcrypt（cost=10）哈希存储
- 登录接口 15 分钟内最多 20 次尝试
- helmet 设置安全响应头；CSP 已放行 jsDelivr，仅允许加载 wordcloud2.js
- MongoDB Atlas：限制 Network Access IP 白名单，数据库账号仅授予所需库的最小权限；自建则启用认证并 `bindIp: 127.0.0.1`
- VPS 上 Node 进程只监听 `127.0.0.1:1234`，外部统一走 Nginx
- 强烈建议启用 HTTPS（JWT 明文传输需 TLS 保护）

## 后续可扩展

- 单词分类/标签、Spaced Repetition 复习提醒
- CSV 导入导出
- 例句、发音（接入第三方词典 API）
- 移动端 PWA
