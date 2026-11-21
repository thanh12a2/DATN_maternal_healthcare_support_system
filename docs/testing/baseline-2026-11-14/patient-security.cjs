module.exports = async ({page,context,check}) => {
  await page.goto('http://localhost:3000/lich-hen');
  await page.getByRole('button',{name:/Tất cả/}).click();
  await page.getByText(/APTMWFTH9XT234394/).first().waitFor();
  check('P06',true,'Lịch cá nhân hiển thị lịch đã đặt');
  const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('an-tam-auth-session')||localStorage.getItem('an-tam-auth-session')).accessToken);
  const call=(url,opt={})=>context.request.fetch('http://localhost:8080'+url,{...opt,headers:{Authorization:'Bearer '+token,...opt.headers}});
  const noauth=await context.request.get('http://localhost:8080/api/appointment/appointments');
  check('A01',noauth.status()===401,'Không JWT đọc danh sách: '+noauth.status());
  const cancel=await call('/api/appointment/appointments/f3d3e8db-b571-4207-8a2d-1ee9ce500ab6/cancel',{method:'POST',data:{reason:'KIEM THU QUYEN',expectedVersion:1},headers:{'Idempotency-Key':'qa-patient-cancel-20261114'}});
  check('A02',cancel.status()===403,'PATIENT tự hủy lịch: '+cancel.status());
  const reschedule=await call('/api/appointment/appointments/f3d3e8db-b571-4207-8a2d-1ee9ce500ab6/reschedule',{method:'POST',data:{reason:'KIEM THU QUYEN',expectedVersion:1,newHoldId:'00000000-0000-4000-8000-000000000001'},headers:{'Idempotency-Key':'qa-patient-reschedule-20261114'}});
  check('A03',reschedule.status()===403,'PATIENT tự đổi lịch: '+reschedule.status());
  const staff=await call('/api/reception/cases',{method:'POST',data:{}});
  check('A04',staff.status()===403,'PATIENT gọi endpoint lễ tân: '+staff.status());
  console.log('BUTTONS',await page.getByRole('button').allTextContents());
};
