(function () {
  window.SHENKUIYE_QUIZZES = window.SHENKUIYE_QUIZZES || {};
  window.SHENKUIYE_QUIZZES["lesson-04"] = {
    title: "第四课 · 时间与恒星时",
    questions: [
      {
        prompt: "北京时间 2026-03-21 03:00，对应的世界时是？",
        choices: ["当天 11:00", "3 月 20 日 19:00", "3 月 21 日 03:00", "3 月 22 日 11:00"],
        answer: 1,
        correct: { expression: "smug", text: "3 月 20 日 19:00。3 减 8 要借一天。观星者，借位这种事你没忘。" },
        wrong: {
          expression: "angry",
          text: "时区不是装饰。借位错了，后面的儒略日整日都不对。",
          review: "北京是东八区，世界时 = 当地时间 − 8 小时。3 − 8 = −5，所以要退回前一天：2026-03-20 的 19:00。公式吃的是世界时，不是墙上的北京时间。",
          section: "先把当地时间换成世界时",
          anchor: "#l4-ut"
        }
      },
      {
        prompt: "某地东经 120°，格林尼治平恒星时 GMST 算出是 30°。地方恒星时是多少度？",
        choices: ["30°", "90°", "150°", "−90°"],
        answer: 2,
        correct: { expression: "shy", text: "150°。东经加上去。150 ÷ 15 = 10 时。这步你是稳的。" },
        wrong: {
          expression: "worried",
          text: "经度不是拿来减的。东边的恒星时更超前。",
          review: "地方恒星时 LST = GMST + 经度，东经为正，单位都用度。30° + 120° = 150°。150 ÷ 15 = 10 时。西经才是负的，会把恒星时减回去。",
          section: "地方恒星时和时角",
          anchor: "#l4-lst"
        }
      },
      {
        prompt: "地方恒星时是 10 时，星星的赤经是 8 时。时角是多少小时？星星在子午圈的哪一边？",
        choices: ["2 时，已经在西边", "2 时，还在东边", "18 时，还在东边", "0，正在上中天"],
        answer: 0,
        correct: { expression: "smug", text: "时角 2 时，正数，已经偏西。东边的是负数。这个符号别再反。" },
        wrong: {
          expression: "angry",
          text: "减法方向反了，或者正负号记错了。星星在哪一边会整个反掉。",
          review: "时角 H = 地方恒星时 − 赤经。10 − 8 = 2 时，也就是 30°。本课把时角收成 −180° 到 +180°：负数还在子午圈东边，正数已经偏西。H = 0 才是上中天。",
          section: "地方恒星时和时角",
          anchor: "#l4-lst"
        }
      },
      {
        prompt: "一个恒星日和日常的太阳日比，大约怎样？",
        choices: ["长大约 4 分钟", "短大约 4 分钟", "正好一样长", "短大约 1 小时"],
        answer: 1,
        correct: { expression: "shy", text: "短大约 3 分 56 秒，口头就说 4 分钟。所以同一颗星明天会早一点升起。" },
        wrong: {
          expression: "worried",
          text: "恒星日更短，不是更长。差出来的那 4 分钟，就是星空换季的原因。",
          review: "太阳连续两次中天平均是 24 小时。春分点连续两次中天大约是 23 小时 56 分 4 秒。地球公转时相对太阳要多转将近 1°，相对星星则不用。所以同一颗星每天早大约 4 分钟升起。",
          section: "太阳时和恒星时不是同一只钟",
          anchor: "#l4-clocks"
        }
      }
    ]
  };
})();
