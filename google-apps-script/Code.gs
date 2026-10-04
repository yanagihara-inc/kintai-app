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
const BULK_EDIT_SHEET = '一括修正';
const CONFIRM_SHEET = '締め確認';
const DEVICE_SHEET = '端末登録';
const CORRECTION_SHEET = '打刻修正申請';
const TYPES = ['出勤', '直行', '退勤', '直帰', '外出', '戻り', '夜勤', '出張'];
const COMPANY_HOLIDAYS_2026 = '2026-01-01,2026-01-02,2026-01-03,2026-01-04,2026-01-10,2026-01-11,2026-01-18,2026-01-24,2026-01-25,2026-02-01,2026-02-08,2026-02-14,2026-02-15,2026-02-22,2026-02-28,2026-03-01,2026-03-08,2026-03-14,2026-03-15,2026-03-22,2026-03-28,2026-03-29,2026-04-05,2026-04-11,2026-04-12,2026-04-19,2026-04-25,2026-04-26,2026-05-03,2026-05-04,2026-05-05,2026-05-06,2026-05-09,2026-05-10,2026-05-17,2026-05-23,2026-05-24,2026-05-31,2026-06-07,2026-06-13,2026-06-14,2026-06-21,2026-06-27,2026-06-28,2026-07-05,2026-07-11,2026-07-12,2026-07-19,2026-07-25,2026-07-26,2026-08-02,2026-08-09,2026-08-13,2026-08-14,2026-08-15,2026-08-16,2026-08-23,2026-08-30,2026-09-06,2026-09-12,2026-09-13,2026-09-20,2026-09-21,2026-09-22,2026-09-26,2026-09-27,2026-10-04,2026-10-10,2026-10-11,2026-10-18,2026-10-24,2026-10-25,2026-11-01,2026-11-08,2026-11-14,2026-11-15,2026-11-22,2026-11-28,2026-11-29,2026-12-06,2026-12-12,2026-12-13,2026-12-20,2026-12-26,2026-12-27,2026-12-30,2026-12-31'.split(',');

function setup() {
  const book = SpreadsheetApp.getActive();
  const members = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日']);
  members.getRange(1, 3).setValue('個人PINハッシュ');
  if (members.getMaxColumns() >= 6) members.getRange(1, 6, members.getMaxRows(), 1).clearContent();
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
  ensureSheet_(book, BULK_EDIT_SHEET, ['反映','記録ID','氏名','現在日付','現在種別','現在時刻','新しい日付','新しい種別','新しい時刻','削除']);
  ensureSheet_(book, CONFIRM_SHEET, ['対象月','氏名','確認日時']);
  ensureSheet_(book, DEVICE_SHEET, ['端末ID','氏名','端末トークンハッシュ','登録日時','最終使用日時','有効']);
  ensureSheet_(book, CORRECTION_SHEET, ['申請ID','氏名','対象記録ID','申請日時','修正前日付','修正前種別','修正前時刻','修正後日付','修正後種別','修正後時刻','状態','承認管理者','承認日時']);
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
  refreshBulkEditSheet_();
  installDailyBackupTrigger_();
  touchConfigVersion_();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('勤怠管理')
    .addItem('まとめ編集を各シートから再読込', 'showRefreshSummaryEditProgress')
    .addItem('まとめ編集を各シートへ反映', 'showApplySummaryEditProgress')
    .addItem('月別集計を更新', 'showMonthlySummaryProgress')
    .addItem('年間現場別人工を更新', 'showYearlySiteLaborProgress')
    .addItem('打刻漏れを更新', 'showMissingPunchProgress')
    .addItem('一括修正シートを更新', 'showBulkEditRefreshProgress')
    .addItem('一括修正を反映', 'showBulkEditApplyProgress')
    .addItem('休暇・遅刻を登録', 'registerLeaveFromMenu')
    .addItem('現場移動時間を登録', 'registerSiteMoveFromMenu')
    .addItem('対象月を締める', 'closeMonthFromMenu')
    .addItem('今すぐバックアップ', 'showBackupProgress')
    .addSeparator()
    .addItem('2026年の休日を再設定', 'showHolidayResetProgress')
    .addToUi();
}

function showRefreshSummaryEditProgress(){showProgressDialog_('まとめ編集を再読込しています','refreshSummaryEditSheet');}
function showApplySummaryEditProgress(){showProgressDialog_('まとめ編集を反映しています','applySummaryEditSheet');}
function showMonthlySummaryProgress(){showProgressDialog_('月別集計を更新しています','refreshMonthlySummarySheet');}
function showYearlySiteLaborProgress(){showProgressDialog_('年間現場別人工を更新しています','refreshYearlySiteLaborSheet');}
function showMissingPunchProgress(){showProgressDialog_('打刻漏れを更新しています','refreshMissingPunchSheet');}
function showBulkEditRefreshProgress(){showProgressDialog_('一括修正シートを更新しています','refreshBulkEditSheet');}
function showBulkEditApplyProgress(){showProgressDialog_('一括修正を反映しています','applyBulkEditSheet');}
function showBackupProgress(){showProgressDialog_('バックアップを作成しています','createMonthlyBackup');}
function showHolidayResetProgress(){showProgressDialog_('休日カレンダーを更新しています','replaceHolidaysFromCompanyCalendar2026');}

function showProgressDialog_(title, task) {
  const html = `<!doctype html><html><head><base target="_top"><style>
    body{font-family:Arial,'Noto Sans JP',sans-serif;margin:0;padding:22px;color:#17351f;background:#f8faf8}
    h3{margin:0 0 16px;font-size:16px}.track{height:18px;background:#dbe7dd;border-radius:10px;overflow:hidden}
    .bar{height:100%;width:3%;background:linear-gradient(90deg,#16a34a,#4ade80);transition:width .35s ease}
    .status{display:flex;justify-content:space-between;margin-top:9px;font-size:13px}.error{color:#b91c1c;white-space:pre-wrap}
  </style></head><body><h3>${title}</h3><div class="track"><div id="bar" class="bar"></div></div>
  <div class="status"><span id="message">処理を開始しています…</span><b id="percent">3%</b></div>
  <script>
    const task=${JSON.stringify(task)},bar=document.getElementById('bar'),percent=document.getElementById('percent'),message=document.getElementById('message');
    let value=3;const timer=setInterval(()=>{if(value<90){value+=value<45?5:2;bar.style.width=value+'%';percent.textContent=value+'%';message.textContent=value<35?'データを読み込んでいます…':value<70?'集計・更新しています…':'仕上げています…';}},450);
    google.script.run.withSuccessHandler(()=>{clearInterval(timer);bar.style.width='100%';percent.textContent='100%';message.textContent='完了しました';setTimeout(()=>google.script.host.close(),1200);}).withFailureHandler(error=>{clearInterval(timer);bar.style.background='#dc2626';bar.style.width='100%';percent.textContent='エラー';message.className='error';message.textContent=error&&error.message?error.message:String(error);}).runProgressTask(task);
  </script></body></html>`;
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(390).setHeight(180), '処理状況');
}

function runProgressTask(task) {
  const tasks = {
    refreshSummaryEditSheet: refreshSummaryEditSheet,
    applySummaryEditSheet: applySummaryEditSheet,
    refreshMonthlySummarySheet: refreshMonthlySummarySheet,
    refreshYearlySiteLaborSheet: refreshYearlySiteLaborSheet,
    refreshMissingPunchSheet: refreshMissingPunchSheet,
    refreshBulkEditSheet: refreshBulkEditSheet,
    applyBulkEditSheet: applyBulkEditSheet,
    createMonthlyBackup: createMonthlyBackup,
    replaceHolidaysFromCompanyCalendar2026: replaceHolidaysFromCompanyCalendar2026
  };
  if (!tasks[task]) throw new Error('実行する処理が見つかりません');
  tasks[task]();
  return true;
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
  const months = [month, shiftMonth_(month, -1), shiftMonth_(month, -2)];
  const members = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[1] !== false);
  const holidaySet = {};
  ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']).getDataRange().getValues().slice(1)
    .filter(row => row[0] && row[2] !== false).forEach(row => holidaySet[formatDate_(row[0])] = true);
  const periods = months.map(value => periodForMonth_(value, settings.closingDay));
  const records = readRecords_(book).filter(record => record.date >= periods[2].start && record.date <= periods[0].end);
  const overtimeParts = String(settings.overtimeStart || '18:00').split(':').map(Number);
  const today=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd');
  const leaveRows=ensureSheet_(book,LEAVE_SHEET,['申請ID','氏名','日付','区分','遅刻時間（分）','備考','登録日時','有効']).getDataRange().getValues().slice(1).filter(row=>row[0]&&row[7]!==false);
  const confirmRows=ensureSheet_(book,CONFIRM_SHEET,['対象月','氏名','確認日時']).getDataRange().getValues().slice(1);

  const rowsByMonth = periods.map((period,periodIndex) => members.map(member => {
      const name=String(member[0]);
      const personRecords = records.filter(record => record.name === name && record.date >= period.start && record.date <= period.end);
      const dates = [...new Set(personRecords.filter(record => ['出勤','直行'].includes(record.type)).map(record => record.date))];
      let regularDays=0, holidayDays=0, regularMinutes=0, holidayMinutes=0, overtimeMinutes=0, outingMinutes=0, earlyMinutes=0;
      dates.forEach(date => {
        const events = personRecords.filter(record => record.date === date).sort((a,b) => a.at - b.at);
        const start = events.find(record => ['出勤','直行'].includes(record.type));
        const end = start && events.find(record => record.at > start.at && ['退勤','直帰'].includes(record.type));
        if (!start) return;
        const away = outingMinutes_(events);
        const work = end ? Math.max(0, Math.round((end.at - start.at) / 60000) - away) : 0;
        const isHoliday = !!holidaySet[date];
        const attendance=attendanceCreditForDay_(events);
        if (isHoliday) { holidayDays+=attendance; holidayMinutes += work; } else { regularDays+=attendance; regularMinutes += work; }
        outingMinutes += away;
        if (end && attendance===1) earlyMinutes += Number(end.earlyLeaveMinutes) || earlyLeaveMinutes_(end.type,end.at,date);
        if (end) {
          const threshold = new Date(`${date}T${String(overtimeParts[0] || 0).padStart(2,'0')}:${String(overtimeParts[1] || 0).padStart(2,'0')}:00+09:00`).getTime();
          overtimeMinutes += overtimeMinutes_(events, end.at, threshold);
        }
      });
      const workedDateSet={};dates.forEach(date=>workedDateSet[date]=true);
      const attendanceTargetDates=dateKeys_(period.start,period.end).filter(date=>date<=today&&!holidaySet[date]&&isMemberEmploymentDate_(member,date));
      const absenceDays=attendanceTargetDates.reduce((total,date)=>{if(workedDateSet[date])return total;const leave=leaveRows.find(row=>String(row[1])===name&&formatDate_(row[2])===date),type=leave?String(leave[3]):'';return total+(type==='有給'?0:['午前半休','午後半休'].includes(type)?0.5:1);},0);
      const nightCount=personRecords.filter(record=>record.type==='夜勤').length;
      const tripCount=personRecords.filter(record=>record.type==='出張').length;
      const confirmed=confirmRows.some(row=>String(row[0])===months[periodIndex]&&String(row[1])===name)?'確認済':'未確認';
      return [name, regularDays, holidayDays, nightCount, tripCount, absenceDays, confirmed, regularMinutes / 1440, holidayMinutes / 1440, (regularMinutes + holidayMinutes) / 1440, overtimeMinutes / 1440, outingMinutes / 1440, earlyMinutes / 1440];
    }));

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  const requiredRows = 5 + rowsByMonth.reduce((total, rows) => total + rows.length + 3, 0);
  if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  sheet.getRange('A1:M1').merge().setValue(`${settings.companyName}　月別勤怠集計（3か月）`).setBackground('#14532d').setFontColor('#ffffff').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A2').setValue('対象月');
  sheet.getRange('B2').setValue(month).setBackground('#fef9c3').setNote('最新の対象月をyyyy-mm形式で入力すると、その月と前2か月を再集計します');
  sheet.getRange('D2').setValue('表示対象');
  sheet.getRange('E2:M2').merge().setValue(months.join('・'));
  sheet.getRange('A3').setValue('残業開始');
  sheet.getRange('B3').setValue(settings.overtimeStart);
  sheet.getRange('D3').setValue('更新日時');
  sheet.getRange('E3:M3').merge().setValue(new Date()).setNumberFormat('yyyy-mm-dd hh:mm');
  sheet.getRange('A4:M4').merge().setValue('印刷設定：A4／横向き／幅を1ページに合わせる／余白「狭い」').setBackground('#fef9c3').setFontColor('#854d0e').setFontSize(9).setHorizontalAlignment('center');
  sheet.getRange(2, 1, 2, 13).setBackgrounds([
    ['#dcfce7','#fef9c3','#ffffff','#dcfce7','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff'],
    ['#dcfce7','#ffffff','#ffffff','#dcfce7','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff']
  ]);
  let startRow=5;
  months.forEach((value,index) => {
    const period=periods[index], rows=rowsByMonth[index];
    sheet.getRange(startRow,1,1,13).merge().setValue(`${value}　集計期間：${period.start} ～ ${period.end}`).setBackground('#166534').setFontColor('#ffffff').setFontWeight('bold').setFontSize(10);
    sheet.getRange(startRow+1,1,1,13).setValues([['氏名','通常出勤日数','休日出勤日数','夜勤回数','出張回数','欠勤日数','本人確認','通常勤務時間','休日勤務時間','合計勤務時間','残業時間','中抜け時間','早退時間']]).setBackground('#bbf7d0').setFontWeight('bold').setFontSize(8).setWrap(true);
    if (rows.length) {
      sheet.getRange(startRow+2,1,rows.length,13).setValues(rows).setFontSize(8);
      sheet.getRange(startRow+2,2,rows.length,5).setNumberFormat('0.0');
      sheet.getRange(startRow+2,8,rows.length,6).setNumberFormat('[h]:mm');
      sheet.setRowHeights(startRow+2,rows.length,18);
    }
    sheet.setRowHeight(startRow,20);
    sheet.setRowHeight(startRow+1,30);
    startRow += rows.length + 3;
  });
  [88,54,54,48,48,48,54,60,60,60,54,54,54].forEach((width,index) => sheet.setColumnWidth(index + 1, width));
  sheet.getRange(1,1,4,13).setFontSize(9);
  sheet.getRange('A1:M1').setFontSize(15);
  sheet.setFrozenRows(4);
  sheet.setHiddenGridlines(true);
}

function shiftMonth_(month, amount) {
  const parts=String(month).split('-').map(Number), date=new Date(Date.UTC(parts[0],parts[1]-1+amount,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
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

function attendanceCreditForDay_(records) {
  const rows=records.slice().sort((a,b)=>a.at-b.at),start=rows.find(record=>['出勤','直行'].includes(record.type));
  const end=start&&rows.find(record=>record.at>start.at&&['退勤','直帰'].includes(record.type));
  if(!start)return 0;
  const startHour=Number(Utilities.formatDate(new Date(Number(start.at)),'Asia/Tokyo','H'));
  const endMinutes=end?Number(Utilities.formatDate(new Date(Number(end.at)),'Asia/Tokyo','H'))*60+Number(Utilities.formatDate(new Date(Number(end.at)),'Asia/Tokyo','m')):1440;
  return startHour>=12||endMinutes<720?0.5:1;
}

function dateKeys_(start,end) {
  const values=[], cursor=new Date(`${start}T00:00:00+09:00`), last=new Date(`${end}T00:00:00+09:00`);
  while(cursor<=last){values.push(Utilities.formatDate(cursor,'Asia/Tokyo','yyyy-MM-dd'));cursor.setTime(cursor.getTime()+86400000);}
  return values;
}

function isMemberEmploymentDate_(member,date) {
  const joined=member[3]?formatDate_(member[3]):'', left=member[4]?formatDate_(member[4]):'';
  return !((joined&&date<joined)||(left&&date>left));
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
  const members = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日']).getDataRange().getValues().slice(1).filter(row => row[0]);
  const sites = ensureSheet_(book, SITE_SHEET, ['現場名', '有効']).getDataRange().getValues().slice(1).filter(row => row[0]);
  const holidays = ensureSheet_(book, HOLIDAY_SHEET, ['日付', '休日名', '有効', '区分']).getDataRange().getValues().slice(1).filter(row => row[0]);
  const maxDataRows = Math.max(120, members.length, sites.length, holidays.length) + 5;

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  sheet.clear();
  if (sheet.getMaxRows() < maxDataRows) sheet.insertRowsAfter(sheet.getMaxRows(), maxDataRows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < 16) sheet.insertColumnsAfter(sheet.getMaxColumns(), 16 - sheet.getMaxColumns());
  sheet.getRange('A1:P1').merge().setValue('勤怠管理　まとめ編集').setBackground('#14532d').setFontColor('#ffffff').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('A2:P2').merge().setValue('黄色のセルを編集した後、メニュー「勤怠管理」→「まとめ編集を各シートへ反映」を選んでください。休日の判定は休日カレンダーを優先します。').setBackground('#dcfce7').setFontColor('#14532d');
  [['A4:B4','会社・集計設定'],['D4:H4','メンバー'],['J4:K4','現場'],['M4:P4','休日']].forEach(item => sheet.getRange(item[0]).merge().setValue(item[1]).setBackground('#166534').setFontColor('#ffffff').setFontWeight('bold'));
  sheet.getRange('A5:B5').setValues([['項目','値']]);
  sheet.getRange('D5:H5').setValues([['氏名','有効','個人PIN状態','入社日','退職日']]);
  sheet.getRange('J5:K5').setValues([['現場名','有効']]);
  sheet.getRange('M5:P5').setValues([['日付','休日名','有効','区分']]);
  ['A5:B5','D5:H5','J5:K5','M5:P5'].forEach(a1 => sheet.getRange(a1).setBackground('#bbf7d0').setFontWeight('bold'));
  sheet.getRange(6, 5, maxDataRows - 5, 1).insertCheckboxes();
  sheet.getRange(6, 11, maxDataRows - 5, 1).insertCheckboxes();
  sheet.getRange(6, 15, maxDataRows - 5, 1).insertCheckboxes();

  sheet.getRange(6, 1, 4, 2).setValues([
    ['会社名', settings.companyName],
    ['管理者', settings.admins.join('、')],
    ['締め日', settings.closingDay],
    ['残業開始時刻', settings.overtimeStart]
  ]);
  if (members.length) sheet.getRange(6, 4, members.length, 5).setValues(members.map(row => [String(row[0]), row[1] !== false, row[2] ? '設定済' : '未設定', row[3] || '', row[4] || '']));
  if (sites.length) sheet.getRange(6, 10, sites.length, 2).setValues(sites.map(row => [String(row[0]), row[1] !== false]));
  if (holidays.length) sheet.getRange(6, 13, holidays.length, 4).setValues(holidays.map(row => [formatDate_(row[0]), String(row[1] || ''), row[2] !== false, String(row[3] || 'manual')]));

  sheet.getRange(6, 2, 4, 1).setBackground('#fef9c3');
  sheet.getRange(6, 4, maxDataRows - 5, 2).setBackground('#fef9c3');
  sheet.getRange(6, 6, maxDataRows - 5, 1).setBackground('#f3f4f6').setFontColor('#6b7280');
  sheet.getRange(6, 7, maxDataRows - 5, 2).setBackground('#fef9c3');
  sheet.getRange(6, 7, maxDataRows - 5, 2).setNumberFormat('yyyy-mm-dd');
  sheet.getRange(6, 10, maxDataRows - 5, 2).setBackground('#fef9c3');
  sheet.getRange(6, 13, maxDataRows - 5, 4).setBackground('#fef9c3');
  sheet.getRange(6, 13, maxDataRows - 5, 1).setNumberFormat('yyyy-mm-dd');
  [140,180,25,170,70,100,110,110,25,180,70,25,110,170,70,130].forEach((width, index) => sheet.setColumnWidth(index + 1, width));
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
  const memberInput = rowCount ? sheet.getRange(6, 4, rowCount, 5).getValues().filter(row => String(row[0]).trim()) : [];
  const siteInput = rowCount ? sheet.getRange(6, 10, rowCount, 2).getValues().filter(row => String(row[0]).trim()) : [];
  const holidayInput = rowCount ? sheet.getRange(6, 13, rowCount, 4).getValues().filter(row => row[0]) : [];
  if (!memberInput.length) throw new Error('メンバーを1名以上入力してください');
  assertNoDuplicates_(memberInput.map(row => String(row[0]).trim()), 'メンバー名');
  assertNoDuplicates_(siteInput.map(row => String(row[0]).trim()), '現場名');
  const holidayDates = holidayInput.map(row => formatDate_(row[0]));
  assertNoDuplicates_(holidayDates, '休日の日付');
  memberInput.forEach(row => {
    const joinDate = row[3] ? formatDate_(row[3]) : '';
    const leaveDate = row[4] ? formatDate_(row[4]) : '';
    if (joinDate && leaveDate && joinDate > leaveDate) throw new Error(`${String(row[0]).trim()}さんの退職日は入社日以降にしてください`);
  });

  const memberSheet = ensureSheet_(book, MEMBER_SHEET, ['氏名', '有効', '個人PINハッシュ', '入社日', '退職日']);
  const pinHashByName = {};
  memberSheet.getDataRange().getValues().slice(1).forEach(row => { if (row[0]) pinHashByName[String(row[0]).trim()] = row[2] || ''; });
  replaceSheetData_(memberSheet, memberInput.map(row => { const name=String(row[0]).trim(); return [name, row[1] !== false, pinHashByName[name] || '', row[3] ? formatDate_(row[3]) : '', row[4] ? formatDate_(row[4]) : '']; }), 5);
  if (memberSheet.getMaxColumns() >= 6) memberSheet.getRange(1, 6, memberSheet.getMaxRows(), 1).clearContent();
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
      if(ok){const book=SpreadsheetApp.getActive();refreshMissingPunchSheet_();result={ok:true,data:{records:readRecords_(book),pinStatus:readPinStatus_(book),deviceStatus:readDeviceStatus_(book),correctionRequests:readCorrectionRequests_(book),missingPunches:ensureSheet_(book,MISSING_SHEET,['氏名','日付','内容','最終更新']).getDataRange().getValues().slice(1).filter(row=>row[0]).map(row=>({name:String(row[0]),date:formatDate_(row[1]),message:String(row[2])}))}};}else result={ok:false};
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
  const missingPunches=ensureSheet_(book,MISSING_SHEET,['氏名','日付','内容','最終更新']).getDataRange().getValues().slice(1).filter(row=>row[0]).map(row=>({name:String(row[0]),date:formatDate_(row[1]),message:String(row[2])}));
  const result = { records: readRecordsForDate_(book,today), missingPunches, configVersion, configChanged: knownVersion !== configVersion };
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
    if (['mathGameRanking','saveMathGameScore'].includes(input.action)) {if(typeof mathGameRanking_!=='function')return {ok:false,error:'ゲームランキングは解除されています'};return mathGameRanking_(book,members,input);}
    if (input.action === 'punch') {
      if (!input.name || !input.date || !TYPES.includes(input.type)) throw new Error('打刻内容が不正です');
      if(!verifyDeviceToken_(book,String(input.name),String(input.deviceToken||'')))throw new Error('この端末の本人登録を確認できません。端末登録をやり直してください');
      if(isDateLocked_(book,String(input.date)))throw new Error('この期間は月締め済みのため打刻できません');
      const list = members.getDataRange().getValues().slice(1);
      if (!list.some(row => String(row[0]) === input.name && row[1] !== false)) throw new Error('有効なメンバーとして登録されていません');
      const dayRows = records.getDataRange().getValues().slice(1).filter(row => String(row[1]) === input.name && formatDate_(row[2]) === input.date && row[5] !== true);
      if(dayRows.some(row=>String(row[3])===String(input.type)&&new Date(row[4]).getTime()===Number(input.at)))return {ok:true,retry:true};
      let done = false;
      if (['出勤', '直行'].includes(input.type)) done = dayRows.some(row => ['出勤', '直行'].includes(String(row[3])));
      else if (['退勤', '直帰'].includes(input.type)) done = dayRows.some(row => ['退勤', '直帰'].includes(String(row[3])));
      else if (input.type === '夜勤') done = dayRows.some(row => String(row[3]) === '夜勤');
      else if (input.type === '出張') done = dayRows.some(row => String(row[3]) === '出張');
      else {
        if (dayRows.some(row => ['退勤','直帰'].includes(String(row[3])))) throw new Error('退勤・直帰後は外出・戻りを記録できません');
        const awayCount = dayRows.filter(row => String(row[3]) === '外出').length;
        const returnCount = dayRows.filter(row => String(row[3]) === '戻り').length;
        if (input.type === '外出' && awayCount > returnCount) throw new Error('戻りが記録されていない外出があります');
        if (input.type === '戻り' && awayCount <= returnCount) throw new Error('先に外出を記録してください');
      }
      const sites = Array.isArray(input.sites) ? input.sites.map(String) : [];
      let savedId='';if (!done) { const id=Utilities.getUuid(), expectedReturn=String(input.expectedReturn || ''), earlyLeaveMinutes=earlyLeaveMinutes_(String(input.type),Number(input.at),String(input.date)), record={id,name:String(input.name),date:String(input.date),type:String(input.type),at:Number(input.at),sites,expectedReturn,earlyLeaveMinutes};savedId=id;records.appendRow([id, input.name, input.date, input.type, new Date(Number(input.at)), false, JSON.stringify(sites), expectedReturn, earlyLeaveMinutes || '']);audit_(book, input.type === '外出' ? '中抜け連絡' : '打刻', id, input.name, '', `${input.date} ${input.type}${earlyLeaveMinutes ? ' / 早退 '+minutesText_(earlyLeaveMinutes) : ''}${expectedReturn ? ' / 戻り予定 '+expectedReturn : ''}${sites.length ? ' / '+sites.join('、') : ''}`); }
      return { ok: true, id:savedId };
    }
    if (input.action === 'registerDevice') {
      const name=String(input.name||''),pin=String(input.personalPin||'');validatePersonalPinForMember_(members,name,pin);const token=Utilities.getUuid()+Utilities.getUuid(),deviceId=Utilities.getUuid(),sheet=ensureSheet_(book,DEVICE_SHEET,['端末ID','氏名','端末トークンハッシュ','登録日時','最終使用日時','有効']);sheet.appendRow([deviceId,name,hashPin_(token),new Date(),new Date(),true]);audit_(book,'本人端末登録',deviceId,name,'','登録');return {ok:true,name,deviceToken:token};
    }
    if (input.action === 'verifyPersonalPin') {
      const name=String(input.name||''),pin=String(input.personalPin||'');if(!/^\d{3}$/.test(pin))throw new Error('個人PINは数字3桁で入力してください');const values=members.getDataRange().getValues();let found=-1;for(let i=1;i<values.length;i++)if(String(values[i][0])===name&&values[i][1]!==false)found=i;if(found<0)throw new Error('メンバーが見つかりません');const current=String(values[found][2]||'');if(!current)throw new Error('個人PINが未設定です。「自分の1か月分の勤怠を確認」から最初にPINを登録してください');const props=PropertiesService.getScriptProperties(),failureKey='PIN_FAILURE_'+hashPin_(name),now=Date.now();let failureState={count:0,blockedUntil:0};try{failureState=JSON.parse(props.getProperty(failureKey)||'{"count":0,"blockedUntil":0}');}catch(_){}if(Number(failureState.blockedUntil||0)>now)throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');if(Number(failureState.blockedUntil||0)&&Number(failureState.blockedUntil)<=now)failureState={count:0,blockedUntil:0};const digest=hashPin_(`${name}|${pin}|${props.getProperty('PERSONAL_PIN_SALT')||''}`);if(current!==digest){const failures=Number(failureState.count||0)+1;props.setProperty(failureKey,JSON.stringify({count:failures,blockedUntil:failures>=5?now+600000:0}));if(failures>=5)throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');throw new Error('個人PINが違います');}props.deleteProperty(failureKey);return {ok:true,verified:true};
    }
    if (input.action === 'confirmAttendance') {
      const name=String(input.name||''),pin=String(input.personalPin||''),month=String(input.month||'');if(!/^\d{4}-\d{2}$/.test(month))throw new Error('対象月を確認してください');validatePersonalAccess_(book,members,name,pin,String(input.deviceToken||''));const closed=ensureSheet_(book,CLOSING_SHEET,['対象月','状態','締め日時','管理者']).getDataRange().getValues().slice(1).some(row=>String(row[0])===month&&String(row[1])==='締済');if(!closed)throw new Error('この対象月はまだ締め処理されていません');const sheet=ensureSheet_(book,CONFIRM_SHEET,['対象月','氏名','確認日時']),rows=sheet.getDataRange().getValues();let target=0;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===month&&String(rows[i][1])===name)target=i+1;const entry=[month,name,new Date()];if(target)sheet.getRange(target,1,1,3).setValues([entry]);else sheet.appendRow(entry);audit_(book,'勤怠本人確認','',name,'',month);refreshMonthlySummarySheet_();return {ok:true,confirmed:true};
    }
    if (input.action === 'personalRecords') {
      const name=String(input.name || ''), pin=String(input.personalPin || ''), month=String(input.month || '');
      if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('対象月を確認してください');
      const values=members.getDataRange().getValues(); let found=-1;
      for(let i=1;i<values.length;i++) if(String(values[i][0])===name && values[i][1]!==false) found=i;
      if(found<0) throw new Error('メンバーが見つかりません');
      const current=String(values[found][2] || ''),deviceVerified=verifyDeviceToken_(book,name,String(input.deviceToken||'')),digest=hashPin_(`${name}|${pin}|${PropertiesService.getScriptProperties().getProperty('PERSONAL_PIN_SALT')||''}`),props=PropertiesService.getScriptProperties(),failureKey='PIN_FAILURE_'+hashPin_(name),now=Date.now();
      let failureState={count:0,blockedUntil:0};
      try { failureState=JSON.parse(props.getProperty(failureKey)||'{"count":0,"blockedUntil":0}'); } catch (_) {}
      if(!deviceVerified){if(Number(failureState.blockedUntil||0)>now)throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');if(Number(failureState.blockedUntil||0)&&Number(failureState.blockedUntil)<=now)failureState={count:0,blockedUntil:0};if(!/^\d{3}$/.test(pin))throw new Error('個人PINを数字3桁で入力してください');if(!current){members.getRange(found+1,3).setValue(digest);props.deleteProperty(failureKey);touchConfigVersion_();audit_(book,'個人PIN初回設定','',name,'未設定','設定済');}else if(current!==digest){const failures=Number(failureState.count||0)+1;props.setProperty(failureKey,JSON.stringify({count:failures,blockedUntil:failures>=5?now+600000:0}));if(failures>=5)throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');throw new Error('個人PINが違います');}else props.deleteProperty(failureKey);}
      const period=periodForMonth_(month,readSettings_(book).closingDay);
      const member=values[found],leaves=ensureSheet_(book,LEAVE_SHEET,['申請ID','氏名','日付','区分','遅刻時間（分）','備考','登録日時','有効']).getDataRange().getValues().slice(1).filter(row=>String(row[1])===name&&row[7]!==false&&formatDate_(row[2])>=period.start&&formatDate_(row[2])<=period.end).map(row=>({date:formatDate_(row[2]),type:String(row[3]),minutes:Number(row[4])||0,note:String(row[5]||'')}));
      const confirmed=ensureSheet_(book,CONFIRM_SHEET,['対象月','氏名','確認日時']).getDataRange().getValues().slice(1).some(row=>String(row[0])===month&&String(row[1])===name);
      const closed=ensureSheet_(book,CLOSING_SHEET,['対象月','状態','締め日時','管理者']).getDataRange().getValues().slice(1).some(row=>String(row[0])===month&&String(row[1])==='締済');
      return {ok:true,firstSetup:!current,confirmed,closed,period,records:readRecords_(book).filter(record=>record.name===name&&record.date>=period.start&&record.date<=period.end),member:{joinDate:member[3]?formatDate_(member[3]):'',leaveDate:member[4]?formatDate_(member[4]):''},leaves};
    }
    if (input.action === 'submitCorrectionRequest') {
      const name=String(input.name||''),pin=String(input.personalPin||''),recordId=String(input.recordId||''),newDate=String(input.date||''),newType=String(input.type||''),newAt=Number(input.at);validatePersonalAccess_(book,members,name,pin,String(input.deviceToken||''));if(!recordId||!/^\d{4}-\d{2}-\d{2}$/.test(newDate)||!TYPES.includes(newType)||!newAt)throw new Error('修正内容を確認してください');const values=records.getDataRange().getValues();let found=-1;for(let i=1;i<values.length;i++)if(String(values[i][0])===recordId&&String(values[i][1])===name&&values[i][5]!==true)found=i;if(found<0)throw new Error('対象の打刻が見つかりません');const oldDate=formatDate_(values[found][2]),oldType=String(values[found][3]),oldAt=new Date(values[found][4]),today=Utilities.formatDate(new Date(),'Asia/Tokyo','yyyy-MM-dd');if(oldDate!==today||newDate!==today)throw new Error('打刻修正申請は当日の記録に限ります。当日以外は管理者へ報告してください');if(isDateLocked_(book,oldDate)||isDateLocked_(book,newDate))throw new Error('締済み期間の修正は申請できません');const requestSheet=ensureSheet_(book,CORRECTION_SHEET,['申請ID','氏名','対象記録ID','申請日時','修正前日付','修正前種別','修正前時刻','修正後日付','修正後種別','修正後時刻','状態','承認管理者','承認日時']),requestId=Utilities.getUuid();requestSheet.appendRow([requestId,name,recordId,new Date(),oldDate,oldType,oldAt,newDate,newType,new Date(newAt),'申請中','','']);audit_(book,'打刻修正申請',recordId,name,`${oldDate} ${oldType} ${Utilities.formatDate(oldAt,'Asia/Tokyo','HH:mm')}`,`${newDate} ${newType} ${Utilities.formatDate(new Date(newAt),'Asia/Tokyo','HH:mm')}`);return {ok:true,requestId};
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
    if (input.action === 'resetDeviceRegistration') { const name=String(input.name||''),sheet=ensureSheet_(book,DEVICE_SHEET,['端末ID','氏名','端末トークンハッシュ','登録日時','最終使用日時','有効']),rows=sheet.getDataRange().getValues();let count=0;for(let i=1;i<rows.length;i++)if(String(rows[i][1])===name&&rows[i][5]!==false){sheet.getRange(i+1,6).setValue(false);count++;}audit_(book,'本人端末登録解除','',name,`${count}台`,'無効');return {ok:true,count}; }
    if (input.action === 'reviewCorrectionRequest') { const requestId=String(input.requestId||''),decision=String(input.decision||''),sheet=ensureSheet_(book,CORRECTION_SHEET,['申請ID','氏名','対象記録ID','申請日時','修正前日付','修正前種別','修正前時刻','修正後日付','修正後種別','修正後時刻','状態','承認管理者','承認日時']),requests=sheet.getDataRange().getValues();let requestRow=-1;for(let i=1;i<requests.length;i++)if(String(requests[i][0])===requestId&&String(requests[i][10])==='申請中')requestRow=i;if(requestRow<1)throw new Error('申請中の修正が見つかりません');const request=requests[requestRow];if(decision==='承認'){const recordRows=records.getDataRange().getValues();let recordRow=-1;for(let i=1;i<recordRows.length;i++)if(String(recordRows[i][0])===String(request[2])&&recordRows[i][5]!==true)recordRow=i;if(recordRow<1)throw new Error('対象の打刻が見つかりません');const newDate=formatDate_(request[7]),newType=String(request[8]),newAt=new Date(request[9]);if(isDateLocked_(book,formatDate_(recordRows[recordRow][2]))||isDateLocked_(book,newDate))throw new Error('締済み期間は修正できません');records.getRange(recordRow+1,3,1,3).setValues([[newDate,newType,newAt]]);records.getRange(recordRow+1,9).setValue(earlyLeaveMinutes_(newType,newAt.getTime(),newDate)||'');audit_(book,'打刻修正申請承認',String(request[2]),String(request[1]),`${formatDate_(recordRows[recordRow][2])} ${recordRows[recordRow][3]} ${Utilities.formatDate(new Date(recordRows[recordRow][4]),'Asia/Tokyo','HH:mm')}`,`${newDate} ${newType} ${Utilities.formatDate(newAt,'Asia/Tokyo','HH:mm')}`);}else if(decision!=='却下')throw new Error('承認または却下を指定してください');sheet.getRange(requestRow+1,11,1,3).setValues([[decision,String(input.adminName||''),new Date()]]);if(decision==='却下')audit_(book,'打刻修正申請却下',String(request[2]),String(request[1]),'申請中','却下');refreshMonthlySummarySheet_();return {ok:true,decision}; }
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

function readDeviceStatus_(book) {
  const rows=ensureSheet_(book,DEVICE_SHEET,['端末ID','氏名','端末トークンハッシュ','登録日時','最終使用日時','有効']).getDataRange().getValues().slice(1),counts={};
  rows.forEach(row=>{if(row[1]&&row[5]!==false)counts[String(row[1])]=(counts[String(row[1])]||0)+1;});
  return Object.keys(counts).map(name=>({name,count:counts[name]}));
}

function readCorrectionRequests_(book) {
  return ensureSheet_(book,CORRECTION_SHEET,['申請ID','氏名','対象記録ID','申請日時','修正前日付','修正前種別','修正前時刻','修正後日付','修正後種別','修正後時刻','状態','承認管理者','承認日時']).getDataRange().getValues().slice(1).filter(row=>row[0]&&String(row[10])==='申請中').map(row=>({id:String(row[0]),name:String(row[1]),recordId:String(row[2]),beforeDate:formatDate_(row[4]),beforeType:String(row[5]),beforeAt:new Date(row[6]).getTime(),afterDate:formatDate_(row[7]),afterType:String(row[8]),afterAt:new Date(row[9]).getTime(),status:String(row[10])}));
}

function validatePersonalPinForMember_(members,name,pin) {
  if(!/^\d{3}$/.test(pin))throw new Error('個人PINは数字3桁で入力してください');const values=members.getDataRange().getValues();let found=-1;for(let i=1;i<values.length;i++)if(String(values[i][0])===name&&values[i][1]!==false)found=i;if(found<0)throw new Error('メンバーが見つかりません');const current=String(values[found][2]||'');if(!current)throw new Error('個人PINが未設定です。「自分の1か月分の勤怠を確認」から最初にPINを登録してください');const props=PropertiesService.getScriptProperties(),failureKey='PIN_FAILURE_'+hashPin_(name),now=Date.now();let state={count:0,blockedUntil:0};try{state=JSON.parse(props.getProperty(failureKey)||'{"count":0,"blockedUntil":0}');}catch(_){}if(Number(state.blockedUntil||0)>now)throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');const digest=hashPin_(`${name}|${pin}|${props.getProperty('PERSONAL_PIN_SALT')||''}`);if(current!==digest){const count=(Number(state.blockedUntil||0)<=now?Number(state.count||0):0)+1;props.setProperty(failureKey,JSON.stringify({count,blockedUntil:count>=5?now+600000:0}));if(count>=5)throw new Error('PIN入力を5回間違えました。10分後にもう一度お試しください');throw new Error('個人PINが違います');}props.deleteProperty(failureKey);return true;
}

function validatePersonalAccess_(book,members,name,pin,deviceToken) {
  if(verifyDeviceToken_(book,name,deviceToken))return true;
  return validatePersonalPinForMember_(members,name,pin);
}

function verifyDeviceToken_(book,name,token) {
  if(!name||!token)return false;const digest=hashPin_(token),sheet=ensureSheet_(book,DEVICE_SHEET,['端末ID','氏名','端末トークンハッシュ','登録日時','最終使用日時','有効']),rows=sheet.getDataRange().getValues();
  for(let i=1;i<rows.length;i++)if(String(rows[i][1])===name&&String(rows[i][2])===digest&&rows[i][5]!==false){sheet.getRange(i+1,5).setValue(new Date());return true;}
  return false;
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

function refreshBulkEditSheet(){refreshBulkEditSheet_();SpreadsheetApp.getActive().toast('一括修正シートを更新しました','勤怠管理',5);}
function refreshBulkEditSheet_(){
  const book=SpreadsheetApp.getActive(),sheet=ensureSheet_(book,BULK_EDIT_SHEET,['反映','記録ID','氏名','現在日付','現在種別','現在時刻','新しい日付','新しい種別','新しい時刻','削除']),records=readRecords_(book).sort((a,b)=>b.at-a.at).slice(0,500);
  sheet.clear();sheet.getRange('A1:J1').merge().setValue('打刻記録　一括修正').setBackground('#14532d').setFontColor('#fff').setFontSize(16).setFontWeight('bold').setHorizontalAlignment('center');sheet.getRange('A2:J2').merge().setValue('修正する行の「反映」にチェックし、変更項目だけ入力します。削除する場合は「削除」にもチェックしてください。').setBackground('#dcfce7').setFontColor('#14532d');sheet.getRange(4,1,1,10).setValues([['反映','記録ID','氏名','現在日付','現在種別','現在時刻','新しい日付','新しい種別','新しい時刻','削除']]).setBackground('#bbf7d0').setFontWeight('bold');
  if(records.length){sheet.getRange(5,1,records.length,10).setValues(records.map(record=>[false,record.id,record.name,record.date,record.type,new Date(record.at),'','','',false]));sheet.getRange(5,1,records.length,1).insertCheckboxes();sheet.getRange(5,10,records.length,1).insertCheckboxes();sheet.getRange(5,4,records.length,1).setNumberFormat('yyyy-mm-dd');sheet.getRange(5,6,records.length,1).setNumberFormat('HH:mm');sheet.getRange(5,7,records.length,1).setNumberFormat('yyyy-mm-dd');sheet.getRange(5,9,records.length,1).setNumberFormat('HH:mm');sheet.getRange(5,2,records.length,5).setBackground('#f3f4f6').setFontColor('#6b7280');sheet.getRange(5,7,records.length,3).setBackground('#fef9c3');}
  [55,235,120,90,85,75,95,90,80,55].forEach((width,index)=>sheet.setColumnWidth(index+1,width));sheet.setFrozenRows(4);sheet.setHiddenGridlines(true);
}
function applyBulkEditSheet(){
  const book=SpreadsheetApp.getActive(),editSheet=book.getSheetByName(BULK_EDIT_SHEET);if(!editSheet)throw new Error('一括修正シートがありません');const input=editSheet.getLastRow()>4?editSheet.getRange(5,1,editSheet.getLastRow()-4,10).getValues().filter(row=>row[0]===true):[];if(!input.length)throw new Error('「反映」にチェックされた行がありません');const recordSheet=ensureSheet_(book,RECORD_SHEET,['記録ID','氏名','日付','打刻種別','打刻日時','削除済','現場名','戻り予定時刻','早退時間（分）']),values=recordSheet.getDataRange().getValues();let changed=0;
  input.forEach(row=>{const id=String(row[1]),index=values.findIndex((value,rowIndex)=>rowIndex>0&&String(value[0])===id&&value[5]!==true);if(index<1)return;const current=values[index],oldDate=formatDate_(current[2]);if(isDateLocked_(book,oldDate))throw new Error(`${current[1]} ${oldDate} は月締め済みです`);if(row[9]===true){recordSheet.getRange(index+1,6).setValue(true);audit_(book,'一括削除',id,String(current[1]),`${oldDate} ${current[3]}`,'削除済');changed++;return;}const newDate=row[6]?formatDate_(row[6]):oldDate,newType=String(row[7]||current[3]),displayTime=row[8]?(row[8] instanceof Date?Utilities.formatDate(row[8],'Asia/Tokyo','HH:mm'):normalizeTime_(row[8])):Utilities.formatDate(new Date(current[4]),'Asia/Tokyo','HH:mm');if(!TYPES.includes(newType))throw new Error(`種別「${newType}」は使用できません`);if(!displayTime)throw new Error(`${current[1]}さんの時刻を確認してください`);if(isDateLocked_(book,newDate))throw new Error(`${newDate} は月締め済みです`);const newAt=new Date(`${newDate}T${displayTime}:00+09:00`),before=`${oldDate} ${current[3]} ${Utilities.formatDate(new Date(current[4]),'Asia/Tokyo','HH:mm')}`;recordSheet.getRange(index+1,3,1,3).setValues([[newDate,newType,newAt]]);recordSheet.getRange(index+1,9).setValue(earlyLeaveMinutes_(newType,newAt.getTime(),newDate)||'');audit_(book,'一括修正',id,String(current[1]),before,`${newDate} ${newType} ${displayTime}`);changed++;});
  refreshMonthlySummarySheet_();refreshYearlySiteLaborSheet_();refreshMissingPunchSheet_();refreshBulkEditSheet_();book.toast(`${changed}件を一括修正しました`,'勤怠管理',7);
}

function installDailyBackupTrigger_() {
  if(!ScriptApp.getProjectTriggers().some(trigger=>trigger.getHandlerFunction()==='dailyMaintenance'))ScriptApp.newTrigger('dailyMaintenance').timeBased().everyDays(1).atHour(2).create();
}
function dailyMaintenance(){refreshMissingPunchSheet_();if(Number(Utilities.formatDate(new Date(),'Asia/Tokyo','d'))===1)createMonthlyBackup();}
function createMonthlyBackup() {
  const book=SpreadsheetApp.getActive(),month=Utilities.formatDate(new Date(Date.now()-86400000),'Asia/Tokyo','yyyy-MM'),name=`バックアップ_${month}`;if(book.getSheetByName(name))return;
  const sheet=book.insertSheet(name),records=ensureSheet_(book,RECORD_SHEET,['記録ID','氏名','日付','打刻種別','打刻日時','削除済','現場名','戻り予定時刻','早退時間（分）']).getDataRange().getValues();sheet.getRange(1,1,records.length,records[0].length).setValues(records);let next=records.length+2;[MEMBER_SHEET,SITE_SHEET,HOLIDAY_SHEET,SETTINGS_SHEET,LEAVE_SHEET,SITE_MOVE_SHEET,CLOSING_SHEET,CONFIRM_SHEET,DEVICE_SHEET,CORRECTION_SHEET].forEach(sourceName=>{const values=book.getSheetByName(sourceName).getDataRange().getValues();sheet.getRange(next,1).setValue(`【${sourceName}】`).setFontWeight('bold');next++;sheet.getRange(next,1,values.length,values[0].length).setValues(values);next+=values.length+1;});sheet.setFrozenRows(1);audit_(book,'月次バックアップ','','','',name);
}
