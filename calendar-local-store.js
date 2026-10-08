// ローカル確認専用。本番のGoogleデータには送信しません。
window.createCalendarLocalRequest=function(isAdmin){
  const key='kintai-calendar-local-preview-v1';
  // 写真の2026年10月工程表。既存予定・修正・削除を上書きしない一度限りの追加。
  const photoRows=window.CALENDAR_LOCAL_PHOTO_ROWS||[];
  return async input=>{
    let entries;try{entries=JSON.parse(localStorage.getItem(key)||'[]');}catch(_){entries=[];}
    if(!Array.isArray(entries))entries=[];
    let added=false;
    photoRows.forEach(([site,work,start,end],index)=>{
      const id='photo-2026-10-v1-'+index;
      if(entries.some(e=>e.id===id))return;
      const date=day=>'2026-10-'+String(day).padStart(2,'0');
      entries.push({id,title:site+'：'+work,startDate:date(start),endDate:date(end),startTime:'',endTime:'',note:work==='作業予定'?'工程表の期間を転記。作業内容は未確認。':'2026年10月の工事工程計画表から転記。',owner:'工程表から登録',version:1});
      added=true;
    });
    if(added)localStorage.setItem(key,JSON.stringify(entries));
    if(input.action==='calendarRead')return {ok:true,events:entries.filter(e=>!e.deleted&&e.startDate<=input.month+'-31'&&e.endDate>=input.month+'-01')};
    const entry=input.entry||{},id=input.id||entry.id,old=entries.find(e=>e.id===id&&!e.deleted);
    if(id&&!old)return {ok:false,error:'予定が見つかりません'};
    if(old&&old.owner!==input.name&&!isAdmin(input.name))return {ok:false,error:'登録した本人と管理者だけ操作できます'};
    if(old&&old.version!==Number(input.version||entry.version))return {ok:false,error:'更新されています。再読み込みしてください'};
    if(input.action==='calendarDelete'){old.deleted=true;old.version++;}
    else if(input.action==='calendarSave'){
      const saved={...entry,id:old?.id||String(Date.now())+'-'+Math.random().toString(36).slice(2),owner:old?.owner||input.name,version:(old?.version||0)+1};
      if(old)Object.assign(old,saved);else entries.push(saved);
    }else return {ok:false,error:'不明な操作'};
    localStorage.setItem(key,JSON.stringify(entries));return {ok:true};
  };
};
