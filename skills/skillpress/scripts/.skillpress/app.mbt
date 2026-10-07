///|
/// # skillpress 站点实例 —— **界面不在这里**
///
/// 界面（顶栏 / 分栏下拉 / 侧栏树 / 正文渲染）住在包 `XiLaiTL/skillpress/shell` 里：
/// 这个实例只负责"**用**那个包"——把内容源（`content` 包，生成物）接线到 `@shell.site`。
///
/// P6 之前这份文件自己带着整套界面（1062 行）与类型声明；搬完之后这里**只剩接线**：
/// 判据是"≤20 行"（`tools/acceptance.sh` 的 A2）—— 把界面抄回来会让那条判据立刻变红。
///
/// 内容源怎么变成 `content` 包：`cmd/skillpress gen-file <内容根>`（见 `package.json` 的 `press`）。
pub fn app() -> @moobile.JsValue {
  @shell.site({
    home: @content.home(),
    docs: @content.skills(),
    find_page: @content.find_page,
    // 页脚要交代的出处（许可 / 生成时间 / 内容根指纹）—— 见 `shell/types.mbt` 的 `Footer`。
    footer: @content.footer(),
  })
}
