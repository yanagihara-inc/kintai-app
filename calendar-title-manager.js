/* Shared editor for administrator-managed calendar choices. */
(() => {
  'use strict';
  const defaults=['建込','コン打ち','解体','運搬'];
  function validate(values,{allowEmpty=false,label='予定名',maxLength=40,maxCount=50}={}){
    if(!Array.isArray(values)||values.length<(allowEmpty?0:1)||values.length>maxCount)throw Error(label+'は'+(allowEmpty?0:1)+'〜'+maxCount+'件登録してください。');
    const titles=values.map(value=>{if(typeof value!=='string')throw Error(label+'を確認してください。');return value.trim();});
    if(titles.some(value=>!value||[...value].length>maxLength||/[\u0000-\u001f\u007f]/.test(value)))throw Error(label+'は1〜'+maxLength+'文字で入力してください。');
    if(new Set(titles).size!==titles.length)throw Error('同じ'+label+'が重複しています。');
    return titles;
  }
  window.CalendarTitleChoices={defaults,validate};
  window.createCalendarTitleEditor=function(host,adapter,{kind='title'}={}){
    const site=kind==='site',label=site?'現場名':'予定名',maxLength=site?80:40,maxCount=site?200:50;
    const validateList=(values,options={})=>validate(values,{label,maxLength,maxCount,allowEmpty:site,...options});
    if(!document.getElementById('calendar-title-editor-style')){
      const style=document.createElement('style');style.id='calendar-title-editor-style';
      style.textContent='.calendar-title-manager{margin:20px 0;padding:16px;border:1px solid #bcd8d0;border-radius:12px;background:#f3faf7}.calendar-title-manager h3{margin:0 0 10px}.calendar-title-manager p{line-height:1.6}.calendar-title-manager .title-choice-row{display:flex;align-items:center;gap:8px;margin:8px 0}.calendar-title-manager .title-choice-row input{width:100%;min-width:0;flex:1;min-height:44px;padding:10px;font:inherit;box-sizing:border-box}.calendar-title-manager button{min-height:44px;padding:10px 14px;margin:4px 0;font:inherit}.calendar-title-manager .title-choice-row button{flex:none;background:#fff0f2;color:#9d2032}.calendar-title-manager .title-choice-actions{display:flex;flex-wrap:wrap;gap:10px}.calendar-title-manager [role=status]{font-weight:700;white-space:pre-wrap}.calendar-title-manager .title-choice-add{display:flex;gap:8px;align-items:end}.calendar-title-manager label{display:block;flex:1;min-width:0;margin:8px 0}.calendar-title-manager label input{display:block;width:100%;min-height:44px;padding:10px;font:inherit;box-sizing:border-box}';document.head.append(style);
    }
    host.classList.add('calendar-title-manager');
    host.innerHTML='<h3>'+label+'の管理</h3><p>'+(site?'勤怠とカレンダーで選べる現場を追加・変更・無効化できます。過去の打刻や予定の現場名は変わりません。無効化した現場もシートには履歴として残ります。':'カレンダーで選べる予定名を追加・変更・削除できます。登録済みの予定名は変わりません。')+'</p><p>1〜'+maxLength+'文字、最大'+maxCount+'件。変更後は「選択肢を保存」を押してください。</p><div data-title-rows></div><div class="title-choice-add"><label>追加する'+label+'<input data-title-new maxlength="'+maxLength+'" placeholder="'+(site?'例：〇〇邸':'例：資材整理')+'"></label><button type="button" data-title-add>追加</button></div><div class="title-choice-actions"><button type="button" class="primary" data-title-save>選択肢を保存</button><button type="button" class="secondary" data-title-reload>再読み込み</button></div><p role="status" aria-live="polite" data-title-status></p>';
    const rows=host.querySelector('[data-title-rows]'),status=host.querySelector('[data-title-status]'),newTitle=host.querySelector('[data-title-new]');
    let revision='',loaded=false,busy=false,dirty=false,generation=0;
    const values=()=>[...rows.querySelectorAll('input')].map(input=>input.value);
    function lock(active){busy=active;host.querySelectorAll('input,button').forEach(el=>el.disabled=active||(!loaded&&!el.matches('[data-title-reload]')));}
    function row(value){
      const div=document.createElement('div'),input=document.createElement('input'),remove=document.createElement('button');div.className='title-choice-row';input.value=value;input.maxLength=maxLength;input.setAttribute('aria-label',label);input.oninput=()=>dirty=true;remove.type='button';remove.textContent=site?'無効にする':'削除';remove.setAttribute('aria-label',value+'を選択肢から'+(site?'無効にする':'削除'));remove.onclick=()=>{div.remove();dirty=true;status.textContent='変更はまだ保存されていません。';};div.append(input,remove);rows.append(div);
    }
    async function reload(){
      if(busy)return;if(dirty&&!confirm('保存していない変更を破棄して、読み直しますか？'))return;
      const serial=++generation;lock(true);status.textContent=label+'を読み込み中…';
      try{const result=await adapter.load();if(serial!==generation)return;if(!result?.ok)throw Error(result?.error||label+'を読み込めません。');const titles=validateList(result.titles,{allowEmpty:true});if(typeof result.revision!=='string'||!result.revision)throw Error(label+'の管理機能がサーバーに反映されていません。');revision=result.revision;loaded=true;dirty=false;rows.replaceChildren();titles.forEach(row);status.textContent='登録中：'+titles.length+'件';}
      catch(error){status.textContent=error.message;}
      finally{if(serial===generation)lock(false);}
    }
    function add(){
      if(busy||!loaded)return;
      try{const list=validateList([...values(),newTitle.value]);row(list[list.length-1]);newTitle.value='';dirty=true;status.textContent='追加しました。「選択肢を保存」で全員に反映します。';newTitle.focus();}catch(error){status.textContent=error.message;}
    }
    host.querySelector('[data-title-add]').onclick=add;
    newTitle.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();add();}};
    host.querySelector('[data-title-reload]').onclick=reload;
    host.querySelector('[data-title-save]').onclick=async()=>{
      if(busy||!loaded)return;let titles;
      try{titles=validateList(values());if(newTitle.value.trim())throw Error('追加する'+label+'の「追加」を押してから保存してください。');}catch(error){status.textContent=error.message;return;}
      lock(true);status.textContent='選択肢を保存中…';
      try{const result=await adapter.save({titles,revision});if(!result?.ok)throw Error(result?.error||'保存できませんでした。');if(!result.revision)throw Error('保存結果を確認できません。再読み込みしてください。');const savedTitles=validateList(result.titles);revision=result.revision;dirty=false;rows.replaceChildren();savedTitles.forEach(row);adapter.onSaved?.(result);status.textContent=site?'保存しました。勤怠とカレンダーの現場名に反映されます。':'保存しました。カレンダーの予定名に反映されます。';}
      catch(error){status.textContent=error.message+'\n入力は残しています。再読み込みすると現在の登録内容を確認できます。';}
      finally{lock(false);}
    };
    reload();return {reload};
  };
})();
