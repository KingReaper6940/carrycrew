import {clone,validate} from './model.mjs';
export function edit(board,a){
 const b=clone(board),index=b.items.findIndex(i=>i.id===a.id),person=b.people.find(p=>p.id===a.id);
 const item=()=>{if(index<0)throw Error('Select an existing bundle.');return b.items[index];};
 const nextId=(list,prefix)=>prefix+(Math.max(0,...list.map(x=>Number(x.id.slice(1))))+1);
 switch(a.type){
 case 'title':b.title=a.title;break;
 case 'personAdd':b.people.push({id:nextId(b.people,'p'),name:a.name});break;
 case 'personRename':if(!person)throw Error('Person not found.');person.name=a.name;break;
 case 'personDelete':if(!person)throw Error('Person not found.');if(b.people.length===1)throw Error('Keep at least one person.');if(b.items.some(i=>i.carrier===a.id))throw Error('Reassign this person’s bundles before removing them.');b.people=b.people.filter(p=>p.id!==a.id);break;
 case 'itemAdd':b.items.push({id:nextId(b.items,'i'),name:a.name,kind:a.kind,unitMg:a.unitMg,qty:a.qty,carrier:a.carrier,packed:a.packed});break;
 case 'itemUpdate':Object.assign(item(),{name:a.name,kind:a.kind,unitMg:a.unitMg,qty:a.qty,carrier:a.carrier,packed:a.packed});break;
 case 'itemDelete':item();b.items.splice(index,1);break;
 case 'assign':item().carrier=a.carrier;break;
 case 'packed':item().packed=a.packed;break;
 default:throw Error('Unknown board edit.');
 }return validate(b);
}
export class History{
 constructor(b){this.current=clone(b);this.past=[];this.future=[];}
 replace(b){const next=clone(b);if(JSON.stringify(next)===JSON.stringify(this.current))return false;this.past.push(this.current);if(this.past.length>25)this.past.shift();this.current=next;this.future=[];return true;}
 apply(a){return this.replace(edit(this.current,a));}
 undo(){if(!this.past.length)return false;this.future.push(this.current);this.current=this.past.pop();return true;}
 redo(){if(!this.future.length)return false;this.past.push(this.current);this.current=this.future.pop();return true;}
}
