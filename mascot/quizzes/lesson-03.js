(function () {
  window.SHENKUIYE_QUIZZES = window.SHENKUIYE_QUIZZES || {};
  window.SHENKUIYE_QUIZZES["lesson-03"] = {
    title: "第三课 · 赤道坐标系",
    questions: [
      {
        prompt: "一颗星的赤经是 6 时整。换成度是多少？",
        choices: ["6°", "60°", "90°", "360°"],
        answer: 2,
        correct: { expression: "smug", text: "6 × 15° = 90°。一时等于 15 度，这是后面所有换算的钥匙。" },
        wrong: {
          expression: "angry",
          text: "时和度不是一比一。你要是这样代进公式，高度会错得很难看。",
          review: "赤经一圈是 24 时，也是 360°。所以 1 时 = 15°。6 时整就是 6 × 15° = 90°。天狼的赤经大约 6 时 45 分，比 90° 还要多一截。",
          section: "赤经",
          anchor: "#l3-ra"
        }
      },
      {
        prompt: "赤纬 −16° 的星星，在天赤道的哪一边？你从北京飞到上海，它的赤纬会变吗？",
        choices: ["北边，会变", "南边，不会变", "就在天赤道上，会变", "南边，会变成正的"],
        answer: 1,
        correct: { expression: "shy", text: "南边，而且不随你搬家。赤纬是星星自己的地址。你这次分得清楚。" },
        wrong: {
          expression: "worried",
          text: "负的赤纬在南边。换城市改的是地平坐标，不是赤纬。",
          review: "赤纬从天赤道量起，向北为正，向南为负。−16° 在天赤道以南。赤道坐标跟着天赤道和天极走，恒星的赤经、赤纬不随观测地点改变。变的是方位角和高度角。",
          section: "赤纬",
          anchor: "#l3-dec"
        }
      },
      {
        prompt: "星表为什么要写 J2000，而不是只写「赤经、赤纬」？",
        choices: ["因为星星只在 2000 年存在", "春分点和天赤道会因岁差慢慢移动，要写明历元", "因为赤经只有 2000 个刻度", "因为那一年黄赤交角是 0°"],
        answer: 1,
        correct: { expression: "smug", text: "历元。不写年份，后人不知道这组数字对准哪一张坐标网。本站用 J2000.0。" },
        wrong: {
          expression: "angry",
          text: "J2000 不是星星的出厂日期。",
          review: "岁差会让春分点和天赤道每年慢慢挪一点，所以星表要写历元。J2000.0 是 2000 年 1 月 1 日 12 时世界时那一套春分点和天赤道。不写历元，赤经赤纬就没有对准的网格。",
          section: "格子画在天球上",
          anchor: "#l3-grid"
        }
      },
      {
        prompt: "赤纬的范围是？",
        choices: ["0 到 24 时", "0° 到 360°", "−90° 到 +90°", "只有 0° 和 90° 两个值"],
        answer: 2,
        correct: { expression: "shy", text: "−90° 到 +90°。北天极 +90°，南天极 −90°，天赤道 0°。像纬度，你就好记。" },
        wrong: {
          expression: "worried",
          text: "赤纬不是绕一圈的那个角。绕一圈的是赤经。",
          review: "赤纬从天赤道向北或向南量，范围是 −90° 到 +90°。天赤道是 0°，北天极 +90°，南天极 −90°。0 到 24 时、0° 到 360° 说的是赤经那一圈。",
          section: "赤纬",
          anchor: "#l3-dec"
        }
      }
    ]
  };
})();
