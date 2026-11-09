export function InstallSection() {
  return (
    <div className="flex flex-col gap-4" data-testid="install-meta">
      <h2 className="text-sm font-medium">安装到主屏幕</h2>
      <p className="text-sm leading-6 text-muted-foreground">
        iPhone 请用 Safari 打开旅序，点底部分享，再选「添加到主屏幕」。打开后是独立窗口，没有地址栏。离线时仍能进入已经保存的行程。
      </p>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">名称</dt>
        <dd>旅序</dd>
        <dt className="text-muted-foreground">显示</dt>
        <dd>独立窗口，竖屏</dd>
        <dt className="text-muted-foreground">主题色</dt>
        <dd>浅色纸色，深色随系统</dd>
        <dt className="text-muted-foreground">图标</dt>
        <dd>180、192 与 512，含可遮罩图标</dd>
        <dt className="text-muted-foreground">启动画面</dt>
        <dd>纸色底，居中行程标记。深色随系统。</dd>
      </dl>
    </div>
  );
}
