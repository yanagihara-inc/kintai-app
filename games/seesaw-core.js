(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.SeesawGame=factory();})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
class Game {
constructor(random=Math.random){this.random=random;this.elapsed=0;this.angle=0;this.velocity=0;this.player=0;this.walk=0;this.loads=[];this.falling=[];this.events=[];this.score=0;this.saved=0;this.misses=0;this.danger=0;this.ended=false;this.reason='';this.serial=0;this.cooldown=0;this.next=this.plan(2.5);}
get remaining(){return Math.max(0,60-this.elapsed);}get level(){return Math.min(6,1+Math.floor(this.elapsed/10));}get torque(){return this.loads.reduce((sum,b)=>sum+b.mass*b.x,0)+this.player*34;}get balance(){return clamp(Math.abs(this.angle)/.44,0,1);}
plan(delay){let side=this.random()<.5?-1:1;const distance=120+this.random()*115,mass=[18,24,30][Math.floor(this.random()*3)],moment=[...this.loads,...this.falling].reduce((sum,b)=>sum+b.mass*b.x,0);if(Math.abs(moment+side*distance*mass)>7200&&Math.abs(moment-side*distance*mass)<Math.abs(moment+side*distance*mass))side=-side;return {x:side*distance,mass,at:this.elapsed+delay,id:++this.serial};}
emit(type,values={}){this.events.push({type,...values});}drain(){return this.events.splice(0);}finish(reason){if(this.ended)return;this.ended=true;this.reason=reason;this.emit('end',{reason});}
step(dt,direction=0){if(this.ended||!Number.isFinite(dt)||dt<=0)return;let rest=Math.min(dt,this.remaining);while(rest>1e-8&&!this.ended){const slice=Math.min(rest,1/120);this.advance(slice,clamp(direction,-1,1));rest-=slice;}}
advance(dt,input){
this.elapsed=Math.min(60,this.elapsed+dt);this.cooldown=Math.max(0,this.cooldown-dt);const move=input*230*dt;this.player=clamp(this.player+move,-235,235);this.walk+=Math.abs(move)*.09;
if(this.elapsed>=this.next.at&&this.elapsed<59){this.falling.push({...this.next,y:-70,v:55});this.next=this.plan(Math.max(.95,2.2-(this.level-1)*.25));this.emit('release');}
for(const b of this.falling){b.v+=520*dt;b.y+=b.v*dt;const surface=405+Math.tan(this.angle)*b.x-22;if(b.y>=surface){b.landed=true;this.loads.push({...b,age:0,x:b.x/Math.cos(this.angle)});this.velocity+=b.mass*b.x*.000016;this.emit('land',{x:b.x,mass:b.mass});}}
this.falling=this.falling.filter(b=>!b.landed);for(const b of this.loads)b.age+=dt;
const collected=this.loads.filter(b=>b.age>=4.8);for(const b of collected){this.saved++;const points=Math.abs(this.angle)<.16?150:100;this.score+=points;this.emit('saved',{x:b.x,points});}this.loads=this.loads.filter(b=>b.age<4.8);
this.velocity+=(this.torque*.00018-this.angle*1.05-this.velocity*1.9)*dt;this.angle=clamp(this.angle+this.velocity*dt,-.55,.55);this.danger=Math.abs(this.angle)>.38?this.danger+dt:Math.max(0,this.danger-dt*2.5);
if(this.danger>.60&&this.cooldown===0&&this.loads.some(b=>Math.sign(b.x)===Math.sign(this.angle))){const side=Math.sign(this.angle),dropped=this.loads.filter(b=>Math.sign(b.x)===side);this.loads=this.loads.filter(b=>!dropped.includes(b));this.misses++;this.emit('miss',{side,loads:dropped,angle:this.angle});this.danger=0;this.cooldown=1.3;this.velocity=-this.angle*1.2;if(this.misses>=3)this.finish('falls');}
if(this.elapsed>=60-1e-7){this.elapsed=60;this.finish('time');}
}}
return {Game,clamp};});
