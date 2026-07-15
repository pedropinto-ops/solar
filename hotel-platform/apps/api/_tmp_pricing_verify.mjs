const API='https://solar-production-7ddb.up.railway.app/api/v1', SLUG='solar-irara';
const q=async(ci,co,g=2)=>{const r=await fetch(`${API}/public/property/${SLUG}/availability?checkInDate=${ci}&checkOutDate=${co}&guests=${g}`);const j=await r.json();const rt=j.roomTypes?.[0]||{};return{daily:rt.dailyRate,total:rt.totalAmount}};
const cases=[
 ['BASELINE (sem regra)','2028-06-01','2028-06-04',300,900],
 ['ABSOLUTE 500','2028-06-10','2028-06-13',1000,3000],
 ['PERCENT +50%','2028-07-10','2028-07-13',450,1350],
 ['PERCENT -20%','2028-08-10','2028-08-13',240,720],
 ['PRIORIDADE (900>400)','2028-09-10','2028-09-13',1800,5400],
 ['MIXED (150/600/150)','2028-10-10','2028-10-13',600,1800],
 ['SEM VAZAMENTO (pos-periodo)','2028-06-13','2028-06-16',300,900],
 ['BORDA fim inclusivo (so 06-12)','2028-06-12','2028-06-13',1000,1000],
];
let pass=0,fail=0;
for(const [name,ci,co,eDaily,eTotal] of cases){
 const {daily,total}=await q(ci,co);
 const ok = daily===eDaily && total===eTotal;
 console.log(`${ok?'✓':'✗'} ${name}: daily=${daily}(esp ${eDaily}) total=${total}(esp ${eTotal})`);
 ok?pass++:fail++;
 await new Promise(r=>setTimeout(r,400));
}
console.log(`\nRESULTADO: ${pass} passou, ${fail} falhou`);
