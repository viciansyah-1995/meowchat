import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../app/api/places/route.js',import.meta.url),'utf8').replace("import { createClient } from '@supabase/supabase-js';",'const createClient = (...args) => globalThis.testPlacesClient(...args);');
process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-key';
let state={user:true,member:true,gate:true,provider:true};
globalThis.testPlacesClient = (_url,_key,options) => {
 assert.equal(options.global.headers.Authorization,'Bearer test-session');
 return {auth:{getUser:async()=>({data:{user:state.user?{id:'self'}:null},error:null})},rpc:async name=>({data:name==='can_view_room_moments'?state.member:state.gate,error:null})};
};
globalThis.fetch=async url=>{
 assert.equal(url.hostname,'photon.komoot.io');assert.equal(url.searchParams.get('q'),'Kebun Raya Bogor');
 return {ok:state.provider,json:async()=>({features:[{properties:{name:'Kebun Raya Bogor',city:'Bogor'},geometry:{coordinates:[106.8,-6.6]}},{properties:{name:'Invalid'},geometry:{coordinates:[999,999]}}]})};
};
const {POST}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const call=(body,token=true)=>POST(new Request('https://example.test/api/places',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer test-session'}:{})},body:JSON.stringify(body)}));
const body={query:'Kebun Raya Bogor',chatId:'10000000-0000-0000-0000-000000000001'};
assert.equal((await call(body,false)).status,401);
assert.equal((await call({...body,query:'x'})).status,400);
state.user=false;assert.equal((await call(body)).status,401);state.user=true;
state.member=false;assert.equal((await call(body)).status,403);state.member=true;
state.gate=false;assert.equal((await call(body)).status,429);state.gate=true;
state.provider=false;assert.equal((await call(body)).status,502);state.provider=true;
const response=await call(body);assert.equal(response.status,200);
const data=await response.json();assert.deepEqual(data.places,[{name:'Kebun Raya Bogor, Bogor',latitude:-6.6,longitude:106.8}]);
console.log('PASS: place API authentication, membership, validation, rate limit, upstream errors and safe results');
