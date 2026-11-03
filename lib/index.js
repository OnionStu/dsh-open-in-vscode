/**
 * dsh-open-in-vscode host half.
 *
 * 插件只有 client 半：点击拦截与 VS Code 唤起全部在浏览器侧完成
 * （lib/client.js）。host 半仅满足宿主的装载契约（bundle 装载时按
 * main 入口 require 并执行 cordis 插件），不注册任何服务与路由。
 */
export const inject = [];

export function apply() {
  // no-op by design
}
