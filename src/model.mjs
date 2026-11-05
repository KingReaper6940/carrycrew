export const LIMITS=Object.freeze({people:8,items:100,source:80000,file:320000});
export function text(s,max,name){if(typeof s!=='string'||s.length>max||!s.trim()||s!==s.trim()||!s.isWellFormed()||/[\u0000-\u001f\u007f\u2028\u2029]/u.test(s))throw Error(name+' must be trimmed single-line Unicode text, 1–'+max+' UTF-16 units.');return s;}
function fields(obj,keys){if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).sort().join(',')!==keys.sort().join(','))throw Error('Unsupported project fields.');}
export function gramsInput(s){
 if(typeof s!=='string'||! /^(0|[1-9]\d{0,4})(\.\d{1,3})?$/.test(s))throw Error('Enter grams from 0 to 50,000 with at most three decimal places.');
 const [whole,part='']=s.split('.'),mg=Number(whole)*1000+Number(part.padEnd(3,'0'));
 if(mg>50000000)throw Error('Per-unit weight is limited to 50,000 grams.');return mg;
}
export function gramsText(mg){if(!Number.isSafeInteger(mg)||mg<0)throw Error('Invalid mass.');return Math.floor(mg/1000)+(mg%1000?'.'+String(mg%1000).padStart(3,'0').replace(/0+$/,''):'');}
export function quantityInput(s){if(typeof s!=='string'||!/^([1-9]|[1-9]\d)$/.test(s))throw Error('Quantity must be an integer from 1 to 99.');return Number(s);}
export function validate(board){
 fields(board,['schema','title','people','items']);if(board.schema!=='carrycrew-project-v1')throw Error('Unsupported project version.');text(board.title,80,'Trip title');
 if(!Array.isArray(board.people)||board.people.length<1||board.people.length>8)throw Error('Use 1–8 people.');
 const people=new Set(),names=new Set();
 for(const p of board.people){fields(p,['id','name']);if(typeof p.id!=='string'||!/^p[1-9]\d{0,6}$/.test(p.id)||people.has(p.id))throw Error('Invalid or repeated person ID.');text(p.name,32,'Person name');if(names.has(p.name.toLowerCase()))throw Error('Use distinct person names, ignoring letter case.');people.add(p.id);names.add(p.name.toLowerCase());}
 if(!Array.isArray(board.items)||board.items.length>100)throw Error('Use at most 100 item bundles.');
 const ids=new Set();for(const i of board.items){
 fields(i,['id','name','kind','unitMg','qty','carrier','packed']);
 if(typeof i.id!=='string'||!/^i[1-9]\d{0,6}$/.test(i.id)||ids.has(i.id))throw Error('Invalid or repeated item ID.');ids.add(i.id);text(i.name,80,'Item name');
 if(!['personal','shared'].includes(i.kind)||!Number.isSafeInteger(i.unitMg)||i.unitMg<0||i.unitMg>50000000||!Number.isInteger(i.qty)||i.qty<1||i.qty>99||typeof i.packed!=='boolean')throw Error('Invalid item kind, weight, quantity or packed flag.');
 if(i.carrier!==null&&!people.has(i.carrier))throw Error('An item points to a missing carrier.');
 }return board;
}
export const clone=b=>structuredClone(validate(b));
export const mass=item=>item.unitMg*item.qty;
export function audit(board){
 validate(board);const people=board.people.map(p=>({...p,mg:0,packedMg:0,bundles:0,packedBundles:0})),byId=new Map(people.map(p=>[p.id,p]));let mg=0,packedMg=0,packedBundles=0,unassignedMg=0,unassignedBundles=0,unassignedPersonal=0;
 for(const item of board.items){const m=mass(item);mg+=m;if(item.packed){packedMg+=m;packedBundles++;}
 const owner=byId.get(item.carrier);if(owner){owner.mg+=m;owner.bundles++;if(item.packed){owner.packedMg+=m;owner.packedBundles++;}}else{unassignedMg+=m;unassignedBundles++;if(item.kind==='personal')unassignedPersonal++;}}
 return {people,totalMg:mg,packedMg,packedBundles,totalBundles:board.items.length,unassignedMg,unassignedBundles,unassignedPersonal};
}
