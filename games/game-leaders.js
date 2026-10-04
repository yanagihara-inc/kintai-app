(()=>{
 const units={math:'問',mole:'回',drop:'個',maze:'本',order:'個',color:'問',chest:'回'};
 function show(id,rows){const el=document.getElementById(id+'Leader');if(!el)return;const leaders=rows.filter(r=>r.rank===1&&r.score!==null);el.textContent=leaders.length?'🏆 1位 '+leaders.map(r=>r.name).join('・')+' '+leaders[0].score+units[id]:'1位：まだ記録がありません';}
 for(const id of Object.keys(units)){const button=document.getElementById(id==='math'?'mathRankingOpen':id+'RankingOpen');if(!button)continue;const el=document.createElement('span');el.id=id+'Leader';el.className='game-leader';el.setAttribute('role','status');el.textContent='1位：読み込み中…';button.after(el);}
 window.addEventListener('game-ranking-updated',e=>show(e.detail.gameId,e.detail.rows));
 (async()=>{if(!await gameReady){for(const id of Object.keys(units))document.getElementById(id+'Leader').textContent='1位：接続設定を確認してください';return;}try{const result=await callShared({action:'gameLeaders'});for(const id of Object.keys(units)){if(result.ok&&result.leaders)show(id,result.leaders[id]||[]);else document.getElementById(id+'Leader').textContent='1位：取得できません';}}catch{for(const id of Object.keys(units))document.getElementById(id+'Leader').textContent='1位：取得できません';}})();
})();
