'use strict';
const crypto=require('node:crypto');
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const isPuzzle=q=>q&&['memory','search'].includes(q.kind);
// Original, short definitions make the first round approachable.
const themes=[
 [1,'함께 일하기',[['협력','힘을 합쳐 함께 일함','協力'],['갈등','생각이나 이해관계가 충돌함','対立'],['양보','자신의 몫이나 주장을 일부 물러섬','譲歩']]],
 [1,'생각 나누기',[['의견','어떤 일에 대한 자신의 생각','意見'],['근거','주장을 뒷받침하는 이유나 자료','根拠'],['반대','다른 의견에 찬성하지 않음','反対']]],
 [2,'서로 이해하기',[['타협','서로 조금씩 양보해 의견을 맞춤','妥協'],['공감','다른 사람의 감정이나 생각을 이해함','共感'],['오해','뜻이나 사실을 잘못 이해함','誤解']]],
 [2,'변화 살피기',[['증가','수나 양이 더 많아짐','増加'],['감소','수나 양이 더 적어짐','減少'],['유지','현재의 상태가 계속되도록 함','維持']]],
 [3,'판단의 도구',[['추론','알고 있는 사실로 다른 결론을 이끌어 냄','推論'],['검증','사실인지 따져 확인함','検証'],['가설','검증하기 위해 임시로 세운 설명','仮説']]],
 [3,'의견 조율',[['합의','서로의 의견이 일치함','合意'],['반박','다른 주장에 반대 근거를 제시함','反論'],['설득','이유를 설명해 상대가 받아들이게 함','説得']]],
 [4,'사회를 읽다',[['편견','충분히 살피지 않고 한쪽으로 치우친 생각','偏見'],['관행','오랫동안 반복되어 굳어진 방식','慣行'],['격차','수준이나 정도의 차이','格差']]],
 [4,'변화를 만들다',[['촉진','일이 더 잘 진행되도록 북돋움','促進'],['억제','정도나 진행을 눌러 막음','抑制'],['완화','긴장이나 심한 정도를 누그러뜨림','緩和']]],
 [5,'논리의 흐름',[['전제','논의를 시작할 때 바탕으로 삼는 조건','前提'],['귀결','논의나 사건이 마지막 결과에 이름','帰結'],['함의','직접 드러나지 않아도 속에 담긴 뜻','含意']]],
 [5,'복잡한 관계',[['상충','서로 맞지 않아 충돌함','相反'],['양립','두 가지가 함께 성립함','両立'],['매개','서로 사이에 들어 관계를 이어 줌','媒介']]]
];
function items(){return ['memory','search'].flatMap(kind=>themes.map(([level,theme,words],i)=>({id:`${kind}-${i+1}`,kind,level,area:'어휘',prompt:theme,pairs:words.map(([word,meaning,ja])=>({word,meaning,ja})),explanation:words.map(([w,m])=>`${w}: ${m}`).join(' / '),ja:words.map(([w,,j])=>`${w}＝${j}`).join(' / '),similar:'단어의 뜻을 떠올리고 예문으로 한 번 말해 보세요.'})));}
function prepare(q){const x=structuredClone(q);if(q.kind==='memory'){x.tiles=shuffle(q.pairs.flatMap((p,i)=>[{pair:i,text:p.word},{pair:i,text:p.meaning}]));x.answer=q.pairs.map((_,i)=>i);}else{
 const size=6,grid=Array(size*size).fill(null),paths=[];
 for(const p of q.pairs){const positions=[];for(let y=0;y<size;y++)for(let col=0;col<size;col++)for(const[dy,dx]of [[0,1],[1,0]]){const path=[...p.word].map((_,i)=>(y+i*dy)*size+col+i*dx);if(y+(p.word.length-1)*dy<size&&col+(p.word.length-1)*dx<size&&path.every(n=>grid[n]===null))positions.push(path);}const path=shuffle(positions)[0];if(!path)throw Error('Cannot place word');path.forEach((n,i)=>grid[n]=p.word[i]);paths.push(path);}
 const filler=[...'가나다라마바사아자차카타파하경제사회문화생각'];x.grid=grid.map(v=>v??filler[crypto.randomInt(filler.length)]);x.size=size;x.answer=paths;x.clues=q.pairs.map(p=>({meaning:p.meaning,length:p.word.length}));
 }return x;}
function progress(){return{open:[],matched:[],found:[],attempts:0,peekUntil:0,message:'',paths:[]};}
function refresh(p,now=Date.now()){if(p.peekUntil&&now>=p.peekUntil){p.open=[];p.peekUntil=0;}}
function publicQuestion(q,p){refresh(p);const {answer,pairs,tiles,explanation,ja,similar,...safe}=q;
 if(q.kind==='memory')safe.tiles=q.tiles.map((t,i)=>({text:p.open.includes(i)||p.matched.includes(t.pair)?t.text:null,matched:p.matched.includes(t.pair)}));
 safe.progress={attempts:p.attempts,found:q.kind==='memory'?p.matched.length:p.found.length,total:q.pairs.length,peekUntil:p.peekUntil,message:p.message,foundClues:p.found,paths:p.paths};return safe;}
function wordAt(q,path){if(!Array.isArray(path)||path.length<2||path.length>6||!path.every(n=>Number.isInteger(n)&&n>=0&&n<q.grid.length))return null;const delta=path[1]-path[0];if(![1,-1,q.size,-q.size].includes(delta)||!path.every((n,i)=>i===0||n-path[i-1]===delta))return null;if(Math.abs(delta)===1&&!path.every(n=>Math.floor(n/q.size)===Math.floor(path[0]/q.size)))return null;return path.map(n=>q.grid[n]).join('');}
function move(q,p,d,now=Date.now()){
 refresh(p,now);
 if(q.kind==='memory'){
  const i=d.index;if(!Number.isInteger(i)||i<0||i>=q.tiles.length||p.peekUntil||p.open.includes(i)||p.matched.includes(q.tiles[i].pair))return false;
  p.open.push(i);p.message='다른 카드 한 장을 뒤집으세요.';
  if(p.open.length===2){p.attempts++;const[a,b]=p.open;if(q.tiles[a].pair===q.tiles[b].pair){p.matched.push(q.tiles[a].pair);p.open=[];p.message='짝을 찾았어요!';}else{p.peekUntil=now+1300;p.message='다른 뜻이에요. 위치를 기억해 두세요.';}}
 }else{
  const i=d.clue;if(!Number.isInteger(i)||i<0||i>=q.pairs.length||p.found.includes(i))return false;
  const word=wordAt(q,d.path);if(word===null)return false;p.attempts++;
  if(word===q.pairs[i].word){p.found.push(i);p.paths.push(d.path);p.message='단어를 찾았어요!';}else p.message='그 뜻에 맞는 단어가 아니에요. 다시 찾아보세요.';
 }return true;
}
function complete(q,p){return q.kind==='memory'?p.matched.length===q.pairs.length:p.found.length===q.pairs.length;}
function grade(q,a){return JSON.stringify(a)===JSON.stringify(q.answer);}
const solution=q=>q.pairs.map(p=>`${p.word} · ${p.meaning}`).join(' / ');
module.exports={items,isPuzzle,prepare,progress,publicQuestion,move,complete,grade,solution,wordAt};
