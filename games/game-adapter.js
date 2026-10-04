// メンバー名のみ一時保持。本人確認は起動元の勤怠で再確認します。
const launchParams=new URLSearchParams(location.search),attendanceLaunch=launchParams.get('fromAttendance')==='1';
const bridgeWindow=attendanceLaunch?window.opener:(window.parent!==window?window.parent:null),embedded=attendanceLaunch||!!bridgeWindow;
let API=embedded?'bridge':'local',playerName='',memberAuthorized=false,sequence=0,attendanceStandalone=false,transport='';
const waiting=new Map(),nameInput=document.getElementById('employee'),label=document.getElementById('connectionLabel');
const sessionId=launchParams.get('attendanceSession'),sessionKey='kintai-game-player-'+(sessionId||'legacy');
let channel=null,readyTimer,connectionTimer;const connectionWaiters=[];
if(embedded){
 nameInput.disabled=true;nameInput.value='';
 try{playerName=sessionStorage.getItem(sessionKey)||'';nameInput.value=playerName}catch{}
 label.textContent='勤怠アプリとの接続を確認中…';
 if(sessionId&&/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)&&typeof BroadcastChannel!=='undefined'){channel=new BroadcastChannel('kintai-games-'+sessionId);channel.onmessage=e=>receive(e.data,'channel');}
 window.addEventListener('message',e=>{if(e.source!==bridgeWindow)return;const saved=launchParams.get('attendanceUrl');if(saved){try{if(e.origin!==new URL(saved).origin)return}catch{return}}receive(e.data,'opener')});
 readyTimer=setInterval(connect,700);connectionTimer=setTimeout(()=>{clearInterval(readyTimer);if(!memberAuthorized)label.textContent='勤怠との接続が切れています。勤怠アプリから開き直してください。';for(const resolve of connectionWaiters.splice(0))resolve(false)},8000);connect();
}else{ nameInput.disabled=true;nameInput.value='';label.textContent='勤怠アプリの「暇つぶし」から起動してください';}
function receive(m,via){
 if(m?.type==='games-context'&&m.authorized===true&&typeof m.name==='string'&&m.name){transport=via;memberAuthorized=true;playerName=m.name;nameInput.value=playerName;attendanceStandalone=!!m.standalone;API=m.shared?'bridge':'local';try{sessionStorage.setItem(sessionKey,playerName)}catch{}clearInterval(readyTimer);clearTimeout(connectionTimer);label.textContent=m.shared?'登録メンバーの共有ランキング':'登録メンバー専用・ランキングはこの端末に保存';for(const resolve of connectionWaiters.splice(0))resolve(true);}
 if(m?.type==='games-response'&&waiting.has(m.id)){const pending=waiting.get(m.id);clearTimeout(pending.timer);waiting.delete(m.id);pending.resolve(m.result)}
}
function connect(){if(bridgeWindow&&!bridgeWindow.closed)bridgeWindow.postMessage({type:'games-ready'},'*');channel?.postMessage({type:'games-ready'});}
function send(m){if(transport==='channel'&&channel){channel.postMessage(m);return true}if(bridgeWindow&&!bridgeWindow.closed){bridgeWindow.postMessage(m,'*');return true}return false}
async function verifyPunchIdentity(){if(embedded&&!memberAuthorized)await new Promise(resolve=>{connectionWaiters.push(resolve);const t=setTimeout(()=>{const i=connectionWaiters.indexOf(resolve);if(i>=0)connectionWaiters.splice(i,1);resolve(false)},8500);});if(embedded&&memberAuthorized&&playerName)return true;alert('勤怠アプリの登録済み本人端末から「暇つぶし」を開き直してください。');return false;}
function readDeviceRegistration(){return memberAuthorized&&playerName?{name:playerName,deviceToken:''}:null}
async function callShared(payload){
 if(!memberAuthorized)return {ok:false,error:'勤怠アプリとの接続を確認してください'};
 if(API==='bridge')return new Promise(resolve=>{const id=++sequence,timer=setTimeout(()=>{waiting.delete(id);resolve({ok:false,error:'ランキング通信がタイムアウトしました。勤怠アプリが開いているか、Apps Scriptが更新済みか確認してください。'})},24000);waiting.set(id,{resolve,timer});if(!send({type:'games-request',id,payload:{action:payload.action,gameId:payload.gameId,score:payload.score}})){clearTimeout(timer);waiting.delete(id);resolve({ok:false,error:'勤怠アプリとの接続が切れています。勤怠アプリから開き直してください。'})}});
 try{const key='pastime-standalone-rankings-v1',all=JSON.parse(localStorage.getItem(key)||'{}'),rows=all[payload.gameId]||[];if(payload.action==='saveMathGameScore'){const row=rows.find(r=>r.name===playerName);if(row)row.score=Math.max(row.score,payload.score);else rows.push({name:playerName,score:payload.score});all[payload.gameId]=rows;localStorage.setItem(key,JSON.stringify(all))}rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ja'));let rank=0;return {ok:true,ranking:rows.map((r,i)=>{if(i===0||r.score!==rows[i-1].score)rank=i+1;return {...r,rank}})}}catch{return {ok:false,error:'このブラウザではランキングを保存できません。'}}
}
function returnToAttendance(){
 send({type:'games-return'});
 if(bridgeWindow&&!bridgeWindow.closed){bridgeWindow.focus();window.close();setTimeout(()=>{label.textContent='勤怠アプリを開いてください。このゲーム画面は閉じて構いません。'},500);return;}
 if(attendanceStandalone||sessionId){window.close();label.textContent='ホーム画面の「勤怠」をタップして戻ってください。';alert('ホーム画面の「勤怠」をタップして戻ってください。ブラウザから起動済みアプリへの自動切り替えは、この端末ではできません。');return;}
 alert('ホーム画面の勤怠アプリから開き直してください。');
}
