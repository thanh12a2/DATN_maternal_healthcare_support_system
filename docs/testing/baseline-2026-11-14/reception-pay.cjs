module.exports = async ({page,check}) => {
  await page.goto('http://localhost:3000/workspace/receptionist/overview');
  const search=page.getByPlaceholder(/Tìm theo tên bệnh nhân/);
  await search.fill('APTMWFTH9XT234394'); await search.press('Enter');
  await page.getByRole('button',{name:/Thu tiền & Check-in ngay/}).first().waitFor();
  await page.getByRole('button',{name:/Thu tiền & Check-in ngay/}).first().click();
  await page.getByRole('button',{name:/Xác nhận Thu tiền & Cấp số thứ tự/}).waitFor();
  check('R03',true,'Mở modal thu tiền/check-in từ lịch hẹn đã đặt');
  await page.getByRole('button',{name:/Xác nhận Thu tiền & Cấp số thứ tự/}).click();
  await page.waitForTimeout(2500);
  console.log('AFTER_PAYMENT', (await page.locator('body').innerText()).slice(-5000));
};
