import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  loadDefaultSimplifiedChineseParser,
  loadDefaultTraditionalChineseParser,
} from "budoux";

const root = new URL("../", import.meta.url);
const check = process.argv.includes("--check");
const simplified = loadDefaultSimplifiedChineseParser();
const traditional = loadDefaultTraditionalChineseParser();
const han = /\p{Script=Han}/u;
const noStart = /^[、。，．！？：；…‥」』】〕〉》）］｝〗〙〛”’!?.,:;)\]}]/u;
const noEnd = /[「『【〔〈《（［｛〖〘〚“‘([{]$/u;
// Keep site vocabulary intact where the general-purpose model splits a term.
const terms = /常用|叠层|疊層|当地|當地|直接|地平圈|地平|春分点|春分點|坐标|座標|位置|恒星时|恆星時|世界时|世界時|方位角|比一比|织女|織女|中天|北极星|北極星|水委一|接上/gu;
const attachForward = new Set(["是", "在", "把", "这", "那", "能", "不", "可", "怎", "为", "有", "从", "向", "将", "过", "会", "还", "再", "与", "跟", "让", "到"]);

function segment(markup, lang) {
  const text = markup.replace(/<wbr>/g, "");
  if (!/^zh(?:-|$)/i.test(lang) || !han.test(text)) return text;
  const parser = /^zh-(?:Hant|TW|HK|MO)(?:-|$)/i.test(lang) ? traditional : simplified;
  // Keep Latin runs and timestamps intact. Don't introduce opportunities
  // next to punctuation or NBSPs that the browser would keep together.
  const tokens = [
    ...text.matchAll(/&(?:nbsp|#160);|[\p{Script=Latin}\p{N}]+(?:[.:/-][\p{Script=Latin}\p{N}]+)*/gu),
    ...text.matchAll(terms),
  ];
  const parts = [];
  for (const part of parser.parse(text)) {
    if (/^\p{Script=Han}$/u.test(part) && attachForward.has(part)) {
      parts.push(part);
    } else if (/^\p{Script=Han}$/u.test(part) && parts.length) {
      parts[parts.length - 1] += part;
    } else {
      parts.push(part);
    }
  }
  for (let i = 0; i < parts.length - 1; i++) {
    if (attachForward.has(parts[i]) && /^\p{Script=Han}/u.test(parts[i + 1])) {
      parts[i] += parts.splice(i + 1, 1)[0];
      i--;
    }
  }
  let result = "";
  let offset = 0;
  for (const part of parts) {
    const before = text.slice(0, offset);
    const after = text.slice(offset);
    const insideToken = tokens.some(({ 0: token, index }) => index < offset && offset < index + token.length);
    if (offset && !insideToken && !/(?:\s|&nbsp;|&#160;)$/u.test(before) &&
        !/^(?:\s|&nbsp;|&#160;)/u.test(after) && !noEnd.test(before) && !noStart.test(after)) {
      result += "<wbr>";
    }
    result += part;
    offset += part.length;
  }
  return result;
}

function enhanceChineseProse(source, lang) {
  if (!/^zh(?:-|$)/i.test(lang)) return source;
  // Fixed pairs are intentional spacing rules, not prose or translation edits.
  source = source.replace(/<!--[\s\S]*?-->|<(script|style|pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>|>([^<>]+)</gi,
    (match, protectedTag, text) => {
      if (text === undefined) return match;
      text = text.replace(
        /([+−-]?\d+(?:\.\d+)?)(?:\s|&nbsp;|&#160;)+(万公里|光年|角秒|时秒|时分|小时|分钟|秒|度|分|时|年|月|日|天|颗|个|倍|UT|km|m|%|[°′″])/gu,
        (_, number, suffix) => `${number}\u00a0${suffix}`,
      );
      text = text.replace(/([\p{Script=Han}]) +([A-Za-z0-9])|([A-Za-z0-9]) +([\p{Script=Han}])/gu,
        (_, hanBefore, asciiAfter, asciiBefore, hanAfter) => `${hanBefore || asciiBefore}${asciiAfter || hanAfter}`);
      return `>${text}<`;
    });
  return source.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, content) => {
    if (/\bclass="[^"]*\b(?:brand|kicker|formula|readout|calc-note|noscript-note|sg-note)\b/.test(attrs) ||
        /<\s*(?:svg|canvas|input|button|code|pre)\b/i.test(content) || /\bprose-measure\b/.test(attrs)) return match;
    const visible = content.replace(/<[^>]*>/g, "").replace(/&(?:nbsp|#160);/g, " ").trim();
    if ((visible.match(/\p{Script=Han}/gu) || []).length < 48) return match;
    attrs = /\bclass="([^"]*)"/.test(attrs)
      ? attrs.replace(/\bclass="([^"]*)"/, (_, classes) => `class="${classes} prose-measure"`)
      : `${attrs} class="prose-measure"`;
    return `<p${attrs}>${content}</p>`;
  });
}

function apply(file, transform) {
  const url = new URL(file, root);
  const source = readFileSync(url, "utf8");
  const next = transform(source);
  if (next === source) return;
  if (check) {
    console.error(`${file}: refresh heading breaks with npm run typography`);
    process.exitCode = 1;
  } else {
    writeFileSync(url, next);
  }
}

for (const file of readdirSync(root).filter((name) => name.endsWith(".html"))) {
  apply(file, (source) => {
    const pageLang = source.match(/<html\b[^>]*\blang="([^"]+)"/i)?.[1] ?? "";
    source = enhanceChineseProse(source, pageLang);
    // Current headings and card titles are plain text. Leave nested markup alone.
    return source.replace(
      /(<(h[1-3]|span)\b([^>]*)>)((?:[^<]|<wbr>)+)(<\/\2>)/g,
      (match, open, tag, attrs, content, close) => {
        if (tag === "span" && !/\bclass="(?:[^" ]+ +)*toc-title(?: +[^" ]+)*"/.test(attrs)) return match;
        const lang = attrs.match(/\blang="([^"]+)"/i)?.[1] ?? pageLang;
        return open + segment(content, lang) + close;
      },
    );
  });
}

apply("calculator.js", (source) => source.replace(
  /\bstep\("([^"\n]+)",/g,
  (_, title) => `step("${segment(title, "zh-CN")}",`,
));
