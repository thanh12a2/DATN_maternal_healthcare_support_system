module.exports=async({page,check,events})=>{
  await page.goto('http://localhost:3000/workspace/receptionist/overview');
  const input=page.getByPlaceholder(/Tìm theo tên bệnh nhân/);
  await input.fill('APTMWFTGJ2SAD764C'); await input.press('Enter');
  await page.getByRole('button',{name:/Dời lịch \/ Đổi bác sĩ/}).first().click();
  await page.waitForTimeout(500);
  console.log('FORM_INPUTS',await page.locator('input,textarea').evaluateAll(xs=>xs.map(x=>({placeholder:x.placeholder,value:x.value,type:x.type}))));
  await page.getByText('10:00 - 10:30',{exact:true}).click();
  await page.getByPlaceholder('Nhập lý do chi tiết...').fill('KIỂM THỬ ĐỒ ÁN: bệnh nhân yêu cầu dời giờ, dữ liệu mô phỏng');
  await page.getByRole('button',{name:/Xác nhận dời lịch/}).click();
  await page.waitForTimeout(1800);
  const response=events.find(x=>x.method==='POST'&&x.url.endsWith('/reschedule'));
  check('R04',!!response&&response.status<300,'Đổi lịch qua UI: HTTP '+response?.status+' '+JSON.stringify(response?.body));
};
