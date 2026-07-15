import { randomUUID } from 'node:crypto';
const API='https://solar-production-7ddb.up.railway.app/api/v1', SLUG='solar-irara';
function cpf(seed){const n=[];let x=seed;for(let i=0;i<9;i++){n.push(x%10);x=Math.floor(x/7)+3;}const dv=(a)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*(a.length+1-i);const r=(s*10)%11;return r===10?0:r;};const d1=dv(n),d2=dv([...n,d1]);return n.join('')+d1+d2;}
const RT='cmr0rgfi1000cn6zzlwhp60ho';
const KEY=randomUUID(); // MESMA chave nas 8 tentativas
const body={roomTypeId:RT,checkInDate:'2028-06-11',checkOutDate:'2028-06-13',guest:{fullName:'TESTE Idem Flaky',documentType:'CPF',documentNumber:cpf(557001),email:'pedro.pinto@gpcbahia.com.br',phone:'75981492537',consentMarketing:false},companions:[{fullName:'TESTE Ac2',documentType:'CPF',documentNumber:cpf(557002),age:30}],contractAccepted:true,contractVersion:'__TESTE_PRICING__',idempotencyKey:KEY};
const post=async()=>{const r=await fetch(`${API}/public/property/${SLUG}/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});let j;try{j=await r.json()}catch{j={}}return{s:r.status,code:j.reservations?.[0]?.code,total:j.totalAmount}};
const codes=new Set(); let ok=0,e500=0,other=0;
for(let i=1;i<=8;i++){
  const r=await post();
  if(r.s===201){ok++; if(r.code)codes.add(r.code);} else if(r.s===500){e500++;} else other++;
  console.log(`#${i}: ${r.s} code=${r.code??'-'} total=${r.total??'-'}`);
  await new Promise(x=>setTimeout(x,3000));
}
console.log(`\n201=${ok} 500=${e500} outros=${other}`);
console.log(`Reservas DISTINTAS criadas (idempotencia): ${codes.size} -> ${[...codes].join(',')}`);
console.log(codes.size<=1?'✓ IDEMPOTENCIA OK (nunca duplicou apesar das repeticoes)':'✗ DUPLICOU!');
