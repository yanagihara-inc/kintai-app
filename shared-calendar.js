/* Shared calendar: identity and server authorization are supplied by the host app. */
window.createSharedCalendar=function(adapter){
  const dialog=document.createElement('dialog');
  dialog.className='shared-calendar-dialog';
  document.body.appendChild(dialog);
  let month=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}).slice(0,7),events=[],loading=false,requestSerial=0,showingSaved=false;
  const esc=s=>String(s||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const identity=()=>adapter.getIdentity();
  const cacheKey='kintai-shared-calendar-cache-v1';
  let calendarCache={};
  try{calendarCache=JSON.parse(sessionStorage.getItem(cacheKey)||'{}')||{};}catch(_){}
  async function readMonth(value){
    const auth=identity(),key=auth.name+'|'+value,cached=calendarCache[key];
    let result=await adapter.request({action:'calendarRead',month:value,knownRevision:cached?.revision||'',...auth});
    if(!result.ok)return result;
    if(result.notModified){
      if(cached)return {ok:true,events:cached.events};
      result=await adapter.request({action:'calendarRead',month:value,...auth});
    }
    if(result.ok&&result.revision){
      calendarCache[key]={revision:result.revision,events:result.events||[]};
      try{sessionStorage.setItem(cacheKey,JSON.stringify(calendarCache));}catch(_){}
    }
    return result;
  }
  async function readMonths(months){
    const auth=identity(),knownRevisions={};
    months.forEach(value=>knownRevisions[value]=calendarCache[auth.name+'|'+value]?.revision||'');
    const result=await adapter.request({action:'calendarRead',month:months[1],months,knownRevisions,...auth});
    if(!result.ok)throw Error(result.error||'予定を取得できません');
    // 古いデプロイ、ローカル確認版にも対応。
    if(!result.months)return Promise.all(months.map(readMonth));
    return months.map(value=>{
      const item=result.months[value],key=auth.name+'|'+value;
      if(!item)throw Error('予定の応答を確認してください');
      if(item.notModified){if(!calendarCache[key])throw Error('保存済み予定を確認してください');return {ok:true,events:calendarCache[key].events};}
      calendarCache[key]={revision:item.revision,events:item.events||[]};
      try{sessionStorage.setItem(cacheKey,JSON.stringify(calendarCache));}catch(_){}
      return {ok:true,events:item.events||[]};
    });
  }
  const editable=e=>!e.readOnly&&(e.owner===identity().name||adapter.isAdmin(identity().name));
  let selectedDate=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'}),selectedSite='';
  const siteName=e=>e.title.split(/[：:]/)[0].trim();
  const shiftDate=(date,days)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const displayDate=date=>Number(date.slice(5,7))+'月'+Number(date.slice(8))+'日（'+['日','月','火','水','木','金','土'][new Date(date+'T00:00:00Z').getUTCDay()]+'）';
  const eventCard=e=>'<article class="calendar-detail-card"><div class="calendar-detail-date">'+displayDate(e.startDate)+(e.endDate!==e.startDate?'<span class="calendar-date-separator">～</span>'+displayDate(e.endDate):'')+'</div><h4>'+esc(e.title.includes('：')?e.title.split('：').slice(1).join('：'):e.title)+'</h4><span class="calendar-time-badge">'+(e.startTime?esc(e.startTime)+' ～ '+esc(e.endTime):'終日')+'</span>'+(e.note?'<details class="calendar-detail-note"><summary>備考を見る</summary><p>'+esc(e.note)+'</p></details>':'')+'<div class="calendar-detail-footer"><small>登録者：'+esc(e.owner)+'</small>'+(editable(e)?'<button class="secondary" data-edit="'+esc(e.id)+'">変更・削除</button>':'')+'</div></article>';
  function shell(){
    dialog.innerHTML='<div class="modal"><h2>共有カレンダー</h2><p class="hint">全員が追加できます。変更・削除は登録した本人と管理者のみ。</p><div class="calendar-toolbar"><button data-prev>◀</button><input type="month" value="'+month+'" aria-label="表示する月"><button data-next>▶</button></div><button class="primary" data-add>＋ 予定を追加</button><p class="hint" role="status" data-status></p><div data-grid></div><div data-events></div><div class="modal-actions"><button class="secondary" data-close>閉じる</button></div></div>';
    dialog.querySelector('[data-close]').onclick=()=>dialog.close();
    dialog.querySelector('h2').insertAdjacentHTML('beforebegin','<div class="modal-actions calendar-top-actions"><button class="secondary" data-close-top>閉じる</button></div>');
    dialog.querySelector('[data-close-top]').onclick=()=>dialog.close();
    dialog.querySelector('[data-add]').onclick=()=>edit();
    dialog.querySelector('input').onchange=e=>{if(e.target.value){month=e.target.value;refresh();}};
    const move=delta=>{const [y,m]=month.split('-').map(Number),date=new Date(Date.UTC(y,m-1+delta,1));month=date.toISOString().slice(0,7);refresh();};
    dialog.querySelector('[data-prev]').onclick=()=>move(-1);
    dialog.querySelector('[data-next]').onclick=()=>move(1);
    dialog.querySelector('[data-next]').insertAdjacentHTML('afterend','<button class="secondary" data-today>今日</button>');
    dialog.querySelector('[data-today]').onclick=()=>{
      selectedDate=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
      selectedSite='';
      month=selectedDate.slice(0,7);
      refresh();
    };
    if(adapter.localPreview)dialog.querySelector('h2').insertAdjacentHTML('afterend','<p class="hint">ローカル確認用です。予定はこのブラウザーだけに保存され、公開中のデータには送信されません。</p>');
    draw();
  }
  function draw(){
    const [y,m]=month.split('-').map(Number),count=new Date(Date.UTC(y,m,0)).getUTCDate(),offset=new Date(Date.UTC(y,m-1,1)).getUTCDay();
    let grid=['日','月','火','水','木','金','土'].map(day=>'<b>'+day+'</b>').join('')+'<span></span>'.repeat(offset);
    for(let day=1;day<=count;day++){
      const date=month+'-'+String(day).padStart(2,'0'),items=events.filter(e=>e.startDate<=date&&e.endDate>=date),holiday=adapter.holidayName?.(date)||'';
      grid+='<button aria-label="'+date+(holiday?' '+esc(holiday):'')+' 予定'+items.length+'件" class="calendar-day'+(items.length?' calendar-has-events':' calendar-no-events')+(holiday?' calendar-holiday':'')+(date===selectedDate?' calendar-selected':'')+'" data-date="'+date+'"><strong>'+day+'</strong></button>';
    }
    dialog.querySelector('[data-grid]').innerHTML='<div class="calendar-grid">'+grid+'</div>';
    dialog.querySelectorAll('[data-date]').forEach(button=>button.onclick=()=>{selectedDate=button.dataset.date;selectedSite='';draw();});
    const weekday=new Date(selectedDate+'T00:00:00Z').getUTCDay(),weekStart=shiftDate(selectedDate,-weekday);
    let list='<div class="calendar-week-nav"><button data-week-prev>◀ 前週</button><h3>週間予定</h3><button data-week-next>翌週 ▶</button></div><p class="hint">大きい太字の日付は予定あり、小さい日付は予定なし。日付を押すとその週を表示します。</p>';
    if(selectedSite){
      const matching=events.filter(e=>siteName(e)===selectedSite&&e.startDate<=month+'-31'&&e.endDate>=month+'-01');
      list='<div class="calendar-detail-header"><button class="secondary" data-back-week>← 週間予定に戻る</button><h3>'+esc(selectedSite)+'</h3><p>'+Number(month.slice(0,4))+'年'+Number(month.slice(5))+'月の予定 <span>'+matching.length+'件</span></p></div>'+matching.map(eventCard).join('');
    }else{
      const weekEnd=shiftDate(weekStart,6),groups=new Map();
      const label=date=>Number(date.slice(5,7))+'/'+Number(date.slice(8))+'（'+['日','月','火','水','木','金','土'][new Date(date+'T00:00:00Z').getUTCDay()]+'）';
      list+='<p class="calendar-week-range">'+label(weekStart)+' ～ '+label(weekEnd)+'</p>';
      events.filter(e=>e.startDate<=weekEnd&&e.endDate>=weekStart).forEach(e=>{const site=siteName(e);if(!groups.has(site))groups.set(site,[]);groups.get(site).push(e);});
      if(!groups.size)list+='<p class="hint">この週の予定はありません。</p>';
      groups.forEach((items,site)=>{
        list+='<section class="calendar-site-week"><button class="calendar-site" data-site="'+esc(site)+'">'+esc(site)+' ›</button><div class="calendar-week-items">';
        items.forEach(e=>{
          const start=e.startDate<weekStart?weekStart:e.startDate,end=e.endDate>weekEnd?weekEnd:e.endDate;
          const work=e.title.includes('：')?e.title.split('：').slice(1).join('：'):e.title;
          list+='<div class="calendar-week-item"><div class="calendar-week-dates">'+label(start)+(start!==end?' ～ '+label(end):'')+'</div><strong>'+esc(work)+'</strong>'+(e.startTime?'<small>'+esc(e.startTime)+' ～ '+esc(e.endTime)+'</small>':'')+(editable(e)?'<button class="secondary" data-edit="'+esc(e.id)+'">変更・削除</button>':'')+'</div>';
        });
        list+='</div></section>';
      });
    }
    dialog.querySelector('[data-events]').innerHTML=list;
    dialog.querySelectorAll('[data-site]').forEach(button=>button.onclick=()=>{selectedSite=button.dataset.site;draw();});
    const back=dialog.querySelector('[data-back-week]');if(back)back.onclick=()=>{selectedSite='';draw();};
    const moveWeek=days=>{selectedDate=shiftDate(selectedDate,days);selectedSite='';if(selectedDate.slice(0,7)!==month){month=selectedDate.slice(0,7);refresh();}else draw();};
    const prev=dialog.querySelector('[data-week-prev]'),next=dialog.querySelector('[data-week-next]');if(prev)prev.onclick=()=>moveWeek(-7);if(next)next.onclick=()=>moveWeek(7);
    dialog.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>edit(events.find(e=>e.id===button.dataset.edit)));
    dialog.querySelector('[data-status]').textContent=loading?(showingSaved?'保存済みの予定を表示中・変更を確認しています…':'予定を読み込み中…'):'';
  }
  async function refresh(){
    if(selectedDate.slice(0,7)!==month)selectedDate=month+'-01';
    selectedSite='';
    const [year,mon]=month.split('-').map(Number),months=[-1,0,1].map(n=>new Date(Date.UTC(year,mon-1+n,1)).toISOString().slice(0,7));
    const saved=months.map(value=>calendarCache[identity().name+'|'+value]);
    showingSaved=saved.some(value=>Array.isArray(value?.events));
    const merge=items=>Array.from(new Map(items.map(e=>[e.id,e])).values()).sort((a,b)=>a.startDate.localeCompare(b.startDate)||(a.startTime||'').localeCompare(b.startTime||''));
    events=merge(saved.flatMap(value=>Array.isArray(value?.events)?value.events:[]));
    const serial=++requestSerial;loading=true;shell();
    try{
      const results=await readMonths(months);
      if(serial!==requestSerial||!dialog.open)return;
      const failed=results.find(r=>!r.ok);if(failed)throw Error(failed.error||'予定を取得できません');
      events=merge(results.flatMap(r=>r.events||[]));loading=false;showingSaved=false;draw();
    }catch(error){if(serial===requestSerial&&dialog.open){loading=false;draw();dialog.querySelector('[data-status]').textContent=(showingSaved?'保存済みの予定を表示しています。最新の変更は確認できませんでした。':'')+error.message+'。月を選び直して再読み込みできます。';}}
  }
  async function edit(event=null,date=month+'-01'){
    if(event&&!editable(event))return;
    const serial=++requestSerial;
    let sites;
    dialog.querySelector('[data-status]').textContent='現場名を読み込み中…';
    try{sites=await adapter.getSites();}catch(error){if(serial===requestSerial&&dialog.open)dialog.querySelector('[data-status]').textContent='現場名を読み込めません：'+error.message;return;}
    if(serial!==requestSerial||!dialog.open)return;
    sites=[...new Set((sites||[]).filter(s=>typeof s==='string'&&s.trim()))];
    const e=event||{title:'',startDate:date,endDate:date,startTime:'',endTime:'',note:''};
    dialog.innerHTML='<div class="modal"><h2>'+ (event?'予定を変更':'予定を追加')+'</h2><form><label class="field">予定名<input name="title" required maxlength="80" value="'+esc(e.title)+'"></label><label class="field">開始日<input name="startDate" type="date" required value="'+esc(e.startDate)+'"></label><label class="field">終了日<input name="endDate" type="date" required value="'+esc(e.endDate)+'"></label><p class="hint">時刻を空欄にすると終日です。</p><label class="field">開始時刻<input name="startTime" type="time" value="'+esc(e.startTime)+'"></label><label class="field">終了時刻<input name="endTime" type="time" value="'+esc(e.endTime)+'"></label><label class="field">内容<textarea name="note" maxlength="1000">'+esc(e.note).replaceAll('>','&gt;')+'</textarea></label><p class="hint">登録者：'+esc(event?event.owner:identity().name)+'</p><p role="alert" data-error></p><div class="modal-actions"><button type="button" class="secondary" data-cancel>キャンセル</button><button class="primary" type="submit">保存</button></div>'+(event?'<button type="button" class="delete" data-delete>この予定を削除</button>':'')+'</form></div>';
    const titleInput=dialog.querySelector('[name="title"]'),split=e.title.indexOf('：');
    const currentSite=split>=0?siteName(e):'',currentWork=split>=0?e.title.slice(split+1):e.title;
    const options=(values,current)=>'<option value="">選択してください</option>'+values.map(value=>'<option value="'+esc(value)+'"'+(value===current?' selected':'')+'>'+esc(value)+'</option>').join('');
    const oldSite=event&&currentSite&&!sites.includes(currentSite)?'<option selected value="'+esc(currentSite)+'">'+esc(currentSite)+'（既存予定・登録外）</option>':'';
    titleInput.closest('label').insertAdjacentHTML('beforebegin','<label class="field">現場名<select name="site" required>'+options(sites,currentSite)+oldSite+'</select></label>'+(!sites.length?'<p class="hint">有効な現場がありません。勤怠アプリで現場を登録してください。</p>':''));
    const works=['建込','コン打ち','解体','運搬'],aliases={'建込み':'建込','コンクリート打設':'コン打ち','バラシ':'解体'},work=aliases[currentWork]||currentWork;
    titleInput.outerHTML='<select name="title" required>'+options(works,work)+(event&&work&&!works.includes(work)?'<option selected value="'+esc(work)+'">'+esc(work)+'（既存予定）</option>':'')+'</select>';
    const startDateInput=dialog.querySelector('[name="startDate"]'),endDateInput=dialog.querySelector('[name="endDate"]');
    const startTimeInput=dialog.querySelector('[name="startTime"]'),endTimeInput=dialog.querySelector('[name="endTime"]');
    startDateInput.onchange=()=>{if(startDateInput.value)endDateInput.value=startDateInput.value;};
    startTimeInput.onchange=()=>{
      if(!startTimeInput.value)return;
      const [hour,minute]=startTimeInput.value.split(':').map(Number);
      endTimeInput.value=String((hour+1)%24).padStart(2,'0')+':'+String(minute).padStart(2,'0');
      // 日付をまたぐ場合は、終了時刻が開始より前にならないよう翌日へ。
      if(startDateInput.value&&(hour===23||endDateInput.value===shiftDate(startDateInput.value,1)))endDateInput.value=hour===23?shiftDate(startDateInput.value,1):startDateInput.value;
    };
    dialog.querySelector('[data-cancel]').onclick=()=>refresh();
    dialog.querySelector('form').onsubmit=ev=>{
      ev.preventDefault();const entry=Object.fromEntries(new FormData(ev.target));
      entry.title=entry.site.trim()+'：'+entry.title.trim();delete entry.site;
      if(entry.title.length>80){dialog.querySelector('[data-error]').textContent='現場名と予定名は合わせて80文字以内にしてください。';return;}
      if(entry.endDate<entry.startDate||(entry.startTime&&!entry.endTime)||(!entry.startTime&&entry.endTime)||(entry.startDate===entry.endDate&&entry.startTime&&entry.endTime<=entry.startTime)){
        dialog.querySelector('[data-error]').textContent='日付・開始時刻・終了時刻の順序を確認してください。';return;
      }
      send({action:'calendarSave',entry:{...entry,id:event?.id||'',version:event?.version||0}},'予定の保存');
    };
    const remove=dialog.querySelector('[data-delete]');
    if(remove)remove.onclick=()=>{if(confirm('この予定を削除しますか？'))send({action:'calendarDelete',id:event.id,version:event.version},'予定の削除');};
  }
  function send(payload,label){
    const auth=identity();dialog.close();adapter.notify(label+'を送信中です。');
    Promise.resolve().then(()=>adapter.request({...payload,...auth})).then(result=>{
      if(!result.ok)throw Error(result.error||'保存できません');
      adapter.notify(label+'が完了しました。');
    }).catch(error=>{adapter.notify(label+'に失敗しました：'+error.message);alert(label+'に失敗しました。カレンダーを開き直して確認してください。\n'+error.message);});
  }
  return {open(){events=[];dialog.showModal();refresh();}};
};
