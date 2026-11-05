import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
import {gramsInput,gramsText,quantityInput,audit,clone,validate,mass} from '../src/model.mjs';import {edit,History} from '../src/edit.mjs';import {suggest,applySuggestion} from '../src/suggest.mjs';import {report,chartSvg,checklistHtml} from '../src/export.mjs';import {readProject,readFile} from '../src/handoff.mjs';import {example} from '../src/example.mjs';
test('decimal grams use exact integer milligrams without silent rounding',()=>{
 for(const [s,n] of [['0',0],['0.001',1],['1.23',1230],['50000',50000000],['450.555',450555]])assert.equal(gramsInput(s),n);
 for(let n=0;n<=50000000;n+=67123)assert.equal(gramsInput(gramsText(n)),n);
 for(const s of ['01','-1','1e3',' 1','1.0001','50000.001','NaN'])assert.throws(()=>gramsInput(s));
 for(const s of ['0','100','1.5','01'])assert.throws(()=>quantityInput(s));
});
test('example accounting includes all bundles, quantity, packed and unassigned mass',()=>{
 const a=audit(example);assert.equal(a.totalMg,5400000);assert.equal(a.packedMg,3500000);assert.equal(a.unassignedMg,1400000);assert.equal(a.packedBundles,2);assert.deepEqual(a.people.map(p=>p.mg),[500000,2300000,1200000]);
});
test('generated audits match independent carrier and packed partitions',()=>{
 for(let seed=0;seed<60;seed++){
 const b=clone(example);b.items=Array.from({length:seed%50},(_,i)=>({id:'i'+(i+1),name:'Bundle '+i,kind:i%2?'personal':'shared',unitMg:(i+seed)*1001,qty:1+i%9,carrier:i%4===3?null:b.people[i%3].id,packed:i%3===0}));
 const a=audit(b);let total=0,packed=0,unassigned=0;const owners=[0,0,0];
 for(const i of b.items){const m=i.unitMg*i.qty;total+=m;if(i.packed)packed+=m;if(i.carrier===null)unassigned+=m;else owners[b.people.findIndex(p=>p.id===i.carrier)]+=m;}
 assert.equal(a.totalMg,total);assert.equal(a.packedMg,packed);assert.equal(a.unassignedMg,unassigned);assert.deepEqual(a.people.map(p=>p.mg),owners);assert.equal(a.people.reduce((s,p)=>s+p.mg,0)+a.unassignedMg,total);
 }
});
test('suggestions are deterministic previews, preserve assigned carriers and skip personal bundles',()=>{
 const b=clone(example),before=JSON.stringify(b);b.items.push({id:'i7',name:'Personal unassigned',kind:'personal',unitMg:2000000,qty:1,carrier:null,packed:false});const snapshot=JSON.stringify(b),p=suggest(b);
 assert.equal(JSON.stringify(b),snapshot);assert.deepEqual(p,suggest(b));assert.equal(p.assignments.length,3);
 assert.deepEqual(p.assignments.map(x=>[x.id,x.carrier]),[['i5','p1'],['i4','p3'],['i3','p1']]);
 const next=applySuggestion(b,p);assert.equal(next.items.find(i=>i.id==='i1').carrier,'p2');assert.equal(next.items.find(i=>i.id==='i7').carrier,null);assert.deepEqual(next.items.map(i=>i.packed),b.items.map(i=>i.packed));
 assert.equal(audit(next).totalMg,audit(b).totalMg);assert.equal(audit(next).unassignedMg,2000000);assert.notEqual(before,snapshot);
});
test('stable source order resolves equal bundles and member order resolves equal loads',()=>{
 const b=clone(example);b.items=[1,2,3].map(i=>({id:'i'+i,name:'Bundle '+i,kind:'shared',unitMg:1000,qty:1,carrier:null,packed:false}));
 assert.deepEqual(suggest(b).assignments.map(x=>x.carrier),['p1','p2','p3']);
});
test('stale or tampered proposals cannot apply, even after packed-only changes',()=>{
 const b=clone(example),p=suggest(b),changed=edit(b,{type:'packed',id:'i1',packed:false});assert.throws(()=>applySuggestion(changed,p),/changed/);
 const bad=structuredClone(p);bad.assignments[0].carrier='p2';assert.throws(()=>applySuggestion(b,bad),/does not match/);
});
test('person deletion cannot orphan gear; immutable edits and history preserve exact plans',()=>{
 const b=clone(example),before=JSON.stringify(b);assert.throws(()=>edit(b,{type:'personDelete',id:'p1'}),/Reassign/);assert.equal(JSON.stringify(b),before);
 const h=new History(b);h.apply({type:'assign',id:'i2',carrier:'p3'});h.apply({type:'personDelete',id:'p1'});assert.equal(h.current.items.length,6);h.undo();assert.equal(h.current.people.length,3);h.undo();assert.deepEqual(h.current,b);h.redo();assert.equal(h.current.items[1].carrier,'p3');
});
test('limits reject foreign carriers, malformed mass, duplicate names and oversized projects',()=>{
 for(const patch of [{schema:'v2'},{title:' x'},{title:'\uD800'},{people:[{id:'p1',name:'A'},{id:'p2',name:'a'}]}])assert.throws(()=>validate({...clone(example),...patch}));
 const bad=clone(example);bad.items[0].carrier='missing';assert.throws(()=>validate(bad));bad.items[0].carrier=null;bad.items[0].unitMg=0.5;assert.throws(()=>validate(bad));
 const extra=clone(example);extra.secret='no';assert.throws(()=>validate(extra));assert.throws(()=>readProject('x'.repeat(80001)));
});
test('all reports and escaped HTML/SVG retain every bundle and unassigned row',()=>{
 const b=clone(example);b.people[0].name='<script>&';b.items[0].name='<img src=x>';
 const r=report(b);assert.equal(r.items.length,6);assert.equal(r.items[4].totalMg,1000000);
 for(const [source,kind] of [[chartSvg(b),'image/svg+xml'],[checklistHtml(b),'text/html']]){
 const dom=new JSDOM(source,{contentType:kind});try{const d=dom.window.document;assert.equal(d.querySelectorAll('script,img,image,foreignObject,a').length,0);assert.match(d.documentElement.textContent,/<script>&/);assert.match(d.documentElement.textContent,/Unassigned/);if(kind==='text/html'){assert.equal(d.querySelectorAll('tbody tr').length,6);assert.match(d.documentElement.textContent,/<img src=x>/);}}finally{dom.window.close();}
 }
});
test('maximum supported mass and item count stay exact and resumable',()=>{
 const b=clone(example);b.items=Array.from({length:100},(_,i)=>({id:'i'+(i+1),name:'x'.repeat(80),kind:'shared',unitMg:50000000,qty:99,carrier:null,packed:true}));
 assert.equal(audit(b).totalMg,495000000000);assert.ok(Number.isSafeInteger(audit(b).totalMg));const text=JSON.stringify(b,null,2);assert.ok(text.length<80000);assert.deepEqual(readProject(text),b);assert.equal(report(b).items.length,100);assert.equal(audit(applySuggestion(b,suggest(b))).unassignedMg,0);
});
test('UTF-8 file errors never produce a partial project',async()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(example));assert.deepEqual(await readFile({size:bytes.length,arrayBuffer:async()=>bytes.buffer}),example);
 await assert.rejects(()=>readFile({size:320001}),/320,000/);await assert.rejects(()=>readFile({size:1,arrayBuffer:async()=>Uint8Array.of(0xff).buffer}));
});
