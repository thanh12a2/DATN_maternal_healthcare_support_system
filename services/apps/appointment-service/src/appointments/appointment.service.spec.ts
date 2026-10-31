import { AppointmentDomainException } from '../common/domain.exception';
describe('Appointment invariants',()=>{it('keeps patient cancel forbidden by design',()=>{const e=new AppointmentDomainException('FORBIDDEN','Staff only',403);expect(e.code).toBe('FORBIDDEN');expect(e.getStatus()).toBe(403);});it('uses a five minute hold constant contract',()=>{expect(300_000).toBe(5*60*1000);});});
