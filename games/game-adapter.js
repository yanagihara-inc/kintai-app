// ゲーム専用Apps Scriptへ直接通信。勤怠のウィンドウには依存しません。
const gameSettings=window.PASTIME_CONFIG||{},API=gameSettings.apiUrl||'';
const nameInput=document.getElementById('employee'),connectionLabel=document.getElementById('connectionLabel');
const GAME_SESSION_KEY='pastime-game-session-v2',GAME_TICKET_KEY='pastime-game-launch-v2';
let gameSession=null,sessionError='',requestSequence=0;
nameInput.disabled=true;nameInput.value='';
function gameJsonp(payload){return new Promise(resolve=>{
 if(!API)return resolve({ok:false,error:'ゲーム専用の公開URLが未設定です。game-config.jsを設定してください。'});
 const callback='pastimeReply_'+Date.now()+'_'+(++requestSequence),script=document.createElement('script');let done=false;
 const finish=result=>{if(done)return;done=true;clearTimeout(timer);delete window[callback];script.remove();resolve(result)};
 const timer=setTimeout(()=>finish({ok:false,error:'ゲーム専用サーバーから応答がありません。公開URL・アクセス設定・通信を確認してください。'}),45000);
 window[callback]=finish;script.referrerPolicy='no-referrer';script.onerror=()=>finish({ok:false,error:'ゲーム専用サーバーへ接続できませんでした。'});
 script.onload=()=>{if(!done)finish({ok:false,error:'ゲーム専用サーバーが応答を返しませんでした。GameService.gsのデプロイを確認してください。'})};
 script.src=API+'?payload='+encodeURIComponent(JSON.stringify(payload))+'&callback='+callback;document.head.append(script);
});}
const gameReady=(async()=>{
 try{
  let ticket=new URLSearchParams(location.hash.slice(1)).get('ticket');
  if(ticket){sessionStorage.setItem(GAME_TICKET_KEY,ticket);history.replaceState(null,'',location.pathname+location.search);gameSession=null;sessionStorage.removeItem(GAME_SESSION_KEY);}
  else{try{gameSession=JSON.parse(sessionStorage.getItem(GAME_SESSION_KEY)||'null')}catch{}ticket=sessionStorage.getItem(GAME_TICKET_KEY);}
  if(gameSession?.name)nameInput.value=gameSession.name;
  connectionLabel.textContent='ゲーム専用サーバーでユーザーを確認中…';
  let result;
  if(ticket){result=await gameJsonp({action:'exchangeLaunch',ticket});}
  else if(gameSession?.token){result=await gameJsonp({action:'gameSession',sessionToken:gameSession.token});}
  else throw new Error('勤怠アプリの「暇つぶし」から起動してください。');
  if(!result.ok)throw new Error(result.error||'ゲームのユーザー確認に失敗しました');
  gameSession={name:result.name,token:result.sessionToken||gameSession?.token,expiresAt:result.expiresAt};
  if(!gameSession.token)throw new Error('ゲーム専用の認証情報を取得できませんでした');
  sessionStorage.setItem(GAME_SESSION_KEY,JSON.stringify(gameSession));sessionStorage.removeItem(GAME_TICKET_KEY);
  nameInput.value=gameSession.name;connectionLabel.textContent='ゲーム専用サーバーに接続・登録メンバーの共有ランキング';return true;
 }catch(error){gameSession=null;sessionError=error.message;connectionLabel.textContent=sessionError;return false;}
})();
async function verifyPunchIdentity(){if(await gameReady)return true;alert(sessionError);return false;}
function readDeviceRegistration(){return gameSession?{name:gameSession.name,deviceToken:''}:null;}
async function callShared(payload){if(!await gameReady)return {ok:false,error:sessionError};return gameJsonp({action:payload.action,gameId:payload.gameId,score:payload.score,sessionToken:gameSession.token});}
function returnToAttendance(){
 const params=new URLSearchParams(location.search);
 if(params.get('attendanceApp')==='1'){
  const dialog=document.createElement('dialog');dialog.style.cssText='max-width:360px;width:90%;border:0;border-radius:16px;padding:24px;color:#214965;font:16px system-ui';
  const message=document.createElement('p');message.textContent='勤怠アプリへ戻るには、ホーム画面の「らくらく勤怠」をタップしてください。ゲーム画面は閉じずに残ります。';
  const button=document.createElement('button');button.textContent='わかった';button.onclick=()=>{dialog.close();dialog.remove()};dialog.append(message,button);document.body.append(dialog);dialog.showModal();return;
 }
 const saved=params.get('attendanceUrl');try{const url=new URL(saved);if(['https:','http:','file:'].includes(url.protocol)&&!url.username&&!url.password){const button=document.getElementById('attendanceReturn');if(button){button.disabled=true;button.textContent='勤怠へ移動中…';}connectionLabel.textContent='勤怠へ切り替えています…';setTimeout(()=>location.assign(url.href),100);return;}}catch{}
 alert('ホーム画面の勤怠アプリを開いてください。');
}
