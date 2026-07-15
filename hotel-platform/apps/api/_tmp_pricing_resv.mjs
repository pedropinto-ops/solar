import { randomUUID } from 'node:crypto';
const API='https://solar-production-7ddb.up.railway.app/api/v1', SLUG='solar-irara';
function cpf(seed){const n=[];let x=seed;for(let i=0;i<9;i++){n.push(x%10);x=Math.floor(x/7)+3;}const dv=(a)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*(a.length+1-i);const r=(s*10)%11;return r===10?0:r;};const d1=dv(n),d2=dv([...n,d1]);return n.join('')+d1+d2;}
const RT='cmr0rgfi1000cn6zzlwhp60ho';
const body={roomTypeId:RT,checkInDate:'2028-06-10',checkOutDate:'2028-06-13',
 guest:{fullName:'TESTE Pricing Dinamico',documentType:'CPF',documentNumber:cpf(555001),email:'pedro.pinto@gpcbahia.com.br',phone:'75981492537',consentMarketing:false},
 companions:[{fullName:'TESTE Acomp Adulto',documentType:'CPF',documentNumber:cpf(555002),age:30}],
 contractAccepted:true,contractVersion:'__TESTE_PRICING__',idempotencyKey:randomUUID()};
const r=await fetch(`${API}/public/property/${SLUG}/reservations`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const j=await r.json();
console.log('status',r.status);
console.log('totalAmount:',j.totalAmount,'(esperado 3000 = 2 adultos x 3 noites x 500)');
console.log('depositAmount:',j.depositAmount,'(esperado 900 = 30%)');
console.log('codes:',(j.reservations||[]).map(x=>x.code).join(','));
console.log(j.totalAmount===3000?'✓ RESERVA HONROU O PRECO ESPECIAL':'✗ DIVERGENCIA');
