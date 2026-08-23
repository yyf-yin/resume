# 简历助手：腾讯云部署清单

项目采用 Next.js 服务端 API，部署目标为腾讯云中国大陆 Ubuntu 服务器、Nginx 和 PM2。备案号为 `苏ICP备2026058202号`，已经展示在网页底部并链接至工信部备案系统。

## 1. 上线前提

- 如果 ICP 备案不是通过腾讯云完成，先在腾讯云办理接入备案。
- 腾讯云防火墙仅放行 `22`、`80`、`443`，不要向公网放行 `3000`。
- SSH 的 `22` 端口尽量只允许管理员固定 IP。
- 域名添加 `@` 和 `www` 的 A 记录，指向服务器公网 IP。

## 2. 服务器环境

推荐 Ubuntu 22.04/24.04、Node.js 20 或 22、Nginx、Git、PM2。当前目标服务器为 4 核 8GB、5Mbps，可与其他轻量网站共享；建议为系统和其他服务保留至少 3GB 可用内存。

```bash
node --version
npm --version
nginx -v
```

## 3. 获取并配置项目

```bash
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone YOUR_GIT_REPOSITORY resume-assistant
cd resume-assistant
npm ci
cp .env.example .env.production
chmod 600 .env.production
```

以上命令必须在 `/var/www/resume-assistant` 根目录执行。

编辑 `.env.production`，至少替换真实的 `LLM_API_KEY`、模型和接口地址。生产环境保持：

```env
USE_MOCK_AI=false
AI_RESPONSE_LOG_ENABLED=false
API_RATE_LIMIT_MAX=20
API_RATE_LIMIT_WINDOW_MS=600000
API_MAX_BODY_BYTES=1048576
```

`.env.production` 已加入 Git 忽略规则，禁止提交真实密钥。

## 4. 构建和启动

```bash
npm ci
npm run typecheck
npm run lint
npm run build
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

执行 `pm2 startup` 输出的命令，然后验证：

```bash
curl --fail http://127.0.0.1:3000/api/health
curl --fail http://127.0.0.1:3000/api/ai/status
pm2 status
```

## 5. Nginx 与 HTTPS

1. 把 `deploy/nginx-http.conf` 中所有 `YOUR_DOMAIN` 替换为真实主域名。
2. 将文件复制到 `/etc/nginx/sites-available/resume-assistant` 并启用。
3. 执行 `sudo nginx -t && sudo systemctl reload nginx`。
4. HTTP 和 DNS 验证成功后，在腾讯云申请 SSL 证书。
5. 将 Nginx 证书和私钥放入 `/etc/nginx/ssl/`，权限设为仅 root 可读。
6. 按实际证书文件名修改 `deploy/nginx-https.conf`，替换线上配置并重新加载 Nginx。

不要在证书正确安装前直接启用 HTTPS 模板。启用后验证：

```bash
curl --fail https://YOUR_DOMAIN/api/health
curl -I https://YOUR_DOMAIN
```

## 6. 功能验收

- 首页底部显示 `苏ICP备2026058202号`，点击后进入 `https://beian.miit.gov.cn/`。
- 浏览器地址栏证书正常，HTTP 自动跳转 HTTPS。
- `/api/health` 返回 `status: ok`。
- `/api/ai/status` 返回 `mode: llm`，且不会返回密钥。
- 使用非敏感测试简历完成分析、优化、追问和补强计划全流程。
- 连续超限调用 API 时返回 HTTP 429。
- `.ai-logs` 不产生包含简历正文的生产日志。
- `3000` 端口无法从公网直接访问。

## 7. 更新与回滚

更新前先记录当前 Git 提交号：

```bash
cd /var/www/resume-assistant
git rev-parse HEAD
git pull --ff-only
npm ci
npm run typecheck
npm run build
pm2 reload ecosystem.config.cjs --update-env
curl --fail http://127.0.0.1:3000/api/health
```

若新版本异常，切换回已记录的稳定提交，重新执行 `npm ci`、`npm run build` 和 PM2 reload。不要使用会清除未备份数据的强制重置命令。

## 8. 上线后事项

- 网站开通后 30 个自然日内提交公安联网备案；审核通过后，把公安备案号和图标加入页脚。
- 定期更新 Node.js、Next.js 和系统安全补丁。
- 配置腾讯云主机监控、磁盘告警和进程异常告警。
- 公开收集真实简历前，准备隐私政策并明确说明简历内容会发送给所配置的大模型服务商处理。
