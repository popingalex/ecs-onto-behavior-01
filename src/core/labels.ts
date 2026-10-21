import type { Primitive, ValueShape, WriteMode } from "./types"

/** 模式层字段的中文显示名；ID 保持英文稳定标识。 */
export const WRITE_MODE_LABEL: Record<WriteMode, string> = {
  configuration: "配置",
  exclusive: "独占写入",
  contribution: "贡献",
  contract: "契约",
}

export const WRITE_MODE_HINT: Record<WriteMode, string> = {
  configuration: "运行前确定，运行中只读。",
  exclusive: "每回合只有一个 system 可写。",
  contribution: "多个 system 提交请求，经归约契约裁决后整回合原子生效。",
  contract: "由联合约束统一写入。",
}

export const SHAPE_LABEL: Record<ValueShape, string> = {
  scalar: "标量",
  vector3: "三维向量",
  matrixRef: "矩阵引用",
}

export const PRIMITIVE_LABEL: Record<Primitive, string> = {
  f64: "浮点 f64",
  i64: "整数 i64",
  bool: "布尔",
  string: "文本",
  EntityRef: "实体引用",
}
