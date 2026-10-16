/* Administrator-only entry point. The host supplies its existing identity and transport. */
window.installCalendarTitleAdmin=function(adapter){
  const button=document.getElementById('calendarNameAdminOpen');if(!button)return;
  const dialog=document.createElement('dialog');
  dialog.className='shared-calendar-dialog name-admin-dialog';document.body.append(dialog);
  let password='',name='',generation=0;
  const allowed=()=>adapter.ready()&&adapter.isAdmin();
  const reset=()=>{password='';name='';generation++;};
  dialog.addEventListener('close',()=>{reset();dialog.replaceChildren();});
  function show(){
    dialog.querySelector('[data-title-close]').onclick=()=>dialog.close();
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;dialog.querySelector('h2').focus({preventScroll:true});
  }
  function menu(){
    if(!allowed())return;
    reset();
    dialog.innerHTML='<div class="modal"><div class="modal-actions name-admin-nav"><button class="secondary" type="button" data-title-close>閉じる</button></div><h2 tabindex="-1">現場管理</h2><p class="hint">変更する項目を選んでください。</p><div class="name-admin-choices"><button class="primary" type="button" data-name-site>現場名変更<span>勤怠・カレンダーで使う現場</span></button><button class="primary" type="button" data-name-title>予定名変更<span>建込・コン打ちなどの作業名</span></button></div></div>';
    dialog.querySelector('[data-name-site]').onclick=()=>edit('site');
    dialog.querySelector('[data-name-title]').onclick=()=>edit('title');show();
  }
  function edit(kind){
    if(!allowed())return;
    const site=kind==='site',label=site?'現場名':'予定名',read=site?'calendarSitesRead':'calendarTitlesRead',save=site?'calendarSitesSave':'calendarTitlesSave',onSaved=site?adapter.onSitesSaved:adapter.onSaved;
    reset();name=adapter.name();const serial=generation;
    dialog.innerHTML='<div class="modal"><div class="modal-actions name-admin-nav"><button class="secondary" type="button" data-name-back>現場管理へ戻る</button><button class="secondary" type="button" data-title-close>閉じる</button></div><h2 tabindex="-1">'+label+'変更</h2><div data-title-content><p class="hint">管理者暗証番号で確認してから、'+label+'の選択肢を変更できます。</p><form data-title-login><label class="field">管理者暗証番号<input type="password" autocomplete="off" required data-title-password></label><button class="primary" type="submit">管理画面を開く</button><p role="status" aria-live="polite" data-title-login-status></p></form></div></div>';
    dialog.querySelector('[data-name-back]').onclick=menu;show();
    const form=dialog.querySelector('[data-title-login]'),status=dialog.querySelector('[data-title-login-status]');
    const current=()=>dialog.open&&serial===generation&&allowed()&&adapter.name()===name;
    const request=payload=>{
      if(!current())return Promise.reject(Error('現場管理を開き直してください'));
      return adapter.request({...payload,name,adminName:name,pin:password,deviceToken:''});
    };
    form.onsubmit=async event=>{
      event.preventDefault();if(!current())return;
      const submit=form.querySelector('button');if(submit.disabled)return;
      password=form.querySelector('input').value;form.querySelector('input').value='';submit.disabled=true;status.textContent='管理者を確認中…';
      try{
        const result=await request({action:read});if(!current())return;
        if(!result?.ok)throw Error(result?.error||'管理者の確認ができませんでした');
        const host=dialog.querySelector('[data-title-content]');let firstResult=result;
        createCalendarTitleEditor(host,{load:()=>{if(!current())return Promise.reject(Error('現場管理を開き直してください'));if(firstResult){const value=firstResult;firstResult=null;return Promise.resolve(value);}return request({action:read});},save:payload=>request({action:save,...payload}),onSaved:value=>onSaved?.(value)},{kind});
      }catch(error){if(current()){password='';status.textContent=error.message;submit.disabled=false;}}
    };
  }
  button.onclick=menu;
};
