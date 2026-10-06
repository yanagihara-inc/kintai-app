// ゲーム専用Apps Scriptへ直接通信。勤怠のウィンドウには依存しません。
const gameSettings=window.PASTIME_CONFIG||{},API=gameSettings.apiUrl||'';
const nameInput=document.getElementById('employee'),connectionLabel=document.getElementById('connectionLabel');
const GAME_SESSION_KEY='pastime-game-session-v2',GAME_TICKET_KEY='pastime-game-launch-v2';
const GAME_SAVED_SESSION_KEY='pastime-verified-session-v1:'+API;
function savedGameSession(){try{const s=JSON.parse(localStorage.getItem(GAME_SAVED_SESSION_KEY)||'null');return s?.name&&s.token&&Number(s.expiresAt)>Date.now()+60000?s:null;}catch{return null;}}
// チケットの氏名は保存済み許可との照合用。認証は必ずサーバーで行います。
function launchMember(ticket){try{const body=ticket.split('.')[0].replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes)).name;}catch{return null;}}
let gameSession=null,sessionError='',requestSequence=0;
const launchParams=new URLSearchParams(location.hash.slice(1));
let launchName=launchParams.get('player')||sessionStorage.getItem('pastime-player')||'';
nameInput.disabled=true;nameInput.value=launchName;
if(launchParams.get('channel'))sessionStorage.removeItem(GAME_TICKET_KEY);
if(launchName){sessionStorage.setItem('pastime-player',launchName);connectionLabel.textContent='ゲームを選んで遊べます';}
async function waitLaunchTicket(){const channel=launchParams.get('channel');if(!channel||!/^pastime-launch-[a-z0-9-]+$/.test(channel))return null;for(let i=0;i<90;i++){try{const value=JSON.parse(localStorage.getItem(channel)||'null');if(value){localStorage.removeItem(channel);if(value.name===launchName&&value.expiresAt>Date.now())return value.ticket;return null;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}return null;}
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
  let ticket=launchParams.get('ticket');
  if(!ticket&&launchName){const saved=savedGameSession();if(saved?.name===launchName)gameSession=saved;else ticket=await waitLaunchTicket();}
  if(ticket){sessionStorage.setItem(GAME_TICKET_KEY,ticket);history.replaceState(null,'',location.pathname+location.search);const saved=savedGameSession();gameSession=saved?.name===launchMember(ticket)?saved:null;sessionStorage.removeItem(GAME_SESSION_KEY);}
  else{if(!gameSession){try{gameSession=JSON.parse(sessionStorage.getItem(GAME_SESSION_KEY)||'null')}catch{}}if(launchName&&gameSession?.name!==launchName)gameSession=null;ticket=sessionStorage.getItem(GAME_TICKET_KEY);}
  if(gameSession?.name)nameInput.value=gameSession.name;
  connectionLabel.textContent=launchName?'ゲームを選んで遊べます（ランキング接続中）':'ゲーム専用サーバーでユーザーを確認中…';
  let result;
  if(ticket&&gameSession?.token){result=await gameJsonp({action:'gameSession',sessionToken:gameSession.token});if(!result.ok||result.name!==gameSession.name){gameSession=null;try{localStorage.removeItem(GAME_SAVED_SESSION_KEY)}catch{}result=await gameJsonp({action:'exchangeLaunch',ticket});}}
  else if(ticket){result=await gameJsonp({action:'exchangeLaunch',ticket});}
  else if(gameSession?.token){result=await gameJsonp({action:'gameSession',sessionToken:gameSession.token});}
  else throw new Error('勤怠アプリの「暇つぶし」から起動してください。');
  if(!result.ok)throw new Error(result.error||'ゲームのユーザー確認に失敗しました');
  gameSession={name:result.name,token:result.sessionToken||gameSession?.token,expiresAt:result.expiresAt};
  if(!gameSession.token)throw new Error('ゲーム専用の認証情報を取得できませんでした');
  sessionStorage.setItem(GAME_SESSION_KEY,JSON.stringify(gameSession));sessionStorage.removeItem(GAME_TICKET_KEY);
  try{localStorage.setItem(GAME_SAVED_SESSION_KEY,JSON.stringify(gameSession))}catch{}
  if(result.leaders)window.PASTIME_STARTUP_LEADERS=result.leaders;
  nameInput.value=gameSession.name;connectionLabel.textContent='ゲーム専用サーバーに接続・登録メンバーの共有ランキング';return true;
 }catch(error){gameSession=null;sessionError=error.message;connectionLabel.textContent=launchName?'ゲームは遊べます。共有ランキングは接続できませんでした。':sessionError;return false;}
})();
async function verifyPunchIdentity(){if(launchName)return true;if(await gameReady)return true;alert(sessionError);return false;}
function readDeviceRegistration(){return launchName?{name:launchName,deviceToken:''}:gameSession?{name:gameSession.name,deviceToken:''}:null;}
async function callShared(payload){if(!await gameReady)return {ok:false,error:sessionError};return gameJsonp({action:payload.action,gameId:payload.gameId,score:payload.score,sessionToken:gameSession.token});}
function exitGameApp(){
 const button=document.getElementById('gameExit');if(button){button.disabled=true;button.textContent='終了中…';}
 for(const id of ['mathGameDialog','mathRankingDialog']){const dialog=document.getElementById(id);if(dialog?.open)dialog.close();}
 const frame=document.getElementById('mathGameFrame');if(frame){frame.src='about:blank';frame.remove();}
 const main=document.querySelector('main');if(main)main.hidden=true;
 connectionLabel.textContent='暇つぶしアプリを終了しています…';
 setTimeout(()=>{connectionLabel.textContent='終了しました。この画面を閉じてください。';if(button){button.disabled=false;button.textContent='画面を閉じる';}},700);
 window.close();
}
