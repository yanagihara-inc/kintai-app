// ゲーム側は勤怠の記録・PIN・端末トークンを受け取りません。
const attendanceLaunch=new URLSearchParams(location.search).get('fromAttendance')==='1'&&!!window.opener;const bridgeWindow=attendanceLaunch?window.opener:(window.parent!==window?window.parent:null);const embedded=!!bridgeWindow;let API=embedded?'': 'local',playerName='',memberAuthorized=false,sequence=0;const waiting=new Map();
const nameInput=document.getElementById('employee');
if(embedded){nameInput.disabled=true;document.getElementById('connectionLabel').textContent='勤怠との接続を確認中…';window.addEventListener('message',e=>{if(e.source!==bridgeWindow)return;const m=e.data;if(m?.type==='games-context'){memberAuthorized=m.authorized===true;playerName=memberAuthorized?m.name:'';nameInput.value=playerName;API=m.shared?'bridge':'local';document.getElementById('connectionLabel').textContent=m.shared?'登録メンバーの共有ランキング':'登録メンバー専用・ランキングはこの端末に保存'}if(m?.type==='games-response'&&waiting.has(m.id)){const pending=waiting.get(m.id);clearTimeout(pending.timer);waiting.delete(m.id);pending.resolve(m.result)}});bridgeWindow.postMessage({type:'games-ready'},'*');}
async function verifyPunchIdentity(){if(embedded&&memberAuthorized&&playerName)return true;alert('勤怠アプリの登録済み本人端末から「暇つぶし」を開いてください。');return false;}
function readDeviceRegistration(){const name=embedded?playerName:nameInput.value.trim().slice(0,30);if(!name){alert('プレイヤー名を入力してください');return null}return {name,deviceToken:''}}
async function callShared(payload){
  if(embedded&&API==='bridge')return new Promise(resolve=>{const id=++sequence;const timer=setTimeout(()=>{waiting.delete(id);resolve({ok:false,error:'通信がタイムアウトしました'})},24000);waiting.set(id,{resolve,timer});bridgeWindow.postMessage({type:'games-request',id,payload:{action:payload.action,gameId:payload.gameId,score:payload.score}},'*')});
  try{const key='pastime-standalone-rankings-v1',all=JSON.parse(localStorage.getItem(key)||'{}'),rows=all[payload.gameId]||[];
    if(payload.action==='saveMathGameScore'){const row=rows.find(r=>r.name===payload.name);if(row)row.score=Math.max(row.score,payload.score);else rows.push({name:payload.name,score:payload.score});all[payload.gameId]=rows;localStorage.setItem(key,JSON.stringify(all));}
    rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ja'));let rank=0;const ranking=rows.map((r,i)=>{if(i===0||r.score!==rows[i-1].score)rank=i+1;return {...r,rank}});return {ok:true,ranking};
  }catch{return {ok:false,error:'このブラウザではランキングを保存できません。'}}
}
