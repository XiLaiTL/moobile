///|
test "basic_url" {
  let a = "http://localhost:5173/abcd"
  @debug.debug_inspect(
    @url.parse(a),
    content=(
      #|{
      #|  protocol: Http,
      #|  host: "localhost",
      #|  port: Some(5173),
      #|  path: "abcd",
      #|  query: None,
      #|  fragment: None,
      #|}
    ),
  )
  @debug.debug_inspect(
    @url.parse("https://example.com"),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: None,
      #|  path: "",
      #|  query: None,
      #|  fragment: None,
      #|}
    ),
  )
  @debug.debug_inspect(
    @url.parse("https://example.com/"),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: None,
      #|  path: "",
      #|  query: None,
      #|  fragment: None,
      #|}
    ),
  )
  @debug.debug_inspect(
    @url.parse("https://example.com/path1/path2"),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: None,
      #|  path: "path1/path2",
      #|  query: None,
      #|  fragment: None,
      #|}
    ),
  )
  @debug.debug_inspect(
    @url.parse("https://example.com:8080/path/to/somewhere?query#fragment"),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: Some(8080),
      #|  path: "path/to/somewhere",
      #|  query: Some("query"),
      #|  fragment: Some("fragment"),
      #|}
    ),
  )
  @debug.debug_inspect(
    @url.parse(
      "https://example.com:8080/path/to/somewhere?key=value&key2=value2#fragment",
    ),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: Some(8080),
      #|  path: "path/to/somewhere",
      #|  query: Some("key=value&key2=value2"),
      #|  fragment: Some("fragment"),
      #|}
    ),
  )
}

///|
test "special url" {
  @debug.debug_inspect(
    @url.parse("localhost:8080/abcd"),
    content=(
      #|{
      #|  protocol: Other(""),
      #|  host: "localhost",
      #|  port: Some(8080),
      #|  path: "abcd",
      #|  query: None,
      #|  fragment: None,
      #|}
    ),
  )
}

///|
test "no_port" {
  @debug.debug_inspect(
    @url.parse("https://example.com/path/to/somewhere?query#fragment"),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: None,
      #|  path: "path/to/somewhere",
      #|  query: Some("query"),
      #|  fragment: Some("fragment"),
      #|}
    ),
  )
}

///|
test "no_query" {
  @debug.debug_inspect(
    @url.parse("https://example.com:8080/path/to/somewhere#fragment"),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: Some(8080),
      #|  path: "path/to/somewhere",
      #|  query: None,
      #|  fragment: Some("fragment"),
      #|}
    ),
  )
}

///|
test "no_fragment" {
  @debug.debug_inspect(
    @url.parse("https://example.com:8080/path/to/somewhere?query"),
    content=(
      #|{
      #|  protocol: Https,
      #|  host: "example.com",
      #|  port: Some(8080),
      #|  path: "path/to/somewhere",
      #|  query: Some("query"),
      #|  fragment: None,
      #|}
    ),
  )
}
