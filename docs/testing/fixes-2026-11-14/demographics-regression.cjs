module.exports=async({page,check})=>{
  await page.goto('http://localhost:3000/workspace/doctor/overview');
  await page.getByPlaceholder('Chọn thời điểm').fill('16/11/2026');await page.getByPlaceholder('Chọn thời điểm').press('Enter');
  await page.getByText(/Tất cả ca hôm nay/).click();
  await page.getByText('APTMWFTH9XT234394',{exact:true}).first().click();
  await page.getByPlaceholder('120/80',{exact:true}).waitFor();
  const body=await page.locator('body').innerText();
  check('F02-nationalId',body.includes('001193000102')&&!body.includes('001196000112'),'Actual national ID, no hardcoded fallback');
  check('F02-phone',body.includes('+84901234003')||body.includes('0901234003'),'Actual phone from Patient Service');
  check('F02-address',body.includes('45 Tràng Thi')&&!body.includes('18 Lý Thường Kiệt'),'Actual address');
  check('F02-contact',body.includes('Nguyễn Hoàng Long')&&!body.includes('Lê Quang Huy'),'Actual emergency contact');
  check('F02-age',body.includes('33 tuổi')&&body.includes('22/9/1993'),'DOB and age calculated from actual patient');
};
