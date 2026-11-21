module.exports=async({page,check,events})=>{
  await page.goto('http://localhost:3000/lich-hen');
  await page.getByRole('button',{name:/Lịch sử khám/}).click();
  await page.getByText(/APTMWFTH9XT234394/).first().waitFor();
  check('P07',(await page.locator('body').innerText()).includes('Đã hoàn tất'),'Lịch hoàn tất chuyển sang lịch sử khám');
  await page.getByText('Xem kết quả',{exact:true}).click();
  await page.getByText('Đang tải đầy đủ kết quả khám...', {exact:true}).waitFor({state:'hidden',timeout:20000});
  console.log('RESULT_URL',page.url());
  console.log('LINKS',await page.getByRole('link').allTextContents());
  check('P08',(await page.locator('body').innerText()).includes('KIỂM THỬ CHỨC NĂNG LƯU BỆNH ÁN'),'Bệnh nhân xem kết quả đã lưu từ bác sĩ');
};
