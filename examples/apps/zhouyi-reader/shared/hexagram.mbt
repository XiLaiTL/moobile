///|
/// 数据模型：对应 assets/reader_data.json（《御纂周易折中》64 卦阅读数据）
/// 字段名与 JSON key 一致（中文标识符）

///|
/// 三画卦
pub(all) struct Trigram {
  名 : String
  象 : String
} derive(Eq, ToJson, FromJson)

///|
/// 集说条目（一家之说）
pub(all) struct Citation {
  家 : String?
  书 : String?
  文 : String
} derive(Eq, ToJson, FromJson)

///|
/// 注疏集合：本义(朱熹)/程传(程颐)/案(御案)/总论 + 集说[]
pub(all) struct Commentary {
  本义 : String?
  程传 : String?
  案 : String?
  总论 : String?
  集说 : Array[Citation]?
} derive(Eq, ToJson, FromJson)

///|
/// 经文块（文 + 可选类型 + 可选注疏）
pub(all) struct Block {
  文 : String
  类型 : String?
  注疏 : Commentary?
} derive(Eq, ToJson, FromJson)

///|
/// 系辞引述（引爻辞 + 子曰/引经）
pub(all) struct Cite {
  来源 : String
  类型 : String
  引文 : String
  引文前 : String?
  引文后 : String?
  子曰 : String?
  注疏 : Commentary?
} derive(Eq, ToJson, FromJson)

///|
/// 一爻
pub(all) struct Yao {
  位 : Int
  爻题 : String
  爻辞 : String
  注疏 : Commentary?
  小象 : Array[Block]?
  系辞引述 : Array[Cite]?
  文言 : Array[Block]?
} derive(Eq, ToJson, FromJson)

///|
/// 卦主
pub(all) struct Guazhu {
  爻题 : String
  类型 : String
} derive(Eq, ToJson, FromJson)

///|
/// 义例归类
pub(all) struct Guilei {
  时 : Array[String]?
  六四承九五 : Bool?
  九四承六五 : Bool?
  九二应六五 : Bool?
  六二应九五 : Bool?
} derive(Eq, ToJson, FromJson)

///|
/// 传文关联
pub(all) struct Relations {
  序卦 : Array[Block]?
  杂卦 : Array[Block]?
  说卦 : Array[Block]?
  系辞 : Array[Block]?
} derive(Eq, ToJson, FromJson)

///|
/// 单卦
pub(all) struct Hexagram {
  序号 : Int
  卦名 : String
  象名 : String
  卦画 : String
  经 : String
  卷 : String
  上卦 : Trigram
  下卦 : Trigram
  卦主 : Array[Guazhu]?
  卦辞 : Block?
  彖传 : Array[Block]?
  大象 : Array[Block]?
  六爻 : Array[Yao]
  用 : Block?
  总论 : String?
  文言 : Array[Block]?
  传文关联 : Relations?
  义例归类 : Guilei?
} derive(Eq, ToJson, FromJson)

///|
/// 顶层文档
pub(all) struct ReaderData {
  meta : Meta
  hexagrams : Array[Hexagram]
} derive(Eq, ToJson, FromJson)

///|
/// 元信息
pub(all) struct Meta {
  书名 : String
  版本 : String
  卦数 : Int
  生成时间 : String
} derive(Eq, ToJson, FromJson)

///|
/// 从 JSON 字符串解析整个阅读数据（数据非法时 abort——reader_data.json 由生成脚本保证合法）
pub fn parse_reader_data(raw : String) -> ReaderData {
  @json.from_json(@json.parse(raw)) catch {
    _ => abort("invalid reader_data json")
  }
}

///|
/// 按卦序号取卦（1-64），越界返回 None
pub fn hexagram_by_number(data : ReaderData, number : Int) -> Hexagram? {
  if number < 1 || number > data.meta.卦数 {
    return None
  }
  Some(data.hexagrams[number - 1])
}

///|
/// 按卦名取卦（如 "渐"、"风山渐"、"渐卦"）
pub fn hexagram_by_name(data : ReaderData, name : String) -> Hexagram? {
  let trimmed = name.trim().to_owned()
  for h in data.hexagrams {
    if h.卦名 == trimmed || h.象名 == trimmed || "\{h.卦名}卦" == trimmed {
      return Some(h)
    }
  }
  None
}

///|
/// 卦画（6位码，自下而上）-> 上卦三爻（5,4,3位）
pub fn upper_trigram_code(code : String) -> String {
  code[3:6].to_owned()
}

///|
/// 卦画 -> 下卦三爻（2,1,0位）
pub fn lower_trigram_code(code : String) -> String {
  code[0:3].to_owned()
}

///|
/// 错卦：六爻全变（0<->1）
pub fn opposite(code : String) -> String {
  let mut result = ""
  for ch in code {
    result = result + (if ch == '1' { "0" } else { "1" })
  }
  result
}

///|
/// 综卦：上下颠倒（反覆）
pub fn reversed(code : String) -> String {
  let mut result = ""
  let mut i = code.length() - 1
  while i >= 0 {
    result = result + code[i:i + 1].to_owned()
    i = i - 1
  }
  result
}

///|
/// 互卦：二三四爻为下卦，三四五爻为上卦（code 自下而上 0..5）
pub fn mutual(code : String) -> String {
  let lower = code[1:4].to_owned() // 二三四
  let upper = code[2:5].to_owned() // 三四五
  lower + upper
}
