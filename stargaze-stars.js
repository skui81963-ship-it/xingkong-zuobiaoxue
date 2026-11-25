/*
  stargaze-stars.js
  -----------------
  虚拟观星用的星表、星座连线和四季星群。

  坐标是依巴谷星表（Hipparcos）的 J2000.0 赤经、赤纬，单位是度。
  星等是目视星等。第六课计算器里已经有的亮星，准备数据时会改用
  calculator.js 里的赤经、赤纬和星等，这样和附录、计算器是同一组数字。

  中文名是传统星官名。织女、北极星这些和课文用字保持一致
  （星表里织女常写作「织女一」，北极星常写作「勾陈一」）。
  没有中文名的，用拜耳名，例如「γ Ori」，和附录的写法一样。

  连线是这 14 个星座的棍棒图：把星星连成平时认星用的那个形状。
  五车五（金牛座 β，也叫 Elnath）同时属于金牛座和御夫座，
  所以两个星座都勾上时它只画一次，只勾其中一个时它也还在。
  壁宿二（飞马大方框的一角）拜耳名是仙女座 α，这里归在飞马座的连线里，
  否则秋季四边形会缺一角。
*/

var StarGazeStars = (function () {
  var CONSTELLATIONS = [
    { id: "boo", name: "牧夫座" },
    { id: "vir", name: "室女座" },
    { id: "leo", name: "狮子座" },
    { id: "lyr", name: "天琴座" },
    { id: "aql", name: "天鹰座" },
    { id: "cyg", name: "天鹅座" },
    { id: "peg", name: "飞马座" },
    { id: "ori", name: "猎户座" },
    { id: "cma", name: "大犬座" },
    { id: "cmi", name: "小犬座" },
    { id: "tau", name: "金牛座" },
    { id: "aur", name: "御夫座" },
    { id: "gem", name: "双子座" },
    { id: "umi", name: "小熊座" },
  ];

  /* hip 是依巴谷编号。sky 非空时，坐标改用 calculator.js 的同名星。 */
  var STARS = [
    { hip: 677, sky: "", name: "壁宿二", bayer: "α And", mag: 2.07, ra: 2.09691071, dec: 29.09043199, cons: ["peg"], ast: ["autumn"] },
    { hip: 1067, sky: "", name: "壁宿一", bayer: "γ Peg", mag: 2.83, ra: 3.30897012, dec: 15.18359590, cons: ["peg"], ast: ["autumn"] },
    { hip: 11767, sky: "polaris", name: "北极星", bayer: "α UMi", mag: 1.97, ra: 37.95451535, dec: 89.26410951, cons: ["umi"], ast: [] },
    { hip: 15900, sky: "", name: "", bayer: "ο Tau", mag: 3.61, ra: 51.20330738, dec: 9.02886984, cons: ["tau"], ast: [] },
    { hip: 16083, sky: "", name: "", bayer: "ξ Tau", mag: 3.73, ra: 51.79230269, dec: 9.73267975, cons: ["tau"], ast: [] },
    { hip: 16852, sky: "", name: "", bayer: "10 Tau", mag: 4.29, ra: 54.21826338, dec: 0.40166163, cons: ["tau"], ast: [] },
    { hip: 18724, sky: "", name: "", bayer: "λ Tau", mag: 3.41, ra: 60.17006562, dec: 12.49034659, cons: ["tau"], ast: [] },
    { hip: 18907, sky: "", name: "", bayer: "ν Tau", mag: 3.91, ra: 60.78908352, dec: 5.98930513, cons: ["tau"], ast: [] },
    { hip: 20205, sky: "", name: "", bayer: "γ Tau", mag: 3.65, ra: 64.94834891, dec: 15.62764232, cons: ["tau"], ast: [] },
    { hip: 20455, sky: "", name: "毕宿三", bayer: "δ Tau", mag: 3.77, ra: 65.73372189, dec: 17.54251420, cons: ["tau"], ast: [] },
    { hip: 20889, sky: "", name: "毕宿一", bayer: "ε Tau", mag: 3.53, ra: 67.15416474, dec: 19.18043155, cons: ["tau"], ast: [] },
    { hip: 20894, sky: "", name: "毕宿增十三", bayer: "θ2 Tau", mag: 3.40, ra: 67.16558676, dec: 15.87088266, cons: ["tau"], ast: [] },
    { hip: 21421, sky: "aldebaran", name: "毕宿五", bayer: "α Tau", mag: 0.87, ra: 68.98016110, dec: 16.50930139, cons: ["tau"], ast: ["winter"] },
    { hip: 22449, sky: "", name: "参旗六", bayer: "π3 Ori", mag: 3.19, ra: 72.46004413, dec: 6.96127568, cons: ["ori"], ast: [] },
    { hip: 22509, sky: "", name: "参旗五", bayer: "π2 Ori", mag: 4.35, ra: 72.65300729, dec: 8.90017585, cons: ["ori"], ast: [] },
    { hip: 22549, sky: "", name: "", bayer: "π4 Ori", mag: 3.68, ra: 72.80151623, dec: 5.60510396, cons: ["ori"], ast: [] },
    { hip: 22797, sky: "", name: "", bayer: "π5 Ori", mag: 3.71, ra: 73.56290198, dec: 2.44067205, cons: ["ori"], ast: [] },
    { hip: 22845, sky: "", name: "", bayer: "π1 Ori", mag: 4.64, ra: 73.72386617, dec: 10.15083310, cons: ["ori"], ast: [] },
    { hip: 22957, sky: "", name: "", bayer: "ο2 Ori", mag: 4.06, ra: 74.09281008, dec: 13.51446582, cons: ["ori"], ast: [] },
    { hip: 23015, sky: "", name: "五车一", bayer: "ι Aur", mag: 2.69, ra: 74.24841152, dec: 33.16609031, cons: ["aur"], ast: [] },
    { hip: 23123, sky: "", name: "", bayer: "π6 Ori", mag: 4.47, ra: 74.63709138, dec: 1.71401579, cons: ["ori"], ast: [] },
    { hip: 23416, sky: "", name: "柱一", bayer: "ε Aur", mag: 3.03, ra: 75.49222568, dec: 43.82330836, cons: ["aur"], ast: [] },
    { hip: 23453, sky: "", name: "柱二", bayer: "ζ Aur", mag: 3.69, ra: 75.61952888, dec: 41.07583744, cons: ["aur"], ast: [] },
    { hip: 23607, sky: "", name: "", bayer: "11 Ori", mag: 4.65, ra: 76.14228959, dec: 15.40410527, cons: ["ori"], ast: [] },
    { hip: 23767, sky: "", name: "", bayer: "η Aur", mag: 3.18, ra: 76.62871992, dec: 41.23447447, cons: ["aur"], ast: [] },
    { hip: 24436, sky: "rigel", name: "参宿七", bayer: "β Ori", mag: 0.18, ra: 78.63446812, dec: -8.20164055, cons: ["ori"], ast: ["winter"] },
    { hip: 24608, sky: "capella", name: "五车二", bayer: "α Aur", mag: 0.08, ra: 79.17232940, dec: 45.99799111, cons: ["aur"], ast: ["winter"] },
    { hip: 25281, sky: "", name: "参宿增三", bayer: "η Ori", mag: 3.35, ra: 81.11923643, dec: -2.39714624, cons: ["ori"], ast: [] },
    { hip: 25336, sky: "", name: "参宿五", bayer: "γ Ori", mag: 1.64, ra: 81.28276276, dec: 6.34970223, cons: ["ori"], ast: [] },
    { hip: 25428, sky: "", name: "五车五", bayer: "β Tau", mag: 1.65, ra: 81.57297249, dec: 28.60745001, cons: ["tau","aur"], ast: [] },
    { hip: 25930, sky: "", name: "参宿三", bayer: "δ Ori", mag: 2.25, ra: 83.00166968, dec: -0.29909204, cons: ["ori"], ast: [] },
    { hip: 26207, sky: "", name: "觜宿一", bayer: "λ Ori", mag: 3.39, ra: 83.78448789, dec: 9.93415842, cons: ["ori"], ast: [] },
    { hip: 26311, sky: "", name: "参宿二", bayer: "ε Ori", mag: 1.69, ra: 84.05338934, dec: -1.20191983, cons: ["ori"], ast: [] },
    { hip: 26451, sky: "", name: "天关", bayer: "ζ Tau", mag: 2.97, ra: 84.41119070, dec: 21.14254914, cons: ["tau"], ast: [] },
    { hip: 26727, sky: "", name: "参宿一", bayer: "ζ Ori", mag: 1.74, ra: 85.18969642, dec: -1.94257224, cons: ["ori"], ast: [] },
    { hip: 27366, sky: "", name: "参宿六", bayer: "κ Ori", mag: 2.07, ra: 86.93912023, dec: -9.66960478, cons: ["ori"], ast: [] },
    { hip: 27913, sky: "", name: "", bayer: "χ1 Ori", mag: 4.39, ra: 88.59576026, dec: 20.27617455, cons: ["ori"], ast: [] },
    { hip: 27989, sky: "betelgeuse", name: "参宿四", bayer: "α Ori", mag: 0.45, ra: 88.79293860, dec: 7.40706274, cons: ["ori"], ast: ["winter"] },
    { hip: 28358, sky: "", name: "", bayer: "δ Aur", mag: 3.72, ra: 89.88181908, dec: 54.28465615, cons: ["aur"], ast: [] },
    { hip: 28360, sky: "", name: "五车三", bayer: "β Aur", mag: 1.90, ra: 89.88217889, dec: 44.94743278, cons: ["aur"], ast: [] },
    { hip: 28380, sky: "", name: "五车四", bayer: "θ Aur", mag: 2.65, ra: 89.93028743, dec: 37.21258518, cons: ["aur"], ast: [] },
    { hip: 28614, sky: "", name: "", bayer: "μ Ori", mag: 4.12, ra: 90.59582821, dec: 9.64727656, cons: ["ori"], ast: [] },
    { hip: 28716, sky: "", name: "", bayer: "χ2 Ori", mag: 4.64, ra: 90.97993717, dec: 20.13845182, cons: ["ori"], ast: [] },
    { hip: 28734, sky: "", name: "", bayer: "1 Gem", mag: 4.16, ra: 91.03006202, dec: 23.26334108, cons: ["gem"], ast: [] },
    { hip: 29038, sky: "", name: "", bayer: "ν Ori", mag: 4.42, ra: 91.89302018, dec: 14.76847170, cons: ["ori"], ast: [] },
    { hip: 29426, sky: "", name: "", bayer: "ξ Ori", mag: 4.45, ra: 92.98498257, dec: 14.20876508, cons: ["ori"], ast: [] },
    { hip: 29655, sky: "", name: "钺", bayer: "η Gem", mag: 3.31, ra: 93.71940501, dec: 22.50679887, cons: ["gem"], ast: [] },
    { hip: 30324, sky: "", name: "军市一", bayer: "β CMa", mag: 1.98, ra: 95.67493869, dec: -17.95591772, cons: ["cma"], ast: [] },
    { hip: 30343, sky: "", name: "井宿一", bayer: "μ Gem", mag: 2.87, ra: 95.74011257, dec: 22.51358585, cons: ["gem"], ast: [] },
    { hip: 30883, sky: "", name: "井宿二", bayer: "ν Gem", mag: 4.13, ra: 97.24077812, dec: 20.21213298, cons: ["gem"], ast: [] },
    { hip: 31592, sky: "", name: "", bayer: "ν2 CMa", mag: 3.95, ra: 99.17098928, dec: -19.25587920, cons: ["cma"], ast: [] },
    { hip: 31681, sky: "", name: "井宿三", bayer: "γ Gem", mag: 1.93, ra: 99.42792124, dec: 16.39925217, cons: ["gem"], ast: [] },
    { hip: 32246, sky: "", name: "井宿五", bayer: "ε Gem", mag: 3.06, ra: 100.98302496, dec: 25.13112417, cons: ["gem"], ast: [] },
    { hip: 32349, sky: "sirius", name: "天狼", bayer: "α CMa", mag: -1.44, ra: 101.28715539, dec: -16.71611582, cons: ["cma"], ast: ["winter"] },
    { hip: 32362, sky: "", name: "井宿四", bayer: "ξ Gem", mag: 3.35, ra: 101.32235265, dec: 12.89559111, cons: ["gem"], ast: [] },
    { hip: 33018, sky: "", name: "", bayer: "θ Gem", mag: 3.60, ra: 103.19724251, dec: 33.96125399, cons: ["gem"], ast: [] },
    { hip: 33152, sky: "", name: "军市五", bayer: "ο1 CMa", mag: 3.89, ra: 103.53313596, dec: -24.18421076, cons: ["cma"], ast: [] },
    { hip: 33160, sky: "", name: "", bayer: "θ CMa", mag: 4.08, ra: 103.54749079, dec: -12.03862790, cons: ["cma"], ast: [] },
    { hip: 33347, sky: "", name: "", bayer: "ι CMa", mag: 4.36, ra: 104.03427011, dec: -17.05424211, cons: ["cma"], ast: [] },
    { hip: 33579, sky: "", name: "弧矢七", bayer: "ε CMa", mag: 1.50, ra: 104.65645182, dec: -28.97208374, cons: ["cma"], ast: [] },
    { hip: 34045, sky: "", name: "天狼增四", bayer: "γ CMa", mag: 4.11, ra: 105.93955289, dec: -15.63328598, cons: ["cma"], ast: [] },
    { hip: 34088, sky: "", name: "井宿七", bayer: "ζ Gem", mag: 4.01, ra: 106.02721594, dec: 20.57029706, cons: ["gem"], ast: [] },
    { hip: 34444, sky: "", name: "弧矢一", bayer: "δ CMa", mag: 1.83, ra: 107.09785107, dec: -26.39319967, cons: ["cma"], ast: [] },
    { hip: 34693, sky: "", name: "", bayer: "τ Gem", mag: 4.41, ra: 107.78487783, dec: 30.24516301, cons: ["gem"], ast: [] },
    { hip: 35350, sky: "", name: "", bayer: "λ Gem", mag: 3.58, ra: 109.52324476, dec: 16.54038314, cons: ["gem"], ast: [] },
    { hip: 35550, sky: "", name: "天樽二", bayer: "δ Gem", mag: 3.50, ra: 110.03073983, dec: 21.98232055, cons: ["gem"], ast: [] },
    { hip: 35904, sky: "", name: "弧矢二", bayer: "η CMa", mag: 2.45, ra: 111.02376056, dec: -29.30310360, cons: ["cma"], ast: [] },
    { hip: 36046, sky: "", name: "", bayer: "ι Gem", mag: 3.78, ra: 111.43165048, dec: 27.79808040, cons: ["gem"], ast: [] },
    { hip: 36188, sky: "", name: "南河二", bayer: "β CMi", mag: 2.89, ra: 111.78767771, dec: 8.28931548, cons: ["cmi"], ast: [] },
    { hip: 36850, sky: "", name: "北河二", bayer: "α Gem", mag: 1.58, ra: 113.64942834, dec: 31.88827629, cons: ["gem"], ast: [] },
    { hip: 36962, sky: "", name: "", bayer: "υ Gem", mag: 4.06, ra: 113.98060996, dec: 26.89574074, cons: ["gem"], ast: [] },
    { hip: 37279, sky: "procyon", name: "南河三", bayer: "α CMi", mag: 0.40, ra: 114.82549301, dec: 5.22499306, cons: ["cmi"], ast: ["winter"] },
    { hip: 37740, sky: "", name: "", bayer: "κ Gem", mag: 3.57, ra: 116.11189245, dec: 24.39799260, cons: ["gem"], ast: [] },
    { hip: 37826, sky: "pollux", name: "北河三", bayer: "β Gem", mag: 1.16, ra: 116.32895983, dec: 28.02619862, cons: ["gem"], ast: ["winter"] },
    { hip: 46146, sky: "", name: "轩辕七", bayer: "κ Leo", mag: 4.47, ra: 141.16357964, dec: 26.18232410, cons: ["leo"], ast: [] },
    { hip: 46750, sky: "", name: "轩辕八", bayer: "λ Leo", mag: 4.32, ra: 142.93011700, dec: 22.96797056, cons: ["leo"], ast: [] },
    { hip: 47908, sky: "", name: "轩辕九", bayer: "ε Leo", mag: 2.97, ra: 146.46280429, dec: 23.77425466, cons: ["leo"], ast: [] },
    { hip: 48455, sky: "", name: "轩辕十", bayer: "μ Leo", mag: 3.88, ra: 148.19090535, dec: 26.00695149, cons: ["leo"], ast: [] },
    { hip: 49583, sky: "", name: "轩辕十三", bayer: "η Leo", mag: 3.48, ra: 151.83313456, dec: 16.76266443, cons: ["leo"], ast: [] },
    { hip: 49669, sky: "regulus", name: "轩辕十四", bayer: "α Leo", mag: 1.36, ra: 152.09296110, dec: 11.96720706, cons: ["leo"], ast: [] },
    { hip: 50335, sky: "", name: "轩辕十一", bayer: "ζ Leo", mag: 3.43, ra: 154.17257060, dec: 23.41731066, cons: ["leo"], ast: [] },
    { hip: 50583, sky: "", name: "轩辕十二", bayer: "γ1 Leo", mag: 2.01, ra: 154.99314355, dec: 19.84148873, cons: ["leo"], ast: [] },
    { hip: 54872, sky: "", name: "西上相", bayer: "δ Leo", mag: 2.56, ra: 168.52708898, dec: 20.52371682, cons: ["leo"], ast: [] },
    { hip: 54879, sky: "", name: "西次相", bayer: "θ Leo", mag: 3.33, ra: 168.56002157, dec: 15.42957019, cons: ["leo"], ast: [] },
    { hip: 55434, sky: "", name: "", bayer: "σ Leo", mag: 4.05, ra: 170.28414306, dec: 6.02932171, cons: ["leo"], ast: [] },
    { hip: 55642, sky: "", name: "", bayer: "ι Leo", mag: 4.00, ra: 170.98105130, dec: 10.52950862, cons: ["leo"], ast: [] },
    { hip: 57380, sky: "", name: "", bayer: "ν Vir", mag: 4.04, ra: 176.46482927, dec: 6.52937639, cons: ["vir"], ast: [] },
    { hip: 57632, sky: "", name: "五帝座一", bayer: "β Leo", mag: 2.14, ra: 177.26490656, dec: 14.57206032, cons: ["leo"], ast: ["spring"] },
    { hip: 57757, sky: "", name: "右执法", bayer: "β Vir", mag: 3.59, ra: 177.67382733, dec: 1.76471793, cons: ["vir"], ast: [] },
    { hip: 58948, sky: "", name: "", bayer: "ο Vir", mag: 4.12, ra: 181.30224822, dec: 8.73298544, cons: ["vir"], ast: [] },
    { hip: 60129, sky: "", name: "左执法", bayer: "η Vir", mag: 3.89, ra: 184.97648721, dec: -0.66680331, cons: ["vir"], ast: [] },
    { hip: 61941, sky: "", name: "东上相", bayer: "γ Vir", mag: 2.74, ra: 190.41517626, dec: -1.44937487, cons: ["vir"], ast: [] },
    { hip: 63090, sky: "", name: "东次相", bayer: "δ Vir", mag: 3.39, ra: 193.90086578, dec: 3.39747026, cons: ["vir"], ast: [] },
    { hip: 63608, sky: "", name: "东次将", bayer: "ε Vir", mag: 2.85, ra: 195.54415463, dec: 10.95915037, cons: ["vir"], ast: [] },
    { hip: 64238, sky: "", name: "", bayer: "θ Vir", mag: 4.38, ra: 197.48746449, dec: -5.53900959, cons: ["vir"], ast: [] },
    { hip: 65474, sky: "spica", name: "角宿一", bayer: "α Vir", mag: 0.98, ra: 201.29824701, dec: -11.16132203, cons: ["vir"], ast: ["spring"] },
    { hip: 66249, sky: "", name: "角宿二", bayer: "ζ Vir", mag: 3.38, ra: 203.67330011, dec: -0.59582018, cons: ["vir"], ast: [] },
    { hip: 67275, sky: "", name: "", bayer: "τ Boo", mag: 4.50, ra: 206.81559553, dec: 17.45690604, cons: ["boo"], ast: [] },
    { hip: 67927, sky: "", name: "右摄提一", bayer: "η Boo", mag: 2.68, ra: 208.67116138, dec: 18.39771704, cons: ["boo"], ast: [] },
    { hip: 68520, sky: "", name: "", bayer: "τ Vir", mag: 4.23, ra: 210.41163881, dec: 1.54453185, cons: ["vir"], ast: [] },
    { hip: 69483, sky: "", name: "天枪一", bayer: "κ2 Boo", mag: 4.53, ra: 213.37086581, dec: 51.78996497, cons: ["boo"], ast: [] },
    { hip: 69673, sky: "arcturus", name: "大角", bayer: "α Boo", mag: -0.05, ra: 213.91530010, dec: 19.18241030, cons: ["boo"], ast: ["spring"] },
    { hip: 69701, sky: "", name: "亢宿二", bayer: "ι Vir", mag: 4.07, ra: 214.00362402, dec: -6.00054666, cons: ["vir"], ast: [] },
    { hip: 69732, sky: "", name: "玄戈", bayer: "λ Boo", mag: 4.18, ra: 214.09591139, dec: 46.08830542, cons: ["boo"], ast: [] },
    { hip: 70497, sky: "", name: "天枪三", bayer: "θ Boo", mag: 4.04, ra: 216.29915180, dec: 51.85074357, cons: ["boo"], ast: [] },
    { hip: 71053, sky: "", name: "", bayer: "ρ Boo", mag: 3.57, ra: 217.95745802, dec: 30.37143717, cons: ["boo"], ast: [] },
    { hip: 71075, sky: "", name: "招搖", bayer: "γ Boo", mag: 3.04, ra: 218.01946630, dec: 38.30825261, cons: ["boo"], ast: [] },
    { hip: 71795, sky: "", name: "", bayer: "ζ Boo", mag: 3.78, ra: 220.28729920, dec: 13.72830024, cons: ["boo"], ast: [] },
    { hip: 71957, sky: "", name: "亢宿增七", bayer: "μ Vir", mag: 3.87, ra: 220.76509742, dec: -5.65820663, cons: ["vir"], ast: [] },
    { hip: 72105, sky: "", name: "梗河一", bayer: "ε Boo", mag: 2.35, ra: 221.24674043, dec: 27.07422244, cons: ["boo"], ast: [] },
    { hip: 72220, sky: "", name: "", bayer: "109 Vir", mag: 3.73, ra: 221.56218374, dec: 1.89288544, cons: ["vir"], ast: [] },
    { hip: 72607, sky: "", name: "帝", bayer: "β UMi", mag: 2.07, ra: 222.67636006, dec: 74.15550491, cons: ["umi"], ast: [] },
    { hip: 73555, sky: "", name: "七公增五", bayer: "β Boo", mag: 3.49, ra: 225.48650975, dec: 40.39056569, cons: ["boo"], ast: [] },
    { hip: 74666, sky: "", name: "七公七", bayer: "δ Boo", mag: 3.46, ra: 228.87567917, dec: 33.31483347, cons: ["boo"], ast: [] },
    { hip: 75097, sky: "", name: "太子", bayer: "γ UMi", mag: 3.00, ra: 230.18214784, dec: 71.83401605, cons: ["umi"], ast: [] },
    { hip: 77055, sky: "", name: "勾陈四", bayer: "ζ UMi", mag: 4.29, ra: 236.01466385, dec: 77.79449293, cons: ["umi"], ast: [] },
    { hip: 79822, sky: "", name: "勾陈增九", bayer: "η UMi", mag: 4.95, ra: 244.37619927, dec: 75.75533045, cons: ["umi"], ast: [] },
    { hip: 82080, sky: "", name: "勾陈三", bayer: "ε UMi", mag: 4.21, ra: 251.49268245, dec: 82.03726206, cons: ["umi"], ast: [] },
    { hip: 85822, sky: "", name: "勾陈二", bayer: "δ UMi", mag: 4.35, ra: 263.05416851, dec: 86.58646042, cons: ["umi"], ast: [] },
    { hip: 91262, sky: "vega", name: "织女", bayer: "α Lyr", mag: 0.03, ra: 279.23473511, dec: 38.78369180, cons: ["lyr"], ast: ["summer"] },
    { hip: 91919, sky: "", name: "织女二", bayer: "ε1 Lyr", mag: 4.67, ra: 281.08477214, dec: 39.67012325, cons: ["lyr"], ast: [] },
    { hip: 91971, sky: "", name: "织女三", bayer: "ζ1 Lyr", mag: 4.34, ra: 281.19315590, dec: 37.60511483, cons: ["lyr"], ast: [] },
    { hip: 92420, sky: "", name: "渐台二", bayer: "β Lyr", mag: 3.52, ra: 282.51997782, dec: 33.36266704, cons: ["lyr"], ast: [] },
    { hip: 92791, sky: "", name: "", bayer: "δ2 Lyr", mag: 4.22, ra: 283.62618249, dec: 36.89861310, cons: ["lyr"], ast: [] },
    { hip: 93194, sky: "", name: "渐台三", bayer: "γ Lyr", mag: 3.25, ra: 284.73592771, dec: 32.68955742, cons: ["lyr"], ast: [] },
    { hip: 93244, sky: "", name: "吴越增一", bayer: "ε Aql", mag: 4.02, ra: 284.90565584, dec: 15.06829817, cons: ["aql"], ast: [] },
    { hip: 93429, sky: "", name: "", bayer: "i Aql", mag: 4.02, ra: 285.42011337, dec: -5.73911489, cons: ["aql"], ast: [] },
    { hip: 93747, sky: "", name: "吴越", bayer: "ζ Aql", mag: 2.99, ra: 286.35253418, dec: 13.86347817, cons: ["aql"], ast: [] },
    { hip: 93805, sky: "", name: "天弁七", bayer: "λ Aql", mag: 3.43, ra: 286.56224338, dec: -4.88255421, cons: ["aql"], ast: [] },
    { hip: 94779, sky: "", name: "天津二", bayer: "κ Cyg", mag: 3.80, ra: 289.27570325, dec: 53.36845943, cons: ["cyg"], ast: [] },
    { hip: 95501, sky: "", name: "右旗二", bayer: "δ Aql", mag: 3.36, ra: 291.37458540, dec: 3.11477530, cons: ["aql"], ast: [] },
    { hip: 95853, sky: "", name: "奚仲二", bayer: "ι Cyg", mag: 3.76, ra: 292.42649598, dec: 51.72977887, cons: ["cyg"], ast: [] },
    { hip: 95947, sky: "", name: "辇道增七", bayer: "β1 Cyg", mag: 3.05, ra: 292.68033578, dec: 27.95968112, cons: ["cyg"], ast: [] },
    { hip: 96468, sky: "", name: "右旗五", bayer: "ι Aql", mag: 4.36, ra: 294.18032351, dec: -1.28660090, cons: ["aql"], ast: [] },
    { hip: 97165, sky: "", name: "天津二", bayer: "δ Cyg", mag: 2.86, ra: 296.24365768, dec: 45.13080969, cons: ["cyg"], ast: [] },
    { hip: 97278, sky: "", name: "河鼓三", bayer: "γ Aql", mag: 2.72, ra: 296.56491454, dec: 10.61326120, cons: ["aql"], ast: [] },
    { hip: 97649, sky: "altair", name: "河鼓二", bayer: "α Aql", mag: 0.76, ra: 297.69582916, dec: 8.86832198, cons: ["aql"], ast: ["summer"] },
    { hip: 97804, sky: "", name: "", bayer: "η Aql", mag: 3.87, ra: 298.11819944, dec: 1.00566053, cons: ["aql"], ast: [] },
    { hip: 98036, sky: "", name: "河鼓一", bayer: "β Aql", mag: 3.71, ra: 298.82830569, dec: 6.40676346, cons: ["aql"], ast: [] },
    { hip: 99473, sky: "", name: "", bayer: "θ Aql", mag: 3.24, ra: 302.82618951, dec: -0.82146099, cons: ["aql"], ast: [] },
    { hip: 99848, sky: "", name: "", bayer: "ο2 Cyg", mag: 3.96, ra: 303.86800672, dec: 47.71420822, cons: ["cyg"], ast: [] },
    { hip: 100453, sky: "", name: "天津一", bayer: "γ Cyg", mag: 2.23, ra: 305.55709120, dec: 40.25667924, cons: ["cyg"], ast: [] },
    { hip: 102098, sky: "deneb", name: "天津四", bayer: "α Cyg", mag: 1.25, ra: 310.35797809, dec: 45.28033800, cons: ["cyg"], ast: ["summer"] },
    { hip: 102488, sky: "", name: "天津九", bayer: "ε Cyg", mag: 2.48, ra: 311.55284473, dec: 33.97025610, cons: ["cyg"], ast: [] },
    { hip: 103413, sky: "", name: "", bayer: "ν Cyg", mag: 3.94, ra: 314.29340932, dec: 41.16713558, cons: ["cyg"], ast: [] },
    { hip: 104732, sky: "", name: "", bayer: "ζ Cyg", mag: 3.21, ra: 318.23410910, dec: 30.22691571, cons: ["cyg"], ast: [] },
    { hip: 107315, sky: "", name: "危宿三", bayer: "ε Peg", mag: 2.38, ra: 326.04649214, dec: 9.87501126, cons: ["peg"], ast: [] },
    { hip: 107354, sky: "", name: "", bayer: "κ Peg", mag: 4.14, ra: 326.16139335, dec: 25.64503558, cons: ["peg"], ast: [] },
    { hip: 109176, sky: "", name: "", bayer: "ι Peg", mag: 3.77, ra: 331.75277532, dec: 25.34511155, cons: ["peg"], ast: [] },
    { hip: 109410, sky: "", name: "", bayer: "π Peg", mag: 4.28, ra: 332.49685019, dec: 33.17822387, cons: ["peg"], ast: [] },
    { hip: 109427, sky: "", name: "危宿二", bayer: "θ Peg", mag: 3.52, ra: 332.54993837, dec: 6.19786491, cons: ["peg"], ast: [] },
    { hip: 112029, sky: "", name: "雷电一", bayer: "ζ Peg", mag: 3.41, ra: 340.36550330, dec: 10.83136442, cons: ["peg"], ast: [] },
    { hip: 112158, sky: "", name: "离宫四", bayer: "η Peg", mag: 2.93, ra: 340.75057261, dec: 30.22124520, cons: ["peg"], ast: [] },
    { hip: 112440, sky: "", name: "离宫一", bayer: "λ Peg", mag: 3.97, ra: 341.63282775, dec: 23.56565397, cons: ["peg"], ast: [] },
    { hip: 112748, sky: "", name: "离宫二", bayer: "μ Peg", mag: 3.51, ra: 342.50080334, dec: 24.60157928, cons: ["peg"], ast: [] },
    { hip: 113881, sky: "", name: "室宿二", bayer: "β Peg", mag: 2.44, ra: 345.94357301, dec: 28.08278909, cons: ["peg"], ast: ["autumn"] },
    { hip: 113963, sky: "", name: "室宿一", bayer: "α Peg", mag: 2.49, ra: 346.19022409, dec: 15.20526442, cons: ["peg"], ast: ["autumn"] },
  ];

  /* 每条连线两个端点都是依巴谷编号，cons 是它属于哪个星座。 */
  var LINES = [
    { cons: "aql", a: 98036, b: 97649 },
    { cons: "aql", a: 97649, b: 97278 },
    { cons: "aql", a: 97278, b: 95501 },
    { cons: "aql", a: 95501, b: 93805 },
    { cons: "aql", a: 95501, b: 93747 },
    { cons: "aql", a: 95501, b: 97804 },
    { cons: "aql", a: 97804, b: 99473 },
    { cons: "aql", a: 93244, b: 93747 },
    { cons: "aql", a: 93805, b: 93429 },
    { cons: "aql", a: 99473, b: 96468 },
    { cons: "aql", a: 96468, b: 93805 },
    { cons: "aql", a: 93805, b: 93747 },
    { cons: "aur", a: 25428, b: 23015 },
    { cons: "aur", a: 23015, b: 23767 },
    { cons: "aur", a: 23767, b: 24608 },
    { cons: "aur", a: 24608, b: 28360 },
    { cons: "aur", a: 28360, b: 28380 },
    { cons: "aur", a: 28380, b: 25428 },
    { cons: "aur", a: 23767, b: 23453 },
    { cons: "aur", a: 23453, b: 23416 },
    { cons: "aur", a: 23416, b: 24608 },
    { cons: "aur", a: 24608, b: 28358 },
    { cons: "aur", a: 28358, b: 28360 },
    { cons: "boo", a: 69673, b: 72105 },
    { cons: "boo", a: 72105, b: 74666 },
    { cons: "boo", a: 74666, b: 73555 },
    { cons: "boo", a: 73555, b: 71075 },
    { cons: "boo", a: 71075, b: 71053 },
    { cons: "boo", a: 71053, b: 69673 },
    { cons: "boo", a: 69673, b: 67927 },
    { cons: "boo", a: 67927, b: 67275 },
    { cons: "boo", a: 69673, b: 71795 },
    { cons: "boo", a: 71075, b: 69732 },
    { cons: "boo", a: 69732, b: 70497 },
    { cons: "boo", a: 70497, b: 69483 },
    { cons: "boo", a: 69483, b: 69732 },
    { cons: "cma", a: 30324, b: 32349 },
    { cons: "cma", a: 32349, b: 34444 },
    { cons: "cma", a: 34444, b: 33579 },
    { cons: "cma", a: 34444, b: 35904 },
    { cons: "cma", a: 30324, b: 31592 },
    { cons: "cma", a: 31592, b: 33152 },
    { cons: "cma", a: 33152, b: 33579 },
    { cons: "cma", a: 32349, b: 33347 },
    { cons: "cma", a: 33347, b: 34045 },
    { cons: "cma", a: 34045, b: 33160 },
    { cons: "cma", a: 33160, b: 33347 },
    { cons: "cmi", a: 37279, b: 36188 },
    { cons: "cyg", a: 102098, b: 100453 },
    { cons: "cyg", a: 100453, b: 102488 },
    { cons: "cyg", a: 100453, b: 95947 },
    { cons: "cyg", a: 100453, b: 97165 },
    { cons: "cyg", a: 97165, b: 95853 },
    { cons: "cyg", a: 95853, b: 94779 },
    { cons: "cyg", a: 95853, b: 99848 },
    { cons: "cyg", a: 99848, b: 102098 },
    { cons: "cyg", a: 102098, b: 103413 },
    { cons: "cyg", a: 103413, b: 104732 },
    { cons: "cyg", a: 104732, b: 102488 },
    { cons: "gem", a: 32362, b: 35350 },
    { cons: "gem", a: 35350, b: 35550 },
    { cons: "gem", a: 35550, b: 34088 },
    { cons: "gem", a: 34088, b: 31681 },
    { cons: "gem", a: 35550, b: 36962 },
    { cons: "gem", a: 36962, b: 37740 },
    { cons: "gem", a: 36962, b: 37826 },
    { cons: "gem", a: 36962, b: 36046 },
    { cons: "gem", a: 36046, b: 34693 },
    { cons: "gem", a: 34693, b: 36850 },
    { cons: "gem", a: 34693, b: 33018 },
    { cons: "gem", a: 34693, b: 32246 },
    { cons: "gem", a: 32246, b: 30883 },
    { cons: "gem", a: 32246, b: 30343 },
    { cons: "gem", a: 30343, b: 29655 },
    { cons: "gem", a: 29655, b: 28734 },
    { cons: "leo", a: 49669, b: 49583 },
    { cons: "leo", a: 49583, b: 50583 },
    { cons: "leo", a: 50583, b: 50335 },
    { cons: "leo", a: 50335, b: 48455 },
    { cons: "leo", a: 48455, b: 47908 },
    { cons: "leo", a: 50583, b: 54872 },
    { cons: "leo", a: 54872, b: 57632 },
    { cons: "leo", a: 57632, b: 54879 },
    { cons: "leo", a: 54879, b: 54872 },
    { cons: "leo", a: 54879, b: 49583 },
    { cons: "leo", a: 48455, b: 46146 },
    { cons: "leo", a: 46146, b: 46750 },
    { cons: "leo", a: 46750, b: 47908 },
    { cons: "leo", a: 47908, b: 49583 },
    { cons: "leo", a: 54879, b: 55642 },
    { cons: "leo", a: 55642, b: 55434 },
    { cons: "lyr", a: 91262, b: 91919 },
    { cons: "lyr", a: 91919, b: 91971 },
    { cons: "lyr", a: 91971, b: 91262 },
    { cons: "lyr", a: 91971, b: 92791 },
    { cons: "lyr", a: 92791, b: 93194 },
    { cons: "lyr", a: 93194, b: 92420 },
    { cons: "lyr", a: 92420, b: 91971 },
    { cons: "ori", a: 27989, b: 26727 },
    { cons: "ori", a: 26727, b: 27366 },
    { cons: "ori", a: 26727, b: 26311 },
    { cons: "ori", a: 26311, b: 25930 },
    { cons: "ori", a: 25930, b: 25336 },
    { cons: "ori", a: 25930, b: 25281 },
    { cons: "ori", a: 25281, b: 24436 },
    { cons: "ori", a: 27989, b: 25336 },
    { cons: "ori", a: 25336, b: 26207 },
    { cons: "ori", a: 26207, b: 27989 },
    { cons: "ori", a: 23607, b: 22957 },
    { cons: "ori", a: 22957, b: 22845 },
    { cons: "ori", a: 22845, b: 22509 },
    { cons: "ori", a: 22509, b: 22449 },
    { cons: "ori", a: 22449, b: 25336 },
    { cons: "ori", a: 22449, b: 22549 },
    { cons: "ori", a: 22549, b: 22797 },
    { cons: "ori", a: 22797, b: 23123 },
    { cons: "ori", a: 27989, b: 28614 },
    { cons: "ori", a: 28614, b: 29038 },
    { cons: "ori", a: 29426, b: 28716 },
    { cons: "ori", a: 28716, b: 27913 },
    { cons: "ori", a: 27913, b: 29038 },
    { cons: "peg", a: 109410, b: 112158 },
    { cons: "peg", a: 112158, b: 113881 },
    { cons: "peg", a: 113881, b: 112748 },
    { cons: "peg", a: 112748, b: 112440 },
    { cons: "peg", a: 112440, b: 109176 },
    { cons: "peg", a: 109176, b: 107354 },
    { cons: "peg", a: 677, b: 113881 },
    { cons: "peg", a: 113881, b: 113963 },
    { cons: "peg", a: 113963, b: 1067 },
    { cons: "peg", a: 1067, b: 677 },
    { cons: "peg", a: 107315, b: 109427 },
    { cons: "peg", a: 109427, b: 112029 },
    { cons: "peg", a: 112029, b: 113963 },
    { cons: "tau", a: 26451, b: 21421 },
    { cons: "tau", a: 21421, b: 20894 },
    { cons: "tau", a: 20894, b: 20205 },
    { cons: "tau", a: 20205, b: 20455 },
    { cons: "tau", a: 20455, b: 20889 },
    { cons: "tau", a: 20889, b: 25428 },
    { cons: "tau", a: 16083, b: 18907 },
    { cons: "tau", a: 15900, b: 16852 },
    { cons: "tau", a: 20205, b: 18724 },
    { cons: "tau", a: 18724, b: 16083 },
    { cons: "umi", a: 11767, b: 85822 },
    { cons: "umi", a: 85822, b: 82080 },
    { cons: "umi", a: 82080, b: 77055 },
    { cons: "umi", a: 77055, b: 79822 },
    { cons: "umi", a: 79822, b: 75097 },
    { cons: "umi", a: 75097, b: 72607 },
    { cons: "umi", a: 72607, b: 77055 },
    { cons: "vir", a: 60129, b: 58948 },
    { cons: "vir", a: 58948, b: 57380 },
    { cons: "vir", a: 57380, b: 57757 },
    { cons: "vir", a: 57757, b: 60129 },
    { cons: "vir", a: 60129, b: 61941 },
    { cons: "vir", a: 61941, b: 63090 },
    { cons: "vir", a: 63090, b: 63608 },
    { cons: "vir", a: 61941, b: 64238 },
    { cons: "vir", a: 64238, b: 65474 },
    { cons: "vir", a: 61941, b: 66249 },
    { cons: "vir", a: 66249, b: 68520 },
    { cons: "vir", a: 68520, b: 72220 },
    { cons: "vir", a: 66249, b: 69701 },
    { cons: "vir", a: 69701, b: 71957 },
  ];

  /*
    四季星群。loop 按天空上绕一圈的顺序连成封闭图形。
    冬季六边形另外把参宿四记在 extra 里：它在六边形中间，不连进六条边。
    颜色用主题样式表里的变量名，换肤时只改 CSS。
  */
  var ASTERISMS = [
    { id: "spring", name: "春季大三角", colorVar: "--sg-spring", loop: [69673, 65474, 57632], extra: [] },
    { id: "summer", name: "夏季大三角", colorVar: "--sg-summer", loop: [91262, 97649, 102098], extra: [] },
    { id: "autumn", name: "秋季四边形", colorVar: "--sg-autumn", loop: [677, 113881, 113963, 1067], extra: [] },
    { id: "winter", name: "冬季六边形", colorVar: "--sg-winter", loop: [32349, 24436, 21421, 24608, 37826, 37279], extra: [27989] }
  ];

  /*
    这颗星要不要画出来。
    星座复选框：星星的 cons 里只要有一个被勾上，就画。
    四季星群：哪怕它的星座没勾，只要对应的星群勾了，也画。
    只勾猎户座、四个星群都不勾时，就只剩下猎户座。
  */
  function isShown(star, consOn, astOn) {
    var i;
    for (i = 0; i < star.cons.length; i++) {
      if (consOn[star.cons[i]]) {
        return true;
      }
    }
    for (i = 0; i < star.ast.length; i++) {
      if (astOn[star.ast[i]]) {
        return true;
      }
    }
    return false;
  }

  /* 给画图用的一份副本。第六课已有的星，改成计算器里的坐标和星等。 */
  function prepare() {
    var skyById = {};
    if (typeof SkyCalc !== "undefined" && SkyCalc.STARS) {
      var s;
      for (s = 0; s < SkyCalc.STARS.length; s++) {
        skyById[SkyCalc.STARS[s].id] = SkyCalc.STARS[s];
      }
    }
    var stars = [];
    var byHip = {};
    var i;
    for (i = 0; i < STARS.length; i++) {
      var src = STARS[i];
      var ra = src.ra;
      var dec = src.dec;
      var mag = src.mag;
      if (src.sky && skyById[src.sky]) {
        var item = skyById[src.sky];
        ra = SkyCalc.raToDegrees(item.ra[0], item.ra[1], item.ra[2]).degrees;
        dec = SkyCalc.decToDegrees(item.decSign, item.dec[0], item.dec[1], item.dec[2]);
        mag = item.mag;
      }
      var star = {
        hip: src.hip,
        sky: src.sky,
        name: src.name,
        bayer: src.bayer,
        mag: mag,
        ra: ra,
        dec: dec,
        cons: src.cons,
        ast: src.ast
      };
      stars.push(star);
      byHip[star.hip] = star;
    }
    return {
      constellations: CONSTELLATIONS,
      stars: stars,
      lines: LINES,
      asterisms: ASTERISMS,
      byHip: byHip,
      isShown: isShown
    };
  }

  return {
    CONSTELLATIONS: CONSTELLATIONS,
    ASTERISMS: ASTERISMS,
    prepare: prepare,
    isShown: isShown
  };
})();
