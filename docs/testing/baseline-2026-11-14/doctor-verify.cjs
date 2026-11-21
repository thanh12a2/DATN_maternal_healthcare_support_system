module.exports=async({page,check,context})=>{
  await page.goto('http://localhost:3000/workspace/doctor/overview');
  await page.getByPlaceholder('Chọn thời điểm').fill('16/11/2026');
  await page.getByPlaceholder('Chọn thời điểm').press('Enter');
  await page.getByText(/Tất cả ca hôm nay/).click();
  await page.getByText('APTMWFTH9XT234394',{exact:true}).first().click();
  await page.getByPlaceholder('120/80',{exact:true}).waitFor();
  check('D04',await page.getByPlaceholder('120/80',{exact:true}).inputValue()==='120/80'&&await page.getByPlaceholder('58.5',{exact:true}).inputValue()==='58.5','Sinh hiệu đã lưu và giữ nguyên sau reload');
  check('D06',await page.getByPlaceholder(/Nhập chẩn đoán lâm sàng/).inputValue()==='KIỂM THỬ CHỨC NĂNG LƯU BỆNH ÁN — dữ liệu mô phỏng, không phải chẩn đoán thực tế.','Nội dung thử nghiệm lưu đúng sau reload');
  check('D07',(await page.locator('body').innerText()).includes('Đã hoàn tất ca khám'),'Ca hoàn tất hiển thị lại sau reload');
  check('D08',await page.getByPlaceholder('120/80',{exact:true}).isDisabled(),'Hồ sơ đã hoàn tất không cho sửa sinh hiệu');
  check('BUG01',!(await page.locator('body').innerText()).includes('001196000112'),'Định danh bác sĩ phải khớp hồ sơ Thanh Hằng, không dùng dữ liệu fallback của người khác');
};
