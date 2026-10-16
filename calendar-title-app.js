/* Administrator-only entry point. The host supplies its existing identity and transport. */
window.installCalendarTitleAdmin=function(adapter){
 function install(buttonId,{kind='title',read='calendarTitlesRead',save='calendarTitlesSave',onSaved=adapter.onSaved}={}){
  const button=document.getElementById(buttonId);if(!button)return;
  const label=kind==='site'?'現場名':'予定名',dialog=document.createElement('dialog');
  dialog.className='shared-calendar-dialog';dialog.style.cssText='width:min(92vw,540px);max-height:90dvh;overflow:auto';document.body.append(dialog);
  let password='',name='',generation=0;
  dialog.addEventListener('close',()=>{password='';name='';generation++;dialog.replaceChildren();});
  button.onclick=()=>{
    if(!adapter.ready()||!adapter.isAdmin())return;
    name=adapter.name();const serial=++generation;password='';
    dialog.innerHTML='<div class="modal"><div class="modal-actions" style="margin-top:0"><button class="secondary" type="button" data-title-close>閉じる</button></div><h2>'+label+'管理</h2><div data-title-content><p class="hint">管理者暗証番号で確認してから、'+label+'の選択肢を変更できます。</p><form data-title-login><label class="field">管理者暗証番号<input type="password" autocomplete="off" required data-title-password></label><button class="primary" type="submit">管理画面を開く</button><p role="status" aria-live="polite" data-title-login-status></p></form></div></div>';
    dialog.querySelector('[data-title-close]').onclick=()=>dialog.close();dialog.showModal();
    const form=dialog.querySelector('[data-title-login]'),status=dialog.querySelector('[data-title-login-status]');
    const request=payload=>adapter.request({...payload,name,adminName:name,pin:password,deviceToken:''});
    form.onsubmit=async event=>{
      event.preventDefault();const submit=form.querySelector('button');if(submit.disabled)return;
      password=form.querySelector('input').value;form.querySelector('input').value='';submit.disabled=true;status.textContent='管理者を確認中…';
      try{
        const result=await request({action:read});if(!dialog.open||serial!==generation)return;
        if(!result?.ok)throw Error(result?.error||'管理者の確認ができませんでした');
        const host=dialog.querySelector('[data-title-content]');let firstResult=result;
        createCalendarTitleEditor(host,{load:()=>{if(firstResult){const value=firstResult;firstResult=null;return Promise.resolve(value);}return request({action:read});},save:payload=>{if(!dialog.open||serial!==generation||!adapter.isAdmin()||adapter.name()!==name)return Promise.reject(Error('管理画面を開き直してください'));return request({action:save,...payload});},onSaved:value=>onSaved?.(value)},{kind});
      }catch(error){if(dialog.open&&serial===generation){password='';status.textContent=error.message;submit.disabled=false;}}
    };
  };
 }
 install('calendarTitleAdminOpen');
 install('calendarSiteAdminOpen',{kind:'site',read:'calendarSitesRead',save:'calendarSitesSave',onSaved:adapter.onSitesSaved});
};
