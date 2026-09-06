import {readFile,writeFile} from 'node:fs/promises';
const here=new URL('./',import.meta.url);
const read=n=>readFile(new URL(n,here),'utf8');
const model=(await read('model.mjs')).replace(/^export /gm,'');
const recipes=(await read('recipes.mjs')).replace(/^import .*;\r?\n/gm,'');
const history=(await read('history.mjs')).replace(/^export /gm,'');
const script=model+'\n'+recipes+'\n'+history+'\n'+await read('app.js');
new Function(script); // Reject broken inline JS before creating a public artifact.
const html=(await read('template.html')).replace('/* STYLE */',await read('style.css')).replace('/* APP */',()=>script);
if(html.includes('/* APP */')||html.includes('/* STYLE */'))throw Error('Unresolved template');
await writeFile(new URL('../public/nutrition-plan.html',here),html,'utf8');
console.log('Built standalone nutrition-plan.html ('+Buffer.byteLength(html)+' bytes)');
