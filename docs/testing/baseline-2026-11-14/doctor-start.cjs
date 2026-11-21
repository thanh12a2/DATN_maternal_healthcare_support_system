module.exports = async ({page,check,events}) => {
  await page.goto('http://localhost:3000/workspace/doctor/overview');
  await page.getByPlaceholder('Chọn thời điểm').fill('16/11/2026');
  await page.getByPlaceholder('Chọn thời điểm').press('Enter');
  await page.getByText('APTMWFTH9XT234394',{exact:true}).first().click();
  await page.getByRole('button',{name:/Bắt đầu khám bệnh/}).first().click();
  await page.waitForTimeout(1700);
  console.log('INPUTS',await page.locator('input,textarea').evaluateAll(xs=>xs.map(x=>({tag:x.tagName,type:x.type,placeholder:x.placeholder,value:x.value,disabled:x.disabled}))));
  console.log('BUTTONS',await page.getByRole('button').allTextContents());
  check('D03',events.some(x=>x.method==='POST'&&x.url.endsWith('/start')&&x.status<300),'Bắt đầu khám qua UI, đồng bộ encounter và appointment');
};
