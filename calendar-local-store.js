// ローカル確認専用。本番のGoogleデータには送信しません。
window.createCalendarLocalRequest=function(isAdmin,getInitialSites=()=>[]){
  const key='kintai-calendar-local-preview-v1';
  // 写真の2026年10月工程表。既存予定・修正・削除を上書きしない一度限りの追加。
  const photoRows=window.CALENDAR_LOCAL_PHOTO_ROWS||[];
  return async input=>{
    if(['calendarSitesRead','calendarSitesSave'].includes(input.action)){
      if(!isAdmin(input.adminName||input.name))return {ok:false,error:'管理者だけが操作できます'};
      let titles;try{titles=JSON.parse(localStorage.getItem(key+'-sites')||'null');}catch(_){}
      if(!Array.isArray(titles))titles=getInitialSites();
      const revision='local:'+JSON.stringify(titles);
      if(input.action==='calendarSitesRead')return {ok:true,titles,revision};
      if(input.revision!==revision)return {ok:false,error:'ほかの操作で現場名が変更されました。再読み込みしてください'};
      try{titles=CalendarTitleChoices.validate(input.titles,{label:'現場名',allowEmpty:true,maxLength:80,maxCount:200});}catch(error){return {ok:false,error:error.message};}
      localStorage.setItem(key+'-sites',JSON.stringify(titles));return {ok:true,titles,revision:'local:'+JSON.stringify(titles)};
    }
    if(['calendarTitlesRead','calendarTitlesSave'].includes(input.action)){
      let titles;try{titles=JSON.parse(localStorage.getItem(key+'-titles')||'null');}catch(_){}
      if(!Array.isArray(titles))titles=['建込','コン打ち','解体','運搬'];
      const revision='local:'+JSON.stringify(titles);
      if(input.action==='calendarTitlesRead')return {ok:true,titles,revision};
      if(!isAdmin(input.name))return {ok:false,error:'管理者だけが変更できます'};
      if(input.revision!==revision)return {ok:false,error:'ほかの操作で予定名が変更されました。再読み込みしてください'};
      try{titles=CalendarTitleChoices.validate(input.titles);}catch(error){return {ok:false,error:error.message};}
      localStorage.setItem(key+'-titles',JSON.stringify(titles));return {ok:true,titles,revision:'local:'+JSON.stringify(titles)};
    }
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
    if(input.action==='calendarRead'){
      let titles;try{titles=JSON.parse(localStorage.getItem(key+'-titles')||'null');}catch(_){}
      return {ok:true,events:entries.filter(e=>!e.deleted&&e.startDate<=input.month+'-31'&&e.endDate>=input.month+'-01'),calendarTitleChoices:{titles:Array.isArray(titles)?titles:['建込','コン打ち','解体','運搬']}};
    }
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
