/**
 * dsh-open-in-vscode client half.
 *
 * 拦截消息里文件引用按钮（宿主渲染的 fileMention，title 属性为文件路径）的点击，
 * 改为经 vscode://file 协议唤起本机 VS Code 并定位到行；原行为（内置预览侧边栏）
 * 被阻止。仅处理绝对路径按钮，其余点击走宿主原逻辑。
 *
 * 行号来源优先级：
 * 1. React fiber 上 iU 组件的 props.file.line（宿主解析 路径#L行号 锚点所得，最可靠）；
 * 2. 按钮文本尾部的 L数字 或 L数字-L数字（链接文字约定格式，fallback）。
 *
 * 输出侧约定：引用链接文字以 L行号 或 L行号-L行号 结尾，href 用绝对路径加
 * #L行号 锚点，例如 [item-rank-before-save.ts L40-L81](绝对路径#L40-L81)。
 */
window.__ModuleLoader__.load({
  id: 'dsh-open-in-vscode',
  factory: () => {
    var isAbsolute = function (p) {
      return p.charAt(0) === '/' || /^[A-Za-z]:[\\/]/.test(p);
    };

    var lineFromFiber = function (dom) {
      var key = Object.keys(dom).filter(function (k) {
        return k.indexOf('__reactFiber$') === 0;
      })[0];
      if (!key) return undefined;
      var fiber = dom[key];
      for (var i = 0; fiber && i < 16; i += 1, fiber = fiber.return) {
        var props = fiber.memoizedProps || fiber.pendingProps;
        if (props && props.file && typeof props.file.path === 'string') {
          return typeof props.file.line === 'number' ? props.file.line : undefined;
        }
      }
      return undefined;
    };

    var lineFromText = function (text) {
      if (!text) return undefined;
      var m = /L([1-9]\d*)(?:\s*-\s*L?([1-9]\d*))?\s*$/.exec(text.trim());
      return m ? parseInt(m[1], 10) : undefined;
    };

    var openVsCode = function (path, line) {
      var parts = path.split('/').map(encodeURIComponent);
      var url = 'vscode://file' + parts.join('/') + (line ? ':' + line : '');
      var a = document.createElement('a');
      a.href = url;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    var onClick = function (ev) {
      var target = ev.target;
      if (!target || !target.closest) return;
      var btn = target.closest('button[type="button"][title]');
      if (!btn) return;
      var cls = typeof btn.className === 'string' ? btn.className : '';
      if (cls.indexOf('fileMention') === -1 && cls.indexOf('fileLink') === -1) return;
      var path = btn.getAttribute('title');
      if (!path || !isAbsolute(path)) return;
      var line = lineFromFiber(btn);
      if (line === undefined) line = lineFromText(btn.textContent);
      ev.preventDefault();
      ev.stopPropagation();
      openVsCode(path, line);
    };

    return {
      apply: function (ctx) {
        ctx.effect(function () {
          document.addEventListener('click', onClick, true);
          return function () {
            document.removeEventListener('click', onClick, true);
          };
        });
      },
    };
  },
});
