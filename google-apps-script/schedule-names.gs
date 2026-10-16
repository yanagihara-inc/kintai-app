// A:B are attendance sites. D:E are an independent list of calendar work names.
function initializeScheduleNames(){
 const sheet=ensureSheet_(SpreadsheetApp.getActive(),SITE_SHEET,['現場名','有効']);
 if(sheet.getMaxColumns()<5)sheet.insertColumnsAfter(sheet.getMaxColumns(),5-sheet.getMaxColumns());
 const current=sheet.getRange(1,4,Math.max(1,sheet.getLastRow()),2).getValues();
 if(String(current[0][0]||'')==='予定名'&&String(current[0][1]||'')==='予定名の有効'){touchConfigVersion_();return;}
 if(current.some(row=>row.some(value=>value!=='')))throw Error('現場シートのD:E列に既存の内容があります。上書きせず停止しました。');
 if(sheet.getMaxRows()<5)sheet.insertRowsAfter(sheet.getMaxRows(),5-sheet.getMaxRows());
 sheet.getRange(2,5,sheet.getMaxRows()-1,1).insertCheckboxes();
 sheet.getRange(1,4,5,2).setValues([['予定名','予定名の有効'],['建込',true],['コン打ち',true],['解体',true],['運搬',true]]);
 sheet.getRange('D1:E1').setFontWeight('bold').setBackground('#e7f4ef');sheet.setColumnWidth(4,160);
 sheet.getRange('D1').setNote('カレンダーの予定名の候補。現場名とは独立した一覧です。追加・変更後はアプリを開き直してください。');touchConfigVersion_();
}
function readScheduleNames_(book){
 const sheet=ensureSheet_(book,SITE_SHEET,['現場名','有効']);
 if(sheet.getLastColumn()<5||String(sheet.getRange(1,4).getValue())!=='予定名')return ['建込','コン打ち','解体','運搬'];
 if(sheet.getLastRow()<2)return [];
 return [...new Set(sheet.getRange(2,4,sheet.getLastRow()-1,2).getValues().filter(row=>String(row[0]).trim()&&row[1]!==false&&String(row[1]).toLowerCase()!=='false').map(row=>String(row[0]).trim()))];
}
function replaceSiteRows_(sheet,rows){
 // Summary editing must never clear the independent schedule-name columns.
 const oldRows=Math.max(0,sheet.getLastRow()-1);
 if(oldRows)sheet.getRange(2,1,oldRows,2).clearContent();
 if(rows.length)sheet.getRange(2,1,rows.length,2).setValues(rows);
}

// The administrator screen and the spreadsheet share the same D:E choices.
function scheduleTitleState_(book){
 const titles=readScheduleNames_(book);
 const revision=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(titles),Utilities.Charset.UTF_8));
 return {titles,revision};
}
function validateScheduleTitles_(values){
 if(!Array.isArray(values)||values.length<1||values.length>50)throw Error('予定名は1〜50件登録してください');
 const titles=values.map(value=>{if(typeof value!=='string')throw Error('予定名を確認してください');return value.trim();});
 if(titles.some(value=>!value||[...value].length>40||/[\u0000-\u001f\u007f]/.test(value)))throw Error('予定名は1〜40文字で入力してください');
 if(new Set(titles).size!==titles.length)throw Error('同じ予定名が重複しています');return titles;
}
function calendarTitlesAction_(input){
 const book=SpreadsheetApp.getActive(),name=String(input.name||''),adminName=String(input.adminName||name);
 const adminVerified=isAdmin_(adminName)&&!!String(input.pin||'')&&String(input.pin||'')===PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
 if(input.action==='calendarTitlesRead'){
  const members=ensureSheet_(book,MEMBER_SHEET,['氏名','有効','個人PINハッシュ']).getDataRange().getValues().slice(1);
  if(!adminVerified&&(!members.some(row=>String(row[0])===name&&row[1]!==false)||!verifyDeviceToken_(book,name,String(input.deviceToken||''))))throw Error('有効な本人端末でログインしてください');
  return Object.assign({ok:true},scheduleTitleState_(book));
 }
 if(!adminVerified)throw Error('管理者名または暗証番号が違います');
 const titles=validateScheduleTitles_(input.titles),lock=LockService.getScriptLock();lock.waitLock(20000);
 try{
  const before=scheduleTitleState_(book);if(typeof input.revision!=='string'||input.revision!==before.revision)throw Error('ほかの操作で予定名が変更されました。再読み込みして確認してください');
  initializeScheduleNames();
  const sheet=ensureSheet_(book,SITE_SHEET,['現場名','有効']);
  const required=titles.length+1;if(sheet.getMaxRows()<required)sheet.insertRowsAfter(sheet.getMaxRows(),required-sheet.getMaxRows());
  const rows=Math.max(sheet.getLastRow()-1,titles.length);
  // Only the independent schedule columns are replaced; sites and events stay intact.
  sheet.getRange(2,4,rows,2).clearContent();sheet.getRange(2,5,rows,1).insertCheckboxes();
  sheet.getRange(2,4,titles.length,2).setValues(titles.map(title=>[title,true]));
  touchConfigVersion_();audit_(book,'予定名の選択肢変更','',adminName,JSON.stringify(before.titles),JSON.stringify(titles));
  return Object.assign({ok:true},scheduleTitleState_(book));
 }finally{lock.releaseLock();}
}
