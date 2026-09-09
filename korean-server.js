'use strict';
const crypto=require('node:crypto');
const {games,bank}=require('./korean-data');
const puzzles=require('./korean-puzzles');
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const normalize=s=>String(s??'').normalize('NFC').trim().replace(/\s+/g,' ').replace(/[.!?。]+$/u,'');
function prepare(q){
 if(puzzles.isPuzzle(q))return puzzles.prepare(q);
 const x=structuredClone(q);
 if(q.options){const indices=shuffle(q.options.map((_,i)=>i));x.options=indices.map(i=>q.options[i]);x.answer=q.kind==='nuance'?q.answer.map(a=>indices.indexOf(a)):indices.indexOf(q.answer);}
 if(q.cards){const indices=shuffle(q.cards.map((_,i)=>i));if(indices.every((v,i)=>v===i))indices.push(indices.shift());x.cards=indices.map(i=>q.cards[i]);x.answer=q.answer.map(a=>indices.indexOf(a));}
 return x;
}
function grade(q,a){
 if(puzzles.isPuzzle(q))return puzzles.grade(q,a);
 if(q.kind==='sniper')return Number.isInteger(a)&&a===q.answer;
 if(q.kind==='order'||q.kind==='nuance')return Array.isArray(a)&&JSON.stringify(a)===JSON.stringify(q.answer);
 if(q.kind==='survival')return typeof a==='string'&&normalize(a)===normalize(q.answer);
 if(q.kind==='repair')return a&&a.index===q.answer.index&&[q.answer.text,...(q.accepted||[])].some(t=>normalize(a.text)===normalize(t));
 return false;
}
function selectBank(game,level,review=[],seen=[]){
 const ranges={1:[1,2],2:[2,3],3:[3,4],4:[4,5],5:[5]};
 let pool=bank.filter(q=>((game==='boss'&&(review.length||!puzzles.isPuzzle(q)))||q.kind===game)&&(review.length?review.includes(q.id):ranges[level].includes(q.level)));
 const used=new Set(seen);pool=shuffle(pool);return [...pool.filter(q=>!used.has(q.id)),...pool.filter(q=>used.has(q.id))];
}
function solutionText(q){if(puzzles.isPuzzle(q))return puzzles.solution(q);if(q.kind==='sniper')return q.options[q.answer];if(q.kind==='nuance')return q.answer.map((n,i)=>`${i+1}: ${q.options[n]}`).join(' / ');if(q.kind==='order')return q.answer.map(n=>q.cards[n]).join(' ');if(q.kind==='repair')return `${q.parts[q.answer.index]} → ${q.answer.text}`;return q.answer;}
function install(io,config={}){
 const ns=io.of('/korean'),rooms=new Map(),sessions=new Map();
 const grace=config.grace??30000,reviewMs=config.reviewMs??60000;
 function cancel(r){clearTimeout(r.timer);r.timer=null;r.deadline=0;}
 function timer(r,ms,fn){cancel(r);r.deadline=Date.now()+ms;r.timer=setTimeout(()=>{if(rooms.get(r.code)===r)fn();},ms);r.timer.unref?.();}
 function active(r){return [...r.players.values()].filter(p=>p.connected);}
 function wipe(r){cancel(r);clearTimeout(r.expiry);rooms.delete(r.code);for(const p of r.players.values()){clearTimeout(p.disconnectTimer);sessions.delete(p.token);}}
 function roster(r){return [...r.players.values()].map(p=>({id:p.id,name:p.name,score:p.score,hp:p.hp,combo:p.combo,connected:p.connected,host:r.host===p.id}));}
 function publicQuestion(q,p){if(!q)return null;if(puzzles.isPuzzle(q))return puzzles.publicQuestion(q,p.puzzle);const {answer,accepted,explanation,ja,similar,...safe}=q;return safe;}
 function state(r,p){return{code:r.code,game:r.game,mode:r.mode,level:r.level,phase:r.phase,round:r.index+1,total:r.items.length,deadline:r.deadline,now:Date.now(),roundKey:r.roundKey,runId:r.runId,you:p.id,host:r.host===p.id,players:roster(r),teamHp:r.teamHp,bossLeft:r.bossLeft,bossMax:r.bossMax,question:r.phase==='question'?publicQuestion(r.items[r.index],p):null,submitted:r.answers.has(p.id),ready:r.ready.has(p.id),done:r.answers.size,review:r.phase==='review'?r.review:null,history:p.history,summary:r.phase==='finished'?p.history:null,reason:r.reason||'',poolCount:r.items.length};}
 function broadcast(r){for(const p of r.players.values())if(p.connected)ns.to(p.socketId).emit('state',state(r,p));}
 function finish(r,reason){cancel(r);r.phase='finished';r.reason=reason;broadcast(r);}
 function next(r){
 const alive=active(r);if(!alive.length)return;
 if(r.index+1>=r.items.length)return finish(r,'모든 미션 완료');
 const hpGame=r.mode==='coop'||['survival','boss'].includes(r.game);
 if(hpGame&&(r.mode==='coop'?r.teamHp<=0:alive.every(p=>p.hp<=0)))return finish(r,'HP 소진 · 오답을 복습하고 다시 도전하세요.');
 r.index++;r.phase='question';r.roundKey=crypto.randomUUID();r.answers.clear();r.ready.clear();r.review=null;for(const p of r.players.values())p.puzzle=puzzles.progress();
 const q=r.items[r.index];const duration=config.questionMs??({sniper:35000,nuance:55000,survival:35000,order:65000,repair:65000,memory:120000,search:120000}[q.kind]);
 timer(r,duration,()=>reveal(r));broadcast(r);
 }
 function advance(r){if(r.phase!=='review')return;cancel(r);next(r);}
 function reveal(r){
 if(r.phase!=='question')return;cancel(r);r.phase='review';const q=r.items[r.index],results=[];
 for(const p of r.players.values()){
  const a=r.answers.get(p.id);if(!p.connected&&!a)continue;
  if(['survival','boss'].includes(r.game)&&r.mode!=='coop'&&p.hp<=0)continue;
  const correct=!!a&&grade(q,a.value);p.combo=correct?p.combo+1:0;const points=correct?100+Math.min(100,(p.combo-1)*20):0;p.score+=points;if(!correct)p.hp=Math.max(0,p.hp-1);
  const record={id:q.id,kind:q.kind,area:q.area,level:q.level,correct,points,prompt:q.prompt,answer:solutionText(q),explanation:q.explanation,ja:q.ja,time:Date.now(),round:r.index,key:`${r.runId}:${r.index}:${p.id}`};p.history.push(record);
  results.push({id:p.id,name:p.name,correct,points,answer:puzzles.isPuzzle(q)?(a?'모두 찾음':`${q.kind==='memory'?p.puzzle.matched.length:p.puzzle.found.length}/${q.pairs.length}개 찾음`):a?.value??null});
 }
 if(results.length&&results.some(x=>!x.correct))r.teamHp=Math.max(0,r.teamHp-1);
 if(results.some(x=>x.correct))r.bossLeft=Math.max(0,r.bossLeft-1);
 r.review={question:q,results};timer(r,reviewMs,()=>advance(r));broadcast(r);
 }
 function check(r){const players=active(r).filter(p=>r.mode==='coop'||!['survival','boss'].includes(r.game)||p.hp>0);if(!players.length)return;if(r.phase==='question'&&players.every(p=>r.answers.has(p.id)))reveal(r);else if(r.phase==='review'&&active(r).every(p=>r.ready.has(p.id)))advance(r);}
 function leave(r,p){
 clearTimeout(p.disconnectTimer);sessions.delete(p.token);r.players.delete(p.id);r.answers.delete(p.id);r.ready.delete(p.id);
 if(!r.players.size){wipe(r);return;}
 if(r.host===p.id)r.host=(active(r)[0]||[...r.players.values()][0]).id;
 broadcast(r);check(r);
 }
 function playerFor(socket){const session=sessions.get(socket.data.token);if(!session||session.p.socketId!==socket.id||rooms.get(session.r.code)!==session.r)return null;return session;}
 function attach(socket,r,p){
 clearTimeout(p.disconnectTimer);if(p.socketId&&p.socketId!==socket.id){const old=ns.sockets.get(p.socketId);old?.emit('replaced');if(old)old.data.token=null;old?.disconnect(true);}
 p.socketId=socket.id;p.connected=true;socket.data.token=p.token;sessions.set(p.token,{r,p});socket.emit('session',{token:p.token,code:r.code});if(r.phase==='review'&&!r.deadline)advance(r);else broadcast(r);
 }
 function newPlayer(socket,name){return{id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('hex'),socketId:socket.id,name:String(name||'플레이어').trim().slice(0,18)||'플레이어',connected:true,score:0,hp:3,combo:0,history:[],puzzle:puzzles.progress()};}
 ns.on('connection',socket=>{
  socket.emit('catalog',{games,counts:Object.fromEntries(Object.keys(games).map(g=>[g,bank.filter(q=>g==='boss'||q.kind===g).length]))});
  function handle(event,fn){socket.on(event,(data={})=>{try{if(!data||typeof data!=='object'||Array.isArray(data))return;fn(data);}catch{socket.emit('error-message','요청을 처리하지 못했습니다. 다시 시도해 주세요.');}});}
  handle('resume',({token})=>{const s=sessions.get(token);if(!s)return socket.emit('session-expired','방이 종료되었거나 재접속 시간이 지났습니다. 새 방을 만들어 주세요.');attach(socket,s.r,s.p);});
  handle('create',d=>{
   if(playerFor(socket))return socket.emit('error-message','현재 방에서 먼저 나가 주세요.');if(rooms.size>=500)return socket.emit('error-message','현재 방이 많습니다. 잠시 후 다시 시도해 주세요.');
   const game=Object.hasOwn(games,d.game)?d.game:'sniper',mode=['solo','vs','coop'].includes(d.mode)?d.mode:'solo',level=[1,2,3,4,5].includes(d.level)?d.level:4;
   const review=mode==='solo'&&Array.isArray(d.review)?d.review.filter(x=>typeof x==='string').slice(0,100):[];
   const seen=mode==='solo'&&Array.isArray(d.seen)?d.seen.filter(x=>typeof x==='string').slice(0,200):[];
   let items=selectBank(game,level,review,seen);const count=[5,10,20,30].includes(d.count)?d.count:10;if(game==='boss'){const groups=Object.keys(games).filter(k=>k!=='boss').map(k=>items.filter(q=>q.kind===k));items=[];while(groups.some(g=>g.length))for(const g of groups)if(g.length)items.push(g.shift());}items=items.slice(0,count).map(prepare);
   if(!items.length)return socket.emit('error-message','이 조건에 맞는 복습 문제가 없습니다.');
   let code;do{code='K'+crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
   const p=newPlayer(socket,d.name),r={code,game,mode,level,players:new Map([[p.id,p]]),host:p.id,phase:'lobby',items,index:-1,answers:new Map(),ready:new Set(),timer:null,deadline:0,teamHp:5,bossLeft:items.length,bossMax:items.length,runId:crypto.randomUUID()};
   rooms.set(code,r);r.expiry=setTimeout(()=>{for(const x of r.players.values())ns.to(x.socketId).emit('session-expired','방 이용 시간이 종료되었습니다.');wipe(r);},2*60*60*1000);r.expiry.unref?.();attach(socket,r,p);
   if(mode==='solo')next(r);
  });
  handle('join',d=>{if(playerFor(socket))return socket.emit('error-message','현재 방에서 먼저 나가 주세요.');const r=rooms.get(String(d.code||'').toUpperCase().trim());if(!r||r.mode==='solo')return socket.emit('error-message','참가할 수 있는 방을 찾지 못했습니다.');if(r.phase!=='lobby')return socket.emit('error-message','이미 시작한 방입니다.');if(r.players.size>=8)return socket.emit('error-message','최대 8명까지 참여할 수 있습니다.');const p=newPlayer(socket,d.name);r.players.set(p.id,p);attach(socket,r,p);});
  handle('start',()=>{const s=playerFor(socket);if(!s||s.r.host!==s.p.id||s.r.phase!=='lobby')return;if(active(s.r).length<2)return socket.emit('error-message','함께할 플레이어가 한 명 더 필요합니다.');next(s.r);});
  handle('answer',d=>{const s=playerFor(socket);if(!s)return;const {r,p}=s;if(r.phase!=='question'||r.roundKey!==d.roundKey||r.answers.has(p.id))return;if(Date.now()>=r.deadline){reveal(r);return;}if(['boss','survival'].includes(r.game)&&r.mode!=='coop'&&p.hp<=0)return;
   if(puzzles.isPuzzle(r.items[r.index]))return;
   if(JSON.stringify(d.answer??null).length>1000)return;r.answers.set(p.id,{value:d.answer});broadcast(r);check(r);
  });
  handle('puzzle-move',d=>{const s=playerFor(socket);if(!s)return;const {r,p}=s,q=r.items[r.index];
   if(r.phase!=='question'||r.roundKey!==d.roundKey||r.answers.has(p.id)||!puzzles.isPuzzle(q))return;
   if(Date.now()>=r.deadline){reveal(r);return;}if(r.game==='boss'&&r.mode!=='coop'&&p.hp<=0)return;
   if(!puzzles.move(q,p.puzzle,d))return;
   if(puzzles.complete(q,p.puzzle))r.answers.set(p.id,{value:q.answer});
   broadcast(r);check(r);
  });
  handle('ready',d=>{const s=playerFor(socket);if(!s||s.r.phase!=='review'||s.r.roundKey!==d.roundKey)return;s.r.ready.add(s.p.id);broadcast(s.r);check(s.r);});
  handle('sync',()=>{const s=playerFor(socket);if(s)socket.emit('state',state(s.r,s.p));});
  handle('leave',()=>{const s=playerFor(socket);if(s)leave(s.r,s.p);socket.data.token=null;socket.emit('left');});
  socket.on('disconnect',()=>{const s=playerFor(socket);if(!s)return;const {r,p}=s;p.connected=false;broadcast(r);check(r);p.disconnectTimer=setTimeout(()=>leave(r,p),grace);p.disconnectTimer.unref?.();});
 });
 return{rooms,close(){for(const r of rooms.values())wipe(r);}};
}
module.exports=install;module.exports.grade=grade;module.exports.prepare=prepare;module.exports.selectBank=selectBank;
