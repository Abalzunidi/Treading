// مصادر البيانات: قاعدة البيانات عبر الخادم (http) أو ملف المؤشر المحلي (file://).
(function(){
  "use strict";
  const GTJ = (window.GTJ = window.GTJ || {});

  const LOCAL_CANDIDATES = [
    "trade_journal.js",
    "file:///C:/Users/TechTroniX/AppData/Roaming/MetaQuotes/Terminal/Common/Files/trade_journal.js"
  ];
  const LOAD_TIMEOUT_MS = 2500;
  const TOKEN_KEY = "gtj_api_token";

  GTJ.isServed = location.protocol === "http:" || location.protocol === "https:";
  GTJ.pollMs = GTJ.isServed ? 10000 : 3000;

  // ---------- CSV ----------
  // الإكسبيرت القديم كان يكتب نوع الصفقة المغلقة بحسب صفقة الإغلاق (معكوساً).
  // نتحقق من إشارة الربح مقابل حركة السعر ونعدّل النوع لو تعارضا.
  function fixClosedType(r){
    if(r.status !== "CLOSED") return;
    const o = Number(r.open_price), c = Number(r.close_price), p = Number(r.profit);
    if(!(o>0) || !(c>0) || !p || o===c) return;
    const expectBuy = (c - o) * p > 0;
    if(expectBuy && r.type === "SELL") r.type = "BUY";
    else if(!expectBuy && r.type === "BUY") r.type = "SELL";
  }

  GTJ.parseCsv = function(text){
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if(lines.length < 2) return [];
    const header = lines[0].split(",");
    const out = [];
    for(let i=1;i<lines.length;i++){
      const parts = lines[i].split(",");
      if(parts.length < header.length) continue;
      const obj = {};
      header.forEach((h,idx)=> obj[h.trim()] = (parts[idx]||"").trim());
      fixClosedType(obj);
      out.push(obj);
    }
    return out;
  };

  // ---------- ملف محلي عبر وسم <script> (يعمل من file:// بدون أي إذن) ----------
  let scriptSeq = 0;
  function loadScriptCsv(url){
    return new Promise((resolve, reject)=>{
      document.querySelectorAll("script[data-gtj-loader]").forEach(el=>el.remove());
      window.GTJ_CSV = undefined;
      const s = document.createElement("script");
      s.dataset.gtjLoader = String(scriptSeq++);
      s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
      let done = false;
      const timer = setTimeout(()=>{ if(done) return; done = true; s.remove(); reject(new Error("timeout")); }, LOAD_TIMEOUT_MS);
      s.onload = ()=>{
        if(done) return; done = true; clearTimeout(timer);
        if(typeof window.GTJ_CSV === "string" && window.GTJ_CSV.length) resolve(window.GTJ_CSV);
        else reject(new Error("empty"));
      };
      s.onerror = ()=>{ if(done) return; done = true; clearTimeout(timer); s.remove(); reject(new Error("load-error")); };
      document.head.appendChild(s);
    });
  }

  let lastGoodIndex = 0;
  async function fetchLocal(){
    const order = [lastGoodIndex, ...LOCAL_CANDIDATES.map((_,i)=>i).filter(i=>i!==lastGoodIndex)];
    for(const idx of order){
      try{
        const csv = await loadScriptCsv(LOCAL_CANDIDATES[idx]);
        lastGoodIndex = idx;
        return { raw: csv, rows: GTJ.parseCsv(csv), source: "ملف المؤشر" };
      }catch(e){ /* جرّب المصدر التالي */ }
    }
    return null;
  }

  // ---------- قاعدة البيانات عبر الخادم ----------
  async function fetchApi(){
    const headers = {};
    const token = localStorage.getItem(TOKEN_KEY);
    if(token) headers["Authorization"] = "Bearer " + token;
    let res = await fetch("/api/trades", { headers, cache: "no-store" });
    if(res.status === 401){
      const entered = prompt("أدخل رمز الدخول (API_TOKEN) المحدد في ملف .env للخادم:");
      if(!entered) throw new Error("unauthorized");
      localStorage.setItem(TOKEN_KEY, entered.trim());
      headers["Authorization"] = "Bearer " + entered.trim();
      res = await fetch("/api/trades", { headers, cache: "no-store" });
    }
    if(!res.ok) throw new Error("api-" + res.status);
    const rows = await res.json();
    rows.forEach(fixClosedType);
    return { raw: JSON.stringify(rows), rows, source: "قاعدة البيانات" };
  }

  // يعيد { raw, rows, source } أو null لو ما فيه بيانات متاحة
  GTJ.fetchRows = async function(){
    if(GTJ.isServed){
      try{ return await fetchApi(); }catch(e){ return null; }
    }
    return fetchLocal();
  };
})();
