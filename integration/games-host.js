window.KintaiGames=(()=>{
 let gameWindow=null,identity=null,ids=[],gameOrigin=null,session=0,channel=null;
 function validMember(){const r=readDeviceRegistration();return !!identity&&r?.name===identity.name&&r.deviceToken===identity.deviceToken&&data.employees.includes(identity.name);}
 async function receive(m,send){
  if(!validMember())return;
  if(m?.type==='games-ready'){send({type:'games-context',name:identity.name,authorized:true,shared:!!API,standalone:window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true});return;}
  if(m?.type==='games-return'){window.focus();send({type:'games-returned'});return;}
  if(m?.type!=='games-request'||!Number.isSafeInteger(m.id)||!ids.includes(m.payload?.gameId)||!['mathGameRanking','saveMathGameScore'].includes(m.payload.action))return;
  if(m.payload.action==='saveMathGameScore'&&(!Number.isInteger(m.payload.score)||m.payload.score<0||m.payload.score>100000))return;
  const current=session;let result;
  try{result=API?await callShared({action:m.payload.action,gameId:m.payload.gameId,score:m.payload.score,...identity}):{ok:false,error:'共有先が未設定です'};}catch{result={ok:false,error:'通信できませんでした'};}
  if(current===session)send({type:'games-response',id:m.id,result});
 }
 window.addEventListener('message',event=>{
  if(!gameWindow||gameWindow.closed||event.source!==gameWindow||event.origin!==gameOrigin)return;
  const target=gameWindow;receive(event.data,m=>{if(!target.closed)target.postMessage(m,gameOrigin==='null'?'*':gameOrigin)});
 });
 async function open(config){
  const name=document.getElementById('employee').value,r=readDeviceRegistration();
  if(!r?.deviceToken||r.name!==name||!data.employees.includes(name)){alert('登録済みの本人端末から利用してください。勤怠アプリで端末を登録してください。');return;}
  if(gameWindow&&!gameWindow.closed){gameWindow.focus();return;}
  gameWindow=window.open('about:blank','_blank');
  if(!gameWindow){alert('ゲームを開くため、このアプリのポップアップを許可してください。');return;}
  const target=gameWindow;session++;ids=config.gameIds||[];channel?.close();channel=null;
  try{
   const url=new URL(config.url,location.href);if(!['https:','http:','file:'].includes(url.protocol))throw Error('URL');
   identity={name:r.name,deviceToken:r.deviceToken};gameOrigin=url.origin;
   const linkId=crypto.randomUUID();url.searchParams.set('attendanceSession',linkId);
   if(url.origin===location.origin&&typeof BroadcastChannel!=='undefined'){channel=new BroadcastChannel('kintai-games-'+linkId);const active=channel;channel.onmessage=e=>{if(channel===active)receive(e.data,m=>active.postMessage(m))};}
   url.searchParams.set('v',config.version||'1');url.searchParams.set('fromAttendance','1');
   const attendanceUrl=new URL(location.href);attendanceUrl.search='';attendanceUrl.hash='';url.searchParams.set('attendanceUrl',attendanceUrl.href);
   target.location.href=url.href;
  }catch(error){target.close();identity=null;channel?.close();channel=null;throw error;}
 }
 return {open};
})();