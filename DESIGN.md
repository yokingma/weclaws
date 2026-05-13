# DESIGN.md

# WeClaws Design Guidelines

WeClaws 的设计方向是：

> Warm Executive Dashboard  
> 温暖、克制、精致、有呼吸感的 AI Bot 管理控制台。

本文档用于约束 WeClaws Web 控制台的视觉风格、主题系统、组件规范和页面落地标准。

---

## 1. Design Principles

### 1.1 关键词

- Warm / 温暖
- Soft / 柔和
- Premium / 高级
- Calm / 克制
- Clean / 清晰
- Spacious / 有呼吸感
- Reliable / 可信赖
- Lightweight Neumorphism / 轻拟物

### 1.2 应该做到

- 使用奶油色、浅沙色、暖黑色作为主视觉基调
- 使用深棕黑作为 Light 模式主按钮色
- 使用浅奶油色作为 Dark 模式主按钮色
- 使用浅金色作为品牌强调色
- 使用大圆角、柔和阴影、低对比边框
- 使用卡片式布局组织信息
- 保持充足留白，避免后台模板感
- 所有颜色必须通过 CSS Variables 管理

### 1.3 避免事项

不要使用：

- 纯白背景 + 灰色边框
- 纯黑背景 + 纯白文字
- 高饱和蓝、紫、绿
- 黑色重阴影
- 小圆角、硬分割线、密集表格
- 默认组件库堆叠感
- 大面积玻璃拟态或强发光效果

---

## 2. Theme System

WeClaws 支持 Light / Dark 明暗主题。

主题通过 `data-theme` 控制：

```html
<html data-theme="light">
<html data-theme="dark">
```

业务组件中禁止硬编码主题颜色，必须使用 CSS Variables。

---

## 3. Design Tokens

建议放在 `src/styles/tokens.css` 中。

```css
:root {
  /* Radius */
  --wc-radius-sm: 12px;
  --wc-radius-md: 16px;
  --wc-radius-lg: 20px;
  --wc-radius-xl: 24px;
  --wc-radius-2xl: 28px;
  --wc-radius-3xl: 32px;
  --wc-radius-pill: 999px;

  /* Spacing */
  --wc-space-1: 4px;
  --wc-space-2: 8px;
  --wc-space-3: 12px;
  --wc-space-4: 16px;
  --wc-space-5: 20px;
  --wc-space-6: 24px;
  --wc-space-8: 32px;
  --wc-space-10: 40px;
  --wc-space-12: 48px;

  /* Motion */
  --wc-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --wc-duration-fast: 120ms;
  --wc-duration-base: 180ms;
  --wc-duration-slow: 260ms;
}

:root,
[data-theme="light"] {
  /* Background */
  --wc-bg-page: #f6efe5;
  --wc-bg-shell: #fbf4ea;

  /* Surface */
  --wc-surface: #fffdf8;
  --wc-surface-soft: #fcf7ef;
  --wc-surface-hover: #fff8ee;
  --wc-surface-active: #f3dfc4;

  /* Border */
  --wc-border: rgba(218, 196, 166, 0.72);
  --wc-border-soft: rgba(232, 218, 199, 0.78);
  --wc-border-strong: rgba(199, 168, 128, 0.72);

  /* Text */
  --wc-text-primary: #211a15;
  --wc-text-secondary: #6f6255;
  --wc-text-muted: #9b8d7c;
  --wc-text-inverse: #fff8ef;

  /* Brand */
  --wc-primary: #211a15;
  --wc-primary-hover: #34281f;
  --wc-accent: #c99a5b;
  --wc-accent-soft: #f2dec2;
  --wc-accent-faint: #fbf0de;

  /* Semantic */
  --wc-success-text: #267352;
  --wc-success-bg: #dff4ea;
  --wc-warning-text: #9a6815;
  --wc-warning-bg: #fff1d6;
  --wc-danger-text: #943b31;
  --wc-danger-bg: #fbe2dd;

  /* Chart */
  --wc-chart-line: #c99a5b;
  --wc-chart-fill: rgba(201, 154, 91, 0.14);
  --wc-chart-grid: rgba(218, 196, 166, 0.52);
  --wc-chart-axis: #a09282;

  /* Shadow */
  --wc-shadow-shell:
    0 24px 70px rgba(76, 52, 28, 0.10),
    0 8px 24px rgba(76, 52, 28, 0.05);

  --wc-shadow-card:
    0 14px 36px rgba(63, 44, 24, 0.075),
    inset 0 1px 0 rgba(255, 255, 255, 0.88);

  --wc-shadow-card-hover:
    0 20px 48px rgba(63, 44, 24, 0.11),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);

  --wc-shadow-button:
    0 12px 26px rgba(33, 26, 21, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

[data-theme="dark"] {
  /* Background */
  --wc-bg-page: #17120e;
  --wc-bg-shell: #211912;

  /* Surface */
  --wc-surface: #251d16;
  --wc-surface-soft: #2b2119;
  --wc-surface-hover: #35291f;
  --wc-surface-active: #3f2f22;

  /* Border */
  --wc-border: rgba(133, 100, 64, 0.52);
  --wc-border-soft: rgba(104, 80, 55, 0.58);
  --wc-border-strong: rgba(201, 154, 91, 0.58);

  /* Text */
  --wc-text-primary: #fff3e5;
  --wc-text-secondary: #cdbba5;
  --wc-text-muted: #9f8d78;
  --wc-text-inverse: #211a15;

  /* Brand */
  --wc-primary: #f4dfc3;
  --wc-primary-hover: #ffe8c7;
  --wc-accent: #d7a96a;
  --wc-accent-soft: #493520;
  --wc-accent-faint: #302419;

  /* Semantic */
  --wc-success-text: #9ee1bd;
  --wc-success-bg: rgba(58, 155, 109, 0.18);
  --wc-warning-text: #f3ce88;
  --wc-warning-bg: rgba(217, 154, 43, 0.18);
  --wc-danger-text: #f0a397;
  --wc-danger-bg: rgba(199, 92, 74, 0.18);

  /* Chart */
  --wc-chart-line: #d7a96a;
  --wc-chart-fill: rgba(215, 169, 106, 0.16);
  --wc-chart-grid: rgba(133, 100, 64, 0.32);
  --wc-chart-axis: #9f8d78;

  /* Shadow */
  --wc-shadow-shell:
    0 24px 70px rgba(0, 0, 0, 0.36),
    0 8px 24px rgba(0, 0, 0, 0.22);

  --wc-shadow-card:
    0 16px 40px rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 244, 232, 0.055);

  --wc-shadow-card-hover:
    0 22px 54px rgba(0, 0, 0, 0.36),
    inset 0 1px 0 rgba(255, 244, 232, 0.075);

  --wc-shadow-button:
    0 12px 28px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
```

---

## 4. Base Style

```css
body {
  min-height: 100vh;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "SF Pro Display",
    "SF Pro Text",
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "Segoe UI",
    sans-serif;
  color: var(--wc-text-primary);
  background: var(--wc-bg-page);
}

[data-theme="light"] body {
  background:
    radial-gradient(circle at 8% 0%, rgba(255,255,255,0.95), transparent 30%),
    radial-gradient(circle at 92% 8%, rgba(225,190,143,0.28), transparent 34%),
    linear-gradient(135deg, #f8f1e8 0%, #f3e7d7 48%, #fbf7f0 100%);
}

[data-theme="dark"] body {
  background:
    radial-gradient(circle at 8% 0%, rgba(92,67,42,0.28), transparent 32%),
    radial-gradient(circle at 92% 8%, rgba(201,154,91,0.16), transparent 34%),
    linear-gradient(135deg, #17120e 0%, #211912 48%, #18110d 100%);
}
```

---

## 5. Typography

| 用途 | 字号 | 行高 | 字重 |
|---|---:|---:|---:|
| Hero 标题 | `44px` | `1.12` | `800` |
| 页面标题 | `36px` | `1.16` | `800` |
| 区块标题 | `22px` | `1.3` | `700` |
| 卡片标题 | `17px` | `1.4` | `700` |
| 正文 | `14px` | `1.6` | `400 / 500` |
| 辅助文字 | `12px` | `1.5` | `400` |
| 数据数字 | `32px` | `1.05` | `800` |

文字原则：

- 标题要稳重、有分量
- 数字指标必须醒目
- 辅助文字降低对比度
- 不在同一页面使用过多字号

---

## 6. Layout

后台页面统一采用：

```txt
App
├── Sidebar
└── Main
    ├── Topbar
    └── Page Content
```

布局规范：

- Sidebar 宽度：`260px`
- 页面外边距：`16px - 24px`
- 主内容模块间距：`16px - 24px`
- 卡片内边距：`20px - 28px`
- 移动端 Sidebar 收起，内容单列展示

```css
.app-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
}
```

---

## 7. Core Components

### 7.1 Card

所有信息容器统一使用 Card 材质。

```css
.card {
  border-radius: var(--wc-radius-xl);
  background: var(--wc-surface);
  border: 1px solid var(--wc-border-soft);
  box-shadow: var(--wc-shadow-card);
  color: var(--wc-text-primary);
}

.card:hover {
  box-shadow: var(--wc-shadow-card-hover);
}
```

要求：

- 圆角不小于 `20px`
- 不使用纯白硬卡片
- 不使用灰色线框
- 不使用黑色重阴影

---

### 7.2 Button

主按钮只用于关键操作。

```css
.button-primary {
  height: 44px;
  padding: 0 22px;
  border-radius: var(--wc-radius-pill);
  border: none;
  background: linear-gradient(145deg, var(--wc-primary), var(--wc-primary-hover));
  color: var(--wc-text-inverse);
  font-size: 14px;
  font-weight: 700;
  box-shadow: var(--wc-shadow-button);
}

.button-secondary {
  height: 40px;
  padding: 0 18px;
  border-radius: var(--wc-radius-pill);
  background: var(--wc-surface);
  border: 1px solid var(--wc-border-soft);
  color: var(--wc-text-primary);
  font-size: 14px;
  font-weight: 600;
}
```

说明：

- Light 模式主按钮为深棕黑
- Dark 模式主按钮为浅奶油色
- Hover 动效要轻，不要夸张

---

### 7.3 Input / Select

```css
.input,
.select {
  height: 48px;
  padding: 0 16px;
  border-radius: var(--wc-radius-md);
  background: var(--wc-surface);
  border: 1px solid var(--wc-border);
  color: var(--wc-text-primary);
  font-size: 14px;
}

.input::placeholder {
  color: var(--wc-text-muted);
}

.input:focus,
.select:focus {
  outline: none;
  border-color: var(--wc-border-strong);
  box-shadow: 0 0 0 4px rgba(201, 154, 91, 0.14);
}
```

---

### 7.4 Badge

```css
.badge {
  height: 24px;
  padding: 0 10px;
  border-radius: var(--wc-radius-pill);
  font-size: 12px;
  font-weight: 600;
}

.badge-success {
  color: var(--wc-success-text);
  background: var(--wc-success-bg);
}

.badge-warning {
  color: var(--wc-warning-text);
  background: var(--wc-warning-bg);
}

.badge-danger {
  color: var(--wc-danger-text);
  background: var(--wc-danger-bg);
}
```

Badge 应小、圆、柔和，不要使用高饱和色块。

---

### 7.5 Stat Card

```css
.stat-card {
  min-height: 96px;
  padding: 22px 24px;
  border-radius: var(--wc-radius-xl);
  background: var(--wc-surface);
  border: 1px solid var(--wc-border-soft);
  box-shadow: var(--wc-shadow-card);
}

.stat-label {
  font-size: 13px;
  color: var(--wc-text-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 32px;
  line-height: 1.05;
  font-weight: 800;
  color: var(--wc-text-primary);
}
```

---

## 8. Overview Page

概览页是 WeClaws 的视觉门面。

推荐结构：

```txt
Overview Page
├── Hero Summary
├── Metrics Grid
├── Quick Start
└── Dashboard Grid
    ├── Recent Active Bots
    └── Conversation Trend / System Status
```

### Hero Summary

Hero 应使用大圆角、柔和渐变、浅金装饰和充足留白。

```css
.overview-hero {
  position: relative;
  overflow: hidden;
  min-height: 190px;
  padding: 38px 42px;
  border-radius: var(--wc-radius-3xl);
  background:
    radial-gradient(circle at 82% 12%, rgba(201,154,91,0.18), transparent 36%),
    linear-gradient(135deg, var(--wc-surface), var(--wc-surface-soft));
  border: 1px solid var(--wc-border-soft);
  box-shadow: var(--wc-shadow-shell);
}
```

Hero 规则：

- 只放页面标题、副标题和 2-3 个能力标签
- 不堆太多数据
- 装饰要浅，不影响阅读

### Metrics Grid

```css
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
```

### Dashboard Grid

```css
.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(380px, 0.85fr);
  gap: 16px;
}
```

---

## 9. Chart Guidelines

图表应像运营摘要，不要像复杂 BI 工具。

规则：

- 折线不超过 2 条
- 主线使用 `--wc-chart-line`
- 面积填充使用 `--wc-chart-fill`
- 网格线使用 `--wc-chart-grid`
- 坐标文字使用 `--wc-chart-axis`
- Tooltip 使用圆角卡片
- 不使用高饱和蓝紫色

---

## 10. Motion

动效应短、轻、安静。

```css
.card,
.button-primary,
.button-secondary,
.sidebar-item,
.bot-list-item {
  transition:
    transform var(--wc-duration-base) var(--wc-ease-out),
    box-shadow var(--wc-duration-base) var(--wc-ease-out),
    background var(--wc-duration-base) var(--wc-ease-out),
    border-color var(--wc-duration-base) var(--wc-ease-out);
}
```

规则：

- 卡片 Hover 上浮 `1px - 2px`
- 按钮 Hover 上浮 `1px`
- 不使用弹跳动画
- 不使用大幅缩放
- 页面切换控制在 `180ms - 260ms`

---

## 11. Theme Toggle

主题切换按钮建议放在 Topbar 右侧。

要求：

- 支持 Light / Dark
- 可默认跟随系统主题
- 用户手动切换后保存到 `localStorage`
- 刷新页面后保持用户选择
- 切换时不应闪屏

推荐逻辑：

```ts
type ThemeMode = "light" | "dark";

const STORAGE_KEY = "weclaws-theme";

export function getInitialTheme(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}
```

---

## 12. Responsive Rules

```css
@media (max-width: 1200px) {
  .metrics-grid,
  .overview-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
    padding: 12px;
  }

  .sidebar {
    display: none;
  }

  .metrics-grid,
  .overview-grid {
    grid-template-columns: 1fr;
  }

  .overview-hero {
    padding: 28px 24px;
  }
}
```

移动端原则：

- Sidebar 收起
- 内容单列
- 优先展示核心指标和主操作
- 次要信息允许折叠

---

## 13. Implementation Rules

开发时必须遵守：

- 所有颜色使用 CSS Variables
- 不在业务组件中硬编码颜色、阴影、圆角
- Card、Button、Badge、Input、StatCard 必须组件化
- 图表颜色必须来自 token
- 新页面必须复用统一 App Layout
- 列表优先使用卡片式表达
- 空状态、加载态、错误态必须有设计
- 新组件必须同时检查 Light / Dark 两种主题

---

## 14. Review Checklist

提交页面前检查：

### Visual

- [ ] 页面背景是否有温暖质感？
- [ ] 卡片、阴影、圆角是否统一？
- [ ] 是否避免默认后台模板感？
- [ ] Light / Dark 下文字是否清晰？
- [ ] 主按钮是否突出但不过度抢眼？

### Layout

- [ ] 页面是否有足够留白？
- [ ] 信息层级是否清晰？
- [ ] 卡片间距是否统一？
- [ ] 是否避免密集表格感？

### Interaction

- [ ] Hover 是否克制？
- [ ] Focus 状态是否清晰？
- [ ] 点击区域是否足够大？
- [ ] Loading / Empty / Error 是否完整？

---

## 15. Final Standard

一个页面是否符合 WeClaws 设计系统，用以下标准判断：

1. 第一眼是否温暖、精致、可信赖？
2. 是否不像默认后台模板？
3. 卡片、阴影、圆角是否统一？
4. Light / Dark 是否都自然？
5. 重点信息是否清晰？
6. 操作是否明确？
7. 页面是否有足够呼吸感？
8. 长时间使用是否不疲劳？

WeClaws 的设计不是为了炫技，而是为了让 AI Bot 管理变得稳定、清晰、可信、优雅。