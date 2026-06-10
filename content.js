(() => {
  const PERSIAN_REGEX = /[\u0600-\u06FF]/;
  const EXCLUDED_TAGS = new Set([
    "CODE", "PRE", "TEXTAREA", "INPUT",
    "BUTTON", "SVG", "PATH", "SCRIPT", "STYLE"
  ]);
  const FONT_STACK =
    "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

  function isSkippable(el) {
    if (!el) return true;
    if (EXCLUDED_TAGS.has(el.tagName)) return true;
    if (
      el.closest("code") ||
      el.closest("pre") ||
      el.closest("button") ||
      el.closest("svg")
    ) return true;
    return false;
  }

  function containsPersian(text) {
    return PERSIAN_REGEX.test(text || "");
  }

  function hasDirectText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        return true;
      }
    }
    return false;
  }

  function wrapTextNode(node) {
    const text = node.textContent;
    if (!text || !text.trim()) return;

    const isPersian = containsPersian(text);
    
    // ← اگه فارسی نیست و فونت نیاز نداره، فقط dir رو ست کن بدون span
    if (!isPersian) {
      // LTR متن انگلیسی رو دست نزن — مرورگر خودش درست نشون میده
      return;
    }

    const span = document.createElement("span");
    span.textContent = text;
    span.dataset.dirFixed = "1";
    // ← فونت فقط برای فارسی
    span.style.fontFamily = FONT_STACK;
    span.setAttribute("dir", "rtl");
    span.style.direction = "rtl";
    span.style.unicodeBidi = "embed";

    node.parentNode.replaceChild(span, node);
  }

  // ← فقط تگ‌های inline-ish که مستقیم متن نمایش میدن
  const BLOCK_TAGS = new Set([
    "P", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
    "TD", "TH", "BLOCKQUOTE", "DT", "DD", "FIGCAPTION"
  ]);
  // DIV از لیست حذف شد ← مشکل اصلی همین بود

  function fixBlockDirection(el) {
    if (isSkippable(el)) return;
    if (!BLOCK_TAGS.has(el.tagName)) return;
    if (el.dataset.dirFixed) return;

    // ← فقط المان‌هایی که خودشون مستقیم متن دارن یا فرزند inline دارن
    // نه container های بزرگ
    const hasText = hasDirectText(el);
    const fullText = hasText
      ? ""
      : (el.innerText || el.textContent || "").trim();

    const textToCheck = hasText
      ? Array.from(el.childNodes)
          .filter(n => n.nodeType === Node.TEXT_NODE)
          .map(n => n.textContent)
          .join("")
      : fullText;

    if (!textToCheck && !fullText) return;
    const checkTarget = textToCheck || fullText;

    if (containsPersian(checkTarget)) {
      el.setAttribute("dir", "rtl");
      el.style.direction = "rtl";
      el.style.textAlign = "right";
      el.dataset.wasSetByExt = "rtl";
      el.dataset.dirFixed = "1";
    } else {
      if (el.dataset.wasSetByExt === "rtl") {
        el.setAttribute("dir", "ltr");
        el.style.direction = "ltr";
        el.style.textAlign = "";
      }
    }
  }

  function scan(root = document.body) {
    if (!root) return;

    const elements = root.nodeType === 1
      ? [root, ...root.querySelectorAll("*")]
      : [];
    for (const el of elements) {
      fixBlockDirection(el);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (isSkippable(parent)) continue;
      if (parent.dataset.dirFixed) continue;
      if (!node.textContent.trim()) continue;
      nodes.push(node);
    }
    nodes.forEach(wrapTextNode);
  }

  scan();

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const added of m.addedNodes) {
        if (added.nodeType === 1 && !added.dataset?.dirFixed) {
          scan(added);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();