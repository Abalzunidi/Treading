// تشغيل الصفحة: تحديث دوري + أزرار.
(function(){
  "use strict";
  const GTJ = window.GTJ;
  const $ = id => document.getElementById(id);

  let lastRaw = null;
  let manualMode = false;

  function setStatus(mode, text){
    $("statusDot").className = "dot" + (mode==="live" ? " live" : mode==="stale" ? " stale" : "");
    $("statusText").textContent = text;
  }
  const clock = () => new Date().toLocaleTimeString("en-GB");

  async function poll(){
    if(manualMode) return;
    const res = await GTJ.fetchRows();
    if(!res){
      setStatus("stale", "بانتظار البيانات… تأكد أن مؤشر المحلل أو الخادم شغّال، ثم اضغط \"تحديث الآن\"");
      return;
    }
    if(res.raw !== lastRaw){
      lastRaw = res.raw;
      GTJ.render(res.rows);
    }
    $("hintBox").style.display = "none";
    setStatus("live", "متصل (" + res.source + ") — آخر تحديث " + clock());
  }

  $("refreshBtn").addEventListener("click", ()=>{
    manualMode = false;
    setStatus("", "جارٍ التحديث…");
    poll();
  });

  $("manualBtn").addEventListener("click", ()=>{
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".csv";
    input.onchange = async ()=>{
      if(!input.files || !input.files[0]) return;
      manualMode = true;
      GTJ.render(GTJ.parseCsv(await input.files[0].text()));
      setStatus("stale", "ملف يدوي — اضغط \"تحديث الآن\" للعودة للتحديث التلقائي");
    };
    input.click();
  });

  GTJ.render([]);
  poll();
  setInterval(poll, GTJ.pollMs);
})();
