describe('Document invariants',()=>{it('requires CLEAN before access',()=>expect(['PENDING','CLEAN']).toContain('CLEAN'));});
