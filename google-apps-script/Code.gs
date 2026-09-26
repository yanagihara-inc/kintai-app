/**
 * らくらく勤怠 - Google スプレッドシート連携用 Apps Script
 * このスクリプトは、空のGoogleスプレッドシートに「拡張機能 > Apps Script」から貼り付けます。
 */
const MEMBER_SHEET = 'メンバー';
const SITE_SHEET = '現場';
const HOLIDAY_SHEET = '休日';
const SETTINGS_SHEET = '設定';
const JAPANESE_HOLIDAY_CALENDAR = 'ja.japanese#holiday@group.v.calendar.google.com';
const RECORD_SHEET = '打刻記録';
const HISTORY_SHEET = '変更履歴';
const SUMMARY_EDIT_SHEET = 'まとめ編集';
const MONTHLY_SUMMARY_SHEET = '月別集計';
const SITE_YEARLY_SHEET = '年間現場別人工';
const LEAVE_SHEET = '休暇・遅刻';
const SITE_MOVE_SHEET = '現場移動';
const CLOSING_SHEET = '月締め';
const MISSING_SHEET = '打刻漏れ';
const TYPES = ['出勤', '直行', '退勤', '直帰', '外出', '戻り'];
const COMPANY_HOLIDAYS_2026 = '2026-01-01,2026-01-02,2026-01-03,2026-01-04,2026-01-10,2026-01-11,2026-01-18,2026-01-24,2026-01-25,2026-02-01,2026-02-08,2026-02-14,2026-02-15,2026-02-22,2026-02-28,2026-03-01,2026-03-08,2026-03-14,2026-03-15,2026-03-22,2026-03-28,2026-03-29,2026-04-05,2026-04-11,2026-04-12,2026-04-19,2026-04-25,2026-04-26,2026-05-03,2026-05-04,2026-05-05,2026-05-06,2026-05-09,2026-05-10,2026-05-17,2026-05-23,2026-05-24,2026-05-31,2026-06-07,2026-06-13,2026-06-14,2026-06-21,2026-06-27,2026-06-28,2026-07-05,2026-07-11,2026-07-12,2026-07-19,2026-07-25,2026-07-26,2026-08-02,2026-08-09,2026-08-13,2026-08-14,2026-08-15,2026-08-16,2026-08-23,2026-08-30,2026-09-06,2026-09-12,2026-09-13,2026-09-20,2026-09-21,2026-09-22,2026-09-26,2026-09-27,2026-10-04,2026-10-10,2026-10-11,2026-10-18,2026-10-24,2026-10-25,2026-11-01,2026-11-08,2026-11-14,2026-11-15,2026-11-22,2026-11-28,2026-11-29,2026-12-06,2026-12-12,2026-12-13,2026-12-20,2026-12-26,2026-12-27,2026-12-30,2026-12-31'.split(',');

function setup() {
  const book = SpreadsheetApp.getActive();
  const members = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日', '勤務曜日']);
  members.getRange(1, 3).setValue('個人PINハッシュ');
  ensureSheet_(book, SITE_SHEET, ['現場名', '有効']);
  ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']);
  const settings = ensureSheet_(book, SETTINGS_SHEET, ['項目', '値']);
  addSettingIfMissing_(settings, '会社名', '会社名を設定');
  addSettingIfMissing_(settings, '管理者', '');
  addSettingIfMissing_(settings, '締め日', '20');
  addSettingIfMissing_(settings, '残業開始時刻', '18:00');
  const records = ensureSheet_(book, RECORD_SHEET, ['記録ID', '氏名', '日付', '打刻種別', '打刻日時', '削除済', '現場名', '戻り予定時刻', '早退時間（分）']);
  records.getRange(1, 8).setValue('戻り予定時刻');
  records.getRange(1, 9).setValue('早退時間（分）');
  ensureSheet_(book, HISTORY_SHEET, ['記録日時', '操作', '対象ID', '対象者', '変更前', '変更後']);
  ensureSheet_(book, LEAVE_SHEET, ['申請ID','氏名','日付','区分','遅刻時間（分）','備考','登録日時','有効']);
  ensureSheet_(book, SITE_MOVE_SHEET, ['記録ID','氏名','日付','現場名','開始日時','終了日時','時間（分）']);
  ensureSheet_(book, CLOSING_SHEET, ['対象月','状態','締め日時','管理者']);
  ensureSheet_(book, MISSING_SHEET, ['氏名','日付','内容','最終更新']);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PIN')) props.setProperty('ADMIN_PIN', '1234');
  if (!props.getProperty('PERSONAL_PIN_SALT')) props.setProperty('PERSONAL_PIN_SALT', Utilities.getUuid());
  if (props.getProperty('PERSONAL_PIN_SCHEMA') !== 'v1') {
    if (members.getLastRow() > 1) members.getRange(2, 3, members.getLastRow() - 1, 1).clearContent();
    props.setProperty('PERSONAL_PIN_SCHEMA', 'v1');
  }
  if (props.getProperty('HOLIDAY_CALENDAR_VERSION') !== '2026-red-v1') {
    replaceHolidaysFromCompanyCalendar2026();
    props.setProperty('HOLIDAY_CALENDAR_VERSION', '2026-red-v1');
  }
  refreshSummaryEditSheet_();
  refreshMonthlySummarySheet_();
  refreshYearlySiteLaborSheet_();
  refreshMissingPunchSheet_();
  installDailyBackupTrigger_();
  touchConfigVersion_();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('勤怠管理')
    .addItem('まとめ編集を最新状態に更新', 'refreshSummaryEditSheet')
    .addItem('まとめ編集を各シートへ反映', 'applySummaryEditSheet')
    .addItem('月別集計を更新', 'refreshMonthlySummarySheet')
    .addItem('年間現場別人工を更新', 'refreshYearlySiteLaborSheet')
    .addItem('打刻漏れを更新', 'refreshMissingPunchSheet')
    .addItem('休暇・遅刻を登録', 'registerLeaveFromMenu')
    .addItem('現場移動時間を登録', 'registerSiteMoveFromMenu')
    .addItem('対象月を締める', 'closeMonthFromMenu')
    .addItem('今すぐバックアップ', 'createMonthlyBackup')
    .addSeparator()
    .addItem('2026年の休日を再設定', 'replaceHolidaysFromCompanyCalendar2026')
    .addToUi();
}

function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === MONTHLY_SUMMARY_SHEET && e.range.getA1Notation() === 'B2') {
    refreshMonthlySummarySheet_();
  }
  if (e && e.range && e.range.getSheet().getName() === SITE_YEARLY_SHEET && e.range.getA1Notation() === 'B2') refreshYearlySiteLaborSheet_();
  if (e && e.range && [MEMBER_SHEET,SITE_SHEET,HOLIDAY_SHEET,SETTINGS_SHEET].includes(e.range.getSheet().getName())) touchConfigVersion_();
}

/** 選択した締め月について、全メンバーの勤務実績を新しいシートに集計します。 */
function refreshMonthlySummarySheet() {
  refreshMonthlySummarySheet_();
  SpreadsheetApp.getActive().toast('月別集計を更新しました', '勤怠管理', 5);
}

function refreshMonthlySummarySheet_() {
  const book = SpreadsheetApp.getActive();
  const existing = book.getSheetByName(MONTHLY_SUMMARY_SHEET);
  let month = existing ? String(existing.getRange('B2').getDisplayValue()).trim() : '';
  if (!/^\d{4}-\d{2}$/.test(month)) month = defaultClosingMonth_(new Date(), readSettings_(book).closingDay);
  const sheet = existing || book.insertSheet(MONTHLY_SUMMARY_SHEET);
  const settings = readSettings_(book);
  const period = periodForMonth_(month, settings.closingDay);
  const members = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日', '勤務曜日']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[1] !== false);
  const holidaySet = {};
  ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[2] !== false).forEach(row => holidaySet[formatDate_(row[0])] = true);
  const records = readRecords_(book).filter(record => record.date >= period.start && record.date <= period.end);
  const overtimeParts = String(settings.overtimeStart || '18:00').split(':').map(Number);
  const today=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd');
  const leaveRows=ensureSheet_(book,LEAVE_SHEET,['申請ID','氏名','日付','区分','遅刻時間（分）','備考','登録日時','有効']).getDataRange().getValues().slice(1).filter(row=>row[0]&&row[7]!==false);

  const rows = members.map(member => {
    const name=String(member[0]);
    const personRecords = records.filter(record => record.name === name);
    const dates = [...new Set(personRecords.filter(record => ['出勤','直行'].includes(record.type)).map(record => record.date))];
    let regularDays=0, holidayDays=0, regularMinutes=0, holidayMinutes=0, overtimeMinutes=0, outingMinutes=0, earlyMinutes=0;
    dates.forEach(date => {
      const events = personRecords.filter(record => record.date === date).sort((a,b) => a.at - b.at);
      const start = events.find(record => ['出勤','直行'].includes(record.type));
      const end = start && events.find(record => record.at > start.at && ['退勤','直帰'].includes(record.type));
      if (!start) return;
      const away = outingMinutes_(events);
      const work = end ? Math.max(0, Math.round((end.at - start.at) / 60000) - away) : 0;
      const isHoliday = !!holidaySet[date] || new Date(`${date}T00:00:00+09:00`).getDay() === 0;
      const attendance=attendanceCredit_(start.at);
      if (isHoliday) { holidayDays+=attendance; holidayMinutes += work; } else { regularDays+=attendance; regularMinutes += work; }
      outingMinutes += away;
      if (end) earlyMinutes += Number(end.earlyLeaveMinutes) || earlyLeaveMinutes_(end.type,end.at,date);
      if (end) {
        const threshold = new Date(`${date}T${String(overtimeParts[0] || 0).padStart(2,'0')}:${String(overtimeParts[1] || 0).padStart(2,'0')}:00+09:00`).getTime();
        overtimeMinutes += overtimeMinutes_(events, end.at, threshold);
      }
    });
    const workedDateSet={};dates.forEach(date=>workedDateSet[date]=true);
    const attendanceTargetDates=dateKeys_(period.start,period.end).filter(date=>date<=today&&!holidaySet[date]&&new Date(`${date}T00:00:00+09:00`).getDay()!==0&&isMemberWorkday_(member,date));
    const absenceDays=attendanceTargetDates.reduce((total,date)=>{if(workedDateSet[date])return total;const leave=leaveRows.find(row=>String(row[1])===name&&formatDate_(row[2])===date),type=leave?String(leave[3]):'';return total+(type==='有給'?0:['午前半休','午後半休'].includes(type)?0.5:1);},0);
    return [name, regularDays, holidayDays, absenceDays, regularMinutes / 1440, holidayMinutes / 1440, (regularMinutes + holidayMinutes) / 1440, overtimeMinutes / 1440, outingMinutes / 1440, earlyMinutes / 1440];
  });

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  sheet.getRange('A1:J1').merge().setValue(`${settings.companyName}　月別勤怠集計`).setBackground('#14532d').setFontColor('#ffffff').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A2').setValue('対象月');
  sheet.getRange('B2').setValue(month).setBackground('#fef9c3').setNote('yyyy-mm形式で入力すると自動的に再集計します');
  sheet.getRange('D2').setValue('集計期間');
  sheet.getRange('E2:J2').merge().setValue(`${period.start} ～ ${period.end}`);
  sheet.getRange('A3').setValue('残業開始');
  sheet.getRange('B3').setValue(settings.overtimeStart);
  sheet.getRange('D3').setValue('更新日時');
  sheet.getRange('E3:J3').merge().setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange('A5:J5').setValues([['氏名','通常出勤日数','休日出勤日数','欠勤日数','通常勤務時間','休日勤務時間','合計勤務時間','残業時間','中抜け時間','早退時間']]).setBackground('#bbf7d0').setFontWeight('bold');
  if (rows.length) {
    sheet.getRange(6, 1, rows.length, 10).setValues(rows);
    sheet.getRange(6, 2, rows.length, 3).setNumberFormat('0.0');
    sheet.getRange(6, 5, rows.length, 6).setNumberFormat('[h]:mm');
  }
  sheet.getRange(2, 1, 2, 10).setBackgrounds([
    ['#dcfce7','#fef9c3','#ffffff','#dcfce7','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff'],
    ['#dcfce7','#ffffff','#ffffff','#dcfce7','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff']
  ]);
  [160,110,110,100,120,120,120,110,110,110].forEach((width,index) => sheet.setColumnWidth(index + 1, width));
  sheet.setFrozenRows(5);
  sheet.setHiddenGridlines(true);
}

function outingMinutes_(events) {
  let open = null, total = 0;
  events.forEach(record => {
    if (record.type === '外出' && open === null) open = record.at;
    else if (record.type === '戻り' && open !== null && record.at > open) { total += Math.round((record.at - open) / 60000); open = null; }
  });
  return total;
}

function overtimeMinutes_(events, endAt, threshold) {
  if (endAt <= threshold) return 0;
  let minutes = Math.round((endAt - threshold) / 60000), open = null;
  events.forEach(record => {
    if (record.type === '外出' && open === null) open = record.at;
    else if (record.type === '戻り' && open !== null) {
      const overlapStart = Math.max(open, threshold);
      const overlapEnd = Math.min(record.at, endAt);
      if (overlapEnd > overlapStart) minutes -= Math.round((overlapEnd - overlapStart) / 60000);
      open = null;
    }
  });
  return Math.max(0, minutes);
}

function defaultClosingMonth_(date, closingDay) {
  const local=Utilities.formatDate(date,'Asia/Tokyo','yyyy-MM-dd').split('-').map(Number);
  let year=local[0], month=local[1];
  if(local[2]>Number(closingDay||20)){month++;if(month===13){year++;month=1;}}
  return `${year}-${String(month).padStart(2,'0')}`;
}

function attendanceCredit_(at) {
  return Number(Utilities.formatDate(new Date(Number(at)),'Asia/Tokyo','H'))>=12?0.5:1;
}

function dateKeys_(start,end) {
  const values=[], cursor=new Date(`${start}T00:00:00+09:00`), last=new Date(`${end}T00:00:00+09:00`);
  while(cursor<=last){values.push(Utilities.formatDate(cursor,'Asia/Tokyo','yyyy-MM-dd'));cursor.setTime(cursor.getTime()+86400000);}
  return values;
}

function isMemberWorkday_(member,date) {
  const joined=member[3]?formatDate_(member[3]):'', left=member[4]?formatDate_(member[4]):'';
  if((joined&&date<joined)||(left&&date>left))return false;
  const labels=['日','月','火','水','木','金','土'], day=labels[new Date(`${date}T00:00:00+09:00`).getDay()];
  const schedule=String(member[5]||'月,火,水,木,金,土').split(/[、,，\s]+/).filter(Boolean);
  return schedule.includes(day);
}

function refreshYearlySiteLaborSheet() {
  refreshYearlySiteLaborSheet_();
  SpreadsheetApp.getActive().toast('年間現場別人工を更新しました','勤怠管理',5);
}

function refreshYearlySiteLaborSheet_() {
  const book=SpreadsheetApp.getActive(), existing=book.getSheetByName(SITE_YEARLY_SHEET);
  let year=existing?String(existing.getRange('B2').getDisplayValue()).trim():'';
  if(!/^\d{4}$/.test(year))year=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy');
  const sheet=existing||book.insertSheet(SITE_YEARLY_SHEET), settings=readSettings_(book);
  const records=readRecords_(book).filter(record=>record.date.startsWith(`${year}-`));
  const overtimeParts=String(settings.overtimeStart||'18:00').split(':').map(Number), dayKeys={};
  const moveRows=ensureSheet_(book,SITE_MOVE_SHEET,['記録ID','氏名','日付','現場名','開始日時','終了日時','時間（分）']).getDataRange().getValues().slice(1).filter(row=>row[0]&&formatDate_(row[2]).startsWith(year));
  records.forEach(record=>{const key=`${record.name}|${record.date}`;(dayKeys[key]||(dayKeys[key]=[])).push(record);});
  const summary={}, details=[];
  Object.keys(dayKeys).sort().forEach(key=>{
    const events=dayKeys[key].sort((a,b)=>a.at-b.at), start=events.find(record=>['出勤','直行'].includes(record.type)), end=start&&events.find(record=>record.at>start.at&&['退勤','直帰'].includes(record.type));
    if(!start||!end)return;
    const date=start.date, work=Math.max(0,Math.round((end.at-start.at)/60000)-outingMinutes_(events));
    const threshold=new Date(`${date}T${String(overtimeParts[0]||0).padStart(2,'0')}:${String(overtimeParts[1]||0).padStart(2,'0')}:00+09:00`).getTime();
    const overtime=overtimeMinutes_(events,end.at,threshold);
    const exactMoves=moveRows.filter(row=>String(row[1])===start.name&&formatDate_(row[2])===date&&row[3]&&row[4]&&row[5]);
    if(exactMoves.length){exactMoves.forEach(row=>{const site=String(row[3]),moveStart=new Date(row[4]).getTime(),moveEnd=new Date(row[5]).getTime(),minutes=Number(row[6])||Math.max(0,Math.round((moveEnd-moveStart)/60000)),overtimeForSite=Math.max(0,Math.round((Math.min(moveEnd,end.at)-Math.max(moveStart,threshold))/60000)),baseLabor=minutes<=240?0.5:1,overtimeLabor=overtimeForSite/480,item=summary[site]||(summary[site]={half:0,full:0,base:0,overtime:0,overtimeLabor:0,total:0});if(baseLabor===0.5)item.half++;else item.full++;item.base+=baseLabor;item.overtime+=overtimeForSite;item.overtimeLabor+=overtimeLabor;item.total+=baseLabor+overtimeLabor;details.push([date,start.name,site,minutes/1440,baseLabor,overtimeForSite/1440,overtimeLabor,baseLabor+overtimeLabor]);});return;}
    const sites=[...new Set(events.flatMap(record=>record.sites||[]).map(String).filter(Boolean))];
    if(!sites.length)sites.push('現場未設定');
    const workPerSite=work/sites.length, overtimePerSite=overtime/sites.length;
    sites.forEach(site=>{
      const baseLabor=workPerSite<=240?0.5:1, overtimeLabor=overtimePerSite/480, item=summary[site]||(summary[site]={half:0,full:0,base:0,overtime:0,overtimeLabor:0,total:0});
      if(baseLabor===0.5)item.half++;else item.full++;
      item.base+=baseLabor;item.overtime+=overtimePerSite;item.overtimeLabor+=overtimeLabor;item.total+=baseLabor+overtimeLabor;
      details.push([date,start.name,site,workPerSite/1440,baseLabor,overtimePerSite/1440,overtimeLabor,baseLabor+overtimeLabor]);
    });
  });
  const summaryRows=Object.keys(summary).sort((a,b)=>a.localeCompare(b,'ja')).map(site=>{const item=summary[site];return [site,item.half,item.full,item.base,item.overtime/1440,item.overtimeLabor,item.total];});
  sheet.getRange(1,1,sheet.getMaxRows(),sheet.getMaxColumns()).breakApart();sheet.clear();
  sheet.getRange('A1:H1').merge().setValue(`${settings.companyName}　年間現場別人工`).setBackground('#14532d').setFontColor('#ffffff').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A2').setValue('対象年');sheet.getRange('B2').setValue(year).setBackground('#fef9c3').setNote('西暦4桁を入力すると自動的に再集計します');
  sheet.getRange('D2').setValue('計算基準');sheet.getRange('E2:H2').merge().setValue('4時間以内＝0.5人工、4時間超＝1人工、残業8時間＝1人工');
  sheet.getRange('A3:H3').merge().setValue('同じ日に複数現場がある場合、勤務時間と残業時間を現場数で均等配分します。').setBackground('#fef9c3').setFontColor('#854d0e');
  sheet.getRange('A4:G4').setValues([['現場名','0.5人工回数','1人工回数','基本人工','残業時間','残業人工','合計人工']]).setBackground('#bbf7d0').setFontWeight('bold');
  if(summaryRows.length){sheet.getRange(5,1,summaryRows.length,7).setValues(summaryRows);sheet.getRange(5,5,summaryRows.length,1).setNumberFormat('[h]:mm');sheet.getRange(5,4,summaryRows.length,1).setNumberFormat('0.0');sheet.getRange(5,6,summaryRows.length,2).setNumberFormat('0.000');}
  const detailStart=Math.max(7,5+summaryRows.length+2);
  sheet.getRange(detailStart,1,1,8).merge().setValue('日別明細').setBackground('#166534').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(detailStart+1,1,1,8).setValues([['日付','氏名','現場名','配分勤務時間','基本人工','配分残業時間','残業人工','合計人工']]).setBackground('#dcfce7').setFontWeight('bold');
  if(details.length){sheet.getRange(detailStart+2,1,details.length,8).setValues(details);sheet.getRange(detailStart+2,1,details.length,1).setNumberFormat('yyyy-mm-dd');sheet.getRange(detailStart+2,4,details.length,1).setNumberFormat('[h]:mm');sheet.getRange(detailStart+2,6,details.length,1).setNumberFormat('[h]:mm');sheet.getRange(detailStart+2,5,details.length,1).setNumberFormat('0.0');sheet.getRange(detailStart+2,7,details.length,2).setNumberFormat('0.000');}
  [110,140,140,100,105,100,100,100].forEach((width,index)=>sheet.setColumnWidth(index+1,width));sheet.setFrozenRows(4);sheet.setHiddenGridlines(true);
}

/** 各管理シートの内容を、編集しやすい1枚のシートにまとめます。 */
function refreshSummaryEditSheet() {
  refreshSummaryEditSheet_();
  SpreadsheetApp.getActive().toast('まとめ編集シートを最新状態に更新しました', '勤怠管理', 5);
}

function refreshSummaryEditSheet_() {
  const book = SpreadsheetApp.getActive();
  const sheet = book.getSheetByName(SUMMARY_EDIT_SHEET) || book.insertSheet(SUMMARY_EDIT_SHEET);
  const settings = readSettings_(book);
  const members = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日', '勤務曜日']).getDataRange().getValues().slice(1).filter(row => row[0]);
  const sites = ensureSheet_(book, SITE_SHEET, ['現場名', '有効']).getDataRange().getValues().slice(1).filter(row => row[0]);
  const holidays = ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']).getDataRange().getValues().slice(1).filter(row => row[0]);
  const maxDataRows = Math.max(120, members.length, sites.length, holidays.length) + 5;

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  if (sheet.getMaxRows() < maxDataRows) sheet.insertRowsAfter(sheet.getMaxRows(), maxDataRows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < 17) sheet.insertColumnsAfter(sheet.getMaxColumns(), 17 - sheet.getMaxColumns());
  sheet.getRange('A1:Q1').merge().setValue('勤怠管理　まとめ編集').setBackground('#14532d').setFontColor('#ffffff').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A2:Q2').merge().setValue('黄色のセルを編集した後、メニュー「勤怠管理」→「まとめ編集を各シートへ反映」を選んでください。勤務曜日は「月,火,水,木,金」の形式で入力します。').setBackground('#dcfce7').setFontColor('#14532d');
  [['A4:B4','会社・集計設定'],['D4:I4','メンバー'],['K4:L4','現場'],['N4:Q4','休日']].forEach(item => sheet.getRange(item[0]).merge().setValue(item[1]).setBackground('#166534').setFontColor('#ffffff').setFontWeight('bold'));
  sheet.getRange('A5:B5').setValues([['項目','値']]);
  sheet.getRange('D5:I5').setValues([['氏名','有効','個人PIN状態','入社日','退職日','勤務曜日']]);
  sheet.getRange('K5:L5').setValues([['現場名','有効']]);
  sheet.getRange('N5:Q5').setValues([['日付','休日名','有効','区分']]);
  ['A5:B5','D5:I5','K5:L5','N5:Q5'].forEach(a1 => sheet.getRange(a1).setBackground('#bbf7d0').setFontWeight('bold'));
  sheet.getRange(6, 5, maxDataRows - 5, 1).insertCheckboxes();
  sheet.getRange(6, 12, maxDataRows - 5, 1).insertCheckboxes();
  sheet.getRange(6, 16, maxDataRows - 5, 1).insertCheckboxes();

  sheet.getRange(6, 1, 4, 2).setValues([
    ['会社名', settings.companyName],
    ['管理者', settings.admins.join('、')],
    ['締め日', settings.closingDay],
    ['残業開始時刻', settings.overtimeStart]
  ]);
  if (members.length) sheet.getRange(6, 4, members.length, 6).setValues(members.map(row => [String(row[0]), row[1] !== false, row[2] ? '設定済' : '未設定', row[3] || '', row[4] || '', String(row[5] || '月,火,水,木,金,土')]));
  if (sites.length) sheet.getRange(6, 11, sites.length, 2).setValues(sites.map(row => [String(row[0]), row[1] !== false]));
  if (holidays.length) sheet.getRange(6, 14, holidays.length, 4).setValues(holidays.map(row => [formatDate_(row[0]), String(row[1] || ''), row[2] !== false, String(row[3] || 'manual')]));

  sheet.getRange(6, 2, 4, 1).setBackground('#fef9c3');
  sheet.getRange(6, 4, maxDataRows - 5, 2).setBackground('#fef9c3');
  sheet.getRange(6, 6, maxDataRows - 5, 1).setBackground('#f3f4f6').setFontColor('#6b7280');
  sheet.getRange(6, 7, maxDataRows - 5, 3).setBackground('#fef9c3');
  sheet.getRange(6, 7, maxDataRows - 5, 2).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(6, 11, maxDataRows - 5, 2).setBackground('#fef9c3');
  sheet.getRange(6, 14, maxDataRows - 5, 4).setBackground('#fef9c3');
  sheet.getRange(6, 14, maxDataRows - 5, 1).setNumberFormat('yyyy-mm-dd');
  [140,180,25,170,70,100,110,110,180,25,180,70,25,110,170,70,130].forEach((width, index) => sheet.setColumnWidth(index + 1, width));
  sheet.setFrozenRows(5);
  sheet.setHiddenGridlines(true);
}

/** まとめ編集の黄色セルを、アプリが使用する各シートへ反映します。 */
function applySummaryEditSheet() {
  const book = SpreadsheetApp.getActive();
  const sheet = book.getSheetByName(SUMMARY_EDIT_SHEET);
  if (!sheet) throw new Error('まとめ編集シートがありません。先にsetupを実行してください。');
  const settingsRows = sheet.getRange(6, 1, 4, 2).getValues();
  const settingMap = {};
  settingsRows.forEach(row => settingMap[String(row[0]).trim()] = row[1]);
  const closingDay = Number(settingMap['締め日']);
  const companyName = String(settingMap['会社名'] || '').trim();
  const admins = String(settingMap['管理者'] || '').trim();
  const overtimeStart = normalizeTime_(settingMap['残業開始時刻']);
  if (!companyName) throw new Error('会社名を入力してください');
  if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 28) throw new Error('締め日は1～28の数字で入力してください');
  if (!overtimeStart) throw new Error('残業開始時刻は18:00の形式で入力してください');

  const rowCount = Math.max(0, sheet.getLastRow() - 5);
  const memberInput = rowCount ? sheet.getRange(6, 4, rowCount, 6).getValues().filter(row => String(row[0]).trim()) : [];
  const siteInput = rowCount ? sheet.getRange(6, 11, rowCount, 2).getValues().filter(row => String(row[0]).trim()) : [];
  const holidayInput = rowCount ? sheet.getRange(6, 14, rowCount, 4).getValues().filter(row => row[0]) : [];
  if (!memberInput.length) throw new Error('メンバーを1名以上入力してください');
  assertNoDuplicates_(memberInput.map(row => String(row[0]).trim()), 'メンバー名');
  assertNoDuplicates_(siteInput.map(row => String(row[0]).trim()), '現場名');
  const holidayDates = holidayInput.map(row => formatDate_(row[0]));
  assertNoDuplicates_(holidayDates, '休日の日付');
  memberInput.forEach(row => {
    const joinDate = row[3] ? formatDate_(row[3]) : '';
    const leaveDate = row[4] ? formatDate_(row[4]) : '';
    if (joinDate && leaveDate && joinDate > leaveDate) throw new Error(`${String(row[0]).trim()}さんの退職日は入社日以降にしてください`);
    const workdays = String(row[5] || '月,火,水,木,金,土').split(/[、,，\s]+/).filter(Boolean);
    if (!workdays.length || workdays.some(day => !['日','月','火','水','木','金','土'].includes(day))) throw new Error(`${String(row[0]).trim()}さんの勤務曜日は「月,火,水,木,金」の形式で入力してください`);
  });

  const memberSheet = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日', '勤務曜日']);
  const pinHashByName = {};
  memberSheet.getDataRange().getValues().slice(1).forEach(row => { if (row[0]) pinHashByName[String(row[0]).trim()] = row[2] || ''; });
  replaceSheetData_(memberSheet, memberInput.map(row => { const name=String(row[0]).trim(); return [name, row[1] !== false, pinHashByName[name] || '', row[3] ? formatDate_(row[3]) : '', row[4] ? formatDate_(row[4]) : '', String(row[5] || '月,火,水,木,金,土').replace(/[、，\s]+/g, ',')]; }), 6);
  replaceSheetData_(ensureSheet_(book, SITE_SHEET, ['現場名', '有効']), siteInput.map(row => [String(row[0]).trim(), row[1] !== false]), 2);
  replaceSheetData_(ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']), holidayInput.map(row => [formatDate_(row[0]), String(row[1] || '').trim() || '休日', row[2] !== false, String(row[3] || 'manual').trim() || 'manual']), 4);
  replaceSheetData_(ensureSheet_(book, SETTINGS_SHEET, ['項目', '値']), [
    ['会社名', companyName], ['管理者', admins], ['締め日', closingDay], ['残業開始時刻', overtimeStart]
  ], 2);
  audit_(book, 'まとめ編集反映', '', '', '', `メンバー${memberInput.length}件・現場${siteInput.length}件・休日${holidayInput.length}件`);
  touchConfigVersion_();
  refreshSummaryEditSheet_();
  refreshMonthlySummarySheet_();
  book.toast('まとめ編集の内容をアプリ用シートへ反映しました', '勤怠管理', 7);
}

function replaceSheetData_(sheet, rows, columns) {
  const oldRows = Math.max(0, sheet.getLastRow() - 1);
  if (oldRows) sheet.getRange(2, 1, oldRows, Math.max(columns, sheet.getLastColumn())).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, columns).setValues(rows);
}

function assertNoDuplicates_(values, label) {
  const seen = {};
  values.forEach(value => { if (seen[value]) throw new Error(`${label}「${value}」が重複しています`); seen[value] = true; });
}

/**
 * 管理者暗証番号を初期値 1234 に戻します。
 * Apps Script エディタから、この関数を選んで1回だけ実行してください。
 */
function resetAdminPin() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', '1234');
}

function doGet(e) {
  const callback = String(e.parameter.callback || '');
  let result;
  try {
    if (e.parameter.payload) result = mutate_(JSON.parse(e.parameter.payload));
    else if (e.parameter.action === 'verifyAdmin') {
      const ok = isAdmin_(String(e.parameter.name || '')) && String(e.parameter.pin || '') === PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
      if(ok){const book=SpreadsheetApp.getActive();refreshMissingPunchSheet_();result={ok:true,data:{records:readRecords_(book),pinStatus:readPinStatus_(book),missingPunches:ensureSheet_(book,MISSING_SHEET,['氏名','日付','内容','最終更新']).getDataRange().getValues().slice(1).filter(row=>row[0]).map(row=>({name:String(row[0]),date:formatDate_(row[1]),message:String(row[2])}))}};}else result={ok:false};
    }
    else result = { ok: true, data: readAll_(String(e.parameter.configVersion || '')) };
  } catch (error) { result = { ok: false, error: error.message }; }
  const body = callback && /^[A-Za-z_$][\w$]*$/.test(callback)
    ? `${callback}(${JSON.stringify(result)});`
    : JSON.stringify(result);
  return ContentService.createTextOutput(body).setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function doPost(e) {
  const raw = (e.parameter && e.parameter.payload) || (e.postData && e.postData.contents) || '{}';
  const input = JSON.parse(raw);
  let result;
  try { result = mutate_(input); } catch (error) { result = { ok: false, error: error.message }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function readAll_(knownVersion) {
  const book = SpreadsheetApp.getActive();
  const configVersion = getConfigVersion_();
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const result = { records: readRecordsForDate_(book,today), configVersion, configChanged: knownVersion !== configVersion };
  if (!result.configChanged) return result;
  const memberRows = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[1] !== false);
  const members = memberRows.map(row => String(row[0]));
  const pinConfiguredNames = memberRows.filter(row => row[2]).map(row => String(row[0]));
  const sites = ensureSheet_(book, SITE_SHEET, ['現場名', '有効']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[1] !== false).map(row => String(row[0]));
  const holidays = ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[2] !== false).map(row => ({ date: formatDate_(row[0]), name: String(row[1]), source: String(row[3] || 'manual') }));
  const settings = readSettings_(book);
  return Object.assign(result, { employees: members, sites, holidays, pinConfiguredNames, companyName: settings.companyName, admins: settings.admins, closingDay: settings.closingDay, overtimeStart: settings.overtimeStart });
}

function mutate_(input) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const book = SpreadsheetApp.getActive();
    const members = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ']);
    const records = ensureSheet_(book, RECORD_SHEET, ['記録ID', '氏名', '日付', '打刻種別', '打刻日時', '削除済', '現場名', '戻り予定時刻', '早退時間（分）']);
    if (input.action === 'punch') {
      if (!input.name || !input.date || !TYPES.includes(input.type)) throw new Error('打刻内容が不正です');
      if(isDateLocked_(book,String(input.date)))throw new Error('この期間は月締め済みのため打刻できません');
      const list = members.getDataRange().getValues().slice(1);
      if (!list.some(row => String(row[0]) === input.name && row[1] !== false)) throw new Error('有効なメンバーとして登録されていません');
      const dayRows = records.getDataRange().getValues().slice(1).filter(row => String(row[1]) === input.name && formatDate_(row[2]) === input.date && row[5] !== true);
      let done = false;
      if (['出勤', '直行'].includes(input.type)) done = dayRows.some(row => ['出勤', '直行'].includes(String(row[3])));
      else if (['退勤', '直帰'].includes(input.type)) done = dayRows.some(row => ['退勤', '直帰'].includes(String(row[3])));
      else {
        const awayCount = dayRows.filter(row => String(row[3]) === '外出').length;
        const returnCount = dayRows.filter(row => String(row[3]) === '戻り').length;
        if (input.type === '外出' && awayCount > returnCount) throw new Error('戻りが記録されていない外出があります');
        if (input.type === '戻り' && awayCount <= returnCount) throw new Error('先に外出を記録してください');
      }
      const sites = Array.isArray(input.sites) ? input.sites.map(String) : [];
      if (!done) { const id=Utilities.getUuid(), expectedReturn=String(input.expectedReturn || ''), earlyLeaveMinutes=earlyLeaveMinutes_(String(input.type),Number(input.at),String(input.date)), record={id,name:String(input.name),date:String(input.date),type:String(input.type),at:Number(input.at),sites,expectedReturn,earlyLeaveMinutes};records.appendRow([id, input.name, input.date, input.type, new Date(Number(input.at)), false, JSON.stringify(sites), expectedReturn, earlyLeaveMinutes || '']);audit_(book, input.type === '外出' ? '中抜け連絡' : '打刻', id, input.name, '', `${input.date} ${input.type}${earlyLeaveMinutes ? ' / 早退 '+minutesText_(earlyLeaveMinutes) : ''}${expectedReturn ? ' / 戻り予定 '+expectedReturn : ''}${sites.length ? ' / '+sites.join('、') : ''}`); }
      return { ok: true };
    }
    if (input.action === 'personalRecords') {
      const name=String(input.name || ''), pin=String(input.personalPin || ''), month=String(input.month || '');
      if (!/^\d{3}$/.test(pin) || !/^\d{4}-\d{2}$/.test(month)) throw new Error('PINは数字3桁で入力してください');
      const values=members.getDataRange().getValues(); let found=-1;
      for(let i=1;i<values.length;i++) if(String(values[i][0])===name && values[i][1]!==false) found=i;
      if(found<0) throw new Error('メンバーが見つかりません');
      const digest=hashPin_(`${name}|${pin}|${PropertiesService.getScriptProperties().getProperty('PERSONAL_PIN_SALT')||''}`), current=String(values[found][2] || ''), props=PropertiesService.getScriptProperties(), failureKey='PIN_FAILURE_'+hashPin_(name), now=Date.now();
      let failureState={count:0,blockedUntil:0};
      try { failureState=JSON.parse(props.getProperty(failureKey)||'{"count":0,"blockedUntil":0}'); } catch (_) {}
      if(Number(failureState.blockedUntil||0)>now) throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');
      if(Number(failureState.blockedUntil||0)&&Number(failureState.blockedUntil)<=now) failureState={count:0,blockedUntil:0};
      if(!current){members.getRange(found+1,3).setValue(digest);props.deleteProperty(failureKey);touchConfigVersion_();audit_(book,'個人PIN初回設定','',name,'未設定','設定済');}
      else if(current!==digest){const failures=Number(failureState.count||0)+1;props.setProperty(failureKey,JSON.stringify({count:failures,blockedUntil:failures>=5?now+600000:0}));if(failures>=5)throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');throw new Error('個人PINが違います');}
      else props.deleteProperty(failureKey);
      const period=periodForMonth_(month,readSettings_(book).closingDay);
      const member=values[found],leaves=ensureSheet_(book,LEAVE_SHEET,['申請ID','氏名','日付','区分','遅刻時間（分）','備考','登録日時','有効']).getDataRange().getValues().slice(1).filter(row=>String(row[1])===name&&row[7]!==false&&formatDate_(row[2])>=period.start&&formatDate_(row[2])<=period.end).map(row=>({date:formatDate_(row[2]),type:String(row[3]),minutes:Number(row[4])||0,note:String(row[5]||'')}));
      return {ok:true,firstSetup:!current,period,records:readRecords_(book).filter(record=>record.name===name&&record.date>=period.start&&record.date<=period.end),member:{joinDate:member[3]?formatDate_(member[3]):'',leaveDate:member[4]?formatDate_(member[4]):'',workdays:String(member[5]||'月,火,水,木,金,土')},leaves};
    }
    if (input.action === 'addSiteByStaff') {
      const name=String(input.name || '').trim();
      if (!name) throw new Error('現場名を入力してください');
      const sheet=ensureSheet_(book, SITE_SHEET, ['現場名', '有効']);
      const exists=sheet.getDataRange().getValues().slice(1).some(row=>String(row[0])===name && row[1]!==false);
      if (!exists) { sheet.appendRow([name, true]); touchConfigVersion_(); audit_(book, 'スタッフによる現場追加', '', String(input.staff || ''), '', name); }
      return { ok: true };
    }
    if (input.action === 'updateRecordSites') {
      const sites = Array.isArray(input.sites) ? input.sites.map(String) : [];
      const rows=records.getDataRange().getValues(); let found=-1;
      for(let i=1;i<rows.length;i++) if(String(rows[i][1])===input.name && formatDate_(rows[i][2])===input.date && String(rows[i][3])===input.type && rows[i][5]!==true) found=i;
      if(found<0) throw new Error('対象の打刻が見つかりません');
      const before=parseSites_(rows[found][6]).join('、');
      records.getRange(found+1,7).setValue(JSON.stringify(sites));
      audit_(book, '現場選択変更', rows[found][0], rows[found][1], before, sites.join('、'));
      return { ok: true };
    }
    if (!isAdmin_(String(input.adminName || '')) || String(input.pin || '') !== PropertiesService.getScriptProperties().getProperty('ADMIN_PIN')) throw new Error('管理者名または暗証番号が違います');
    if (input.action === 'addMember') { if (!input.name) throw new Error('氏名を入力してください'); members.appendRow([input.name, true, '']);audit_(book, 'メンバー追加', '', input.name, '', input.name); }
    else if (input.action === 'resetPersonalPin') { const rows=members.getDataRange().getValues(); let found=-1; for(let i=1;i<rows.length;i++) if(String(rows[i][0])===String(input.name)) found=i; if(found<0) throw new Error('メンバーが見つかりません'); members.getRange(found+1,3).clearContent(); audit_(book,'個人PINリセット','',input.name,'設定済','未設定'); }
    else if (input.action === 'removeMember') { const rows=members.getDataRange().getValues(); for(let i=1;i<rows.length;i++) if(String(rows[i][0])===input.name) members.getRange(i+1,2).setValue(false);audit_(book, 'メンバー無効化', '', input.name, input.name, ''); }
    else if (input.action === 'changePin') { if (String(input.newPin || '').length < 4) throw new Error('暗証番号は4文字以上です'); PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', input.newPin); }
    else if (input.action === 'addSite') { if (!input.name) throw new Error('現場名を入力してください'); ensureSheet_(book, SITE_SHEET, ['現場名', '有効']).appendRow([input.name, true]);audit_(book, '現場追加', '', input.name, '', input.name); }
    else if (input.action === 'removeSite') { const sheet=ensureSheet_(book, SITE_SHEET, ['現場名', '有効']), rows=sheet.getDataRange().getValues(); for(let i=1;i<rows.length;i++) if(String(rows[i][0])===input.name) sheet.getRange(i+1,2).setValue(false);audit_(book, '現場無効化', '', input.name, input.name, ''); }
    else if (input.action === 'addHoliday') { if (!input.date || !input.name) throw new Error('休日と名称を入力してください'); ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']).appendRow([input.date, input.name, true, 'manual']);audit_(book, '休日追加', '', '', '', `${input.date} ${input.name}`); }
    else if (input.action === 'removeHoliday') { const sheet=ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']), rows=sheet.getDataRange().getValues(); for(let i=1;i<rows.length;i++) if(formatDate_(rows[i][0])===input.date && String(rows[i][3] || 'manual')==='manual') sheet.getRange(i+1,3).setValue(false);audit_(book, '休日無効化', '', '', input.date, ''); }
    else if (input.action === 'updateRecord') {
      if (!input.id || !input.date || !TYPES.includes(input.type)) throw new Error('修正内容が不正です');
      if(isDateLocked_(book,String(input.date)))throw new Error('この期間は月締め済みのため修正できません');
      const rows=records.getDataRange().getValues(); let found=-1;
      for(let i=1;i<rows.length;i++) if(String(rows[i][0])===input.id && rows[i][5]!==true) found=i;
      if(found<0) throw new Error('対象の打刻が見つかりません');
      if(isDateLocked_(book,formatDate_(rows[found][2])))throw new Error('変更元の期間は月締め済みのため修正できません');
      const before=`${formatDate_(rows[found][2])} ${rows[found][3]} ${Utilities.formatDate(new Date(rows[found][4]),'Asia/Tokyo','HH:mm')}`;
      records.getRange(found+1,3,1,3).setValues([[input.date,input.type,new Date(Number(input.at))]]);
      const earlyLeaveMinutes=earlyLeaveMinutes_(String(input.type),Number(input.at),String(input.date));
      records.getRange(found+1,9).setValue(earlyLeaveMinutes || '');
      audit_(book, '打刻修正', input.id, rows[found][1], before, `${input.date} ${input.type} ${Utilities.formatDate(new Date(Number(input.at)),'Asia/Tokyo','HH:mm')}${earlyLeaveMinutes ? ' / 早退 '+minutesText_(earlyLeaveMinutes) : ''}`);
    }
    else if (input.action === 'deleteRecord') {
      const rows=records.getDataRange().getValues(); let found=-1;
      for(let i=1;i<rows.length;i++) if(String(rows[i][0])===input.id && rows[i][5]!==true) found=i;
      if(found<0) throw new Error('対象の打刻が見つかりません');
      if(isDateLocked_(book,formatDate_(rows[found][2])))throw new Error('この期間は月締め済みのため削除できません');
      records.getRange(found+1,6).setValue(true);
      audit_(book, '打刻削除', input.id, rows[found][1], `${formatDate_(rows[found][2])} ${rows[found][3]}`, '削除済');
    }
    else throw new Error('未対応の操作です');
    if (['addMember','resetPersonalPin','removeMember','addSite','removeSite','addHoliday','removeHoliday'].includes(input.action)) touchConfigVersion_();
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function ensureSheet_(book, name, header) {
  const sheet = book.getSheetByName(name) || book.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(header);
  const current=sheet.getRange(1,1,1,Math.max(sheet.getLastColumn(),header.length)).getValues()[0];
  header.forEach((title,index)=>{if(!current[index])sheet.getRange(1,index+1).setValue(title);});
  return sheet;
}

function audit_(book, action, id, name, before, after) {
  ensureSheet_(book, HISTORY_SHEET, ['記録日時', '操作', '対象ID', '対象者', '変更前', '変更後'])
    .appendRow([new Date(), action, id, name, before, after]);
}

function formatDate_(value) {
  return Utilities.formatDate(new Date(value), 'Asia/Tokyo', 'yyyy-MM-dd');
}

function parseSites_(value) {
  try { const sites=JSON.parse(value || '[]'); return Array.isArray(sites) ? sites : []; } catch (_) { return []; }
}

function readRecords_(book) {
  return ensureSheet_(book, RECORD_SHEET, ['記録ID', '氏名', '日付', '打刻種別', '打刻日時', '削除済', '現場名', '戻り予定時刻', '早退時間（分）']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[5] !== true)
    .map(recordFromRow_);
}

function readRecordsForDate_(book,date) {
  const sheet=ensureSheet_(book, RECORD_SHEET, ['記録ID', '氏名', '日付', '打刻種別', '打刻日時', '削除済', '現場名', '戻り予定時刻', '早退時間（分）']);
  const lastRow=sheet.getLastRow();
  if(lastRow<2)return [];
  const rowNumbers=sheet.getRange(2,3,lastRow-1,1).getValues().map((row,index)=>row[0]&&formatDate_(row[0])===date?index+2:0).filter(Boolean);
  if(!rowNumbers.length)return [];
  const groups=[];
  rowNumbers.forEach(row=>{const last=groups[groups.length-1];if(last&&row===last.end+1)last.end=row;else groups.push({start:row,end:row});});
  return groups.flatMap(group=>sheet.getRange(group.start,1,group.end-group.start+1,9).getValues())
    .filter(row=>row[0]&&row[5]!==true)
    .map(recordFromRow_);
}

function recordFromRow_(row) {
  const date=formatDate_(row[2]), type=String(row[3]), at=new Date(row[4]).getTime();
  return { id:String(row[0]), name:String(row[1]), date, type, at, sites:parseSites_(row[6]), expectedReturn:String(row[7] || ''), earlyLeaveMinutes:Number(row[8])||earlyLeaveMinutes_(type,at,date) };
}

function readPinStatus_(book) {
  return ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[1] !== false).map(row => ({ name:String(row[0]), configured:!!row[2] }));
}

function earlyLeaveMinutes_(type, at, date) {
  if (!['退勤','直帰'].includes(String(type)) || !Number(at) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return 0;
  const threshold = new Date(`${date}T17:00:00+09:00`).getTime();
  return at < threshold ? Math.max(0, Math.round((threshold - at) / 60000)) : 0;
}

function minutesText_(minutes) {
  const value=Math.max(0,Number(minutes)||0), hours=Math.floor(value/60), rest=value%60;
  return `${hours ? hours+'時間' : ''}${rest ? rest+'分' : hours ? '' : '0分'}`;
}

function hashPin_(pin) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin), Utilities.Charset.UTF_8)
    .map(value => (value < 0 ? value + 256 : value).toString(16).padStart(2,'0')).join('');
}

function periodForMonth_(month, closingDay) {
  const parts=month.split('-').map(Number), year=parts[0], number=parts[1], day=Math.min(28,Math.max(1,Number(closingDay)||20));
  const previousNumber=number===1?12:number-1, previousYear=number===1?year-1:year;
  return {start:`${previousYear}-${String(previousNumber).padStart(2,'0')}-${String(day+1).padStart(2,'0')}`,end:`${year}-${String(number).padStart(2,'0')}-${String(day).padStart(2,'0')}`};
}

function readSettings_(book) {
  const sheet = ensureSheet_(book, SETTINGS_SHEET, ['項目', '値']);
  const values = sheet.getDataRange().getValues().slice(1);
  const lookup = key => (values.find(row => String(row[0]) === key) || ['', ''])[1];
  const companyName = String(lookup('会社名') || '').trim();
  const admins = String(lookup('管理者') || '').split(/[、,，\n]/).map(value => value.trim()).filter(Boolean);
  return { companyName: companyName || '会社名を設定', admins, closingDay: Math.min(28,Math.max(1,Number(lookup('締め日'))||20)), overtimeStart: normalizeTime_(lookup('残業開始時刻')) || '18:00' };
}

function normalizeTime_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return Utilities.formatDate(value, 'Asia/Tokyo', 'HH:mm');
  if (typeof value === 'number' && isFinite(value)) {
    const minutes = Math.round(((value % 1) + 1) % 1 * 1440) % 1440;
    return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
  }
  const text = String(value || '').trim();
  const match = text.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?:\s|$)/);
  return match ? `${String(Number(match[1])).padStart(2,'0')}:${match[2]}` : '';
}

function isAdmin_(name) {
  return readSettings_(SpreadsheetApp.getActive()).admins.includes(name);
}

function addSettingIfMissing_(sheet, key, value) {
  const exists = sheet.getDataRange().getValues().slice(1).some(row => String(row[0]) === key);
  if (!exists) sheet.appendRow([key, value]);
}

function getConfigVersion_() {
  const props=PropertiesService.getScriptProperties();
  let version=props.getProperty('CONFIG_VERSION');
  if(!version){version=Utilities.getUuid();props.setProperty('CONFIG_VERSION',version);}
  return version;
}

function touchConfigVersion_() {
  PropertiesService.getScriptProperties().setProperty('CONFIG_VERSION',Utilities.getUuid());
}

/** 年間カレンダーで赤文字になっている2026年の日付だけに休日を入れ替えます。 */
function replaceHolidaysFromCompanyCalendar2026() {
  const book = SpreadsheetApp.getActive();
  const sheet = ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']);
  const removed = Math.max(0, sheet.getLastRow() - 1);
  if (removed) sheet.getRange(2, 1, removed, Math.max(4, sheet.getLastColumn())).clearContent();
  const values = COMPANY_HOLIDAYS_2026.map(date => {
    const day = new Date(`${date}T00:00:00+09:00`).getDay();
    return [date, day === 0 ? '日曜日' : day === 6 ? '土曜休日' : '会社休日', true, 'calendar-red'];
  });
  if (values.length) sheet.getRange(2, 1, values.length, 4).setValues(values);
  audit_(book, '休日一括入替', '', '', `${removed}件削除`, `2026年赤色日 ${values.length}件登録`);
  touchConfigVersion_();
}

function registerLeaveFromMenu() {
  const ui=SpreadsheetApp.getUi(), response=ui.prompt('休暇・遅刻を登録','氏名,日付,区分,遅刻分,備考 の順で入力\n区分：有給・午前半休・午後半休・遅刻',ui.ButtonSet.OK_CANCEL);
  if(response.getSelectedButton()!==ui.Button.OK)return;
  const parts=response.getResponseText().split(',').map(value=>value.trim()), name=parts[0], date=parts[1], type=parts[2], minutes=Number(parts[3]||0), note=parts.slice(4).join(',');
  if(!name||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['有給','午前半休','午後半休','遅刻'].includes(type))throw new Error('入力内容を確認してください');
  const book=SpreadsheetApp.getActive();ensureSheet_(book,LEAVE_SHEET,['申請ID','氏名','日付','区分','遅刻時間（分）','備考','登録日時','有効']).appendRow([Utilities.getUuid(),name,date,type,type==='遅刻'?minutes:'',note,new Date(),true]);audit_(book,'休暇・遅刻登録','',name,'',`${date} ${type}`);refreshMonthlySummarySheet_();
}

function registerSiteMoveFromMenu() {
  const ui=SpreadsheetApp.getUi(),response=ui.prompt('現場移動時間を登録','氏名,日付,現場名,開始時刻,終了時刻 の順で入力\n例：山田 太郎,2026-09-25,東京現場,08:00,12:00',ui.ButtonSet.OK_CANCEL);if(response.getSelectedButton()!==ui.Button.OK)return;
  const parts=response.getResponseText().split(',').map(value=>value.trim()),name=parts[0],date=parts[1],site=parts[2],startText=parts[3],endText=parts[4];if(!name||!site||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(startText)||!/^\d{2}:\d{2}$/.test(endText))throw new Error('入力内容を確認してください');
  const start=new Date(`${date}T${startText}:00+09:00`),end=new Date(`${date}T${endText}:00+09:00`);if(end<=start)throw new Error('終了時刻は開始時刻より後にしてください');const minutes=Math.round((end-start)/60000),book=SpreadsheetApp.getActive();ensureSheet_(book,SITE_MOVE_SHEET,['記録ID','氏名','日付','現場名','開始日時','終了日時','時間（分）']).appendRow([Utilities.getUuid(),name,date,site,start,end,minutes]);audit_(book,'現場移動時間登録','',name,'',`${date} ${site} ${startText}-${endText}`);refreshYearlySiteLaborSheet_();
}

function closeMonthFromMenu() {
  const ui=SpreadsheetApp.getUi(), response=ui.prompt('月締め','締める対象月を yyyy-mm で入力してください',ui.ButtonSet.OK_CANCEL);if(response.getSelectedButton()!==ui.Button.OK)return;
  const month=response.getResponseText().trim();if(!/^\d{4}-\d{2}$/.test(month))throw new Error('対象月はyyyy-mmで入力してください');
  const book=SpreadsheetApp.getActive(),sheet=ensureSheet_(book,CLOSING_SHEET,['対象月','状態','締め日時','管理者']),rows=sheet.getDataRange().getValues();let row=0;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===month)row=i+1;
  const value=[month,'締済',new Date(),Session.getActiveUser().getEmail()||'管理者'];if(row)sheet.getRange(row,1,1,4).setValues([value]);else sheet.appendRow(value);audit_(book,'月締め','', '', '', month);
}

function isDateLocked_(book,date) {
  const month=closingMonthForDate_(date,readSettings_(book).closingDay);
  return ensureSheet_(book,CLOSING_SHEET,['対象月','状態','締め日時','管理者']).getDataRange().getValues().slice(1).some(row=>String(row[0])===month&&String(row[1])==='締済');
}

function closingMonthForDate_(date,closingDay) {
  const parts=String(date).split('-').map(Number);let year=parts[0],month=parts[1];if(parts[2]>Number(closingDay||20)){month++;if(month===13){year++;month=1;}}return `${year}-${String(month).padStart(2,'0')}`;
}

function refreshMissingPunchSheet() {refreshMissingPunchSheet_();SpreadsheetApp.getActive().toast('打刻漏れを更新しました','勤怠管理',5);}
function refreshMissingPunchSheet_() {
  const book=SpreadsheetApp.getActive(), records=readRecords_(book), groups={};records.forEach(record=>{const key=`${record.name}|${record.date}`;(groups[key]||(groups[key]=[])).push(record);});
  const today=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd'),hour=Number(Utilities.formatDate(new Date(),'Asia/Tokyo','H')),rows=[];Object.keys(groups).sort().forEach(key=>{const list=groups[key],start=list.some(r=>['出勤','直行'].includes(r.type)),end=list.some(r=>['退勤','直帰'].includes(r.type)),away=list.filter(r=>r.type==='外出').length,back=list.filter(r=>r.type==='戻り').length,parts=key.split('|'),dayEnded=parts[1]<today||(parts[1]===today&&hour>=18);if(start&&!end&&dayEnded)rows.push([parts[0],parts[1],'退勤・直帰がありません',new Date()]);if(away>back)rows.push([parts[0],parts[1],'外出後の戻りがありません',new Date()]);});
  const sheet=ensureSheet_(book,MISSING_SHEET,['氏名','日付','内容','最終更新']);replaceSheetData_(sheet,rows,4);if(rows.length)sheet.getRange(2,2,rows.length,1).setNumberFormat('yyyy-mm-dd');
}

function installDailyBackupTrigger_() {
  if(!ScriptApp.getProjectTriggers().some(trigger=>trigger.getHandlerFunction()==='dailyMaintenance'))ScriptApp.newTrigger('dailyMaintenance').timeBased().everyDays(1).atHour(2).create();
}
function dailyMaintenance(){refreshMissingPunchSheet_();if(Number(Utilities.formatDate(new Date(),'Asia/Tokyo','d'))===1)createMonthlyBackup();}
function createMonthlyBackup() {
  const book=SpreadsheetApp.getActive(),month=Utilities.formatDate(new Date(Date.now()-86400000),'Asia/Tokyo','yyyy-MM'),name=`バックアップ_${month}`;if(book.getSheetByName(name))return;
  const sheet=book.insertSheet(name),records=ensureSheet_(book,RECORD_SHEET,['記録ID','氏名','日付','打刻種別','打刻日時','削除済','現場名','戻り予定時刻','早退時間（分）']).getDataRange().getValues();sheet.getRange(1,1,records.length,records[0].length).setValues(records);let next=records.length+2;[MEMBER_SHEET,SITE_SHEET,HOLIDAY_SHEET,SETTINGS_SHEET,LEAVE_SHEET,SITE_MOVE_SHEET,CLOSING_SHEET].forEach(sourceName=>{const values=book.getSheetByName(sourceName).getDataRange().getValues();sheet.getRange(next,1).setValue(`【${sourceName}】`).setFontWeight('bold');next++;sheet.getRange(next,1,values.length,values[0].length).setValues(values);next+=values.length+1;});sheet.setFrozenRows(1);audit_(book,'月次バックアップ','','','',name);
}
