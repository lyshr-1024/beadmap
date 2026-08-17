# 豆图 BeadMap

把图片转成拼豆（perler beads / Hama beads）图纸的纯前端工具。上传图片 → 设定网格尺寸 → 匹配真实拼豆色号 → 输出可打印图纸和每色用量清单。

图片不上传服务器，全部在浏览器本地处理。

## 开发

```bash
pnpm install
pnpm dev
pnpm test
pnpm build
```

## 实现要点

- **降采样**：canvas 面积平均（box filter），可选 Lanczos3；滤波在预乘 alpha 空间进行，避免透明边缘渗黑边。Lanczos 的负瓣过冲会 clamp 回源局部范围，防止产生原图不存在的颜色。
- **色彩匹配**：转 CIELAB 后用 CIEDE2000 做最近邻，而非 RGB 欧氏距离（后者在暗部和蓝色区偏差很大）。实现通过 Sharma 2005 论文的 34 组标准测试数据验证。
- **性能**：量化跑在 Web Worker 里，参数变化时作废在途请求并 debounce。
- **透明像素**按 alpha 阈值留空，不参与匹配。

## 色板数据

`src/data/palettes/*.json`，格式：

```json
{
  "brand": "ARTKAL C",
  "beadSize": "2.6mm",
  "colors": [{ "code": "C01", "name": "白", "hex": "#FFFFFF" }]
}
```

新增品牌：把 JSON 放进该目录，然后在 `src/data/palettes/index.ts` 注册一行。

> 当前内置的 `generic` 和 `mini-16` 色板是按 HSL 构造的**近似占位值**，不对应任何真实品牌色卡，不能照着购买色号。替换为实测色卡后把注册表里的 `approximate` 改为 `false`。
