module.exports=async({page,context,check,fs,output})=>{
  const fixture=JSON.parse(await fs.readFile(output+'/clinical-fixture.json','utf8'));
  const appointment=fixture.appointment;
  await page.goto('http://localhost:3000/workspace/doctor/overview');
  await page.getByText(appointment.appointmentCode,{exact:true}).first().click();
  check('F06-ui',(await page.getByPlaceholder(/Nhập lý do đến khám/).inputValue())===fixture.reason,'Doctor sees original booking reason before editing');
  const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('an-tam-auth-session')||localStorage.getItem('an-tam-auth-session')).accessToken);
  const get=path=>context.request.get('http://localhost:8080'+path,{headers:{Authorization:'Bearer '+token}});
  const stages=(await (await get('/api/queue/stages')).json()).data;
  const stage=stages.find(s=>s.code==='CONSULTATION');
  const tickets=async()=>{const raw=await (await get('/api/queue/stages/'+stage.id+'/tickets?limit=100')).json();return Array.isArray(raw)?raw:raw.data||raw.items};
  const ticket=async()=> (await tickets()).find(t=>t.appointmentId===appointment.id);
  await page.getByRole('button',{name:/Bắt đầu khám bệnh/}).first().click();
  let current;
  for(let i=0;i<25;i++){current=await ticket();if(String(current?.state).endsWith('IN_SERVICE'))break;await page.waitForTimeout(400)}
  check('F03-start',String(current?.state).endsWith('IN_SERVICE'),'Direct open from waiting moves consultation ticket to IN_SERVICE');
  await page.getByPlaceholder('120/80',{exact:true}).fill('118/78');
  await page.getByPlaceholder('75',{exact:true}).fill('76');
  await page.getByPlaceholder('36.8',{exact:true}).fill('36.7');
  await page.getByPlaceholder('58.5',{exact:true}).fill('60');
  await page.getByPlaceholder('160',{exact:true}).fill('160');
  await page.getByPlaceholder(/Nhập chẩn đoán lâm sàng/).fill('QA REGRESSION ONLY - simulated clinical entry');
  await page.waitForTimeout(1500);
  await page.getByRole('button',{name:/Hoàn tất ca khám/}).first().click();
  await page.getByRole('button',{name:'Hoàn tất',exact:true}).click();
  for(let i=0;i<25;i++){current=await ticket();if(String(current?.state).endsWith('COMPLETED'))break;await page.waitForTimeout(400)}
  check('F03-complete',String(current?.state).endsWith('COMPLETED'),'Completion closes queue ticket');
  const final=await (await get('/api/appointment/appointments/'+appointment.id)).json();
  check('F03-appointment',final.status==='COMPLETED','Appointment lifecycle preserved');
  const jr=await get('/api/queue/journeys/'+(current?.journeyId||''));const journey=(await jr.json()).data;
  check('F03-journey',String(journey?.state).endsWith('COMPLETED'),'Journey completed, no residual waiting ticket');
  await fs.writeFile(output+'/clinical-final-state.json',JSON.stringify({appointment:final,ticket:current,journey},null,2));
};
