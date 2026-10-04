function mathGameRanking_(book,members,input){
  const gameId=String(input.gameId||'math');if(!['math','mole','drop','maze','order','color','chest','formwork'].includes(gameId))throw new Error('ゲームが見つかりません');
  const name=String(input.name||''),active=members.getDataRange().getValues().slice(1).filter(r=>r[0]&&r[1]!==false).map(r=>String(r[0]));
  if(!active.includes(name))throw new Error('有効な登録メンバーではありません');
  if(!verifyDeviceToken_(book,name,String(input.deviceToken||'')))throw new Error('本人端末の登録を確認してください');
  if(input.action==='saveMathGameScore'&&(!Number.isInteger(input.score)||input.score<0||input.score>100000))throw new Error('得点が不正です');
  const sheetName=gameId==='formwork'?'型枠ビルダーランキング':gameId==='order'?'順番タップランキング':gameId==='color'?'色当てランキング':gameId==='chest'?'宝箱えらびランキング':gameId==='maze'?'三本道迷路ランキング':gameId==='mole'?'数字もぐらランキング':gameId==='drop'?'数字落ちゲームランキング':'計算ゲームランキング';
  const sheet=ensureSheet_(book,sheetName,['氏名','最高得点','更新日時']),rows=sheet.getDataRange().getValues();
  if(input.action==='saveMathGameScore'){
    let target=0,best=-1;for(let i=1;i<rows.length;i++)if(String(rows[i][0])===name){target=i+1;best=Number(rows[i][1]);break;}
    if(input.score>best){const record=[name,input.score,new Date()];if(target){sheet.getRange(target,1,1,3).setValues([record]);rows[target-1]=record;}else{sheet.appendRow(record);rows.push(record);}}
  }
  const bestByName=new Map();rows.slice(1).forEach(r=>{const n=String(r[0]),s=Number(r[1]);if(active.includes(n)&&Number.isInteger(s)&&s>=0)bestByName.set(n,Math.max(bestByName.get(n)??-1,s));});
  const ranking=active.map(n=>({name:n,score:bestByName.has(n)?bestByName.get(n):null})).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.name.localeCompare(b.name,'ja'));
  let rank=0;ranking.forEach((r,i)=>{if(r.score===null){r.rank=null;return;}if(i===0||r.score!==ranking[i-1].score)rank=i+1;r.rank=rank;});
  return {ok:true,ranking};
}
