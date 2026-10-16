(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PanicGames=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const recipes={
  okonomiyaki:{title:'お好み焼き危機一髪',steps:['裏返す','もう一度裏返す'],unit:'枚',base:2.8,window:.75},
  takoyaki:{title:'たこ焼き危機一髪',steps:['半回転','裏返す','取り出す'],unit:'皿',base:2.1,window:.72},
  yakitori:{title:'焼き鳥危機一髪',steps:['裏返す','タレを付ける','取り出す'],unit:'本',base:2.3,window:.7},
  mochi:{title:'もち焼き危機一髪',steps:['取り出す'],unit:'個',base:3.2,window:.72},
  tempura:{title:'天ぷら危機一髪',steps:['引き上げる'],unit:'皿',base:3.2,window:.78}
 };
 class Base {
  constructor(kind,rng=Math.random){this.kind=kind;this.rng=rng;this.elapsed=0;this.score=0;this.good=0;this.bad=0;this.lives=3;this.ended=false;this.reason='';this.events=[];}
  get level(){return Math.min(5,1+Math.floor(this.elapsed/12));}
  get remaining(){return Math.max(0,60-this.elapsed);}
  emit(type,data={}){this.events.push({type,at:this.elapsed,...data});}
  drain(){return this.events.splice(0);}
  finish(reason){if(this.ended)return;this.ended=true;this.reason=reason;this.emit('end',{reason});}
  miss(text,slot){if(this.ended)return;this.bad++;this.lives--;this.emit('miss',{text,slot});if(!this.lives)this.finish('mistakes');}
  advance(dt){if(this.ended||!Number.isFinite(dt)||dt<=0)return;this.elapsed=Math.min(60,this.elapsed+dt);this.update();if(!this.ended&&this.elapsed>=60)this.finish('time');}
 }
 class Cooking extends Base {
  constructor(kind,rng){super(kind,rng);this.recipe=recipes[kind];this.plates=Array(4).fill(null);this.available=Array(4).fill(0);this.spawn(0);}
  get capacity(){return this.elapsed<12?1:this.elapsed<30?2:this.elapsed<45?3:4;}
  spawn(slot){const type=Math.floor(this.rng()*3);this.plates[slot]={slot,type,stage:0,level:this.level,started:this.elapsed};this.schedule(this.plates[slot]);}
  schedule(p){p.started=this.elapsed;const variation=.86+this.rng()*.28;const stepScale=p.stage===1&&this.kind==='yakitori'?.7:1;const ingredientScale=this.kind==='tempura'?[1,.83,1.16][p.type]:1;const duration=this.recipe.base*variation*stepScale*ingredientScale/(1+(this.level-1)*.13);p.readyAt=this.elapsed+duration;p.window=Math.max(.36,this.recipe.window-(this.level-1)*.085);p.deadline=p.readyAt+p.window;}
  update(){for(let i=0;i<this.capacity&&!this.ended;i++){const p=this.plates[i];if(!p){if(this.elapsed<59.5&&this.elapsed>=this.available[i])this.spawn(i);}else if(this.elapsed>p.deadline){this.plates[i]=null;this.available[i]=this.elapsed+.65;this.miss(this.kind==='mochi'?'膨らみすぎてパンク！':'焼きすぎ！',i);}}}
  action(i){if(this.ended||!Number.isInteger(i))return false;const p=this.plates[i];if(!p||i>=this.capacity)return false;if(this.elapsed<p.readyAt){this.plates[i]=null;this.available[i]=this.elapsed+.65;this.miss('まだ早い！',i);return false;}
   if(this.elapsed>p.deadline){this.update();return false;}
   const perfect=Math.abs(this.elapsed-(p.readyAt+p.window/2))<p.window*.24;
   p.stage++;this.emit('flip',{slot:i,perfect});
   if(p.stage===this.recipe.steps.length){this.good++;this.score+=perfect?150:100;this.plates[i]=null;this.available[i]=this.elapsed+.45;this.emit('complete',{slot:i,text:perfect?'ぴったり！ +150':'完成！ +100'});}else{this.score+=10;this.schedule(p);}
   return true;
  }
 }
 class Bakery extends Base {
  constructor(rng){super('bakery',rng);this.stock=[2,2,2];this.ovens=Array.from({length:3},()=>({stage:'idle',quantity:0}));this.customers=[];this.nextArrival=1.6;this.serial=0;this.sold=0;this.burned=0;this.bag=[];}
  nextType(){if(!this.bag.length){this.bag=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(this.rng()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}return this.bag.pop();}
  update(){
   for(let i=0;i<3;i++){const o=this.ovens[i];if(o.stage==='baking'&&this.elapsed>=o.readyAt){o.stage='ready';this.emit('ready',{slot:i,text:'焼き上がり！ 売り場へ並べよう'});}if(o.stage==='ready'&&this.elapsed>o.burnAt){o.stage='idle';o.quantity=0;this.burned++;this.bad++;this.emit('burn',{slot:i,text:'パンを焦がしてしまった！'});}}
   if(this.elapsed>=this.nextArrival&&this.elapsed<58&&this.customers.length<4){const type=this.nextType(),quantity=this.elapsed<20?1:this.elapsed<43?2:(this.rng()<.4?3:2);this.customers.push({id:++this.serial,type,quantity,arrived:this.elapsed,readyAt:this.elapsed+.7,deadline:this.elapsed+Math.max(5.8,9.2-this.level*.6)});this.nextArrival=this.elapsed+Math.max(1.65,3.4-this.level*.32);this.emit('arrival');}
   for(const c of [...this.customers]){if(this.ended)break;if(this.elapsed>=c.readyAt&&this.stock[c.type]>=c.quantity){this.stock[c.type]-=c.quantity;this.sold+=c.quantity;this.good++;const earned=c.quantity*[150,180,200][c.type];this.score+=earned;this.customers=this.customers.filter(x=>x!==c);this.emit('sold',{slot:c.type,text:'お買い上げ！ ¥'+earned});}else if(this.elapsed>c.deadline){this.customers=this.customers.filter(x=>x!==c);this.miss('品切れでお客さんが帰ってしまった');}}
  }
  action(i){if(this.ended||!Number.isInteger(i)||i<0||i>2)return false;const o=this.ovens[i];if(o.stage==='idle'){o.stage='baking';o.started=this.elapsed;o.readyAt=this.elapsed+([4.2,4.8,5.3][i])/(1+(this.level-1)*.055);o.burnAt=o.readyAt+6;o.quantity=3;this.emit('bake',{slot:i});return true;}
   if(o.stage!=='ready')return false;const count=Math.min(o.quantity,6-this.stock[i]);if(count<=0){this.emit('full',{slot:i,text:'売り場がいっぱいです'});return false;}this.stock[i]+=count;o.quantity-=count;if(!o.quantity)o.stage='idle';this.emit('stock',{slot:i,text:count+'個、売り場に並べました'});this.update();return true;
  }
 }
 class Barrel extends Base {
  constructor(rng,players=1){super('barrel',rng);this.players=Math.max(1,Math.min(4,Math.trunc(players)||1));this.used=Array(20).fill(false);this.danger=Math.floor(this.rng()*20);this.turn=0;this.safe=0;}
  update(){}
  action(i){if(this.ended||!Number.isInteger(i)||i<0||i>=20||this.used[i])return false;this.used[i]=true;if(i===this.danger){this.emit('pop',{player:this.turn,slot:i});this.finish('pop');return true;}this.safe++;this.score=this.safe;this.good=this.safe;this.emit('safe',{slot:i,player:this.turn});this.turn=(this.turn+1)%this.players;if(this.safe===19)this.finish('clear');return true;}
 }
 class Mochitsuki extends Base {
  constructor(rng){super('mochitsuki',rng);this.lives=1;this.expected=0;this.target=1.6;this.previous=0;this.window=.22;}
  update(){if(this.elapsed>this.target+this.window)this.miss('タイミングを逃した！');}
  action(i){if(this.ended)return false;if(i!==this.expected){this.miss('順番が逆！');return false;}if(Math.abs(this.elapsed-this.target)>this.window){this.miss('タイミングが早い！');return false;}this.good++;this.score+=100;this.emit('pound',{slot:i,text:i===0?'ぺったん！ +100':'くるり！ +100'});this.expected=1-this.expected;this.previous=this.target;const tempo=Math.max(.52,1.02-this.elapsed*.008);const shift=this.good%4===0?(this.good%8===0?.25:-.2):0;this.target+=Math.max(.42,tempo+shift);this.window=Math.max(.12,.22-this.elapsed*.0015);return true;}
 }
 function create(kind,options={}){const rng=options.rng||Math.random;if(recipes[kind])return new Cooking(kind,rng);if(kind==='bakery')return new Bakery(rng);if(kind==='barrel')return new Barrel(rng,options.players);if(kind==='mochitsuki')return new Mochitsuki(rng);throw Error('Unknown game '+kind);}
 return {create,recipes};
});
