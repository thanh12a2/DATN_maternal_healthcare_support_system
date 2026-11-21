module.exports=async({page,check,events})=>{
  await page.goto('http://localhost:3000/workspace/receptionist/overview');
  const input=page.getByPlaceholder(/Tìm theo tên bệnh nhân/);
  await input.fill('APTMWFTGJ2SAD764C'); await input.press('Enter');
  await page.getByRole('button',{name:/Hủy lịch/}).first().click();
  await page.waitForTimeout(400);
  console.log('DIALOG',await page.getByRole('dialog').allTextContents());
  console.log('INPUTS',await page.locator('textarea,input').evaluateAll(xs=>xs.map(x=>({placeholder:x.placeholder,value:x.value}))));
  await page.getByRole('button',{name:/Hủy lịch/}).last().click();
  await page.waitForTimeout(1200);
  const response=events.find(x=>x.method==='POST'&&x.url.endsWith('/cancel'));
  check('R05',response?.status<300,'Lễ tân hủy lịch qua UI: HTTP '+response?.status);
};
