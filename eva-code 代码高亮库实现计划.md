# eva-code · 极简自写代码高亮库 · 实现计划（交付 GPT 执行）

> 用途：本文件是给执行方（GPT）的**实现规格**。请严格按此实现，产出可直接落地、符合本项目约定的代码。
> 目标：**只读**代码高亮（不做编辑器），追求**极简 + 零第三方依赖 + 与全站设计令牌统一**。

---

## 0. 背景与定位

- 项目：Lentasy 主题 + Eva Framework 插件。
- Eva 的 UI 库统一放在 `wp-content/plugins/Eva framework/Libs/<库名>/`：**一库一文件夹，含同名 `.js` + `.css`**，由 PHP 的 `Eva::lib_assets()` 自动扫描入队，**无需改 PHP**。
- 现有同类可对照风格：`Libs/eva-select/`（唯一完整实现，对照其 js/css 写法）。
- 本库定位：自写正则 tokenizer 的轻量只读高亮，**比引 Prism 更简约、零依赖、与 `--eva-*` 令牌天然统一**。

## 1. 交付物

> 命名约定：库文件夹/文件名不带 `eva-` 前缀（如 `code/code.js`），但组件标签保留 `eva-` 前缀 `<eva-code>`（避免与 HTML 原生标签如 `<code>` 冲突）。

1. 新增 `Libs/code/code.js`（骨架已建，待实现）
2. 新增 `Libs/code/code.css`（骨架已建，待实现）
3. 修改 `assets/eva-app.js`：在现有 `eva-select` / `eva-modal` 的注册处旁追加一行

```js
if (window.EvaUI && window.EvaUI.Code) { app.component('eva-code', window.EvaUI.Code); }
```

## 2. 技术约束（必须遵守）

- **零第三方依赖**：不引 Prism / highlight.js / Shiki 等，纯自写正则 tokenizer。
- 不引新字体文件、不加重插件、**不做编辑功能**。
- JS 形态对齐 `eva-select.js`：IIFE + `window.EvaUI = window.EvaUI || {}` + `window.EvaUI.Code = { ... }`，Vue3 选项式组件，`template` 用字符串数组 `join('\n')`。
- 样式守 `ui-style-guard`：圆角 `var(--eva-radius)`（5px）、颜色**全部**用 `--eva-*` 令牌、选择器**全部**以 `.eva-code` 前缀、亮暗双模靠令牌自动适配、过渡 `var(--eva-ease)`、**禁 `!important`、禁硬编码颜色、禁新增字体文件**。

## 3. 组件 API

- 标签：`<eva-code>`
- props：
  - `code` {String} 源代码文本（必填）
  - `lang` {String} 语言：`php | js | css | html | bash`（默认 `''` = 纯文本，仅转义+排版，不着色）
  - `inline` {Boolean} 是否行内（默认 `false` = 块级 `<pre><code>`）
- 只读渲染，无 emits。
- 用法：`<eva-code :code="src" lang="php" />`

## 4. tokenizer 规格（核心）

流程：

1. **先对原始 `code` 做 HTML 转义**（`& < > "` → 实体），杜绝 XSS / 标签注入。
2. 在**转义后的文本**上按语言规则，用正则把 token 包成 `<span class="eva-code-tok eva-code-<type>">…</span>`。

支持语言（首批 5 种）：`php / js / css / html / bash`，每种一组规则。

token 类型（统一这几类，对应近单色配色）：

| type | 含义 |
| --- | --- |
| `comment` | 注释 |
| `string` | 字符串 |
| `keyword` | 关键字 |
| `number` | 数字 |
| `func` | 函数名 / HTML 标签名 |

实现建议：

- 每种语言一个「规则数组」`[{ type, re }]`，**先匹配注释与字符串，再匹配关键字、数字、函数名**——顺序是正则高亮最关键的点（否则注释/字符串里的关键字会被误着色）。
- 推荐做法：用一个「合并大正则 + 分组判定 type」单遍扫描，或「占位保护注释/字符串 → 着色其余 → 回填」，二选一，保证不重叠着色。
- **明确取舍（可接受）**：正则方案对模板字符串、正则字面量、嵌套结构等边界会偶发误判，不追求 100% 精确，以「主流代码片段观感正确」为验收线。

## 5. 样式规格（`eva-code.css`）

块级容器 `.eva-code`（`<pre><code>`）：

```css
.eva-code {
  display: block;
  overflow: auto;
  padding: 14px 16px;
  background: var(--eva-surface);
  border: 1px solid var(--eva-border);
  border-radius: var(--eva-radius);
  color: var(--eva-text);
  font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.6;
}
```

行内 `.eva-code.eva-code-inline`：`padding: 1px 6px; background: var(--eva-soft); border-radius: var(--eva-radius);`（去掉 `display:block` 与边框）。

近单色 token 配色（最简约，全走令牌、自动暗色）：

```css
.eva-code-comment { color: var(--eva-text-mute); font-style: italic; }
.eva-code-string  { color: var(--eva-accent); }
.eva-code-keyword { color: var(--eva-primary); font-weight: 600; }
.eva-code-number  { color: var(--eva-accent); }
.eva-code-func    { color: var(--eva-text); }
```

- 不写单独暗色块，全靠 `--eva-*` 令牌在 `.eva-dark` 下自动切换（与 `eva-select` 一致）。
- 滚动条可选加一段克制的 `::-webkit-scrollbar` 轻样式（参考 `eva-select.css`）。

## 6. 安全

- **必须先 HTML 转义再着色**；着色只允许产出受控的 `<span class>`，绝不把用户代码当 HTML 注入。
- `lang` 传入未知值时按纯文本处理（只转义 + 排版，不着色）。
- 因为已先转义，Vue 模板里用 `v-html` 输出着色结果是安全的（着色产物仅含我们生成的 span 与实体）。

## 7. 落地位置（两种场景，按需取一或都做）

- **Eva 后台 / 设置页内**：本库会被 `Eva::lib_assets()` 自动加载，`<eva-code>` 注册后即可在 Eva 字段模板里用。无需额外工作。
- **前台文章代码块**：需要在前台单独 `wp_enqueue_script/style` 本库的 js/css，并确保 `--eva-*` 令牌在前台可用（把 `:root` 令牌抽到一份公共 css，或在前台一并加载 `eva.css` 的令牌部分）。可作为第二步，先把组件做出来。

## 8. 验收标准

- [ ] 5 种语言各贴一段典型代码，关键字 / 字符串 / 注释 / 数字着色基本正确；
- [ ] 注释 / 字符串内部的关键字**不被误着色**（顺序正确）；
- [ ] 亮、暗两模观感正常、正文对比度 ≥ 4.5:1；
- [ ] 无 `!important`、无硬编码颜色、无新增字体文件 / 第三方库；
- [ ] `<eva-code>` 在 `eva-app.js` 注册后可正常渲染；移动端（≤782px）不破版；
- [ ] 传入恶意代码（含 `<script>`）时被转义、不执行。

## 9. 不要做

- 不做编辑 / 可输入；不引第三方高亮库；不做语言自动检测（由 `lang` 显式指定）；
- 默认不加行号 / 复制按钮等插件（如需，复制按钮可作为后续可选项，默认关闭）。

---

> 实现完成后：把成品发回，由值守方按「第 8 节验收标准 + 项目约定（库目录结构、`eva-app.js` 注册行、令牌与转义安全）」做一次 review。
