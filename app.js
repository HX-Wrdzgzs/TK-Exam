
    (() => {
      "use strict";
      const DATA_PARTS = ["questions-01.json","questions-02.json","questions-03.json","questions-04.json"];
      const STORAGE_KEY = "tk-exam-progress-v1";
      const typeNames = {s:"单选题",m:"多选题",j:"判断题",f:"填空题"};
      const $ = (id) => document.getElementById(id);
      let questions = [];
      let progress = loadProgress();
      let session = null;
      let timerHandle = null;
      let toastHandle = null;
      let bankPage = 1;
      const PAGE_SIZE = 25;

      function loadProgress() {
        try {
          const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
          return {
            version: 1,
            wrongIds: Array.isArray(value.wrongIds) ? value.wrongIds : [],
            answeredIds: Array.isArray(value.answeredIds) ? value.answeredIds : [],
            attempts: Number(value.attempts) || 0,
            correctAttempts: Number(value.correctAttempts) || 0,
            lastActive: value.lastActive || "",
            lastSession: value.lastSession || null
          };
        } catch (_) {
          return {version:1,wrongIds:[],answeredIds:[],attempts:0,correctAttempts:0,lastActive:"",lastSession:null};
        }
      }
      function saveProgress() {
        progress.lastActive = new Date().toISOString();
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) { showToast("浏览器存储空间不足，建议导出记录"); }
        renderDashboard();
      }
      function showToast(message) {
        const el = $("toast");
        el.textContent = message;
        el.classList.add("show");
        clearTimeout(toastHandle);
        toastHandle = setTimeout(() => el.classList.remove("show"), 2200);
      }
      function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
      }
      function shuffle(list) {
        const copy = list.slice();
        for (let i=copy.length-1;i>0;i--) {
          const j = Math.floor(Math.random()*(i+1));
          [copy[i],copy[j]] = [copy[j],copy[i]];
        }
        return copy;
      }
      async function loadQuestions() {
        if (questions.length) return questions;
        try {
          const parts = await Promise.all(DATA_PARTS.map(async name => {
            const response = await fetch("./data/" + name);
            if (!response.ok) throw new Error("题库文件加载失败：" + name + "（HTTP " + response.status + "）");
            const data = await response.json();
            if (!Array.isArray(data)) throw new Error("题库文件格式错误：" + name);
            return data;
          }));
          const rows = parts.flat();
          if (rows.length !== 594) throw new Error("题库数量异常：预期 594 道，实际 " + rows.length + " 道");
          const counts = {s:0,m:0,j:0,f:0};
          const validated = rows.map((row,index) => {
            if (!Array.isArray(row) || row.length !== 5) throw new Error("第 " + (index+1) + " 道题数据结构错误");
            const [id,type,stem,options,answer] = row;
            if (id !== index+1 || !["s","m","j","f"].includes(type) || typeof stem !== "string" || !Array.isArray(options)) {
              throw new Error("第 " + (index+1) + " 道题字段错误");
            }
            if (type === "s" && (!/^[A-F]$/.test(answer) || !options.some(o=>Array.isArray(o)&&o[0]===answer))) throw new Error("第 " + id + " 道单选题答案错误");
            if (type === "m" && (typeof answer !== "string" || !/^[A-F]{2,}$/.test(answer) || [...answer].some(k=>!options.some(o=>Array.isArray(o)&&o[0]===k)))) throw new Error("第 " + id + " 道多选题答案错误");
            if (type === "j" && !["正确","错误"].includes(answer)) throw new Error("第 " + id + " 道判断题答案错误");
            if (type === "f" && (!Array.isArray(answer) || !answer.length || answer.some(v=>typeof v!=="string"||!v.trim()))) throw new Error("第 " + id + " 道填空题答案错误");
            counts[type]++;
            return {id,type,stem,options,answer};
          });
          const expected = {s:455,m:76,j:45,f:18};
          if (Object.keys(expected).some(type=>counts[type]!==expected[type])) {
            throw new Error("题型统计异常：" + JSON.stringify(counts));
          }
          questions = validated;
          $("total-count").textContent = questions.length;
          $("progress-label").textContent = `${progress.answeredIds.length} / ${questions.length}`;
          renderDashboard();
          return questions;
        } catch (error) {
          questions = [];
          $("question-area").innerHTML = `<div class="empty">题库加载失败：${escapeHTML(error.message)}<br>请检查 data 目录中的 JSON 文件是否完整。</div>`;
          showToast("题库加载失败，请检查数据文件");
          throw error;
        }
      }
      function showView(name) {
        document.querySelectorAll(".view").forEach(el => el.classList.remove("active"));
        const target = $("view-" + name);
        if (target) target.classList.add("active");
        document.querySelectorAll(".nav button").forEach(btn => btn.classList.toggle("active", btn.dataset.view === name));
        if (name === "home") renderDashboard();
        if (name === "bank") { if (questions.length) renderBank(); else loadQuestions().then(renderBank).catch(()=>{}); }
        if (name === "wrong") { if (questions.length) renderWrongList(); else loadQuestions().then(renderWrongList).catch(()=>{}); }
        window.scrollTo({top:0,behavior:"smooth"});
      }
      function renderDashboard() {
        const total = questions.length || 594;
        $("stat-practiced").textContent = progress.answeredIds.length;
        $("stat-attempts").textContent = progress.attempts;
        $("stat-accuracy").textContent = progress.attempts ? Math.round(progress.correctAttempts/progress.attempts*100)+"%" : "—";
        $("stat-wrong").textContent = progress.wrongIds.length;
        $("progress-label").textContent = `${progress.answeredIds.length} / ${total}`;
        $("progress-fill").style.width = Math.min(100,progress.answeredIds.length/total*100)+"%";
        $("last-active").textContent = progress.lastActive ? new Date(progress.lastActive).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "尚未开始";
      }
      function startSession(mode, ids, options={}) {
        clearInterval(timerHandle);
        const selected = ids.map(id => questions.find(q => q.id === id)).filter(Boolean);
        if (!selected.length) { showToast("当前没有可练习的题目"); return; }
        session = {
          mode, list:selected, index:0, answers:{}, checked:{}, submitted:false,
          startedAt:Date.now(), duration:options.duration || 0, remaining:(options.duration || 0)*60,
          score:null
        };
        $("session-name").textContent = ({order:"顺序练习",random:"随机练习",exam:"模拟考试",wrong:"错题复习"})[mode] || "练习";
        $("session-subtitle").textContent = mode === "exam" ? "考试期间不显示答案，交卷后统一评分" : "提交后立即核对答案，答错的题目会进入错题本";
        $("check-answer").classList.toggle("hidden",mode==="exam");
        $("finish-exam").classList.toggle("hidden",mode!=="exam");
        $("session-timer").textContent = mode==="exam" ? "剩余时间 —" : "";
        showView("session");
        renderQuestion();
        if (mode==="exam") {
          timerHandle = setInterval(() => {
            if (!session || session.submitted) return;
            session.remaining--;
            $("session-timer").textContent = "剩余 " + formatTime(session.remaining);
            if (session.remaining <= 0) finishExam(true);
          },1000);
          $("session-timer").textContent = "剩余 " + formatTime(session.remaining);
        }
      }
      function formatTime(seconds) {
        const s=Math.max(0,seconds);
        return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
      }
      function currentQuestion() { return session && session.list[session.index]; }
      function answerFor(q) {
        if (!session) return null;
        return session.answers[q.id];
      }
      function setAnswer(q, value) {
        if (!session || session.submitted || (session.mode!=="exam" && session.checked[q.id])) return;
        session.answers[q.id] = value;
        renderMap();
      }
      function blankCount(q) {
        return Array.isArray(q.answer) ? q.answer.length : 1;
      }
      function renderQuestion() {
        if (!session) return;
        const q = currentQuestion();
        const saved = answerFor(q);
        const checked = !!session.checked[q.id];
        $("session-count").textContent = `第 ${session.index+1} / ${session.list.length} 题`;
        $("session-progress-fill").style.width = ((session.index+1)/session.list.length*100)+"%";
        $("prev-question").disabled = session.index===0;
        $("next-question").disabled = session.index===session.list.length-1;
        $("mark-wrong").textContent = progress.wrongIds.includes(q.id) ? "移出错题本" : "标记为错题";
        $("question-area").innerHTML = "";
        const card = document.createElement("div");
        card.className = "question-card";
        const kicker = document.createElement("div");
        kicker.className = "question-kicker";
        kicker.innerHTML = `<span class="q-number">第 ${q.id} 题</span><span class="q-type">${typeNames[q.type]}</span>`;
        const stem = document.createElement("div");
        stem.className = "question-stem";
        stem.textContent = q.stem;
        card.append(kicker,stem);
        if (q.type === "f") {
          const inputs = document.createElement("div");
          inputs.className = "fill-inputs";
          const vals = Array.isArray(saved) ? saved : [];
          for (let i=0;i<blankCount(q);i++) {
            const input = document.createElement("input");
            input.className = "fill-input";
            input.type = "text";
            input.autocomplete = "off";
            input.placeholder = `填写第 ${i+1} 空`;
            input.value = vals[i] || "";
            input.disabled = checked || session.submitted;
            input.addEventListener("input", () => {
              const next = Array.from(inputs.querySelectorAll("input")).map(el=>el.value);
              setAnswer(q,next);
            });
            inputs.append(input);
          }
          card.append(inputs);
        } else {
          const options = document.createElement("div");
          options.className = "options";
          let values = Array.isArray(saved) ? saved : (saved ? [saved] : []);
          const list = q.options.length ? q.options : [["正确","正确"],["错误","错误"]];
          list.forEach(([key,label]) => {
            const selected = values.includes(key);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "option" + (selected?" selected":"");
            button.disabled = checked || session.submitted;
            if (checked || session.submitted) {
              const isCorrect = q.type==="m" ? String(q.answer).includes(key) : String(q.answer)===key;
              if (isCorrect) button.classList.add("correct");
              else if (selected) button.classList.add("incorrect");
            }
            const textEl=document.createElement("span"); textEl.className="option-text"; textEl.textContent=label;
            if (q.type==="j") button.append(textEl);
            else {
              const keyEl=document.createElement("span"); keyEl.className="option-key"; keyEl.textContent=key;
              button.append(keyEl,textEl);
            }
            button.addEventListener("click",()=>{
              if (q.type==="m") {
                const next=values.includes(key)?values.filter(x=>x!==key):values.concat(key);
                setAnswer(q,next);
              } else setAnswer(q,key);
              renderQuestion();
            });
            options.append(button);
          });
          card.append(options);
          if (q.type==="m") {
            const hint=document.createElement("div"); hint.className="answer-hint"; hint.textContent="多选题：请选择所有正确选项，再提交答案。"; card.append(hint);
          }
        }
        if (checked || session.submitted) {
          const correct = evaluate(q,answerFor(q));
          const result=document.createElement("div");
          result.className="result-box "+(correct?"good":"bad");
          const correctText = q.type==="f" ? q.answer.join("；") : q.type==="m" ? q.answer.split("").join("、") : q.type==="j" ? (q.answer==="正确"?"正确":"错误") : q.answer;
          const userText = formatUserAnswer(q,answerFor(q));
          result.innerHTML = `<strong>${correct?"回答正确":"回答错误"}</strong>你的答案：${escapeHTML(userText || "未作答")}<br>标准答案：${escapeHTML(correctText)}`;
          card.append(result);
        }
        $("question-area").append(card);
        $("check-answer").disabled = checked;
        $("mark-wrong").disabled = session.mode==="exam" && session.submitted;
        if (session.submitted && session.mode==="exam") $("finish-exam").disabled=true;
        renderMap();
      }
      function formatUserAnswer(q, value) {
        if (q.type==="f") return Array.isArray(value)?value.join("；"):"";
        if (q.type==="m") return Array.isArray(value)?value.join("、"):"";
        return value || "";
      }
      function normalizeText(value) {
        return String(value??"").toLowerCase().replace(/\s+/g,"").replace(/[，,。.;；:：、"'“”‘’（）()【】\[\]]/g,"");
      }
      function evaluate(q, value) {
        if (q.type==="f") {
          if (!Array.isArray(value) || !Array.isArray(q.answer) || value.length!==q.answer.length) return false;
          return q.answer.every((a,i)=>normalizeText(a)===normalizeText(value[i]));
        }
        if (q.type==="m") {
          const chosen=Array.isArray(value)?value.slice().sort().join(""):"";
          return chosen===String(q.answer).split("").sort().join("");
        }
        return String(value||"")===String(q.answer);
      }
      function submitPractice() {
        const q=currentQuestion();
        if (session.checked[q.id]) return;
        const value=answerFor(q);
        if (value==null || (Array.isArray(value) && value.every(x=>!String(x||"").trim()))) {
          showToast("请先作答，再提交"); return;
        }
        const correct=evaluate(q,value);
        session.checked[q.id]=true;
        progress.attempts++;
        if (correct) {
          progress.correctAttempts++;
          progress.wrongIds=progress.wrongIds.filter(id=>id!==q.id);
        } else if (!progress.wrongIds.includes(q.id)) progress.wrongIds.push(q.id);
        if (!progress.answeredIds.includes(q.id)) progress.answeredIds.push(q.id);
        saveProgress();
        renderQuestion();
      }
      function finishExam(auto=false) {
        if (!session || session.submitted) return;
        if (!auto && !confirm("确认交卷？交卷后将统一显示答案和成绩。")) return;
        clearInterval(timerHandle);
        let correctCount=0, answeredCount=0;
        session.list.forEach(q=>{
          const value=answerFor(q);
          const answered=value!=null && (Array.isArray(value)?value.some(x=>String(x||"").trim()):String(value).trim()!=="");
          if (answered) answeredCount++;
          const correct=evaluate(q,value);
          if (correct) correctCount++;
          if (!correct && !progress.wrongIds.includes(q.id)) progress.wrongIds.push(q.id);
          if (correct) progress.wrongIds=progress.wrongIds.filter(id=>id!==q.id);
          if (answered && !progress.answeredIds.includes(q.id)) progress.answeredIds.push(q.id);
          progress.attempts++;
          if (correct) progress.correctAttempts++;
          session.checked[q.id]=true;
        });
        session.submitted=true;
        session.score=Math.round(correctCount/session.list.length*100);
        saveProgress();
        $("session-name").textContent="模拟考试成绩";
        $("session-subtitle").textContent=auto?"考试时间结束，系统已自动交卷":"考试已结束，以下为本次成绩";
        $("session-timer").textContent="已交卷";
        $("finish-exam").classList.add("hidden");
        $("check-answer").classList.remove("hidden");
        $("check-answer").textContent="查看解析答案";
        $("check-answer").disabled=true;
        const score=document.createElement("div");
        score.className="score-hero";
        score.innerHTML=`<div><h2>本次考试完成</h2><p>答对 ${correctCount} 题 · 已作答 ${answeredCount} 题 · 共 ${session.list.length} 题</p></div><div class="score-value">${session.score}<small style="font-size:15px"> 分</small></div>`;
        renderQuestion();
        $("question-area").prepend(score);
        $("map-legend").textContent="绿色为答对，红色为答错，点击题号查看答案";
        showToast("已完成评分");
      }
      function renderMap() {
        if (!session) return;
        const map=$("question-map");
        map.innerHTML="";
        session.list.forEach((q,i)=>{
          const btn=document.createElement("button");
          btn.type="button"; btn.className="map-item"; btn.textContent=i+1;
          if (i===session.index) btn.classList.add("current");
          if (session.checked[q.id] || (session.submitted && session.answers[q.id]!=null)) btn.classList.add(evaluate(q,answerFor(q))?"done":"wrong");
          btn.addEventListener("click",()=>{session.index=i;renderQuestion();});
          map.append(btn);
        });
      }
      function renderBank() {
        if (!questions.length) return;
        const query=$("bank-search").value.trim().toLowerCase();
        const type=$("bank-type").value;
        const filtered=questions.filter(q=>(type==="all"||q.type===type) && (!query || (q.stem+" "+q.options.map(o=>o[1]).join(" ")).toLowerCase().includes(query)));
        $("bank-count").textContent=`筛选出 ${filtered.length} 道题目`;
        const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
        bankPage=Math.min(bankPage,pages);
        const slice=filtered.slice((bankPage-1)*PAGE_SIZE,bankPage*PAGE_SIZE);
        const list=$("bank-list"); list.innerHTML="";
        if (!slice.length) list.innerHTML='<div class="empty">没有找到匹配的题目。<br>请尝试更换关键词或题型。</div>';
        slice.forEach(q=>{
          const item=document.createElement("div"); item.className="bank-item";
          const num=document.createElement("div"); num.className="bank-num"; num.textContent=q.id;
          const body=document.createElement("div"); body.className="bank-text";
          const stem=document.createElement("strong"); stem.textContent=q.stem;
          const meta=document.createElement("div"); meta.className="bank-meta";
          meta.innerHTML=`<span class="tag">${typeNames[q.type]}</span>${progress.wrongIds.includes(q.id)?'<span class="tag wrong-tag">待复习</span>':""}`;
          body.append(stem,meta); item.append(num,body);
          item.addEventListener("click",()=>startSession("order",[q.id]));
          list.append(item);
        });
        const pager=$("bank-pagination"); pager.innerHTML="";
        const prev=document.createElement("button"); prev.textContent="上一页"; prev.disabled=bankPage<=1; prev.onclick=()=>{bankPage--;renderBank();};
        const info=document.createElement("button"); info.textContent=`${bankPage} / ${pages}`; info.disabled=true;
        const next=document.createElement("button"); next.textContent="下一页"; next.disabled=bankPage>=pages; next.onclick=()=>{bankPage++;renderBank();};
        pager.append(prev,info,next);
      }
      function renderWrongList() {
        const list=$("wrong-list"); list.innerHTML="";
        const wrong=progress.wrongIds.map(id=>questions.find(q=>q.id===id)).filter(Boolean);
        if (!wrong.length) {
          list.innerHTML='<div class="empty">错题本还是空的。<br>练习时答错的题目会自动出现在这里。</div>';
          return;
        }
        wrong.sort((a,b)=>a.id-b.id).forEach(q=>{
          const item=document.createElement("div"); item.className="bank-item";
          const num=document.createElement("div"); num.className="bank-num"; num.textContent=q.id;
          const body=document.createElement("div"); body.className="bank-text";
          const stem=document.createElement("strong"); stem.textContent=q.stem;
          const meta=document.createElement("div"); meta.className="bank-meta"; meta.innerHTML=`<span class="tag">${typeNames[q.type]}</span><span class="tag wrong-tag">待复习</span>`;
          body.append(stem,meta); item.append(num,body); item.addEventListener("click",()=>startSession("wrong",[q.id])); list.append(item);
        });
      }
      function exportProgress() {
        const blob=new Blob([JSON.stringify({app:"TK Exam",version:1,exportedAt:new Date().toISOString(),progress},null,2)],{type:"application/json"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a"); a.href=url; a.download="tk-exam-progress.json"; a.click();
        URL.revokeObjectURL(url);
        showToast("学习记录已导出");
      }
      async function importProgress(file) {
        try {
          const data=JSON.parse(await file.text());
          const p=data.progress || data;
          if (!p || !Array.isArray(p.wrongIds) || !Array.isArray(p.answeredIds)) throw new Error("文件格式不正确");
          progress.wrongIds=[...new Set(p.wrongIds.filter(Number.isInteger))];
          progress.answeredIds=[...new Set(p.answeredIds.filter(Number.isInteger))];
          progress.attempts=Number(p.attempts)||0;
          progress.correctAttempts=Number(p.correctAttempts)||0;
          progress.lastActive=p.lastActive||new Date().toISOString();
          saveProgress(); showToast("学习记录导入成功");
        } catch(error) { showToast("导入失败：" + error.message); }
      }

      document.querySelectorAll(".nav button").forEach(btn=>btn.addEventListener("click",async()=>{
        if(btn.dataset.view==="practice"){
          await loadQuestions();
          startSession("order",questions.map(q=>q.id));
        } else showView(btn.dataset.view);
      }));
      $("start-order").addEventListener("click",async()=>{await loadQuestions();startSession("order",questions.map(q=>q.id));});
      $("start-random").addEventListener("click",async()=>{await loadQuestions();startSession("random",shuffle(questions.map(q=>q.id)));});
      $("start-exam").addEventListener("click",async()=>{
        await loadQuestions();
        const count=Number($("exam-count").value), duration=Number($("exam-duration").value);
        startSession("exam",shuffle(questions.map(q=>q.id)).slice(0,count),{duration});
      });
      $("start-wrong").addEventListener("click",async()=>{await loadQuestions();startSession("wrong",progress.wrongIds.slice().sort((a,b)=>a-b));});
      $("continue-btn").addEventListener("click",async()=>{await loadQuestions();startSession("order",questions.map(q=>q.id));});
      $("session-back").addEventListener("click",()=>{clearInterval(timerHandle);showView("home");});
      $("prev-question").addEventListener("click",()=>{if(session&&session.index>0){session.index--;renderQuestion();}});
      $("next-question").addEventListener("click",()=>{if(session&&session.index<session.list.length-1){session.index++;renderQuestion();}});
      $("check-answer").addEventListener("click",submitPractice);
      $("finish-exam").addEventListener("click",()=>finishExam(false));
      $("mark-wrong").addEventListener("click",()=>{
        if(!session)return; const id=currentQuestion().id;
        if(progress.wrongIds.includes(id)) progress.wrongIds=progress.wrongIds.filter(x=>x!==id);
        else progress.wrongIds.push(id);
        saveProgress(); renderQuestion(); showToast("错题本已更新");
      });
      $("bank-search").addEventListener("input",()=>{bankPage=1;renderBank();});
      $("bank-type").addEventListener("change",()=>{bankPage=1;renderBank();});
      $("clear-wrong").addEventListener("click",()=>{
        if(!progress.wrongIds.length)return;
        if(confirm("确定清空全部错题记录？")){progress.wrongIds=[];saveProgress();renderWrongList();}
      });
      $("export-btn").addEventListener("click",exportProgress);
      $("import-btn").addEventListener("click",()=>$("import-file").click());
      $("import-file").addEventListener("change",e=>{const file=e.target.files[0];if(file)importProgress(file);e.target.value="";});
      window.addEventListener("beforeunload",()=>{if(session&&!session.submitted)progress.lastSession={mode:session.mode,index:session.index,ids:session.list.map(q=>q.id),answers:session.answers};saveProgress();});

      renderDashboard();
      loadQuestions().then(()=>{renderDashboard();}).catch(()=>{});
    })();
  