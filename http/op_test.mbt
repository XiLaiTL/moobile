///|
test "HTTP commands have structural debug output" {
  debug_inspect(
    @http.get("/api/v0/modules").expect_text(_ => @cmd.none),
    content="Get(\"/api/v0/modules\", Text)",
  )
}
