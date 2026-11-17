(() => {
  "use strict";

  const FILES = ["questions-01.json","questions-02.json","questions-03.json","questions-04.json"];
  const STORAGE = "tk-exam-progress-v1";
  const TYPES = {s:"单选题",m:"多选题",j:"判断题",f:"填空题"};
  const EXPECTED = {s:455,m:76,j:45,f:18};
  const $ = id => document.getElementById(id);

  let bank = [];
  let mode = "order";
  let order = [];
  let index = 0;
  let answers = {};
  let checked = {};
  let page = 1;
  let record = readRecord();

  function readRecord() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "{}");
      return {
        wrongIds: Array.isArray(saved.wrongIds) ? saved.wrongIds.filter(Number.isInteger) : [],
        answeredIds: Array.isArray(saved.answeredIds) ? saved.answeredIds.filter(Number.isInteger) : [],
        attempts: Math.max(0, Number(saved.attempts) || 0),
        correctAttempts: Math.max(0, Number(saved.correctAttempts) || 0),
        lastSession: saved.lastSession && typeof saved.lastSession === "object" ? saved.lastSession : null
      };
    } catch {
      return {wrongIds:[],answeredIds:[],attempts:0,correctAttempts:0,lastSession:null};
    }
  }

  function save() {
    record.lastSession = {mode, ids:order, index, answers, checked};
    try {localStorage.setItem(STORAGE, JSON.stringify(record));}
    catch { showError("浏览器无法保存记录，请检查存储权限。"); }
    updateStats();
  }

  function showError(message) {
    $("notice").textContent = message;
    $("notice").classList.remove("hidden");
    $("notice").classList.add("error");
  }

  function updateStats() {
    $("stats").textContent = `已刷 ${record.answeredIds.length} / ${bank.length || 594} · 正确率 ${record.attempts ? Math.round(record.correctAttempts / record.attempts * 100) + "%" : "—"}`;
    $("wrong-count").textContent = record.wrongIds.length;
  }

  function validate(rows) {
    if (rows.length !== 594) throw new Error(`题库数量错误（${rows.length} / 594）`);
    const counts = {s:0,m:0,j:0,f:0};
    const parsed = rows.map((row,i) => {
      if (!Array.isArray(row) || row.length !== 5) throw new Error(`第 ${i+1} 题格式错误`);
      const [id,type,stem,options,answer] = row;
      if (id !== i+1 || !(type in TYPES) || typeof stem !== "string" || !stem.trim() || !Array.isArray(options))
        throw new Error(`第 ${i+1} 题字段错误`);
      if (type === "s" && (!options.some(o => o[0] === answer) || typeof answer !== "string"))
        throw new Error(`第 ${id} 题答案错误`);
      if (type === "m" && (typeof answer !== "string" || !answer.length || [...answer].some(a => !options.some(o => o[0] === a))))
        throw new Error(`第 ${id} 题答案错误`);
      if (type === "j" && !["正确","错误"].includes(answer))
        throw new Error(`第 ${id} 题答案错误`);
      if (type === "f" && (!Array.isArray(answer) || !answer.length))
        throw new Error(`第 ${id} 题答案错误`);
      counts[type]++;
      return {id,type,stem,options,answer};
    });
    for (const type of Object.keys(EXPECTED))
      if (counts[type] !== EXPECTED[type]) throw new Error("题型数量错误");
    return parsed;
  }

  async function loadBank() {
    const chunks = await Promise.all(FILES.map(async filename => {
      const res = await fetch("./data/" + filename, {cache:"no-cache"});
      if (!res.ok) throw new Error(`加载 ${filename} 失败（HTTP ${res.status}）`);
      return res.json();
    }));
    if (chunks.some(chunk => !Array.isArray(chunk))) throw new Error("题库 JSON 格式错误");
    return validate(chunks.flat());
  }

  function shuffled(ids) {
    const copy = ids.slice();
    for (let i=copy.length-1;i>0;i--) {
      const j = Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }

  function selectPage(name) {
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("active",el.id==="page-"+name));
    document.querySelectorAll(".tabs button").forEach(btn => btn.classList.toggle("active",btn.dataset.page===name));
    if (name==="bank") renderBank();
    if (name==="wrong") renderWrongList();
  }

  function setMode(next, jumpId=null, restored=null) {
    if (!bank.length) return;
    if (next==="wrong" && !record.wrongIds.length) {
      showError("错题本为空，先做几道题。");
      return;
    }
    mode=next;
    order = next==="random" ? shuffled(bank.map(q=>q.id)) :
            next==="wrong" ? record.wrongIds.slice() : bank.map(q=>q.id);
    index=0;
    answers={};
    checked={};
    if (restored && Array.isArray(restored.ids) && restored.ids.length &&
        restored.ids.every(id=>Number.isInteger(id) && id>=1 && id<=594)) {
      order=restored.ids;
      index=Math.max(0,Math.min(order.length-1,Number(restored.index)||0));
      answers=restored.answers && typeof restored.answers==="object" ? restored.answers : {};
      checked=restored.checked && typeof restored.checked==="object" ? restored.checked : {};
    }
    if (jumpId !== null) {
      const at=order.indexOf(jumpId);
      if (at>=0) index=at;
    }
    for (const type of ["order","random","wrong"])
      $("mode-"+type).classList.toggle("active",mode===type);
    $("notice").classList.add("hidden");
    $("notice").classList.remove("error");
    $("quiz").classList.remove("hidden");
    selectPage("practice");
    renderQuestion();
    save();
  }

  function activeQuestion() {
    return bank[order[index]-1];
  }

  function normalize(value) {
    return String(value ?? "").trim().replace(/\s+/g,"").replace(/[，,。.;；:：、（）()]/g,"").toLowerCase();
  }

  function correct(q, value) {
    if (q.type==="m") {
      if (!Array.isArray(value) || !value.length) return false;
      return value.slice().sort().join("") === q.answer.split("").sort().join("");
    }
    if (q.type==="f") {
      return Array.isArray(value) && value.length===q.answer.length &&
        q.answer.every((part,i) => normalize(part)===normalize(value[i]));
    }
    return value === q.answer;
  }

  function standardAnswer(q) {
    if (q.type==="f") return q.answer.join("；");
    if (q.type==="j") return q.answer;
    return [...q.answer].map(key => {
      const option=q.options.find(o=>o[0]===key);
      return option ? key+"、"+option[1] : key;
    }).join("；");
  }

  function recordAnswer(q, value) {
    if (checked[q.id]) return;
    answers[q.id]=value;
    checked[q.id]=true;
    record.attempts++;
    if (!record.answeredIds.includes(q.id)) record.answeredIds.push(q.id);
    if (correct(q,value)) {
      record.correctAttempts++;
      record.wrongIds=record.wrongIds.filter(id=>id!==q.id);
    } else if (!record.wrongIds.includes(q.id)) {
      record.wrongIds.push(q.id);
    }
    save();
    renderQuestion();
  }

  function renderQuestion() {
    if (!order.length) return;
    const q=activeQuestion();
    const wasChecked=!!checked[q.id];
    const selected=answers[q.id];
    $("question-type").textContent=TYPES[q.type];
    $("question-number").textContent="原题 "+q.id;
    $("question-position").textContent=(index+1)+" / "+order.length;
    $("question-text").textContent=q.stem;
    $("previous").disabled=index===0;
    $("next").disabled=index===order.length-1;
    $("jump-number").value=q.id;

    const holder=$("answer-options");
    holder.replaceChildren();
    if (q.type==="f") {
      const group=document.createElement("div");
      group.className="blank";
      for (let i=0;i<q.answer.length;i++) {
        const input=document.createElement("input");
        input.type="text";
        input.placeholder="第 "+(i+1)+" 空";
        input.autocomplete="off";
        input.value=Array.isArray(selected) ? selected[i] || "" : "";
        input.disabled=wasChecked;
        input.addEventListener("input",() => {
          const a=answers[q.id] && Array.isArray(answers[q.id]) ? answers[q.id].slice() : Array(q.answer.length).fill("");
          a[i]=input.value;
          answers[q.id]=a;
          save();
        });
        group.append(input);
      }
      holder.append(group);
    } else {
      const options=q.type==="j" ? [["正确","正确"],["错误","错误"]] : q.options;
      options.forEach(([key,label]) => {
        const btn=document.createElement("button");
        btn.type="button";
        btn.className="option";
        const active=q.type==="m" ? Array.isArray(selected) && selected.includes(key) : selected===key;
        if (active) btn.classList.add("selected");
        if (wasChecked) {
          const right=q.type==="m" ? q.answer.includes(key) : key===q.answer;
          if (right) btn.classList.add("correct");
          else if (active) btn.classList.add("incorrect");
        }
        btn.disabled=wasChecked;
        const text=document.createElement("span");
        text.className="option-text";
        text.textContent=label;
        if (q.type!=="j") {
          const keyEl=document.createElement("span");
          keyEl.className="option-key";
          keyEl.textContent=key;
          btn.append(keyEl);
        }
        btn.append(text);
        btn.addEventListener("click",() => {
          if (checked[q.id]) return;
          if (q.type==="m") {
            const current=Array.isArray(answers[q.id]) ? answers[q.id] : [];
            answers[q.id]=current.includes(key) ? current.filter(a=>a!==key) : [...current,key];
            save();
            renderQuestion();
          } else recordAnswer(q,key);
        });
        holder.append(btn);
      });
    }

    $("submit").classList.toggle("hidden",q.type==="s" || q.type==="j" || wasChecked);
    const result=$("answer-result");
    result.replaceChildren();
    result.classList.toggle("hidden",!wasChecked);
    result.classList.remove("good","bad");
    if (wasChecked) {
      const passed=correct(q,selected);
      result.classList.add(passed?"good":"bad");
      const title=document.createElement("strong");
      title.textContent=passed?"回答正确":"回答错误";
      const body=document.createElement("div");
      body.textContent="正确答案："+standardAnswer(q);
      result.append(title,body);
    }
  }

  function submit() {
    const q=activeQuestion();
    if (!q || checked[q.id]) return;
    const answer=answers[q.id];
    const empty=answer===undefined ||
      (Array.isArray(answer) && !answer.some(v=>String(v||"").trim()));
    if (empty) {
      const result=$("answer-result");
      result.classList.remove("hidden","good","bad");
      result.textContent="请先作答。";
      return;
    }
    recordAnswer(q,answer);
  }

  function move(offset) {
    if (!order.length) return;
    index=Math.max(0,Math.min(order.length-1,index+offset));
    renderQuestion();
    save();
  }

  function jumpTo(id) {
    const q=Number(id);
    if (!Number.isInteger(q)||q<1||q>bank.length) {
      showError("请输入 1 至 594 的题号。");
      return;
    }
    if (mode!=="order") setMode("order",q);
    else {
      index=q-1;
      renderQuestion();
      save();
      selectPage("practice");
    }
  }

  function renderBank() {
    if (!bank.length) return;
    const search=$("search").value.toLowerCase().trim();
    const type=$("type-filter").value;
    const selected=bank.filter(q =>
      (type==="all" || q.type===type) &&
      (!search || (q.stem+" "+q.options.map(o=>o[1]).join(" ")).toLowerCase().includes(search))
    );
    const perPage=25;
    const totalPages=Math.max(1,Math.ceil(selected.length/perPage));
    page=Math.min(totalPages,Math.max(1,page));
    $("bank-summary").textContent="共 "+selected.length+" 道";
    $("bank-page").textContent=page+" / "+totalPages;
    $("bank-prev").disabled=page===1;
    $("bank-next").disabled=page===totalPages;
    const holder=$("bank-list");
    holder.replaceChildren();
    if (!selected.length) {
      const el=document.createElement("div");
      el.className="empty";
      el.textContent="没有匹配的题目";
      holder.append(el);
      return;
    }
    selected.slice((page-1)*perPage,page*perPage).forEach(q => holder.append(makeListRow(q)));
  }

  function makeListRow(q) {
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="list-row";
    const meta=document.createElement("span");
    meta.className="subtle";
    meta.textContent="第 "+q.id+" 题 · "+TYPES[q.type];
    const title=document.createElement("span");
    title.className="stem";
    title.textContent=q.stem;
    btn.append(meta,title);
    btn.addEventListener("click",()=>jumpTo(q.id));
    return btn;
  }

  function renderWrongList() {
    const holder=$("wrong-list");
    holder.replaceChildren();
    const found=record.wrongIds.map(id=>bank[id-1]).filter(Boolean);
    if (!found.length) {
      const el=document.createElement("div");
      el.className="empty";
      el.textContent="暂无错题";
      holder.append(el);
      return;
    }
    found.forEach(q=>holder.append(makeListRow(q)));
  }

  function exportRecord() {
    const payload={app:"TK Exam",exportedAt:new Date().toISOString(),progress:record};
    const link=document.createElement("a");
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    link.href=url;
    link.download="tk-exam-progress.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importRecord(file) {
    try {
      const data=JSON.parse(await file.text());
      const source=data.progress || data;
      if (!Array.isArray(source.wrongIds)||!Array.isArray(source.answeredIds)) throw new Error("文件格式不正确");
      record={
        wrongIds:[...new Set(source.wrongIds.filter(id=>Number.isInteger(id)&&id>=1&&id<=594))],
        answeredIds:[...new Set(source.answeredIds.filter(id=>Number.isInteger(id)&&id>=1&&id<=594))],
        attempts:Math.max(0,Number(source.attempts)||0),
        correctAttempts:Math.max(0,Number(source.correctAttempts)||0),
        lastSession:source.lastSession||null
      };
      updateStats();
      setMode("order");
      alert("导入成功");
    } catch (error) { alert("导入失败："+error.message); }
  }

  async function init() {
    updateStats();
    try {
      bank=await loadBank();
      $("bank-info").textContent="共 594 道题 · 单选 455 / 多选 76 / 判断 45 / 填空 18";
      for (const id of ["mode-order","mode-random","mode-wrong","jump-button"]) $(id).disabled=false;
      const previous=record.lastSession;
      if (previous && ["order","random","wrong"].includes(previous.mode)) {
        setMode(previous.mode,null,previous);
      } else {
        setMode("order");
      }
    } catch (error) {
      $("bank-info").textContent="题库加载失败";
      showError("题库加载失败："+error.message+"。请刷新网页重试。");
    }
  }

  document.querySelectorAll(".tabs button").forEach(btn => btn.addEventListener("click",()=>selectPage(btn.dataset.page)));
  $("mode-order").addEventListener("click",()=>setMode("order"));
  $("mode-random").addEventListener("click",()=>setMode("random"));
  $("mode-wrong").addEventListener("click",()=>setMode("wrong"));
  $("previous").addEventListener("click",()=>move(-1));
  $("next").addEventListener("click",()=>move(1));
  $("submit").addEventListener("click",submit);
  $("jump-button").addEventListener("click",()=>jumpTo($("jump-number").value));
  $("jump-number").addEventListener("keydown",event=>{if(event.key==="Enter")jumpTo($("jump-number").value);});
  $("search").addEventListener("input",()=>{page=1;renderBank();});
  $("type-filter").addEventListener("change",()=>{page=1;renderBank();});
  $("bank-prev").addEventListener("click",()=>{page--;renderBank();});
  $("bank-next").addEventListener("click",()=>{page++;renderBank();});
  $("export-record").addEventListener("click",exportRecord);
  $("import-record").addEventListener("click",()=>$("import-file").click());
  $("import-file").addEventListener("change",event=>{
    const file=event.target.files[0];
    if (file) importRecord(file);
    event.target.value="";
  });

  init();
})();
