# TK Exam

团课结业考试在线刷题网站。纯静态前端，无需服务器、数据库或账号系统，可直接部署到 Cloudflare Pages。

## 功能

- 顺序练习、随机练习、模拟考试、错题复习
- 单选、多选、判断、填空题
- 即时判题、模拟考试统一评分
- 题号跳转、题库搜索、题型筛选
- 本地保存答题记录、错题和未完成练习
- 导出 / 导入学习记录 JSON
- 手机与桌面端自适应布局

## 题库

题目来源：用户提供的《团课结业考试-题库.docx》。共 594 道题：单选 490 道、多选 76 道、判断 10 道、填空 18 道。原文件未提供解析，因此网站只显示标准答案，不补写解析。题库位于 `data/questions-01.json` 至 `data/questions-12.json`。

## Cloudflare Pages

在 Cloudflare Dashboard 进入 **Workers & Pages → Create → Pages → Connect to Git**，选择 `HX-Wrdzgzs/TK-Exam`，生产分支选择 `main`，Framework preset 选择 `None`，Build command 留空，Build output directory 填 `.`，然后部署。后续推送到 `main` 会自动触发部署。

本项目包含 `wrangler.toml`，配置 `pages_build_output_dir = "."`。学习记录仅保存在当前浏览器 `localStorage`，不会上传到服务器。清理浏览器站点数据会删除本地记录，建议定期导出 JSON 备份。
