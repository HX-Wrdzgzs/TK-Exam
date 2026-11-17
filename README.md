# TK Exam · 团课刷题

简单的静态刷题网站，可部署到 Cloudflare Pages，不需要账号或数据库。

## 功能

- 打开网页直接显示题目，不需要点击“开始练习”
- 顺序刷题、随机刷题、错题本、题库搜索、题号跳转
- 单选题与判断题点选后立即判题；多选题和填空题点击“确认答案”
- 答对后保留 650 毫秒反馈并自动下一题，答错时留在当前题；手动切题、跳题、切换模式会取消自动跳转
- 自动记录错题和正确率；数据保存在当前浏览器，可导出、导入 JSON
- 手机、电脑自适应

题库来自《团课结业考试-题库.docx》，共 **594 道**，按作答交互归类为：单选 455、多选 76、判断 45、填空 18。其中有 35 道 A/B 形式的判断题按判断题显示。

题库：`data/questions-01.json` 至 `data/questions-04.json`。

## Cloudflare Pages：每次提交自动部署

使用 **Git 集成（Connect to Git）** 关联 `HX-Wrdzgzs/TK-Exam`。

- Production branch：`main`
- Framework preset：`None`
- Build command：留空
- Build output directory：`.`
- 在 Cloudflare Pages 项目设置 → **Builds → Branch control** 中启用 **Enable automatic production branch deployments**

配置完成后，向 GitHub `main` 推送修改就会触发 Cloudflare Pages 的生产部署。不需要再上传文件或手工点击部署。**注意：这只有在 Pages 项目通过 Git 集成建立且自动部署已启用时才生效；仅创建一个 Direct Upload 项目不会自动同步 GitHub。**

Cloudflare Pages 官方文档：https://developers.cloudflare.com/pages/configuration/git-integration/

## 本地预览

在仓库根目录启动静态服务器：

```bash
python -m http.server 8080
```

打开 `http://localhost:8080`。不要直接以 `file://` 打开 `index.html`，否则题库 JSON 无法通过 `fetch` 加载。

## 说明

学习记录在浏览器 `localStorage` 中；清理站点数据可能丢失记录。网站不自动跨设备同步。
