// رسم البطاقات والمنحنى والجداول.
(function(){
  "use strict";
  const GTJ = (window.GTJ = window.GTJ || {});

  let activeSymbol = "ALL";
  let rows = [];

  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

  function parseMtTime(s){
    if(!s) return null;
    const m = String(s).match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if(!m) return null;
    return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]);
  }
  function fmtDate(d){
    if(!d) return "—";
    const p = n => String(n).padStart(2,"0");
    return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function fmtMoney(n){
    const v = Number(n)||0;
    return (v>=0?"+":"") + v.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  const hasPrice = v => v && Number(v) !== 0;

  function renderCards(closed, open){
    const net = closed.reduce((s,r)=> s + (Number(r.net)||0), 0);
    $("cardNet").textContent = fmtMoney(net);
    $("cardNet").className = "value " + (net>=0?"pos":"neg");
    $("cardNetSub").textContent = closed.length + " صفقة مغلقة";

    const today = new Date(); today.setHours(0,0,0,0);
    const todayTrades = closed.filter(r=>{ const d=parseMtTime(r.close_time); return d && d>=today; });
    const todayNet = todayTrades.reduce((s,r)=> s+(Number(r.net)||0), 0);
    $("cardToday").textContent = fmtMoney(todayNet);
    $("cardToday").className = "value " + (todayNet>=0?"pos":"neg");
    $("cardTodaySub").textContent = todayTrades.length + " صفقة اليوم";

    const wins = closed.filter(r=> (Number(r.net)||0) >= 0).length;
    $("cardWinRate").textContent = closed.length ? Math.round(wins/closed.length*100)+"%" : "—";
    $("cardWinSub").textContent = closed.length ? (wins+" رابحة / "+(closed.length-wins)+" خاسرة") : "—";

    $("cardTotal").textContent = closed.length;
    const symbols = [...new Set(closed.map(r=>r.symbol))];
    $("cardTotalSub").textContent = symbols.length ? symbols.join(" · ") : "—";

    $("cardOpen").textContent = open.length;
    const floating = open.reduce((s,r)=> s+(Number(r.net)||0), 0);
    $("cardOpenSub").textContent = open.length ? ("عائم: "+fmtMoney(floating)) : "لا توجد";
  }

  function renderChart(closed){
    const canvas = $("chart"), empty = $("chartEmpty");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = rect.width+"px"; canvas.style.height = rect.height+"px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,rect.width,rect.height);

    if(closed.length === 0){ empty.style.display="flex"; return; }
    empty.style.display="none";

    let cum = 0;
    const pts = closed.map(r=>{ cum += (Number(r.net)||0); return cum; });
    const min = Math.min(0, ...pts), max = Math.max(0, ...pts);
    const pad = (max-min)*0.12 || 1;
    const yMin = min-pad, yMax = max+pad;
    const W = rect.width, H = rect.height, L=8, R=8, T=10, B=10;
    const plotW = W-L-R, plotH = H-T-B;
    const x = i => L + (pts.length<=1 ? plotW : (i/(pts.length-1))*plotW);
    const y = v => T + plotH - ((v-yMin)/(yMax-yMin))*plotH;

    const isUp = pts[pts.length-1] >= 0;
    const grad = ctx.createLinearGradient(0,T,0,T+plotH);
    grad.addColorStop(0, isUp ? "rgba(46,204,113,0.35)" : "rgba(255,91,91,0.30)");
    grad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.beginPath();
    ctx.moveTo(x(0), y(pts[0]));
    pts.forEach((v,i)=> ctx.lineTo(x(i), y(v)));
    ctx.lineTo(x(pts.length-1), T+plotH);
    ctx.lineTo(x(0), T+plotH);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.setLineDash([4,4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(L, y(0)); ctx.lineTo(W-R, y(0)); ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(x(0), y(pts[0]));
    pts.forEach((v,i)=> ctx.lineTo(x(i), y(v)));
    ctx.strokeStyle = isUp ? "#2ecc71" : "#ff5b5b";
    ctx.lineWidth = 2.2; ctx.lineJoin = "round"; ctx.stroke();

    ctx.beginPath(); ctx.arc(x(pts.length-1), y(pts[pts.length-1]), 4, 0, Math.PI*2);
    ctx.fillStyle = "#d4af37"; ctx.fill();
  }

  function renderSymbolTabs(all){
    const symbols = [...new Set(all.map(r=>r.symbol).filter(Boolean))];
    const wrap = $("symbolTabs");
    wrap.innerHTML = "";
    const mk = (label, val)=>{
      const el = document.createElement("div");
      el.className = "tab" + (activeSymbol===val ? " active" : "");
      el.textContent = label;
      el.onclick = ()=>{ activeSymbol = val; GTJ.render(rows); };
      wrap.appendChild(el);
    };
    mk("الكل", "ALL");
    symbols.forEach(s=> mk(s, s));
  }

  function renderOpen(open){
    const filtered = activeSymbol==="ALL" ? open : open.filter(r=>r.symbol===activeSymbol);
    $("openCountTag").textContent = filtered.length;
    $("openPanel").style.display = open.length ? "block" : "none";
    $("openBody").innerHTML = filtered.map(r=>{
      const net = Number(r.net)||0;
      return `<tr>
        <td class="sym-cell">${esc(r.symbol)}</td>
        <td><span class="badge ${r.type==='BUY'?'buy':'sell'}">${esc(r.type)}</span></td>
        <td>${esc(r.volume)}</td>
        <td>${esc(r.open_price)}</td>
        <td>${fmtDate(parseMtTime(r.open_time))}</td>
        <td>${hasPrice(r.sl) ? esc(r.sl) : "—"}</td>
        <td>${hasPrice(r.tp) ? esc(r.tp) : "—"}</td>
        <td class="${net>=0?'pos':'neg'}">${fmtMoney(net)}</td>
      </tr>`;
    }).join("");
  }

  function renderHistory(closed){
    const filtered = (activeSymbol==="ALL" ? closed : closed.filter(r=>r.symbol===activeSymbol)).slice().reverse();
    $("histCountTag").textContent = filtered.length;
    const body = $("histBody"), empty = $("histEmpty");
    if(filtered.length===0){ body.innerHTML=""; empty.style.display="block"; return; }
    empty.style.display="none";
    body.innerHTML = filtered.map(r=>{
      const net = Number(r.net)||0;
      return `<tr>
        <td class="sym-cell">${esc(r.symbol)}</td>
        <td><span class="badge ${r.type==='BUY'?'buy':'sell'}">${esc(r.type)}</span></td>
        <td><span class="badge closed">مغلقة</span></td>
        <td>${esc(r.volume)}</td>
        <td>${esc(r.open_price)}</td>
        <td>${esc(r.close_price)}</td>
        <td>${fmtDate(parseMtTime(r.close_time))}</td>
        <td class="${net>=0?'pos':'neg'}">${fmtMoney(net)}</td>
      </tr>`;
    }).join("");
  }

  GTJ.render = function(data){
    rows = data;
    const closed = rows.filter(r=>r.status==="CLOSED").sort((a,b)=>{
      const da = parseMtTime(a.close_time), db = parseMtTime(b.close_time);
      return (da?da.getTime():0) - (db?db.getTime():0);
    });
    const open = rows.filter(r=>r.status==="OPEN");
    renderCards(closed, open);
    renderChart(closed);
    renderSymbolTabs(rows);
    renderOpen(open);
    renderHistory(closed);
  };

  window.addEventListener("resize", ()=> GTJ.render(rows));
})();
