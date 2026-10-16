// Code.gs と同じApps Scriptプロジェクトに追加する共有カレンダー用コード。
const CALENDAR_HEADERS=['予定ID','予定名','開始日','終了日','開始時刻','終了時刻','内容','登録者','作成日時','更新日時','削除済','版'];
function calendarDate_(value){
  const text=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))throw Error('日付を確認してください');
  const date=new Date(text+'T00:00:00+09:00');
  if(isNaN(date.getTime())||Utilities.formatDate(date,'Asia/Tokyo','yyyy-MM-dd')!==text)throw Error('存在する日付を指定してください');
  return text;
}
function calendarEntry_(row){
  return {id:String(row[0]),title:String(row[1]),startDate:formatDate_(row[2]),endDate:formatDate_(row[3]),startTime:String(row[4]||''),endTime:String(row[5]||''),note:String(row[6]||''),owner:String(row[7]),version:Number(row[11])||1};
}
function calendarAction_(input){
  const book=SpreadsheetApp.getActive(),name=String(input.name||'');
  const members=ensureSheet_(book,MEMBER_SHEET,['氏名','有効','個人PINハッシュ']).getDataRange().getValues().slice(1);
  if(!members.some(row=>String(row[0])===name&&row[1]!==false)||!verifyDeviceToken_(book,name,String(input.deviceToken||'')))throw Error('有効な本人端末でログインしてください');
  const lock=LockService.getScriptLock();
  if(input.action!=='calendarRead')lock.waitLock(20000);
  try{
    const sheet=ensureSheet_(book,'共有カレンダー',CALENDAR_HEADERS),rows=sheet.getDataRange().getValues();
    if(input.action==='calendarRead'){
      const allEvents=rows.slice(1).filter(row=>row[0]&&row[10]!==true).map(calendarEntry_);
      const readMonth=(month,knownRevision)=>{
      month=String(month||'');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('表示月を確認してください');
      const start=month+'-01',end=month+'-31';
      const events=allEvents.filter(e=>e.startDate<=end&&e.endDate>=start).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.startTime.localeCompare(b.startTime));
      // 内容から判定するため、シートで直接編集した変更も検出する。
      const revision=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(events),Utilities.Charset.UTF_8));
      if(String(knownRevision||'')===revision)return {ok:true,notModified:true,revision};
      return {ok:true,events,revision};
      };
      if(Array.isArray(input.months)){
        if(input.months.length<1||input.months.length>3)throw Error('取得月は3か月以内にしてください');
        const months={};input.months.forEach(month=>months[month]=readMonth(month,(input.knownRevisions||{})[month]));
        return {ok:true,months,calendarTitleChoices:scheduleTitleState_(book)};
      }
      return Object.assign(readMonth(input.month,input.knownRevision),{calendarTitleChoices:scheduleTitleState_(book)});
    }
    const entry=input.entry||{},id=String(input.id||entry.id||''),index=id?rows.findIndex((row,i)=>i>0&&String(row[0])===id&&row[10]!==true):-1;
    if(id&&index<1)throw Error('予定が見つかりません。カレンダーを再読み込みしてください');
    if(index>0){
      if(String(rows[index][7])!==name&&!isAdmin_(name))throw Error('変更・削除は登録した本人と管理者だけです');
      if(Number(input.version||entry.version)!==(Number(rows[index][11])||1))throw Error('ほかの操作で更新されています。再読み込みしてください');
    }
    if(input.action==='calendarDelete'){
      if(index<1)throw Error('削除する予定を指定してください');
      sheet.getRange(index+1,10,1,3).setValues([[new Date(),true,(Number(rows[index][11])||1)+1]]);
      audit_(book,'共有予定削除',id,name,JSON.stringify(calendarEntry_(rows[index])),'削除済');return {ok:true};
    }
    if(input.action!=='calendarSave')throw Error('予定の操作を確認してください');
    const title=String(entry.title||'').trim(),note=String(entry.note||''),startDate=calendarDate_(entry.startDate),endDate=calendarDate_(entry.endDate),startTime=String(entry.startTime||''),endTime=String(entry.endTime||'');
    if(!title||title.length>80||note.length>1000||endDate<startDate)throw Error('予定名・日付・内容を確認してください');
    const time=/^([01]\d|2[0-3]):[0-5]\d$/;
    if((startTime||endTime)&&(!time.test(startTime)||!time.test(endTime)||(startDate===endDate&&endTime<=startTime)))throw Error('開始・終了時刻を確認してください');
    const eventId=id||Utilities.getUuid(),owner=index>0?String(rows[index][7]):name,version=index>0?(Number(rows[index][11])||1)+1:1;
    const saved=[eventId,title,startDate,endDate,startTime,endTime,note,owner,index>0?rows[index][8]:new Date(),new Date(),false,version];
    if(index>0)sheet.getRange(index+1,1,1,12).setValues([saved]);else sheet.appendRow(saved);
    audit_(book,index>0?'共有予定変更':'共有予定追加',eventId,name,index>0?JSON.stringify(calendarEntry_(rows[index])):'',JSON.stringify(calendarEntry_(saved)));
    return {ok:true,event:calendarEntry_(saved)};
  }finally{if(input.action!=='calendarRead')lock.releaseLock();}
}
