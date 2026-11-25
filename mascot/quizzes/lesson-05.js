(function () {
  window.SHENKUIYE_QUIZZES = window.SHENKUIYE_QUIZZES || {};
  window.SHENKUIYE_QUIZZES["lesson-05"] = {
    title: "第五课 · 坐标转换与升落",
    questions: [
      {
        prompt: "北纬 40°，一颗赤纬 0° 的星星上中天时，高度是多少？在南边还是北边？",
        choices: ["0°，在正北", "40°，在天顶", "50°，在正南", "90°，在正东"],
        answer: 2,
        correct: { expression: "smug", text: "50°，正南。90° − 40° + 0°。天赤道过子午圈时，北半球的人看它在南方。" },
        wrong: {
          expression: "angry",
          text: "中天高度不是纬度本身，也不是 90°。",
          review: "星星从南边过子午圈时，上中天高度 = 90° − φ + δ。北纬 40°、赤纬 0°，就是 90° − 40° + 0° = 50°，在正南。天赤道经过正东和正西，在正南升到的就是这个高度。",
          section: "中天",
          anchor: "#l5-transit"
        }
      },
      {
        prompt: "赤纬 +60° 的星星，在北纬 40° 会落下吗？",
        choices: ["会，每天都落到地平线下", "不会，它是拱极星", "只有冬天会落", "永不升起"],
        answer: 1,
        correct: { expression: "shy", text: "不落。60° 大于 90° − 40° = 50°，拱极。整圈都在地平线以上，不是不动。" },
        wrong: {
          expression: "worried",
          text: "它不会落到地平线下，也不是永不升起。拱极是另一件事。",
          review: "北半球可以记：赤纬大于 90° − φ 就拱极，赤纬小于 φ − 90° 就永不升起。北纬 40° 的界线大约是 +50° 和 −50°。+60° 大于 +50°，所以整夜不落。cos H₀ = −tan φ tan δ 会小于 −1，没有升落解。",
          section: "升起和落下",
          anchor: "#l5-rise"
        }
      },
      {
        prompt: "时角 H = 0 表示什么？",
        choices: ["星星正好在地平线上", "上中天，地方恒星时等于赤经", "春分点", "方位角一定是 90°"],
        answer: 1,
        correct: { expression: "smug", text: "上中天。地方恒星时等于赤经的那一刻。高度达到这一天的最大，方位在正南或正北。" },
        wrong: {
          expression: "angry",
          text: "H = 0 不是升起。升起的时角是 −H₀，不是 0。",
          review: "上中天就是时角 H = 0，地方恒星时等于赤经。下中天是 H = 180°。星星在 −H₀ 升起，在 +H₀ 落下。H 为负还在东边，H 为正已经偏西。",
          section: "中天",
          anchor: "#l5-transit"
        }
      },
      {
        prompt: "在北纬 40°，赤纬小于大约多少，星星就永不升起？",
        choices: ["+50°", "0°", "−50°", "−23.4°"],
        answer: 2,
        correct: { expression: "shy", text: "−50°。φ − 90° = −50°。水委一大约 −57°，所以北京看不到它升起。" },
        wrong: {
          expression: "worried",
          text: "+50° 是拱极的界线，不是永不升起的界线。符号反了。",
          review: "北半球：赤纬大于 90° − φ 就拱极，赤纬小于 φ − 90° 就永不升起。北纬 40° 时，φ − 90° = −50°。水委一赤纬大约 −57°，比这更南，在北京不升出地平线。",
          section: "升起和落下",
          anchor: "#l5-rise"
        }
      }
    ]
  };
})();
