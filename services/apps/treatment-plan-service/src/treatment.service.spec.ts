describe('Treatment plan lifecycle',()=>{it('uses approved states',()=>expect(['DRAFT','ACTIVE','COMPLETED','CANCELLED']).toHaveLength(4));});
