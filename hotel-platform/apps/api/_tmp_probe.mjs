import { randomUUID } from 'node:crypto';
const API='https://solar-production-7ddb.up.railway.app/api/v1', SLUG='solar-irara';
function cpf(seed){const n=[];let x=seed;for(let i=0;i<9;i++){n.push(x%10);x=Math.floor(x/7)+3;}const dv=(a)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*(a.length+1-i);const r=(s*10)%11;return r===10?0:r;};const d1=dv(n),d2=dv([...n,d1]);return n.join('')+d1+d2;}
const RT='cmr0rgfi1000cn6zzlwhp60ho';
const mk=(ci,co,seed)=>({roomTypeId:RT,checkInDate:ci,checkOutDate:co,guest:{fullName:'TESTE PD',documentType:'CPF',documentNumber:cpf(seed),email:'pedro.pinto@gpcbahia.com.br',phone:'75981492537',consentMarketing:false},companions:[{fullName:'TESTE Ac',documentType:'CPF',documentNumber:cpf(seed+1),age:30}],contractAccepted:true,contractVersion:'__TESTE_PRICING__',idempotencyKey:randomUUID()});
const post=async(b)=>{const r=await fetch(`${API}/public/property/${SLUG}/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});let j;try{j=await r.json()}catch{j={}}return{s:r.status,j}};

// PROBE 1: regra das 40 noites -> se 400 "30 noites", codigo NOVO no ar
const p=await post(mk('2028-06-10','2028-07-20',556001));
console.log('PROBE 40-noites: status',p.s,'| msg:',JSON.stringify(p.j).slice(0,160));

await new Promise(r=>setTimeout(r,20000));
// RETRY reserva ABS500 (3 tentativas espacadas p/ descartar transiente)
for(let i=1;i<=3;i++){
  const r=await post(mk('2028-06-10','2028-06-13',556100+i*3));
  console.log(`RETRY ${i}: status ${r.s} | total ${r.j.totalAmount??'-'} | ${JSON.stringify(r.j).slice(0,140)}`);
  if(r.s===201) break;
  await new Promise(x=>setTimeout(x,20000));
}
