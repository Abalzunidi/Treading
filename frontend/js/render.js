// رسم الصفحة: الصفقات المفتوحة، قراءة الحساب، مسار الأداء، النتيجة حسب الرمز، قائمة الصفقات.
(function(){
  "use strict";
  const GTJ = (window.GTJ = window.GTJ || {});

  const state = { rows: [], symbol: "ALL", result: "all", showAll: false };
  const PAGE = 25;

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const num = x => `<span class="num">${x}</span>`;

  // ---------- أدوات ----------
  function parseMtTime(s){
    if(!s) return null;
    const m = String(s).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    return m ? new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]) : null;
  }
  const n = v => Number(v) || 0;
  const fmt2 = v => Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  const money = v => (v < 0 ? "−" : "+") + fmt2(v) + "$";
  const moneyPlain = v => (v < 0 ? "−" : "") + fmt2(v) + "$";
  const cls = v => v < 0 ? "loss" : "win";
  const fmtDay = d => d ? d.toLocaleDateString("ar-u-nu-latn",{day:"numeric",month:"short"}) : "—";
  const fmtDayTime = d => d ? fmtDay(d) + " " + d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "—";
  const sideLabel = t => t === "BUY" ? "شراء" : "بيع";

  function fmtMs(ms){
    const min = Math.max(0, Math.round(ms / 60000));
    if(min < 60) return min + " د";
    if(min < 48*60) return (min/60).toFixed(1).replace(/\.0$/,"") + " س";
    return (min/1440).toFixed(1).replace(/\.0$/,"") + " يوم";
  }
  function duration(a, b){
    return (!a || !b) ? "—" : fmtMs(b - a);
  }
  function avgDuration(list){
    const ds = list.map(r => { const a = parseMtTime(r.open_time), b = parseMtTime(r.close_time); return (a && b) ? b - a : null; })
                   .filter(v => v !== null);
    return ds.length ? fmtMs(ds.reduce((x,y)=>x+y,0) / ds.length) : "—";
  }

  // الـ pip لأزواج الفوركس فقط؛ غير ذلك نعرض فرق السعر.
  function pipSize(sym){
    const s = String(sym).toUpperCase();
    if(/BTC|XAU|XAG|GOLD|ETH|US30|NAS|SPX/.test(s)) return 0;
    return s.includes("JPY") ? 0.01 : 0.0001;
  }
  function distText(sym, diff){
    const p = pipSize(sym);
    const sign = diff < 0 ? "−" : "+";
    return p ? sign + Math.abs(diff / p).toFixed(0) + " pip" : sign + Math.abs(diff).toFixed(2);
  }

  // قيمة وحدة السعر بالدولار لكل لوت، مستنتجة من الصفقات المغلقة لنفس الرمز
  // (المفتوحة لا تحمل السعر الحالي، فنستنتجه من ربحها العائم).
  function unitValue(sym, closedAll){
    const ks = [];
    for(const r of closedAll){
      if(r.symbol !== sym) continue;
      const d = (n(r.close_price) - n(r.open_price)) * (r.type === "BUY" ? 1 : -1);
      const vol = n(r.volume), p = n(r.profit);
      if(d !== 0 && vol > 0 && p !== 0 && (d > 0) === (p > 0)) ks.push(p / (d * vol));
    }
    if(!ks.length) return 0;
    ks.sort((a,b)=>a-b);
    return ks[Math.floor(ks.length/2)];
  }

  function stats(closed){
    const nTr = closed.length;
    const nets = closed.map(r => n(r.net));
    const wins = nets.filter(v => v >= 0), losses = nets.filter(v => v < 0);
    const grossW = wins.reduce((a,b)=>a+b,0), grossL = Math.abs(losses.reduce((a,b)=>a+b,0));
    const avgWin = wins.length ? grossW / wins.length : 0;
    const avgLoss = losses.length ? grossL / losses.length : 0;
    return {
      n: nTr, net: nets.reduce((a,b)=>a+b,0),
      wins: wins.length, losses: losses.length,
      winRate: nTr ? wins.length / nTr * 100 : 0,
      avgWin, avgLoss, grossW, grossL,
      pf: grossL ? grossW / grossL : (grossW ? Infinity : 0),
      maxLoss: losses.length ? Math.abs(Math.min(...losses)) : 0,
      breakeven: (avgWin + avgLoss) ? avgLoss / (avgWin + avgLoss) * 100 : 0,
    };
  }

  function perSymbolStats(closedAll){
    const syms = [...new Set(closedAll.map(r => r.symbol).filter(Boolean))];
    return syms.map(s => ({ s, st: stats(closedAll.filter(r => r.symbol === s)) }))
               .sort((a,b) => b.st.net - a.st.net);
  }

  const byClose = (a,b) => (parseMtTime(a.close_time)||0) - (parseMtTime(b.close_time)||0);

  // ---------- الصفقات المفتوحة ----------
  function ladderHtml(r, price){
    const dir = r.type === "BUY" ? 1 : -1;
    const E = n(r.open_price), TP = n(r.tp), SL = n(r.sl);
    const vals = [E];
    if(TP) vals.push(TP);
    if(SL) vals.push(SL);
    if(price) vals.push(price);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const span = (hi - lo) || Math.abs(E) * 0.002;
    // مساحة إضافية على جهة الوقف إن لم يكن موجوداً ليظهر المقطع المخطّط
    const padLoss = SL ? 0.1 : 0.16, padOther = 0.1;
    if(dir === 1){ lo -= span * padLoss; hi += span * padOther; }
    else         { lo -= span * padOther; hi += span * padLoss; }
    const pct = p => ((p - lo) / (hi - lo) * 100);
    const pl = n(r.net);

    let h = '<div class="ladder"><div class="track"></div>';
    if(!SL){
      h += `<div class="nosl" style="${dir === 1 ? "left:0" : "right:0;left:auto;transform:scaleX(-1)"}"></div>`;
    }
    if(price){
      const a = Math.min(pct(E), pct(price)), b = Math.max(pct(E), pct(price));
      h += `<div class="lseg ${pl < 0 ? "l" : "w"}" style="left:${a}%;width:${b - a}%"></div>`;
    }
    h += `<div class="mk entry" style="left:${pct(E)}%"><b>${E}</b>دخول</div>`;
    if(TP) h += `<div class="mk tp" style="left:${pct(TP)}%"><b>${TP}</b>الهدف</div>`;
    if(SL) h += `<div class="mk sl" style="left:${pct(SL)}%"><b>${SL}</b>الوقف</div>`;
    if(price){
      h += `<div class="now-dot" style="left:${pct(price)}%;background:${pl < 0 ? "var(--loss)" : "var(--win)"}"></div>`;
      h += `<div class="lbl-bottom ${cls(pl)}" style="left:${pct(price)}%">≈ ${price.toFixed(E < 10 ? 5 : 2)} · ${distText(r.symbol, price - E)}</div>`;
    }
    return h + "</div>";
  }

  function renderOpen(open, closedAll){
    const zone = $("openZone");
    if(!open.length){
      zone.innerHTML = `<p class="hero-none"><strong>لا توجد صفقات مفتوحة</strong>عند فتح صفقة تظهر هنا بسعر الدخول والهدف والوقف.</p>`;
      return;
    }
    const total = open.reduce((s,r)=>s+n(r.net),0);
    let html = `<h2>${open.length > 1 ? "الصفقات المفتوحة الآن" : "الصفقة المفتوحة الآن"}${open.length > 1 ? ` · الإجمالي ${num(money(total))}` : ""}</h2>`;
    for(const r of open){
      const dir = r.type === "BUY" ? 1 : -1;
      const k = unitValue(r.symbol, closedAll), vol = n(r.volume);
      const price = (k && vol) ? n(r.open_price) + dir * n(r.profit) / (k * vol) : 0;
      const pl = n(r.net);
      const openAt = parseMtTime(r.open_time);
      const days = openAt ? (Date.now() - openAt.getTime()) / 86400000 : 0;
      const hasSL = n(r.sl) !== 0, hasTP = n(r.tp) !== 0;

      html += `<div class="pos">
        <div class="pos-head">
          <div class="pos-name">${esc(r.symbol)}<small>${sideLabel(r.type)} · ${num(esc(r.volume))} لوت</small></div>
          <div class="pos-pl ${cls(pl)}">${num(money(pl))}</div>
        </div>
        <p class="pos-sub">مفتوحة منذ ${openAt ? fmtDay(openAt) : "—"} (${days.toFixed(0)} يوم)</p>
        ${ladderHtml(r, price)}
        <div class="pos-flags">
          ${hasSL ? "" : '<span class="flag bad">بدون وقف خسارة</span>'}
          ${days > 14 ? '<span class="flag bad">مفتوحة منذ أكثر من أسبوعين</span>' : ""}
          ${hasTP && price ? `<span class="flag">يبقى للهدف ${num(distText(r.symbol, (n(r.tp) - price) * dir))}</span>` : ""}
          ${price ? '<span class="flag">السعر الآن تقديري من الربح العائم</span>' : ""}
        </div>
      </div>`;
    }
    zone.innerHTML = html;
  }

  // ---------- قراءة الحساب ----------
  function renderReading(closed, perSymbol){
    const zone = $("readingZone");
    const s = stats(closed);
    if(!s.n){
      zone.innerHTML = `<h2>قراءة الحساب</h2><p class="verdict">لا توجد صفقات مغلقة بعد.</p>`;
      return;
    }
    let verdict, sub = "";
    const wr = num(s.winRate.toFixed(0) + "%");
    if(s.net < 0 && s.winRate >= 50 && s.avgLoss > s.avgWin){
      verdict = `تربح ${wr} من صفقاتك، لكن الحساب خاسر ${num(moneyPlain(s.net))} لأن الخسارة الواحدة (${num(fmt2(s.avgLoss)+"$")}) أكبر من الربح الواحد (${num(fmt2(s.avgWin)+"$")}).`;
      const covers = s.avgWin ? Math.ceil(s.maxLoss / s.avgWin) : 0;
      sub = `لتتعادل بهذا الحجم تحتاج نسبة فوز ${num(s.breakeven.toFixed(0)+"%")} أو خسائر أصغر. أكبر خسارة (${num(fmt2(s.maxLoss)+"$")}) تمحو ربح ${num(covers)} صفقة.`;
    }else if(s.net < 0){
      verdict = `نسبة فوزك ${wr} وصافي الحساب ${num(moneyPlain(s.net))}.`;
      sub = `تحتاج نسبة فوز ${num(s.breakeven.toFixed(0)+"%")} بهذا الحجم لتتعادل.`;
    }else{
      verdict = `الحساب رابح ${num(moneyPlain(s.net))} من ${num(s.n)} صفقة، بنسبة فوز ${wr}.`;
      sub = s.avgLoss ? `الربح الواحد يعادل ${num((s.avgWin / s.avgLoss).toFixed(2))} من الخسارة الواحدة.` : "";
    }
    // أي رمز يسحب الحساب للأسفل وأي رمز يرفعه (عند عرض كل الرموز)
    if(perSymbol && perSymbol.length > 1){
      const worst = perSymbol[perSymbol.length - 1], best = perSymbol[0];
      if(worst.st.net < 0){
        sub += ` الرمز الأكثر خسارة: ${esc(worst.s)} (${num(money(worst.st.net))})` +
               (best.st.net > 0 ? `، بينما ${esc(best.s)} رابح (${num(money(best.st.net))}).` : ".");
      }
    }
    const pf = s.pf === Infinity ? "∞" : s.pf.toFixed(2);
    zone.innerHTML = `<h2>قراءة الحساب</h2>
      <p class="verdict">${verdict}</p>
      <p class="verdict-sub">${sub}</p>
      <dl class="kv">
        <div><dt>متوسط الربح</dt><dd class="win">${num("+" + fmt2(s.avgWin))}</dd></div>
        <div><dt>متوسط الخسارة</dt><dd class="loss">${num("−" + fmt2(s.avgLoss))}</dd></div>
        <div><dt>معامل الربحية</dt><dd class="${s.pf >= 1 ? "win" : "loss"}">${num(pf)} <small>الربح ÷ الخسارة</small></dd></div>
      </dl>`;
  }

  // ---------- مجموع الأرباح والخسائر ----------
  function renderTotals(closed){
    const zone = $("totalsZone");
    const s = stats(closed);
    if(!s.n){ zone.innerHTML = ""; return; }
    const winList = closed.filter(r => n(r.net) >= 0), lossList = closed.filter(r => n(r.net) < 0);
    const share = (s.grossW + s.grossL) ? s.grossW / (s.grossW + s.grossL) * 100 : 50;
    zone.innerHTML = `
      <div class="tot">
        <span class="tot-l">مجموع ما ربحته</span>
        <strong class="win">${num("+" + fmt2(s.grossW) + "$")}</strong>
        <small>${num(s.wins)} صفقة رابحة · متوسط مدتها ${avgDuration(winList)}</small>
      </div>
      <div class="tot">
        <span class="tot-l">مجموع ما خسرته</span>
        <strong class="${s.grossL ? "loss" : ""}">${num((s.grossL ? "−" : "") + fmt2(s.grossL) + "$")}</strong>
        <small>${num(s.losses)} صفقة خاسرة · متوسط مدتها ${avgDuration(lossList)}</small>
      </div>
      <div class="tot">
        <span class="tot-l">الصافي</span>
        <strong class="${cls(s.net)}">${num(money(s.net))}</strong>
        <small>من ${num(s.n)} صفقة مغلقة · متوسط المدة ${avgDuration(closed)}</small>
      </div>
      <div class="share" role="img" aria-label="نسبة الأرباح إلى الخسائر"><i style="width:${share}%"></i></div>`;
  }

  // ---------- مسار الأداء ----------
  function renderChart(closed){
    const box = $("chartBox"), readout = $("chartReadout");
    if(!closed.length){
      box.innerHTML = '<p class="chart-empty">لا توجد صفقات مغلقة لرسمها.</p>';
      readout.textContent = "";
      return;
    }
    const W = Math.max(300, box.clientWidth - 16), L = 6, R = 6;
    const HT = 104, GAP = 14, HE = 140, AX = 22;
    const H = HT + GAP + HE + AX;
    const plotW = W - L - R, N = closed.length, step = plotW / N;
    const nets = closed.map(r => n(r.net));
    const cum = []; nets.reduce((a,v,i)=> (cum[i]=a+v), 0);

    const maxAbs = Math.max(...nets.map(Math.abs)) || 1;
    const mid = HT / 2, bw = Math.max(1.6, step * 0.68);
    let bars = "";
    nets.forEach((v,i)=>{
      const h = Math.max(2, Math.abs(v) / maxAbs * (mid - 4));
      const x = L + i * step + (step - bw) / 2;
      const up = v >= 0;
      const delay = Math.min(i * 5, 600);
      bars += `<rect class="bar ${up ? "up" : "dn"}" x="${x.toFixed(1)}" y="${(up ? mid - h : mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="${up ? "var(--win)" : "var(--loss)"}" style="animation-delay:${delay}ms"/>`;
    });

    const e0 = HT + GAP;
    const lo = Math.min(0, ...cum), hi = Math.max(0, ...cum);
    const pad = (hi - lo) * 0.1 || 1;
    const ey = v => e0 + HE - ((v - (lo - pad)) / ((hi + pad) - (lo - pad))) * HE;
    const ex = i => L + i * step + step / 2;
    const y0 = ey(0);
    let path = `M${ex(0).toFixed(1)},${ey(cum[0]).toFixed(1)}`;
    cum.forEach((v,i)=>{ if(i) path += ` L${ex(i).toFixed(1)},${ey(v).toFixed(1)}`; });
    const area = `${path} L${ex(N-1).toFixed(1)},${y0.toFixed(1)} L${ex(0).toFixed(1)},${y0.toFixed(1)} Z`;
    const last = cum[N-1];

    // تسميات الأشهر
    let axis = "", prevM = -1, lastX = -999;
    closed.forEach((r,i)=>{
      const d = parseMtTime(r.close_time); if(!d) return;
      const key = d.getFullYear()*12 + d.getMonth();
      if(key !== prevM){
        prevM = key;
        const x = ex(i);
        if(x - lastX > 54){
          lastX = x;
          axis += `<text x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="var(--muted)" font-size="11">${d.toLocaleDateString("ar-u-nu-latn",{month:"short"})}</text>`;
        }
      }
    });

    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="مسار الأرباح: ${N} صفقة، الإجمالي ${moneyPlain(last)}">
      <defs>
        <clipPath id="clipUp"><rect x="0" y="0" width="${W}" height="${y0.toFixed(1)}"/></clipPath>
        <clipPath id="clipDn"><rect x="0" y="${y0.toFixed(1)}" width="${W}" height="${H}"/></clipPath>
      </defs>
      <line x1="${L}" x2="${W-R}" y1="${mid}" y2="${mid}" stroke="var(--line)"/>
      ${bars}
      <path d="${area}" fill="rgba(79,209,161,.16)" clip-path="url(#clipUp)"/>
      <path d="${area}" fill="rgba(255,123,107,.16)" clip-path="url(#clipDn)"/>
      <line x1="${L}" x2="${W-R}" y1="${y0.toFixed(1)}" y2="${y0.toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 4"/>
      <path d="${path}" fill="none" stroke="var(--ink)" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="${ex(N-1).toFixed(1)}" cy="${ey(last).toFixed(1)}" r="4.5" fill="${last >= 0 ? "var(--win)" : "var(--loss)"}" stroke="var(--bg)" stroke-width="2"/>
      <line id="cross" x1="0" x2="0" y1="0" y2="${HT + GAP + HE}" stroke="var(--steel)" stroke-width="1" opacity="0"/>
      ${axis}
      <rect id="hit" x="0" y="0" width="${W}" height="${HT + GAP + HE}" fill="transparent"/>
    </svg>`;

    const svg = box.querySelector("svg"), cross = box.querySelector("#cross"), hit = box.querySelector("#hit");
    const idle = "مرّر على الرسم لرؤية كل صفقة";
    readout.textContent = idle;
    const show = ev => {
      const rect = svg.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width * W;
      const i = Math.min(N - 1, Math.max(0, Math.floor((x - L) / step)));
      const r = closed[i];
      cross.setAttribute("x1", ex(i)); cross.setAttribute("x2", ex(i)); cross.setAttribute("opacity", ".7");
      readout.innerHTML = `${fmtDay(parseMtTime(r.close_time))} · ${esc(r.symbol)} ${sideLabel(r.type)} <b class="${cls(nets[i])}">${num(money(nets[i]))}</b> · المجموع <b>${num(moneyPlain(cum[i]))}</b>`;
    };
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", ()=>{ cross.setAttribute("opacity", "0"); readout.textContent = idle; });
  }

  // ---------- حسب الرمز + أزرار الرموز ----------
  function renderSymbols(closedAll){
    const syms = [...new Set(closedAll.map(r => r.symbol).filter(Boolean))];
    const bar = $("symbolBar");
    const chip = (label, val) => `<button class="chip" type="button" data-sym="${esc(val)}" aria-pressed="${state.symbol === val}">${esc(label)}</button>`;
    bar.innerHTML = syms.length > 1 ? chip("كل الرموز", "ALL") + syms.map(s => chip(s, s)).join("") : "";
    bar.hidden = syms.length <= 1;

    const sec = $("symbolSection");
    sec.hidden = syms.length <= 1;
    const per = perSymbolStats(closedAll);
    const maxAbs = Math.max(...per.map(p => Math.abs(p.st.net)), 1);
    $("symbolRows").innerHTML = per.map(({s, st}) => {
      const w = Math.abs(st.net) / maxAbs * 50;
      const bar = `<i style="${st.net >= 0 ? `left:50%;width:${w}%;background:var(--win)` : `right:50%;width:${w}%;background:var(--loss)`}"></i>`;
      return `<button class="sym-row" type="button" data-sym="${esc(s)}">
        <span class="sym-name">${esc(s)}<span class="sym-meta">${num(st.n)} صفقة · فوز ${num(st.winRate.toFixed(0)+"%")}</span><span class="sym-meta">ربح ${num("+"+fmt2(st.grossW)+"$")} · خسارة ${num((st.grossL ? "−" : "") + fmt2(st.grossL) + "$")}</span></span>
        <span class="sym-bar">${bar}</span>
        <span class="sym-net ${cls(st.net)}">${num(money(st.net))}</span>
      </button>`;
    }).join("");
  }

  // ---------- القائمة ----------
  function renderRows(closed){
    const seg = $("resultSeg");
    const opt = (label, val) => `<button type="button" data-res="${val}" aria-pressed="${state.result === val}">${label}</button>`;
    seg.innerHTML = opt("الكل","all") + opt("رابحة","win") + opt("خاسرة","loss");

    let list = closed.slice().reverse();
    if(state.result === "win") list = list.filter(r => n(r.net) >= 0);
    if(state.result === "loss") list = list.filter(r => n(r.net) < 0);
    $("histCount").textContent = list.length;
    const lt = list.reduce((a,r)=>a+n(r.net),0);
    $("listTotal").innerHTML = list.length ? `مجموع المعروض <b class="${cls(lt)}">${num(money(lt))}</b>` : "";
    $("histEmpty").hidden = list.length > 0;
    $("rows").hidden = list.length === 0;

    const shown = state.showAll ? list : list.slice(0, PAGE);
    const head = `<div class="row head"><span>الإغلاق</span><span>الصفقة</span><span>الحجم</span><span>السعر</span><span>المدة</span><span style="text-align:end">الصافي</span></div>`;
    $("rows").innerHTML = head + shown.map(r => {
      const net = n(r.net), a = parseMtTime(r.open_time), b = parseMtTime(r.close_time);
      return `<div class="row">
        <span class="when">${fmtDayTime(b)}</span>
        <span class="c-sym">${esc(r.symbol)}<span class="side ${r.type === "BUY" ? "buy" : "sell"}">${sideLabel(r.type)}</span></span>
        <span class="c-size">${num(esc(r.volume))}</span>
        <span class="px">${num(`<b>${esc(r.open_price)}</b> ← ${esc(r.close_price)}`)}</span>
        <span class="c-dur"><span class="lbl">المدة</span> ${duration(a, b)}<span class="since"> · فُتحت ${fmtDay(a)}</span></span>
        <span class="net ${cls(net)}">${num(money(net))}</span>
      </div>`;
    }).join("");

    const more = $("moreBtn");
    more.hidden = list.length <= PAGE;
    more.textContent = state.showAll ? "عرض أحدث " + PAGE + " فقط" : `عرض كل الصفقات (${list.length})`;
  }

  // ---------- الواجهة العامة ----------
  function paint(){
    const open = state.rows.filter(r => r.status === "OPEN");
    const closedAll = state.rows.filter(r => r.status === "CLOSED").sort(byClose);
    const closed = state.symbol === "ALL" ? closedAll : closedAll.filter(r => r.symbol === state.symbol);
    renderOpen(open, closedAll);
    renderReading(closed, state.symbol === "ALL" ? perSymbolStats(closedAll) : null);
    renderSymbols(closedAll);
    renderTotals(closed);
    renderChart(closed);
    renderRows(closed);
  }

  GTJ.render = function(rows){
    state.rows = rows;
    if(state.symbol !== "ALL" && !rows.some(r => r.symbol === state.symbol)) state.symbol = "ALL";
    paint();
  };

  document.addEventListener("click", ev => {
    const symBtn = ev.target.closest("[data-sym]");
    if(symBtn){
      const v = symBtn.dataset.sym;
      state.symbol = (state.symbol === v && symBtn.classList.contains("sym-row")) ? "ALL" : v;
      state.showAll = false; paint(); return;
    }
    const resBtn = ev.target.closest("[data-res]");
    if(resBtn){ state.result = resBtn.dataset.res; state.showAll = false; paint(); return; }
    if(ev.target.closest("#moreBtn")){ state.showAll = !state.showAll; paint(); }
  });

  let resizeT = 0, lastW = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const w = $("chartBox").clientWidth;
      if(w !== lastW){ lastW = w; paint(); }
    }, 150);
  });
})();
