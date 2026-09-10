'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),detective=require('../korean-detective'),{prepare,selectBank}=require('../korean-server');
test('detective answer, evidence and trap reason must all match; evidence order is immaterial',()=>{
 for(const raw of detective.bank){assert.equal(raw.passage.length>=5,true);assert.equal(raw.options.includes(raw.trap),true);assert.notEqual(raw.options[raw.answer.choice],raw.trap);assert.equal(new Set(raw.answer.evidence).size,raw.evidenceCount);
  for(let n=0;n<10;n++){const q=prepare(raw);assert.ok(detective.grade(q,q.answer));assert.ok(detective.grade(q,{...q.answer,evidence:[...q.answer.evidence].reverse()}));assert.ok(!detective.grade(q,{...q.answer,evidence:[q.answer.evidence[0],q.answer.evidence[0]]}));assert.ok(!detective.grade(q,{...q.answer,reason:(q.answer.reason+1)%4}));assert.ok(!detective.grade(q,null));}
 }
 assert.ok(selectBank('boss',4).every(x=>x.kind!=='detective'));
 assert.equal(selectBank('boss',4,['detective-10'])[0].id,'detective-10');
});
