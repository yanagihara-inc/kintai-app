window.KintaiGames=(()=>{
 let gameWindow=null,identity=null,ids=[],gameOrigin=null,session=0;
 window.addEventListener('message',async event=>{
  if(!gameWindow||gameWindow.closed||event.source!==gameWindow||event.origin!==gameOrigin||!identity)return;
  const m=event.data;
  if(m?.type==='games-ready'){gameWindow.postMessage({type:'games-context',name:identity.name,authorized:true,shared:!!API&&!!identity.deviceToken},gameOrigin==='null'?'*':gameOrigin);return;}
  if(m?.type!=='games-request'||!Number.isSafeInteger(m.id)||!ids.includes(m.payload?.gameId)||!['mathGameRanking','saveMathGameScore'].includes(m.payload.action))return;
  if(m.payload.action==='saveMathGameScore'&&(!Number.isInteger(m.payload.score)||m.payload.score<0||m.payload.score>100000))return;
  const target=gameWindow,current=session;let result;
  try{result=API&&identity.deviceToken?await callShared({action:m.payload.action,gameId:m.payload.gameId,score:m.payload.score,...identity}):{ok:false,error:'共有先が未設定です'};}catch{result={ok:false,error:'通信できませんでした'};}
  if(current===session&&!target.closed&&target===gameWindow)target.postMessage({type:'games-response',id:m.id,result},gameOrigin==='null'?'*':gameOrigin);
 });
 async function open(config){
  const name=document.getElementById('employee').value;const r=readDeviceRegistration();
  if(!r?.deviceToken||r.name!==name||!data.employees.includes(name)){alert('登録済みの本人端末から利用してください。勤怠アプリで端末を登録してください。');return;}

  if(gameWindow&&!gameWindow.closed){gameWindow.focus();return;}
  gameWindow=window.open('about:blank','_blank');
  if(!gameWindow){alert('ゲームを開くため、このアプリのポップアップを許可してください。');return;}
  const target=gameWindow;identity=null;session++;ids=config.gameIds||[];
  let who={name:'おためし',deviceToken:''};
  try{
   who={name:r.name,deviceToken:r.deviceToken};
   const url=new URL(config.url,location.href);if(!['https:','http:','file:'].includes(url.protocol))throw Error('URL');
   url.searchParams.set('v',config.version||'1');url.searchParams.set('fromAttendance','1');
   identity=who;gameOrigin=url.origin;target.location.href=url.href;
  }catch(error){target.close();identity=null;throw error;}
 }
 return {open};
})();
