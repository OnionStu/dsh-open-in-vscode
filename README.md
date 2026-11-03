# dsh-open-in-vscode

DeepSeek Harness（dsh）Web 插件：把对话内的文件引用点击行为，从内置预览侧边栏改为唤起本机 VS Code 并定位到行。

## 功能

对话消息中的文件引用链接（`[文字](路径#L行号)` 渲染成的 fileMention 按钮），点击后不再打开内置预览，直接经 `vscode://file` 协议唤起 VS Code 跳到对应行。

与 DSH 原生能力的分工：会话头部原生的 Open In 按钮负责把工作区目录一键交给 VS Code 等应用；本插件负责对话内单文件的精确定位跳转。两者互补，不冲突。

## 原理

DSH 消息渲染原生支持文件引用链接，无协议路径加 `#L行号` 锚点会被解析为 fileMention 按钮，按钮的 title 属性即文件路径，默认点击调内置预览。本插件在捕获阶段拦截该按钮的点击，仅处理绝对路径按钮，行号优先从宿主 React fiber 的 `props.file.line` 读取，其次解析链接文字尾部的 `L行号` 约定格式，随后阻止默认行为并经 `vscode://file/路径:行号` 唤起 VS Code。相对路径按钮不拦截，保持原生预览。

浏览器模块导出含 `apply` 方法的 Cordis 插件。点击监听器随插件激活注册，随插件卸载移除；模块导入本身不注册监听器。

## 安装

要求 Node.js 20 以上、pnpm 10。未全局配置 pnpm store 时先执行 `pnpm config set store-dir <全局 store 路径>`。

```bash
git clone <本仓库地址> dsh-open-in-vscode
bash dsh-open-in-vscode/scripts/install.sh
```

安装脚本幂等，做三件事：profile 的 package.json 写入 link 依赖并把包名加入 `dsh.profile.bundles`、清理旧的手动挂载行、执行 pnpm install。完成后重启 dsh web 并硬刷新浏览器（bundle 列表在宿主启动时装载，client 半改动硬刷新即生效）。

## 输出侧引用格式

插件使用者（如 agent）输出引用时，链接文字以 `L行号` 或 `L行号-L行号` 结尾，href 用绝对路径加 `#L行号` 锚点：

```markdown
[manifest.yml L64-L73](/absolute/path/to/project/manifest.yml#L64-L73)
```

## 目录结构

| 路径 | 作用 |
|---|---|
| lib/index.js | host 半，空壳 cordis 插件，满足装载契约 |
| lib/client.js | client 半，点击拦截与 VS Code 唤起 |
| cordis.patch.yml | bundle 层声明，安装即挂载 |
| scripts/install.sh | 幂等安装脚本 |
| scripts/test-client.mjs | client 半的 node:test 单元测试 |

## 测试

```bash
node --test scripts/test-client.mjs
```

## 限制

仅面向本机部署（浏览器与 host 同机）。首次点击时浏览器会弹一次协议确认，允许后不再弹。fileMention 的类名与 React fiber 结构属于宿主内部实现，宿主大版本升级后可能需要适配。

## 协议

MIT
