import {mkdir,copyFile,rm} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'dist');if(dirname(out)!==root||out===root)throw Error('Unexpected build path.');
const assets=['index.html','style.css','favicon.svg',...['model','edit','suggest','example','export','app','handoff'].map(n=>'src/'+n+'.mjs')];
for(const p of assets.filter(p=>p.endsWith('.mjs')))execFileSync(process.execPath,['--check',resolve(root,p)]);
await rm(out,{recursive:true,force:true});await mkdir(resolve(out,'src'),{recursive:true});for(const p of assets)await copyFile(resolve(root,p),resolve(out,p));console.log('Built Carrycrew: '+assets.length+' allowlisted assets.');
