(function () {
  window.SHENKUIYE_QUIZZES = window.SHENKUIYE_QUIZZES || {};
  window.SHENKUIYE_QUIZZES["lesson-02"] = {
    title: "第二课 · 地平坐标系",
    questions: [
      {
        prompt: "本课的方位角，从哪里起量、向哪边增加？",
        choices: ["正南是 0°，向西增加", "正北是 0°，向东增加", "正东是 0°，向北增加", "天顶是 0°，向地平增加"],
        answer: 1,
        correct: { expression: "smug", text: "正北 0°，向东增加。和罗盘一致。有的书从正南起量，那是另一套，别混。" },
        wrong: {
          expression: "angry",
          text: "起算点错了，后面的方位会整个反掉。",
          review: "本课规定正北是 0°，向东到 90° 是正东，180° 是正南，270° 是正西。有的书从正南向西量，和这里差 180°。",
          section: "方位角",
          anchor: "#l2-az"
        }
      },
      {
        prompt: "一颗星方位角 270°、高度角 30°。它在你的哪一边，有多高？",
        choices: ["正东，地平线以下 30°", "正西，地平线以上 30°", "正南，就在天顶", "正北，地平线以上 30°"],
        answer: 1,
        correct: { expression: "shy", text: "正西，地平以上 30°。270° 是从正北向东转过四分之三个圆。干净。" },
        wrong: {
          expression: "worried",
          text: "270° 不是东，也不是南。高度 30° 还在地平线上面。",
          review: "正北 0°，向东量：90° 正东，180° 正南，270° 正西。高度从地平圈向上量，地平是 0°，天顶是 +90°。所以这颗星在正西、地平线以上 30°。",
          section: "方位角",
          anchor: "#l2-az"
        }
      },
      {
        prompt: "为什么星表里通常不印方位角和高度角？",
        choices: ["这两个数太小，印不下", "它们随时间和地点一起变", "它们和赤经是同一个数", "只有太阳才有高度角"],
        answer: 1,
        correct: { expression: "smug", text: "因为它们属于你，不属于星星。换一座城市，或只是过一小时，数字就变了。" },
        wrong: {
          expression: "angry",
          text: "不是印不下。是这套坐标根本钉不住一颗星。",
          review: "地平坐标的原点在观测者。你转身、走动，或者只是等着地球自转，同一颗星的方位和高度都会变。星表要印不随地点改的数，那是下一课的赤经、赤纬。",
          section: "这个坐标系钉在你身上",
          anchor: "#l2-local"
        }
      },
      {
        prompt: "一本书写「方位从正南向西量，这颗星是 0°」。改成本课从正北向东量，是多少度？",
        choices: ["0°", "90°", "180°", "270°"],
        answer: 2,
        correct: { expression: "shy", text: "180°。正南就是正南，两种习惯差半圈。你这次没有被书带着走。" },
        wrong: {
          expression: "worried",
          text: "从正南量的 0°，不是我们的 0°。",
          review: "从正南起算的 0° 就是正南。本课从正北向东量，正南是 180°。两种习惯差 180°。看到别的书，先看它的 0° 在南还是在北。",
          section: "方位角",
          anchor: "#l2-az"
        }
      }
    ]
  };
})();
