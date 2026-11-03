#!/bin/bash
# 安装 dsh-open-in-vscode 到 web profile（幂等，可重复执行）。
# 走 bundle 通道：包名写入 dsh.profile.bundles，宿主按列表读包内 dsh.bundle.patch
# 完成挂载。同时清理旧的手动挂载行（避免双挂载）。
# 用法：bash scripts/install.sh
set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE_DIR="$HOME/.dsh/profiles/web"
PKG_NAME="dsh-open-in-vscode"

if [ ! -d "$PROFILE_DIR" ]; then
  echo "找不到 profile 目录 $PROFILE_DIR，先运行一次 dsh web 初始化。" >&2
  exit 1
fi

# 1. package.json：link 依赖 + bundles 列表（幂等）
node - "$PROFILE_DIR/package.json" "$PKG_NAME" "link:$PLUGIN_DIR" <<'EOF'
const fs = require('fs');
const [path, name, spec] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
let changed = false;
if (pkg.dependencies[name] !== spec) {
  pkg.dependencies[name] = spec;
  changed = true;
}
const dsh = pkg.dsh = pkg.dsh || {};
const profile = dsh.profile = dsh.profile || {};
profile.bundles = profile.bundles || [];
if (!profile.bundles.includes(name)) {
  profile.bundles.push(name);
  changed = true;
}
if (changed) {
  fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log('package.json 已更新（link 依赖 + bundles 挂载）');
} else {
  console.log('package.json 无需变更');
}
EOF

# 2. cordis.patch.yml：移除旧的手动挂载行（双挂载防护，幂等）
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
if [ -f "$PATCH_FILE" ] && grep -q "dsh-open-in-vscode" "$PATCH_FILE"; then
  node - "$PATCH_FILE" <<'EOF'
const fs = require('fs');
const path = process.argv[2];
let text = fs.readFileSync(path, 'utf8');
const before = text;
text = text.replace(/- insert:\s*\n\s*- id: open-in-vscode\s*\n\s*name: 'dsh-open-in-vscode'\s*\n?/g, '');
if (text !== before) {
  fs.writeFileSync(path, text);
  console.log('cordis.patch.yml 已移除旧手动挂载行');
}
EOF
else
  echo "cordis.patch.yml 无手动挂载行"
fi

# 3. pnpm install（store 路径读取用户全局配置，未配置时先 pnpm config set store-dir）
cd "$PROFILE_DIR"
pnpm install

echo ""
echo "安装完成。重启 dsh web 后生效（bundle 列表在宿主启动时装载）："
echo "  ~/.dsh/profiles/web/restart-dsh-web.sh"
echo "重启后硬刷新浏览器（Cmd+Shift+R）。"
