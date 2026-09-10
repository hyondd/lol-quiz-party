'use strict';
const crypto=require('node:crypto'),data=require('./duo-data');
const norm=s=>String(s??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
module.exports=function install(io,config={}){
 const ns=io.of('/duo'),rooms=new Map(),sessions=new Map(),grace=config.grace??30000;
 function clear(r){clearTimeout(r.timer);r.timer=null;r.deadline=0;}
 function schedule(r,ms,fn){clear(r);r.deadline=Date.now()+ms;r.timer=setTimeout(()=>{if(rooms.get(r.code)===r)fn();},ms);r.timer.unref?.();}
 function destroy(r){clear(r);clearTimeout(r.expiry);for(const p of r.players.values()){clearTimeout(p.offlineTimer);sessions.delete(p.token);}rooms.delete(r.code);}
 function current(socket){const s=sessions.get(socket.data.duoToken);return s&&s.p.socketId===socket.id&&rooms.has(s.r.code)?s:null;}
 function payload(r,p){
  const item=r.items[r.index];return{code:r.code,game:r.game,title:data.games[r.game].title,rule:data.games[r.game].rule,phase:r.phase,runId:r.runId,roundKey:r.key,round:r.index+1,total:r.items.length,now:Date.now(),deadline:r.deadline,startAt:r.startAt,you:p.id,host:r.host===p.id,players:[...r.players.values()].map(x=>({id:x.id,name:x.name,score:x.score,connected:x.connected})),submitted:r.answers.has(p.id),ready:r.ready.has(p.id),messages:r.messages,result:r.phase==='review'?r.result:null,
  item:r.phase==='round'?(r.game==='taboo'?{role:r.explainer===p.id?'explain':'guess',...(r.explainer===p.id?item:{})}:item):null};
 }
 function emit(r){for(const p of r.players.values())if(p.connected)ns.to(p.socketId).emit('state',payload(r,p));}
 function next(r){
  if(r.players.size!==2||[...r.players.values()].some(p=>!p.connected)){r.phase='lobby';clear(r);emit(r);return;}
  r.index++;r.answers.clear();r.ready.clear();r.messages=[];r.result=null;r.key=crypto.randomUUID();
  if(r.index>=r.items.length){r.phase='finished';clear(r);emit(r);return;}
  r.phase='round';r.explainer=[...r.players.keys()][r.index%2];r.startAt=Date.now()+(config.leadMs??3000);
  schedule(r,config.roundMs??(r.game==='timing'?r.items[r.index].target+9000:75000),()=>reveal(r));emit(r);
 }
 function reveal(r,solved=false){
  if(r.phase!=='round')return;clear(r);const item=r.items[r.index],players=[...r.players.values()],results=[];
  for(const p of players){const a=r.answers.get(p.id);let points=0,detail='';
   if(r.game==='taboo'){points=solved?100:0;detail=solved?'함께 정답을 맞혔어요!':'이번에는 시간 초과';}
   if(r.game==='telepathy'){const other=players.find(x=>x.id!==p.id),b=r.answers.get(other?.id);points=a&&b&&a.predict===b.own?100:0;detail=a?`내 선택: ${item.options[a.own]} / 상대 예상: ${item.options[a.predict]}`:'미제출';}
   if(r.game==='timing'){const diff=a?Math.abs(a.elapsed-item.target):null;points=diff===null?0:Math.max(0,Math.round(100-diff/30));detail=a?`${(a.elapsed/1000).toFixed(2)}초 · 오차 ${(diff/1000).toFixed(2)}초`:'미제출';}
   p.score+=points;results.push({id:p.id,name:p.name,points,detail});
  }
  r.phase='review';r.result={heading:r.game==='taboo'?`정답: ${item.word}`:r.game==='timing'?`목표: ${item.target/1000}초`:item.prompt,results};schedule(r,config.reviewMs??30000,()=>next(r));emit(r);
 }
 function leave(r,p){clearTimeout(p.offlineTimer);sessions.delete(p.token);r.players.delete(p.id);r.answers.delete(p.id);r.ready.delete(p.id);if(!r.players.size)return destroy(r);if(r.host===p.id)r.host=[...r.players.keys()][0];clear(r);r.phase='lobby';r.messages=[];emit(r);}
 function attach(socket,r,p){clearTimeout(p.offlineTimer);if(p.socketId!==socket.id){const old=ns.sockets.get(p.socketId);if(old){old.data.duoToken=null;old.emit('expired','다른 탭에서 같은 방을 열었습니다.');old.disconnect(true);}}p.connected=true;p.socketId=socket.id;socket.data.duoToken=p.token;sessions.set(p.token,{r,p});socket.emit('session',{token:p.token,code:r.code});emit(r);}
 function player(socket,name){return{id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('hex'),socketId:socket.id,connected:true,name:String(name||'플레이어').trim().slice(0,18)||'플레이어',score:0,lastMessage:0};}
 ns.on('connection',socket=>{
  socket.emit('catalog',data.games);
  function handle(name,fn){socket.on(name,(d={})=>{if(!d||typeof d!=='object'||Array.isArray(d))return;try{fn(d);}catch{socket.emit('error-message','다시 시도해 주세요.');}});}
  handle('create',d=>{if(current(socket))return socket.emit('error-message','먼저 현재 방에서 나가 주세요.');if(rooms.size>=500)return socket.emit('error-message','잠시 후 다시 시도해 주세요.');const game=Object.hasOwn(data.games,d.game)?d.game:'telepathy',count=d.count===10?10:5;
   const items=shuffle(game==='taboo'?data.taboo:game==='telepathy'?data.telepathy:[3000,3500,4000,4500,5000,5500,6000,6500,7000,7500].map(target=>({target}))).slice(0,count);
   let code;do{code='D'+crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const p=player(socket,d.name),r={code,game,items,players:new Map([[p.id,p]]),host:p.id,phase:'lobby',index:-1,answers:new Map(),ready:new Set(),messages:[],runId:crypto.randomUUID(),key:null};rooms.set(code,r);r.expiry=setTimeout(()=>{for(const x of r.players.values())ns.to(x.socketId).emit('expired','방 이용 시간이 끝났습니다.');destroy(r);},7200000);r.expiry.unref?.();attach(socket,r,p);
  });
  handle('join',d=>{if(current(socket))return socket.emit('error-message','먼저 현재 방에서 나가 주세요.');const r=rooms.get(String(d.code||'').trim().toUpperCase());if(!r)return socket.emit('error-message','방을 찾지 못했습니다.');if(r.phase!=='lobby'||r.players.size>=2)return socket.emit('error-message','참가 가능한 빈자리가 없습니다.');const p=player(socket,d.name);r.players.set(p.id,p);attach(socket,r,p);});
  handle('resume',d=>{const s=sessions.get(d.token);if(!s)return socket.emit('expired','이전 방이 종료되었습니다.');attach(socket,s.r,s.p);});
  handle('start',()=>{const s=current(socket);if(!s||s.r.host!==s.p.id||s.r.phase!=='lobby')return;const r=s.r;if(r.players.size!==2||[...r.players.values()].some(p=>!p.connected))return socket.emit('error-message','두 사람이 모두 연결되어야 시작할 수 있어요.');r.index=-1;r.runId=crypto.randomUUID();for(const p of r.players.values())p.score=0;next(r);});
  function round(socket,d){const s=current(socket);if(!s||s.r.phase!=='round'||s.r.key!==d.roundKey)return null;if(Date.now()>=s.r.deadline){reveal(s.r);return null;}return s;}
  handle('chat',d=>{const s=round(socket,d);if(!s||s.r.game!=='taboo')return;const {r,p}=s;if(Date.now()-p.lastMessage<350)return;const text=String(d.text||'').trim().slice(0,160);if(!text)return;const item=r.items[r.index];
   if(r.explainer===p.id&&[item.word,...item.banned].some(word=>norm(text).includes(norm(word))))return socket.emit('error-message','정답이나 금지어가 포함됐어요. 다른 표현으로 설명해 주세요.');
   p.lastMessage=Date.now();r.messages.push({name:p.name,text,role:r.explainer===p.id?'설명':'추리'});r.messages=r.messages.slice(-30);socket.emit('chat-accepted');
   if(r.explainer!==p.id&&norm(text)===norm(item.word))return reveal(r,true);emit(r);
  });
  handle('answer',d=>{const s=round(socket,d);if(!s||s.r.answers.has(s.p.id))return;const {r,p}=s;
   if(r.game==='telepathy'){if(![d.own,d.predict].every(n=>Number.isInteger(n)&&n>=0&&n<4))return;r.answers.set(p.id,{own:d.own,predict:d.predict});}
   else if(r.game==='timing'){if(Date.now()<r.startAt)return socket.emit('error-message','시작 신호를 기다려 주세요.');r.answers.set(p.id,{elapsed:Date.now()-r.startAt});}else return;
   if(r.answers.size===2)reveal(r);else emit(r);
  });
  handle('ready',d=>{const s=current(socket);if(!s||s.r.phase!=='review'||s.r.key!==d.roundKey)return;s.r.ready.add(s.p.id);if(s.r.ready.size===2)next(s.r);else emit(s.r);});
  handle('sync',()=>{const s=current(socket);if(s)socket.emit('state',payload(s.r,s.p));});
  handle('leave',()=>{const s=current(socket);if(s)leave(s.r,s.p);socket.data.duoToken=null;socket.emit('left');});
  socket.on('disconnect',()=>{const s=current(socket);if(!s)return;s.p.connected=false;emit(s.r);s.p.offlineTimer=setTimeout(()=>leave(s.r,s.p),grace);s.p.offlineTimer.unref?.();});
 });
 return{rooms,close(){for(const r of rooms.values())destroy(r);}};
};
module.exports.norm=norm;
