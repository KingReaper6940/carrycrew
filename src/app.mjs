import {History} from './edit.mjs';import {example} from './example.mjs';import {audit,gramsInput,gramsText,quantityInput,clone,mass} from './model.mjs';import {suggest,applySuggestion} from './suggest.mjs';import {report,chartSvg,checklistHtml} from './export.mjs';
export function mount(doc,env={}){
 const $=id=>doc.getElementById(id),h=new History(example),api=env.URL??globalThis.URL,urls=new Map();
 let editing=null,draft=false,revision=0,proposal=null;
 const say=(s,error=false)=>{$('status').textContent=s;$('status').classList.toggle('error',error);};
 const option=(v,s)=>{const o=doc.createElement('option');o.value=v;o.textContent=s;return o;};
 function ownerSelect(el,selected,all=false){el.replaceChildren();if(all)el.append(option('all','Everyone'));el.append(option('none','Unassigned'));for(const p of h.current.people)el.append(option(p.id,p.name));el.value=[...el.options].some(o=>o.value===selected)?selected:(all?'all':'none');}
 function proposalView(){
 $('proposal').replaceChildren();$('apply-proposal').disabled=!proposal||!proposal.assignments.length;$('cancel-proposal').disabled=!proposal;
 if(!proposal)return;
 const intro=doc.createElement('p');intro.className='proposal-summary';intro.textContent=proposal.assignments.length+' shared bundles proposed. '+proposal.before.unassignedPersonal+' personal bundles remain unassigned.';
 const region=doc.createElement('div');region.className='proposal-scroll';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Complete proposed assignments');
 const table=doc.createElement('table'),head=doc.createElement('tr');for(const s of ['Bundle','Quantity','Total grams','Proposed carrier']){const th=doc.createElement('th');th.scope='col';th.textContent=s;head.append(th);}table.append(head);
 for(const a of proposal.assignments){const item=h.current.items.find(i=>i.id===a.id),tr=doc.createElement('tr');for(const value of [item.name,item.qty,gramsText(a.mg),h.current.people.find(p=>p.id===a.carrier).name]){const td=doc.createElement('td');td.textContent=String(value);tr.append(td);}table.append(tr);}
 region.append(table);$('proposal').append(intro,region);
 const changes=doc.createElement('p');changes.className='proposal-summary';changes.textContent=proposal.after.map(p=>p.name+': '+gramsText(proposal.before.people.find(x=>x.id===p.id).mg)+' → '+gramsText(p.mg)+' g').join(' · ');$('proposal').append(changes);
 }
 function list(){
 const b=h.current,q=$('query').value.toLowerCase(),owner=$('filter-owner').value,state=$('filter-state').value,items=b.items.filter(i=>(owner==='all'||(owner==='none'?i.carrier===null:i.carrier===owner))&&(state==='all'||(state==='packed'?i.packed:!i.packed))&&[i.name,b.people.find(p=>p.id===i.carrier)?.name??'unassigned',i.kind].some(s=>s.toLowerCase().includes(q)));
 $('items').replaceChildren();$('visible-count').textContent=items.length+' / '+b.items.length+' bundles';
 for(const item of items){
 const row=doc.createElement('article');row.className='item';const info=doc.createElement('div'),title=doc.createElement('h3'),details=doc.createElement('p');title.textContent=item.name;details.textContent=item.kind+' · '+gramsText(item.unitMg)+' g × '+item.qty+' = '+gramsText(mass(item))+' g';info.append(title,details);
 const controls=doc.createElement('div'),label=doc.createElement('label');label.textContent='Carrier';const select=doc.createElement('select');select.dataset.action='assign';select.dataset.id=item.id;select.setAttribute('aria-label','Carrier for '+item.name);ownerSelect(select,item.carrier??'none');label.append(select);
 const packedLabel=doc.createElement('label');packedLabel.className='check';const box=doc.createElement('input');box.type='checkbox';box.checked=item.packed;box.dataset.action='packed';box.dataset.id=item.id;box.setAttribute('aria-label','All units packed: '+item.name);packedLabel.append(box,'All units packed');controls.append(label,packedLabel);
 const actions=doc.createElement('div');actions.className='item-actions';for(const action of ['edit','delete']){const button=doc.createElement('button');button.type='button';button.dataset.action=action;button.dataset.id=item.id;button.textContent=action==='edit'?'Edit':'Delete';button.setAttribute('aria-label',action+' '+item.name);actions.append(button);}
 row.append(info,controls,actions);$('items').append(row);
 }
 if(!items.length){const empty=doc.createElement('p');empty.className='empty';empty.textContent='No bundles in this view. Add gear or clear the filters.';$('items').append(empty);}
 }
 function render(){
 const b=h.current,a=audit(b);$('title').value=b.title;$('total').textContent=gramsText(a.totalMg)+' g';$('packed-total').textContent=a.packedBundles+' / '+a.totalBundles;$('unassigned').textContent=gramsText(a.unassignedMg)+' g';
 $('people').replaceChildren();const max=Math.max(1,...a.people.map(p=>p.mg));
 for(const p of a.people){const box=doc.createElement('article');box.className='person';const name=doc.createElement('h3'),weight=doc.createElement('strong'),packed=doc.createElement('small'),bar=doc.createElement('progress'),remove=doc.createElement('button');name.textContent=p.name;weight.textContent=gramsText(p.mg)+' g';packed.textContent=p.packedBundles+'/'+p.bundles+' bundles packed';bar.max=max;bar.value=p.mg;bar.setAttribute('aria-label','Relative entered load for '+p.name);remove.type='button';remove.textContent='Remove person';remove.dataset.id=p.id;remove.disabled=b.people.length===1||b.items.some(i=>i.carrier===p.id);box.append(name,weight,packed,bar,remove);$('people').append(box);}
 $('person-add').disabled=b.people.length===8;$('undo').disabled=!h.past.length;$('redo').disabled=!h.future.length;
 ownerSelect($('filter-owner'),$('filter-owner').value,true);
 if(!draft){const i=b.items.find(i=>i.id===editing);if(!i)editing=null;$('editor-heading').textContent=i?'Edit bundle':'Add some gear';$('item-name').value=i?.name??'';$('weight').value=i?gramsText(i.unitMg):'';$('qty').value=String(i?.qty??1);$('kind').value=i?.kind??'shared';ownerSelect($('owner'),i?.carrier??'none');$('item-packed').checked=i?.packed??false;}
 $('draft').textContent=draft?'Unapplied item draft. Save or clear it before other edits.':'No unapplied item draft.';
 list();proposalView();
 for(const url of urls.values())api.revokeObjectURL(url);urls.clear();
 for(const [id,value,type] of [['project',JSON.stringify(b,null,2)+'\n','application/json'],['receipt',JSON.stringify(report(b),null,2)+'\n','application/json'],['chart',chartSvg(b),'image/svg+xml'],['html',checklistHtml(b),'text/html']]){const url=api.createObjectURL(new Blob([value],{type}));urls.set(id,url);$(id).setAttribute('href',url);}
 }
 const clean=()=>{if(!draft)return true;say('Save or clear the item draft before changing other board data.',true);return false;};
 function apply(action,message){try{if(h.apply(action))revision++;proposal=null;render();say(message);return true;}catch(e){say(e.message,true);return false;}}
 $('item-form').addEventListener('submit',e=>{e.preventDefault();try{const action={type:editing?'itemUpdate':'itemAdd',id:editing,name:$('item-name').value,kind:$('kind').value,unitMg:gramsInput($('weight').value),qty:quantityInput($('qty').value),carrier:$('owner').value==='none'?null:$('owner').value,packed:$('item-packed').checked};const was=draft;draft=false;if(!apply(action,'Bundle saved. Quantities and weights are counted in full.'))draft=was;render();}catch(error){say(error.message,true);}});
 for(const id of ['item-name','weight','qty','kind','owner','item-packed'])$(id).addEventListener(['kind','owner','item-packed'].includes(id)?'change':'input',()=>{draft=true;revision++;proposal=null;proposalView();$('draft').textContent='Unapplied item draft. Save or clear it before other edits.';});
 $('cancel-edit').addEventListener('click',()=>{editing=null;draft=false;revision++;proposal=null;render();say('Item editor cleared.');});
 $('title-form').addEventListener('submit',e=>{e.preventDefault();if(clean())apply({type:'title',title:$('title').value},'Plan title updated.');});
 $('title').addEventListener('input',()=>revision++);$('person-name').addEventListener('input',()=>revision++);
 $('person-form').addEventListener('submit',e=>{e.preventDefault();if(clean()&&apply({type:'personAdd',name:$('person-name').value},'Person added.'))$('person-name').value='';});
 $('people').addEventListener('click',e=>{const id=e.target.closest('button')?.dataset.id;if(id&&clean())apply({type:'personDelete',id},'Person removed. Gear rows remain intact.');});
 $('items').addEventListener('click',e=>{const button=e.target.closest('button[data-action]');if(!button||!clean())return;if(button.dataset.action==='edit'){editing=button.dataset.id;render();$('item-name').focus();}else apply({type:'itemDelete',id:button.dataset.id},'Bundle deleted. Undo can restore it.');});
 $('items').addEventListener('change',e=>{const {id,action}=e.target.dataset;if(!id)return;if(!clean()){list();return;}apply(action==='assign'?{type:'assign',id,carrier:e.target.value==='none'?null:e.target.value}:{type:'packed',id,packed:e.target.checked},'Bundle updated.');});
 for(const id of ['query','filter-owner','filter-state'])$(id).addEventListener(id==='query'?'input':'change',list);
 for(const id of ['undo','redo'])$(id).addEventListener('click',()=>{if(clean()&&h[id]()){editing=null;revision++;proposal=null;render();say('Applied board history restored.');}});
 $('suggest').addEventListener('click',()=>{if(!clean())return;proposal=suggest(h.current);proposalView();say(proposal.assignments.length?'Suggestion prepared. Review the full draft before applying.':'No unassigned shared bundles. Personal gear needs a manual carrier.');});
 $('apply-proposal').addEventListener('click',()=>{if(!proposal||!clean())return;try{h.replace(applySuggestion(h.current,proposal));revision++;proposal=null;render();say('Suggestion applied. Packed flags and existing carriers stayed fixed.');}catch(e){proposal=null;render();say(e.message,true);}});
 $('cancel-proposal').addEventListener('click',()=>{proposal=null;proposalView();say('Suggestion dismissed. The board is unchanged.');});
 function load(board){h.replace(clone(board));editing=null;draft=false;proposal=null;revision++;$('query').value='';$('filter-state').value='all';render();say('Project loaded. Previous applied plan is available with Undo.');}
 $('demo').addEventListener('click',()=>load(example));
 $('copy').addEventListener('click',async()=>{try{await (env.clipboard??globalThis.navigator.clipboard).writeText(JSON.stringify(report(h.current),null,2)+'\n');say('Complete receipt copied.');}catch{say('Clipboard unavailable. Download the receipt instead.',true);}});
 render();return {history:h,load,say,get revision(){return revision;},dispose(){for(const u of urls.values())api.revokeObjectURL(u);urls.clear();}};
}
if(typeof document!=='undefined')mount(document);
