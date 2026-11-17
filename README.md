# TK Exam

团课结业考试在线刷题网站。纯静态前端，可直接部署到 Cloudflare Pages，无需服务器、数据库或账号系统。

## 功能

- 顺序练习、随机练习、错题复习
- 模拟考试：随机组卷、可选题量与时长、倒计时、交卷评分
- 单选、多选、判断、填空四种题型
- 即时判题、答题卡跳转、题库搜索与题型筛选
- 错题自动归集，复习答对后自动移出
- 本地答题统计、学习记录 JSON 导入 / 导出
- 手机与桌面端自适应布局

## 题库

题目来源：用户提供的《团课结业考试-题库.docx》。

| 题型 | 数量 |
|---|---:|
| 单选题 | 490 |
| 多选题 | 76 |
| 判断题 | 10 |
| 填空题 | 18 |
| **合计** | **594** |

题目与标准答案按原文件整理。原文件未提供解析，因此网站不补写解析。题库按题号分为 `data/questions-01.json` 至 `data/questions-04.json`，浏览器端并行加载并校验题号、答案字段与题型数量。

## 部署到 Cloudflare Pages

1. 登录 Cloudflare Dashboard。
2. 进入 **Workers & Pages → Create → Pages → Connect to Git**。
3. 选择 GitHub 仓库 `HX-Wrdzgzs/TK-Exam`。
4. 生产分支选择 `main`。
5. Framework preset 选择 **None**。
6. Build command 留空。
7. Build output directory 填写 `.`。
8. 点击 **Save and Deploy**。

之后每次向 `main` 分支推送提交，Cloudflare Pages 都会自动重新部署。

## 本地预览

不要直接双击 `index.html`，浏览器需要通过 HTTP 请求题库文件。在项目根目录执行：

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 数据与隐私

- 不需要账号、后端或数据库。
- 答题记录保存在当前浏览器的 `localStorage` 中，不会自动上传，也不会自动跨设备同步。
- 清理浏览器站点数据可能导致记录丢失，请定期使用页面右上角的“导出记录”备份。
- 可在其他设备通过“导入记录”恢复错题与统计。

## 技术

原生 HTML、CSS、JavaScript；无 npm 依赖、无构建步骤。题库使用原生 `fetch` 与 `response.json()` 加载，无需浏览器解压 API。
