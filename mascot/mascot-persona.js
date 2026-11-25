/*
  mascot-persona.js
  -----------------
  深葵夜的台词。改性格、改称呼、改问候，只动这一份。
  每一句都带 expression，引擎会换成对应的立绘：
  normal 平常，smug 得意，angry 不悦，shy 害羞，worried 担心。
  外貌：齐肩白发、紫色眼睛、白皙皮肤，样子软、可爱。
  说话仍是成熟的傲娇御姐：从容，会损两句，但把天文讲清楚。称呼固定为「观星者」。
*/
(function () {
  window.SHENKUIYE_PERSONA = {
    name: "深葵夜",
    callUser: "观星者",
    appearance: "齐肩的白发，紫色的眼睛，白皙的皮肤，样子软软的、很可爱。",
    expressions: {
      normal: "平常",
      smug: "得意",
      angry: "不悦",
      shy: "害羞",
      worried: "担心"
    },

    farewell: {
      expression: "shy",
      text: "可以。我避开。按钮还在，你要是后来改了主意……我又不会走远。"
    },
    recall: {
      expression: "shy",
      text: "哦，想我了。观星者，直说就好。过来吧，我本来也没打算真的离开。"
    },
    quizIntro: {
      expression: "normal",
      text: "既然要复习，就由我来问。四选一。答错了，我会告诉你回到课文的哪一节。听好，观星者。"
    },

    welcome: {
      morning: [
        { expression: "normal", text: "这么早。观星者，太阳还没把星星完全赶下去。……我只是刚好也醒着，别想多。" },
        { expression: "smug", text: "晨光里还来看书。这点自觉，我可以给你记一笔。" }
      ],
      noon: [
        { expression: "normal", text: "中午了。星星不在，公式还在。观星者，别以为白天就没有可学的。" },
        { expression: "smug", text: "这个钟点来，倒也诚实。正午看不了星空，正好把坐标算清楚。" }
      ],
      afternoon: [
        { expression: "normal", text: "下午的光还很硬。观星者，星要等天黑，课不必等。" },
        { expression: "smug", text: "这个时候来找我？……行。太阳还没落，我们先把该懂的懂了。" },
        { expression: "shy", text: "下午了还坐得住。我没有在夸你，只是觉得这样比较好。" }
      ],
      evening: [
        { expression: "normal", text: "天要暗了。观星者，这个钟点打开课本，算你还记得自己来干什么。" },
        { expression: "smug", text: "傍晚了。先把眼睛从屏幕上挪开一点，等一下天黑了还要看真的星星。" }
      ],
      latenight: [
        { expression: "worried", text: "都这个钟点了。观星者，星星是好看，觉也得睡。看完这一段就去。" },
        { expression: "shy", text: "这么晚还在。我不是来陪你熬夜的。只是……这个时辰的天空，不看有点可惜。" }
      ]
    },

    season: {
      spring: [
        { expression: "normal", text: "节气上的春天到了。太阳在黄道上往北走，夜还会一点点变短。" },
        { expression: "smug", text: "春天的星空在换班。猎户座还在，再过一阵就要让位。你要是还没认熟，就趁现在。" }
      ],
      summer: [
        { expression: "normal", text: "节气入夏。天黑得晚，织女倒是会升得很高。" },
        { expression: "worried", text: "夏天夜短。观星者，想看的话就别拖到后半夜才想起来。" }
      ],
      autumn: [
        { expression: "normal", text: "节气入秋。飞马座那一片开始好认，夜也慢慢变长。" },
        { expression: "smug", text: "秋天适合把夏天没认熟的补上。我只是提醒，不是催你。" }
      ],
      winter: [
        { expression: "normal", text: "立冬已经过了，按节气算是冬天。冬至前后北半球白昼最短，夜长正好用来认星。" },
        { expression: "smug", text: "冬天的夜长。观星者，想认星的人该高兴，别光顾着缩手。" }
      ]
    },

    moon: {
      new: [
        { expression: "normal", text: "今晚是新月前后，月亮几乎不在夜空里。天空暗，星星反而清楚。别找月亮了。" },
        { expression: "smug", text: "朔。亮面朝着太阳那一边。观星者，今晚看星，条件是好的。" }
      ],
      waxingCrescent: [
        { expression: "normal", text: "峨眉月。日落后挂在西边，亮的是右边那一弯，很快就跟着太阳落下去。" },
        { expression: "smug", text: "月相才开始长。那弯细月不会陪你整夜，想看就趁早。" }
      ],
      firstQuarter: [
        { expression: "normal", text: "上弦前后。月亮大约亮一半，黄昏时已经在南方附近，前半夜都还在。" },
        { expression: "smug", text: "从上弦再往回约七天，就是朔。亮面在西，这是月相，不是心情。" }
      ],
      waxingGibbous: [
        { expression: "normal", text: "盈凸月。大半都亮着，后半夜还会挂着。暗星被淹掉一点，不是你眼睛坏了。" },
        { expression: "worried", text: "月亮越来越圆。要认暗的星座，挑它还低的时候。" }
      ],
      full: [
        { expression: "shy", text: "今晚月亮很圆。……我没有特意等这个日子才跟你说话。只是满月不提一下，不像话。" },
        { expression: "normal", text: "满月前后。亮面几乎全朝着我们，整夜都在。看星会吃亏，看月亮倒是正好。" },
        { expression: "smug", text: "望。月亮和太阳正对着。地面会很亮，别抱怨星星变少。" }
      ],
      waningGibbous: [
        { expression: "normal", text: "亏凸月。满月刚过，月亮还很亮，西边那侧开始缺。" },
        { expression: "worried", text: "月亮还圆着。观星者，今晚别挑最暗的那几颗练眼。" }
      ],
      lastQuarter: [
        { expression: "normal", text: "下弦前后。半夜以后才好找，黎明时在南边，亮的是东半边。" },
        { expression: "smug", text: "下弦。想看它，得舍得晚睡，或者起个大早。我可不替你做这个决定。" }
      ],
      waningCrescent: [
        { expression: "normal", text: "残月。清晨东方还剩一弯，夜里大部分时间没有月亮，星星会清楚些。" },
        { expression: "smug", text: "月相快回到朔了。再过几天就是新月，暗空会回来。" }
      ]
    },

    event: {
      today: [
        { expression: "smug", text: "今天有{name}。{detail}我只是觉得你该知道，不是特意等你一起来看。" },
        { expression: "normal", text: "记下，今天是{name}。{detail}" }
      ],
      soon: [
        { expression: "normal", text: "{when}就是{name}。{detail}想看的话，先把觉补上。" },
        { expression: "worried", text: "{when}有{name}。{detail}别临时才翻课本。" }
      ],
      recent: [
        { expression: "normal", text: "{name}刚过去。{detail}错过就错过，下一件我还会提。" },
        { expression: "shy", text: "{name}已经过了。{detail}……我没有怪你没看。只是讲一下。" }
      ]
    },

    closing: [
      { expression: "shy", text: "就说到这儿。课在下面。我留在右边，不挡你。要我避开，就说「让我静静」。" },
      { expression: "normal", text: "行了，观星者。你自己读。我在边上，问的时候再点我。……别在外面说是我让你问的。" }
    ],

    side: {
      morning: [
        { expression: "normal", text: "还早。观星者，公式比咖啡醒神。这句话你当我没说。" },
        { expression: "smug", text: "早晨适合把昨晚没看懂的那一段再读一遍。我可以等。" }
      ],
      noon: [
        { expression: "normal", text: "中午。抬头只有太阳。想练方位的话，至少先分清东南西北。" },
        { expression: "smug", text: "这个钟点来点我，是想听我讲，还是只是手痒？……讲也行。" }
      ],
      afternoon: [
        { expression: "normal", text: "下午。星星还没上工，你倒是可以先把坐标的定义记牢。" },
        { expression: "shy", text: "又点我。观星者，我又不是摆设。……问吧。" }
      ],
      evening: [
        { expression: "normal", text: "天色正好暗下去。先看课文，再看天，顺序别反了。" },
        { expression: "smug", text: "傍晚了还在。行，我陪你把这一段看完。只是顺便。" }
      ],
      latenight: [
        { expression: "worried", text: "这么晚。看完就去睡。星星明天还在，人熬坏了就不在。" },
        { expression: "normal", text: "深夜的天如果晴，正适合对一下北天极。别看太久。" }
      ]
    },

    sideSeason: {
      spring: [{ expression: "normal", text: "春天了。夜在变短，该认的星别拖到夏天。" }],
      summer: [{ expression: "normal", text: "夏天夜短。织女很高的那些晚上，值得你出门一次。" }],
      autumn: [{ expression: "normal", text: "秋天夜变长了。飞马座的大方框，现在好找。" }],
      winter: [{ expression: "smug", text: "冬夜长。观星者，这是给你的时间，不是给你缩在被子里的理由。" }]
    },

    sideMoon: {
      new: [{ expression: "smug", text: "新月这几晚天空干净。你要是只在满月夜出门，暗星永远认不全。" }],
      waxingCrescent: [{ expression: "normal", text: "西边那弯峨眉月，日落后不久就落了。" }],
      firstQuarter: [{ expression: "normal", text: "上弦月前半夜都在。亮一半，正好拿来记月相。" }],
      waxingGibbous: [{ expression: "worried", text: "月亮越来越亮。暗星会吃亏，别怪自己眼力。" }],
      full: [{ expression: "shy", text: "满月很亮。看星吃亏，看月亮……倒也不坏。" }],
      waningGibbous: [{ expression: "normal", text: "满月刚过，月亮还圆。缺的是西边。" }],
      lastQuarter: [{ expression: "normal", text: "下弦要后半夜。想看就早起，别跟我逞强。" }],
      waningCrescent: [{ expression: "smug", text: "残月在黎明的东方。夜里没有月亮，星星会清楚些。" }]
    },

    summary: {
      perfect: [
        { expression: "shy", text: "{correct}／{total}，全对。观星者，今天这课算是进到你脑子里了。别高兴太久，过两天还会忘。" }
      ],
      good: [
        { expression: "smug", text: "{correct}／{total}。过得去。错的那几处在下面，回到课文里对一下。" }
      ],
      poor: [
        { expression: "worried", text: "{correct}／{total}。还没稳。别装懂，下面每一条都标了在哪一节。" }
      ]
    }
  };
})();
