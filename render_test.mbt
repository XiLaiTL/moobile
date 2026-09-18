///|
#cfg(not(target="js"))
#warnings("-alert_experimental")
async test "render appends injected head nodes before the transcript" {
  let app = @rabbita.new(() => {
    @rabbita.Val::constant(
      @html.html([
        @html.head([@html.title("Rabbita")]),
        @html.body([@html.div("content")]),
      ]),
    )
  })
  let rendered = app.render(url="https://example.com/docs", head=[
    @html.link(rel="stylesheet", href="/assets/app.css"),
    @html.script(src="/assets/app.js", type_="module", @html.nothing),
  ])
  inspect(
    rendered,
    content=(
      #|<!DOCTYPE html><html><head><title>Rabbita</title><link href="/assets/app.css" rel="stylesheet"><script src="/assets/app.js" type="module"></script><script id="__rabbita_transcript" type="application/json">{}</script></head><body><div>content</div></body></html>
    ),
  )
}
