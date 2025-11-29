document.addEventListener("DOMContentLoaded", () => {
  const table = document.getElementById("items-table");
  if (!table) {
    console.warn('No element with id "items-table" found. Aborting app.js initialization.');
    return;
  }
  const tbody = table.querySelector("tbody");
  if (!tbody) {
    console.warn("No <tbody> inside #items-table found. Aborting.");
    return;
  }
  const totalEl = document.getElementById("total") || { textContent: "" };
  const summaryText = document.getElementById("summary-text") || {
    textContent: "",
  };
  let formatAsPercent = false;
  // guard to avoid repeatedly calling the site's bulk tooltip initializer
  let esoTooltipBulkRegistered = false;

  function formatNumberForDisplay(n, percent = false) {
    if (percent) {
      return (
        new Intl.NumberFormat("de-DE", {
          maximumFractionDigits: 2,
          useGrouping: false,
        }).format(n) + " %"
      );
    }
    return new Intl.NumberFormat("de-DE").format(n);
  }

  function parseIntSafe(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  function recompute() {
    let sum = 0;
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row) => {
      const cb = row.querySelector(".row-check");
      const countInp = row.querySelector(".row-count");
      const valueCell = row.querySelector(".value");
      if (!cb || !countInp || !valueCell) return;
      const count = parseIntSafe(countInp.value);
      const dataVal = row.getAttribute("data-value");
      const base = dataVal ? parseIntSafe(dataVal) : parseIntSafe(valueCell.textContent);
      const rowTotal = cb.checked ? base * count : 0;
      // display per-row total, formatted as percent if needed
      valueCell.textContent = formatNumberForDisplay(rowTotal, formatAsPercent);
      sum += rowTotal;
    });
    totalEl.textContent = formatNumberForDisplay(sum, formatAsPercent);
  }

  // dynamic row creation and listeners
  function sanitizeNumberInput(input) {
    input.addEventListener("input", (e) => {
      const val = e.target.value;
      if (val === "") {
        return;
      }
      // strip non-digits
      let digits = val.replace(/[^0-9]/g, "");
      if (digits !== val) {
        e.target.value = digits;
        digits = e.target.value;
      }
      // enforce max if present on input
      const maxAttr = e.target.getAttribute("max");
      if (maxAttr) {
        const max = parseInt(maxAttr, 10);
        const cur = parseInt(digits || "0", 10);
        if (Number.isFinite(max) && cur > max) {
          e.target.value = String(max);
        }
      }
    });
    // ensure clamp on change / keyup and then recompute
    input.addEventListener("change", (e) => {
      const maxAttr = e.target.getAttribute("max");
      if (maxAttr) {
        const max = parseInt(maxAttr, 10);
        const cur = parseIntSafe(e.target.value);
        if (Number.isFinite(max) && cur > max) e.target.value = String(max);
      }
      recompute();
    });
    input.addEventListener("keyup", recompute);
  }

  function attachRowListeners(row) {
    const cb = row.querySelector(".row-check");
    const countInp = row.querySelector(".row-count");
    // set tooltip showing max if present (use same tooltip system as the "i" info)
    if (countInp) {
      const maxAttr = countInp.getAttribute("max") || row.getAttribute("data-max");
      if (maxAttr) {
        countInp.setAttribute("data-tip", "Max: " + String(maxAttr));
        registerTooltip(countInp);
      }
    }
    // only attach change listener when checkbox is enabled
    if (cb && !cb.disabled) cb.addEventListener("change", recompute);
    // only attach input listeners when the field is editable
    if (countInp && !countInp.hasAttribute("readonly")) sanitizeNumberInput(countInp);
  }

  function getAnchor(desc, url) {
    if (!url) return escapeHtml(desc);

    return `<a href="${url}" target="_blank">${escapeHtml(desc)}</a> `;
  }

  function createRow({ desc = "", value = 0, count = 0, checked = false, tip = "", countEditable = true, selectable = true, url = "", maxCount } = {}) {
    const tr = document.createElement("tr");
    tr.setAttribute("data-value", String(value));
    if (typeof maxCount !== "undefined") tr.setAttribute("data-max", String(maxCount));

    // cell 1: checkbox
    const tdCheck = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "row-check";
    if (checked) cb.checked = true;
    if (!selectable) cb.disabled = true;
    tdCheck.appendChild(cb);

    // cell 2: count input
    const tdCount = document.createElement("td");
    const countInp = document.createElement("input");
    countInp.type = "number";
    countInp.className = "row-count";
    countInp.min = "0";
    countInp.step = "1";
    countInp.value = String(parseIntSafe(count));
    countInp.setAttribute("inputmode", "numeric");
    countInp.setAttribute("pattern", "\\d*");
    if (typeof maxCount !== "undefined") {
      countInp.setAttribute("max", String(maxCount));
      countInp.setAttribute("data-tip", "Max: " + String(maxCount));
    }
    if (!countEditable) {
      countInp.setAttribute("readonly", "");
      countInp.setAttribute("tabindex", "-1");
      countInp.setAttribute("aria-readonly", "true");
    }
    tdCount.appendChild(countInp);

    // cell 3: description + info
    const tdDesc = document.createElement("td");
    tdDesc.className = "desc";
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.textContent = desc;
      tdDesc.appendChild(a);
    } else {
      tdDesc.appendChild(document.createTextNode(desc));
    }
    const info = document.createElement("span");
    info.className = "info";
    if (tip) info.setAttribute("data-tip", tip);
    info.textContent = "i";
    tdDesc.appendChild(info);

    // cell 4: value
    const tdValue = document.createElement("td");
    tdValue.className = "value";
    tdValue.textContent = "0";

    tr.appendChild(tdCheck);
    tr.appendChild(tdCount);
    tr.appendChild(tdDesc);
    tr.appendChild(tdValue);

    tbody.appendChild(tr);

    // register tooltips for any anchor(s)
    const anchor = tr.querySelectorAll("a");
    if (anchor.length) {
      anchor.forEach((a) => registerTooltip(a));
    }

    // set initial computed value for the row
    const base = parseIntSafe(String(value));
    // clamp initial count to maxCount when provided
    const initialCountRaw = parseIntSafe(countInp ? countInp.value : count);
    const maxAttr = countInp ? countInp.getAttribute("max") : null;
    const initialCount = maxAttr ? Math.min(initialCountRaw, parseIntSafe(maxAttr)) : initialCountRaw;
    if (countInp && String(initialCount) !== String(countInp.value)) countInp.value = String(initialCount);
    if (tdValue) {
      const initialTotal = cb && cb.checked ? base * initialCount : 0;
      tdValue.textContent = formatNumberForDisplay(initialTotal, formatAsPercent);
    }
    attachRowListeners(tr);
    return tr;
  }

  // Attach to any existing rows (if present in DOM)
  tbody.querySelectorAll("tr").forEach(attachRowListeners);

  // load from JSON (supports either an array of items or an object with metadata)
  async function loadFromFile(url = "penetration.json") {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      // Determine structure: either an array of items, or an object { items: [...], formatAsPercent: true }
      let items = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && Array.isArray(data.items)) {
        items = data.items;
        // allow JSON to control percent formatting
        if ("formatAsPercent" in data) {
          formatAsPercent = !!data.formatAsPercent;
          summaryText.textContent = data.summaryText || "Gesamtsumme: ";
          titleEl.textContent = data.title;
        } else if (data.meta && "formatAsPercent" in data.meta) {
          formatAsPercent = !!data.meta.formatAsPercent;
          summaryText.textContent = data.meta.summaryText || "Gesamtsumme: ";
          titleEl.textContent = data.meta.title;
        }
      } else {
        console.warn("Unexpected JSON structure in", url);
        return;
      }

      tbody.innerHTML = "";
      items.forEach((item) =>
        createRow({
          desc: item.desc,
          value: item.value,
          count: item.count,
          checked: item.checked,
          tip: item.tip,
          url: item.url,
          countEditable: "countEditable" in item ? item.countEditable : true,
          selectable: "selectable" in item ? item.selectable : true,
          maxCount: "maxCount" in item ? item.maxCount : undefined,
        })
      );

      recompute();
    } catch (err) {
      console.warn("Could not load", url, "— falling back to embedded rows or default. Error:", err);
    }
  }

  // list selector buttons (if present)
  const btnListPen = document.getElementById("btn-list-pen");
  const btnListCritDamage = document.getElementById("btn-list-critdamage");
  const btnListWeaponDamage = document.getElementById("btn-list-weapondamage");

  const titleEl = document.querySelector("h1");

  async function loadAndSet(file, activeBtn) {
    await loadFromFile(file);

    if (btnListPen) {
      btnListPen.classList.toggle("active", btnListPen === activeBtn);
    }
    if (btnListCritDamage) {
      btnListCritDamage.classList.toggle("active", btnListCritDamage === activeBtn);
    }
    if (btnListWeaponDamage) {
      btnListWeaponDamage.classList.toggle("active", btnListWeaponDamage === activeBtn);
    }
  }

  if (btnListPen) {
    btnListPen.addEventListener("click", () => loadAndSet("penetration.json", btnListPen));
  }
  if (btnListCritDamage) {
    btnListCritDamage.addEventListener("click", () => loadAndSet("criticalDamage.json", btnListCritDamage));
  }
  if (btnListWeaponDamage) {
    btnListWeaponDamage.addEventListener("click", () => loadAndSet("weaponDamage.json", btnListWeaponDamage));
  }

  // initial auto-load default list
  loadAndSet("penetration.json", btnListPen);

  // Summary positioning: when scrolled all the way to the bottom of the page,
  // keep the summary inside the `main` wrapper (10px from main's bottom).
  // Otherwise keep it fixed to the viewport bottom.
  (function setupSummaryPositioning() {
    const summary = document.getElementById("summary");
    const mainEl = document.querySelector("main");
    if (!summary || !mainEl) return;

    let scheduled = false;
    function checkPosition() {
      scheduled = false;
      // consider we are at the bottom when the bottom of the main wrapper is within (or at) the viewport bottom
      const mainRect = mainEl.getBoundingClientRect();
      const scrolledToBottom = mainRect.bottom <= window.innerHeight + 2;
      if (scrolledToBottom) {
        summary.classList.add("in-main");
      } else {
        summary.classList.remove("in-main");
      }
    }

    function onScrollOrResize() {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(checkPosition);
      }
    }

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    // initial check
    onScrollOrResize();
  })();
});

// small helper: escape text for insertion into innerHTML
function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}
