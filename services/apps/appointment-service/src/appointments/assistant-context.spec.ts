import { AppointmentDomainService } from './appointment.service';
describe('Minimal completed appointment assistant context',()=>{
  it('uses authenticated identity, completed past visits and a fixed projection',async()=>{
    const findFirst=jest.fn().mockResolvedValue(null);
    const patientEligibility=jest.fn().mockResolvedValue({patientId:'resolved-owner'});
    const service=new AppointmentDomainService({appointment:{findFirst}} as any,{patientEligibility} as any,{} as any);
    const result=await service.getMyAssistantContext({userId:'account',role:'PATIENT'} as any);
    const args=findFirst.mock.calls[0][0];
    expect(args.where.patientId).toBe('resolved-owner'); expect(args.where.status).toBe('COMPLETED');
    expect(args.where.endAt.lte).toBeInstanceOf(Date);
    expect(args.orderBy).toEqual([{endAt:'desc'},{id:'desc'}]);
    expect(Object.keys(args.select).sort()).toEqual(['assignedDoctorId','endAt','id','serviceId','status']);
    expect(result).toEqual({data:{lastCompleted:null}});
  });
  it('rejects a non-patient before resolving another identity',async()=>{
    const patientEligibility=jest.fn();
    const service=new AppointmentDomainService({} as any,{patientEligibility} as any,{} as any);
    await expect(service.getMyAssistantContext({userId:'staff',role:'RECEPTIONIST'} as any)).rejects.toThrow();
    expect(patientEligibility).not.toHaveBeenCalled();
  });
});
