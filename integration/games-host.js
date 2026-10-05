// 勤怠は起動窓口のみ。ランキングの要求・応答は扱いません。
window.KintaiGames=(()=>{
 let opening=false,prepared=null;
 function currentMember(){
  try{const r=readDeviceRegistration(),name=document.getElementById('employee')?.value;
   return r?.deviceToken&&r.name===name&&data.employees.includes(name)?r:null;
  }catch{return null;}
 }
 function prepareLaunch(){
  const r=currentMember();if(!r||!API||!window.KINTAI_GAMES?.enabled)return null;
  if(prepared?.name===r.name&&prepared.deviceToken===r.deviceToken&&prepared.until>Date.now())return prepared.promise;
  const entry={name:r.name,deviceToken:r.deviceToken,until:Date.now()+240000,promise:null};
  entry.promise=(async()=>{
   let timer;try{
    const result=await Promise.race([callShared({action:'issueGameLaunch',name:r.name,deviceToken:r.deviceToken}),new Promise(resolve=>{timer=setTimeout(()=>resolve({ok:false,error:'ユーザー連携の応答がありません。もう一度お試しください。'}),45000)})]);
    if(!result.ok||typeof result.ticket!=='string'){if(prepared===entry)prepared=null;return result;}
    return result;
   }catch(error){if(prepared===entry)prepared=null;return {ok:false,error:error.message};}finally{clearTimeout(timer);}
  })();prepared=entry;return entry.promise;
 }
 // 勤怠の読み込み後に一度だけ準備。定期的なサーバー通信はしません。
 let readinessChecks=0;
 function warmWhenReady(){
  if(document.visibilityState!=='hidden'&&currentMember()&&!document.getElementById('gamesOpen')?.disabled){prepareLaunch();return;}
  if(++readinessChecks<60)setTimeout(warmWhenReady,1000);
 }
 setTimeout(warmWhenReady,1500);
 try{const config=window.KINTAI_GAMES;if(config?.enabled){const page=new URL(config.url,location.href);if(['http:','https:'].includes(page.protocol)){for(const file of [null,'game-config.js','game-adapter.js','math-ranking.js']){const link=document.createElement('link');link.rel='prefetch';link.href=file?new URL(file,page).href:page.href;document.head.append(link);}}}}catch{}


 async function open(config){
  if(opening)return;
  const name=document.getElementById('employee').value,r=readDeviceRegistration();
  if(!r?.deviceToken||r.name!==name||!data.employees.includes(name)){alert('登録済み本人端末から利用してください');return;}
  if(!API){alert('勤怠の公開接続先が未設定です');return;}
  const target=window.open('about:blank','_blank');if(!target){alert('ゲームを開くためポップアップを許可してください');return;}
  opening=true;
  const button=document.getElementById('gamesOpen'),oldLabel=button?.textContent;
  const status=document.createElement('div');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='外部アプリに切替中';status.style.cssText='position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:24px;background:#eef6fff2;color:#214965;font:700 clamp(28px,7vw,40px)/1.6 system-ui;text-align:center';document.body.append(status);if(button)button.textContent='外部アプリに切替中';
  try{
   const viewport=target.document.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';target.document.head.append(viewport);
   target.document.body.style.cssText='margin:0;min-height:100vh;display:grid;place-items:center;background:#eef6ff;color:#214965;font:700 clamp(28px,7vw,40px)/1.6 system-ui;text-align:center';target.document.body.textContent='外部アプリに切替中';
   const pending=prepareLaunch();if(!pending)throw new Error('登録済み本人端末から利用してください');const result=await pending;prepared=null;
   const current=currentMember();if(!current||current.name!==r.name||current.deviceToken!==r.deviceToken)throw new Error('利用者が変更されました。開き直してください');
   if(!result.ok||typeof result.ticket!=='string')throw new Error(result.error||'勤怠側にGameIdentity.gsを追加して再デプロイしてください');
   const url=new URL(config.url,location.href);if(!['https:','http:','file:'].includes(url.protocol))throw new Error('ゲームURLを確認してください');
   url.searchParams.set('v',config.version||'1');
   url.searchParams.set('attendanceApp',(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true)?'1':'0');
   const back=new URL(location.href);back.search='';back.hash='';url.searchParams.set('attendanceUrl',back.href);
   // 一時チケットはURLフラグメントへ。勤怠用トークンは渡しません。
   url.hash=new URLSearchParams({ticket:result.ticket}).toString();
   status.textContent='外部アプリに切替中';target.document.body.textContent='外部アプリに切替中';target.opener=null;target.location.replace(url.href);
   setTimeout(()=>window.close(),500);
  }catch(error){target.close();alert(error.message||'ゲームを起動できませんでした');}finally{opening=false;status.remove();if(button)button.textContent=oldLabel;}
 }
 return {open};
})();

