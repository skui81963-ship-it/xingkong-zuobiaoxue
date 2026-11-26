(function () {
  window.SHENKUIYE_QUIZZES = window.SHENKUIYE_QUIZZES || {};
  window.SHENKUIYE_QUIZZES["lesson-01"] = {
    title: "第一课 · 天球是什么",
    questions: [
      {
        prompt: "北京大约北纬 40°。北天极在天空的什么方位，高度大约是多少？",
        choices: ["正南，大约 40°", "正北，大约 40°", "天顶，90°", "正东，大约 23.4°"],
        answer: 1,
        correct: { expression: "smug", text: "正北，大约 40°。北天极的地平高度等于北纬。这题你倒是记得。" },
        wrong: {
          expression: "angry",
          text: "不对。方位和高度你至少错了一半。",
          review: "北半球的北天极在正北，地平高度等于北纬。北京大约 40°，所以它在正北、地平线以上大约 40°。北极星离真天极不到 1°，只能用来估计。",
          section: "天极与天赤道",
          anchor: "#l1-poles"
        }
      },
      {
        prompt: "天顶的地平高度是多少？",
        choices: ["0°，贴着地平圈", "+90°，头顶正上方", "−90°，在脚下", "等于当地纬度"],
        answer: 1,
        correct: { expression: "shy", text: "+90°。天顶就是头顶。这种题也会让我多看你一眼。" },
        wrong: {
          expression: "worried",
          text: "天顶不是地平，也不是纬度。",
          review: "沿重力的反方向向上，刺到天球的那一点是天顶，地平高度 +90°。相反的方向是天底，−90°。天顶跟着观测者走，不属于某一颗星。",
          section: "天顶与天底",
          anchor: "#l1-zenith"
        }
      },
      {
        prompt: "黄道和天赤道的夹角大约是多少？",
        choices: ["0°，它们重合", "大约 23.4°", "45°", "90°"],
        answer: 1,
        correct: { expression: "smug", text: "大约 23.4°，黄赤交角。2026 年前后就是这个数，别背成 45。" },
        wrong: {
          expression: "angry",
          text: "差得有点远。这个角决定四季，不能含糊。",
          review: "地轴倾斜大约 23.4°，所以黄道和天赤道不重合，夹角叫黄赤交角。太阳的赤纬就在大约 −23.4° 和 +23.4° 之间来回。",
          section: "黄道与春分点",
          anchor: "#l1-ecliptic"
        }
      },
      {
        prompt: "春分点被用来当作什么的起点？",
        choices: ["方位角的 0°", "当地纬度的 0°", "赤经的 0 时，也是黄经 0°", "恒星日的长度"],
        answer: 2,
        correct: { expression: "shy", text: "赤经从春分点起算。观星者，这句你记住了，后面两课会轻松一点。" },
        wrong: {
          expression: "worried",
          text: "春分点不是方位角的零点。方位角钉在你的地平上。",
          review: "春分点是太阳从天赤道以南走到以北的那个交点，大约在每年 3 月 20 日。赤经从这里沿天赤道向东量，它是赤经 0 时，也是黄经 0°。",
          section: "黄道与春分点",
          anchor: "#l1-ecliptic"
        }
      }
    ]
  };
})();
