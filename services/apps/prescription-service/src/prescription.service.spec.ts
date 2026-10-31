describe('Prescription lifecycle',()=>{it('has no pharmacy state',()=>expect(['DRAFT','ISSUED','CANCELLED']).not.toContain('DISPENSED'));});
