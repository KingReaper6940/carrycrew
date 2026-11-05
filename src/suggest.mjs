import {validate,audit,clone,mass} from './model.mjs';
export function suggest(board){
 validate(board);const totals=audit(board).people.map(p=>({...p})),candidates=board.items.map((item,index)=>({item,index})).filter(x=>x.item.carrier===null&&x.item.kind==='shared').sort((a,b)=>mass(b.item)-mass(a.item)||a.index-b.index),assignments=[];
 for(const {item} of candidates){let chosen=totals[0];for(const p of totals)if(p.mg<chosen.mg)chosen=p;assignments.push({id:item.id,carrier:chosen.id,mg:mass(item)});chosen.mg+=mass(item);}
 return {source:JSON.stringify(board),assignments,before:audit(board),after:totals.map(p=>({id:p.id,name:p.name,mg:p.mg}))};
}
export function applySuggestion(board,proposal){
 validate(board);if(!proposal||proposal.source!==JSON.stringify(board))throw Error('The board changed. Make a fresh suggestion.');
 const expected=suggest(board);if(JSON.stringify(proposal.assignments)!==JSON.stringify(expected.assignments))throw Error('Suggestion does not match the current board.');
 const b=clone(board),owners=new Map(expected.assignments.map(a=>[a.id,a.carrier]));for(const item of b.items)if(owners.has(item.id))item.carrier=owners.get(item.id);
 return validate(b);
}
