module.exports = async ({page,check}) => {
  await page.goto('http://localhost:3000/workspace/doctor/overview');
  await page.waitForTimeout(1000);
  console.log('INPUTS',await page.locator('input').evaluateAll(xs=>xs.map(x=>({placeholder:x.placeholder,value:x.value,type:x.type}))));
  console.log('BUTTONS',await page.getByRole('button').allTextContents());
  check('D01',page.url().includes('/workspace/doctor/'),'Đăng nhập bác sĩ Lê Thu Hà');
  await page.getByPlaceholder('Chọn thời điểm').fill('16/11/2026');
  await page.getByPlaceholder('Chọn thời điểm').press('Enter');
  await page.getByText('APTMWFTH9XT234394',{exact:true}).first().waitFor();
  check('D02',true,'Bác sĩ thấy lịch đã check-in theo ngày đã chọn');
  await page.getByText('APTMWFTH9XT234394',{exact:true}).first().click();
  await page.waitForTimeout(800);
  console.log('CLINICAL', (await page.locator('body').innerText()).slice(-11500));
};
