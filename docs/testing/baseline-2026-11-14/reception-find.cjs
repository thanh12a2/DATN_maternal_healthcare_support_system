module.exports = async ({page, check}) => {
  await page.goto('http://localhost:3000/workspace/receptionist/overview');
  await page.getByPlaceholder('Chọn thời điểm').waitFor();
  await page.getByPlaceholder('Chọn thời điểm').fill('16/11/2026');
  await page.getByPlaceholder('Chọn thời điểm').press('Enter');
  await page.getByText('APTMWFTH9XT234394', {exact:true}).first().waitFor();
  console.log(await page.locator('input').evaluateAll(xs=>xs.map(x=>({placeholder:x.placeholder,value:x.value}))));
  check('R01', (await page.locator('body').innerText()).includes('APTMWFTH9XT234394'), 'Lịch bác sĩ Lê Thu Hà, P.201, ngày 16/11');
  await page.getByText('APTMWFTH9XT234394', {exact:true}).first().click();
  await page.getByRole('button', {name:/Ghi nhận đến/}).first().waitFor();
  check('R02', (await page.locator('body').innerText()).includes('APTMWFTGJ2SAD764C'), 'Mở bệnh nhân thấy cả hai lịch và hóa đơn tương ứng');
  await page.getByRole('button', {name:/Ghi nhận đến/}).first().click();
  await page.waitForTimeout(700);
  console.log('MODALS',await page.locator('.ant-modal-content').allTextContents());
};
