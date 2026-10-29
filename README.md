# 人格记忆 · Persona Memory

[![CI](https://github.com/ifenc/dsh-persona-memory/actions/workflows/ci.yml/badge.svg)](https://github.com/ifenc/dsh-persona-memory/actions/workflows/ci.yml)

给 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) 加上「人设 + 长期记忆 + 日记 + 资料库」的本地插件。

English: a local-first DSH plugin that keeps a character card in the system prompt, remembers facts on an Ebbinghaus forgetting curve, and keeps per-character diaries and a reference library.

## 功能

- **人设模式（按对话独立）**：每个对话单独开关；打开后，当前人物卡会和记忆一起进入这个对话的系统提示词，切换到别的对话不会跟着变。新对话默认关闭。
- **人物卡 + 记忆/日记/资料绑定**：每张人物卡有自己的一组记忆、日记和资料库；切换人物卡时提示词、记忆列表、日记本和资料库都会切到对应的那一套。可以单独清空当前人物卡的记忆和资料库，导入/导出也只针对当前卡；删除人物卡会连同它的记忆、日记和资料一起删除。
- **关闭后的语气提醒**：在一个开过人设的对话里关闭人设后，会额外注入一句很短的提醒，要求用普通助手语气、不要沿用之前的角色自称和动作描写，用来对抗对话历史的惯性。
- **艾宾浩斯记忆**：记忆的清晰度按遗忘曲线随时间衰减；越久不回顾掉得越快。被注入提示词或主动复习会延长保留时间；重要记忆可置顶，永不遗忘。清晰度低于阈值后自动移入「已遗忘」，可以恢复。
- **日记**：可以开启「日记功能」让模型在对话自然收束时写日记；也可以开启「自动摘要」，每轮结束后把你说过的要点在本地汇总成当天的日记（不额外消耗模型调用）。
- **资料库**：每张人物卡有自己的资料库，可以收录聊天里的梗、知识笔记、网上查到的资料（带来源链接）。模型通过 `persona_library` 工具搜索/查阅，学到新东西时会自动补充；用户可以在设置里手动新增、编辑、清空，或按当前卡导入导出。
- **工具**：`persona`、`persona_memory`、`persona_diary`、`persona_library`，可以直接用自然语言让人设调整、记忆增删、写日记、查/记资料；这些工具都作用于当前人物卡。
- **导入导出**：人物卡、记忆、日记、资料库都可以单独导出为 JSON，也可以一键备份/恢复全部数据；导入时可以选择合并（去重）或覆盖。
- **界面**：设置 →「人格记忆」里有卡片编辑、记忆列表（含清晰度条）、资料库、日记本和参数设置；输入框下方（新对话在新会话行）的开关只作用于当前对话，**左键开关、右键呼出菜单**选择关闭或切换人物卡；设置页还提供「全部关闭」。人设只注入主对话，子 Agent 不受影响。开关带「开 / 关」文字，说明性提示收进圆圈问号图标，鼠标悬停或聚焦时显示。

## 安装

需要 DSH 0.2.1+（在 0.2.1-rc.2 桌面版上开发和测试）。

1. 克隆或下载本仓库到本地任意目录：

   ```bash
   git clone https://github.com/ifenc/dsh-persona-memory.git
   ```

2. 在 DSH 的插件管理里安装这个本地 bundle（选择 `dsh-persona-memory` 目录）。

   也可以使用 CLI（`--profile` 按你的实际 profile 名替换，桌面版通常是 `desktop`，Web 版是 `web`）：

   ```bash
   dsh plugin --profile desktop add "/absolute/path/to/dsh-persona-memory"
   ```

3. 安装后刷新页面；如果插件没有出现，重启 `dsh web`。

> 从本地目录安装时 DSH 会以 link 方式挂载，修改源码后重新加载插件或重启即可生效。

## 使用

- 打开 **设置 → 人格记忆**：编辑人物卡、查看记忆与日记、调整参数、导入导出。
- 每个对话输入框下方有一个人设开关：
  - **左键**：开启 / 关闭当前对话；
  - **右键**：关闭当前对话，或切换到某张人物卡（切换卡片会同时切换记忆和日记）；
  - 新建对话时，开关出现在新会话那一行。
- 设置页顶部显示「已开启 N 个对话」，并提供「全部关闭」。
- 直接和模型说「记住这件事」「把这条忘掉」「写篇日记」「换成另一张人物卡」也可以，插件注册了对应的工具。

## 数据与隐私

- 数据默认保存在 `DSH_HOME/persona-memory/store.json`，可以用环境变量 `DSH_PERSONA_MEMORY_DIR` 覆盖目录。
- 所有数据都在本机，插件不发起任何网络请求。
- 人设、记忆和日记会进入发给模型的提示词；请不要把不希望发送给模型的内容写进人物卡或记忆。

## 兼容性

插件依赖 DSH 的 `tools`、`systemPrompt`、`webServer`、`agents`、`sessions` 服务。DSH 仍处于快速迭代阶段，后续版本如果调整这些接口，插件可能需要同步适配。

## 开发

项目是纯 ESM JavaScript，没有构建步骤：

```bash
npm run check   # node --check：语法检查
npm test        # node --test：存储、遗忘曲线、卡片绑定、导入导出测试
```

目录结构：

| 路径 | 作用 |
|---|---|
| `index.js` | Host 半区：提示词注入、工具、HTTP 接口、自动摘要 |
| `lib/store.js` | 存储层与遗忘曲线引擎（纯 Node，可独立测试） |
| `client.js` | Web 设置页、输入框开关、右键菜单 |
| `locale/` | 插件管理页的标题与描述 |
| `cordis.patch.yml` | bundle 挂载 |
| `test/` | 单元测试 |

欢迎 Issue 和 PR。提交前请跑一遍 `npm run check && npm test`。

## 许可证

[MIT](LICENSE)

## 免责声明

这是一个非官方插件，与 DeepSeek 没有隶属关系。人物卡、记忆和日记的内容由使用者自行负责。
