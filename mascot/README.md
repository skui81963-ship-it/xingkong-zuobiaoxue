# 深葵夜

这是一套可以整夹带走的页面角色。星空坐标学用她做首页问候、边上的陪伴，以及每课结束时的复习。角色叫深葵夜：齐肩白发、紫色眼睛、白皙皮肤，样子偏软、偏可爱。说话仍是成熟的傲娇，会损你两句，但把天文讲对。她称呼读者为「观星者」。外貌写在 `mascot-persona.js` 的 `appearance` 里，方便以后补人设。

台词、事件和测验都在数据文件里。换一个网站时，通常只换这些文件和图片，引擎不用改。

## 文件夹里有什么

| 文件 | 作用 |
| --- | --- |
| `mascot.js` | 引擎。对话、月相、事件、右侧小图、测验流程都在这里。 |
| `mascot.css` | 布局。全屏对话框、右侧立绘、选项按钮。 |
| `mascot-theme.css` | 颜色和尺寸，只有 `--sk-` 变量。换外观改这一份。 |
| `mascot-persona.js` | 台词。按早晨、中午、下午、傍晚、深夜、季节、月相分开。 |
| `mascot-events.js` | 2026–2027 的节气、流星雨、交食、行星合，以及估算的朔望。 |
| `quizzes/lesson-01.js` … | 每一课的复习题。文件名要和配置里的 `lesson` 对上。 |
| `img/*.webp` | 五张全身立绘：`normal` 平常、`smug` 得意、`angry` 不悦、`shy` 害羞、`worried` 担心。浅灰底已去掉，大约 9:16，脚也留在画面里。 |

## 接到页面上

样式放在 `head` 里，脚本放在 `body` 最后。路径按你的页面来写。下面是和角色文件夹同一层的写法。

```html
<link rel="stylesheet" href="mascot/mascot-theme.css">
<link rel="stylesheet" href="mascot/mascot.css">

<script src="mascot/mascot-persona.js"></script>
<script src="mascot/mascot-events.js"></script>
<script src="mascot/mascot.js"></script>
<script>
  Shenkuiye.start({
    root: "mascot/",
    page: "home"
  });
</script>
```

`root` 是图片和引擎眼里的资源目录，相对当前这个 html。

`page` 有三种：

| 值 | 行为 |
| --- | --- |
| `home` | 每天第一次打开，播一遍全屏问候，然后缩到右侧。 |
| `lesson` | 不播全屏问候。右侧可以点。若加载了对应题库，会在「小练习」后面加上「和深葵夜一起复习」。 |
| `companion` | 只有右侧的她，不测验。附录用这个。 |

课文要多写两行：

```html
<script src="mascot/quizzes/lesson-01.js"></script>
<script src="mascot/mascot.js"></script>
<script>
  Shenkuiye.start({
    root: "mascot/",
    page: "lesson",
    lesson: "lesson-01"
  });
</script>
```

`lesson` 的值就是题库对象的名字。题库挂在 `window.SHENKUIYE_QUIZZES` 上。

这些脚本是普通的 `<script>`，没有 `type="module"`。双击 html、用 `file://` 打开，也能跑。在线月相接口失败时，自动改用本地月相和这份事件表。

## 她会记住什么

记在浏览器的 `localStorage` 里：

- `shenkuiye.hidden`：选过「让我静静」就是 `"1"`。下次打开仍避开，直到点「我想你了」。
- `shenkuiye.welcomeDay`：今天的日期。同一天不再重复全屏问候。

想再看一遍问候，地址后面加上 `?shenkuiye=reset`。

## 问候怎么拼

每次全屏问候按顺序取一句：

1. 时段。当地时间 5 点到 11 点是早晨，11 点到 14 点是中午，14 点到 18 点是下午，18 点到 22 点是傍晚，其余是深夜。
2. 季节。按节气：立春到立夏是春，立夏到立秋是夏，立秋到立冬是秋，立冬到立春是冬。表里没有的年份，用大约的公历日顶上。
3. 月相。本地公式算出新月、峨眉、上弦、盈凸、满月、亏凸、下弦、残月。能连上美国海军天文台的月相接口时，若距离朔望弦不到 18 小时，改用那边的名称。
4. 若今天前后有节气、流星雨、交食或行星合，再加一句。朔望已经写在月相那句里，不重复。
5. 收尾，告诉读者她会留在右边。

点右侧的小图，会从同时段、季节、月相的短句里轮着说。

## 测验

原有的「小练习」不动。引擎只在那一列的后面加一个按钮。

答错时，她换表情，复述知识点，并给一个链到课文小节的链接。课文里的标题需要有 `id`，题库里的 `anchor` 写成 `#这个id`。点链接会先收起对话框、滚到那一节，页面下方留着「继续和深葵夜复习」。

题库一条长这样：

```js
{
  prompt: "题干",
  choices: ["选项一", "选项二", "选项三", "选项四"],
  answer: 0,
  correct: { expression: "smug", text: "答对时她说的话" },
  wrong: {
    expression: "angry",
    text: "答错时的第一句",
    review: "要把哪一个知识点讲清楚",
    section: "小节标题",
    anchor: "#某一节的id"
  }
}
```

`answer` 是正确选项的序号，从 0 数。

## 换成立绘或换人

五张图是全身、大约 9:16。浅灰底去掉之后存成 WebP，头到脚都要留着。文件名必须是 `normal.webp`、`smug.webp`、`angry.webp`、`shy.webp`、`worried.webp`。全屏对话时她站在文字框旁边或上方，按画面高度缩小，不裁成半身。右侧常驻也是整个人，正文栏会让开这一条。

想换一个人，替换 `img/` 和 `mascot-persona.js`。引擎只认 `expression` 字段和这五个文件名。

## 不要挡操作的页面

星空坐标学的虚拟观星和实用星座模拟没有引用这套脚本。那两页的画布、时间、搜索和陀螺仪贴着屏幕边缘，立绘会挡住。阅读页才让她出现；右侧的小图也可以用「让我静静」收起来。
