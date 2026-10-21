const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync(require('node:path').join(__dirname,'../index.js'),'utf8');
let calls=0,reply,validator,hook,labels=[];
const profile={id:'x',name:'test',url:'https://example.invalid/v1',model:'test'};
const box={window:{XZ_API_ACTIVITY:{begin:(label,retry)=>{labels.push(label+(retry?`第 ${retry}/5`:``));return ()=>{}}},SillyTavern:{getContext:()=>({extensionSettings:{xz_shared_api_v1:{version:1,profiles:[profile],bindings:{memory:'x'}}},getRequestHeaders:()=>({})})}},structuredClone,URL,AbortController,setTimeout:(f,ms)=>setTimeout(f,ms===1000?1:ms),clearTimeout,fetch:async()=>{calls++;hook?.();return {ok:true,json:async()=>reply}}};
vm.createContext(box);vm.runInContext(s.slice(s.indexOf('function installSharedApi()'),s.indexOf('// Pure transformations:'))+';installSharedApi();',box);
const api=box.window.XZ_API;
const good={choices:[{finish_reason:'stop',message:{content:'valid'}}]};
(async()=>{
reply=good;await api.request('memory',[]);assert.equal(calls,1);
calls=0;reply={choices:[{message:{content:''}}]};await assert.rejects(()=>api.request('memory',[]),/有效文本/);assert.equal(calls,6);assert(labels.some(x=>x.includes('第 5/5')));
calls=0;reply=good;let parsed=0;await api.request('memory',[],{validate:()=>{if(++parsed<3)throw Error('填表标签不完整')}});assert.equal(calls,3);
for(const r of [{error:{message:'Payment Required'}},{choices:[{finish_reason:'content_filter',message:{content:'partial'}}]}]){calls=0;reply=r;await assert.rejects(()=>api.request('memory',[]));assert.equal(calls,1);}
calls=0;reply=good;await assert.rejects(()=>api.request('memory',[],{validate:()=>{throw Error('存档已变化')}}));assert.equal(calls,1);
calls=0;const c=new AbortController();c.abort();await assert.rejects(()=>api.request('memory',[],{signal:c.signal}),/取消/);assert.equal(calls,0);
calls=0;hook=()=>api.cancelAll();await assert.rejects(()=>api.request('memory',[]),/取消/);assert.equal(calls,1);hook=null;
calls=0;reply={choices:[{message:{content:''}}]};await assert.rejects(()=>api.request('memory',[],{guard:()=>{if(calls)throw Error('聊天已变化')}}),/变化/);assert.equal(calls,1);
console.log('PASS retry cap, progress, parse recovery, terminal errors, scope guard and cancellation');
})().catch(e=>{console.error(e);process.exitCode=1});
