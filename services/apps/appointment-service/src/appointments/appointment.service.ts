import { createHash, randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppointmentStatus, BookingChannel, Prisma, SelectionMode, SlotHoldStatus } from '../../../../generated/appointment-client';
import type { PublicAuthContext } from '@platform';
import { AppointmentPrismaService } from '../database/prisma.service';
import { AppointmentDomainException } from '../common/domain.exception';
import { AppointmentDependencyGateway } from './dependency.gateway';
import { presentAppointment, presentHold } from './presenter';
import type { AppointmentListDto, CreateAppointmentDto, CreateHoldDto, DoctorOccupancyDto, ReassignDto, ReasonVersionDto, RescheduleDto, SlotQueryDto } from './dto';
import { MATCHING_WEIGHTS } from './matching-weights.config';

type Ctx={requestId?:string;correlationId?:string;idempotencyKey?:string;actorAccountId?:string;actorRole?:string};
const STAFF=['RECEPTIONIST','CLINIC_MANAGER','ADMIN'];
@Injectable()
export class AppointmentDomainService {
 constructor(private readonly db:AppointmentPrismaService,private readonly deps:AppointmentDependencyGateway){}
 async doctorOccupancy(q:DoctorOccupancyDto,auth:PublicAuthContext){
  if(auth.role!=='DOCTOR')this.fail(403,'FORBIDDEN','Doctor only');
  const from=new Date(q.from),to=new Date(q.to);
  if(!Number.isFinite(from.getTime())||!Number.isFinite(to.getTime())||from>=to||to.getTime()-from.getTime()>31*86400000)this.fail(400,'VALIDATION_FAILED','Invalid range');
  const resolved=await this.deps.doctorByAccount(auth.userId,this.ctx(auth));
  if(!resolved.found||!resolved.doctorId)this.fail(403,'DOCTOR_PROFILE_NOT_FOUND','Doctor profile not found');
  const overlap={startAt:{lt:to},endAt:{gt:from}};
  const [appointments,holds]=await Promise.all([
   this.db.appointment.findMany({where:{assignedDoctorId:resolved.doctorId,status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED,AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE]},...overlap},select:{startAt:true,endAt:true}}),
   this.db.slotHold.findMany({where:{doctorId:resolved.doctorId,status:SlotHoldStatus.ACTIVE,expiresAt:{gt:new Date()},...overlap},select:{startAt:true,endAt:true}}),
  ]);
  return {data:[...appointments,...holds].map(x=>({startAt:x.startAt,endAt:x.endAt}))};
 }
 async listBookableSlots(q:SlotQueryDto,auth:PublicAuthContext){
  const from=new Date(q.from),to=new Date(q.to);
  this.interval(from,to);
  const targetDoctorId=q.doctorId??q.requestedDoctorId;
  const targetRankCode=q.rankCode??q.requestedRankCode;
  const effectiveRank=q.selectionMode===SelectionMode.RANK?'BASIC':(targetRankCode??'BASIC');
  const offering=await this.deps.offering(q.serviceId,effectiveRank,from,this.ctx(auth));
  const specialty=offering.offering.requiredSpecialtyId;
  let doctors:any[]=[];

  if(q.selectionMode===SelectionMode.DOCTOR){
    if(!targetDoctorId)this.fail(400,'VALIDATION_FAILED','doctorId required');
    const r=await this.deps.doctorEligibility(targetDoctorId,specialty,this.ctx(auth));
    doctors=[r.doctor];
  }else{
    // Bắt buộc chỉ lọc bác sĩ ngạch tiêu chuẩn BASIC (Phụ phí = 0đ)
    const r=await this.deps.eligibleDoctors(specialty,'BASIC',from,to,this.ctx(auth));
    doctors=(r.doctors??[]).filter((d:any)=>d.status==='DOCTOR_OPERATIONAL_STATUS_ACTIVE');
  }

  const sliceInterval=(startAt:Date,endAt:Date,slotDurationMinutes:number=30)=>{
    const slots:{startAt:Date;endAt:Date}[]=[];
    const durationMs=(slotDurationMinutes||30)*60*1000;
    let curr=startAt.getTime();
    const end=endAt.getTime();
    while(curr+durationMs<=end){
      slots.push({startAt:new Date(curr),endAt:new Date(curr+durationMs)});
      curr+=durationMs;
    }
    return slots;
  };

  if(q.selectionMode===SelectionMode.DOCTOR){
    const rows:any[]=[];
    for(const d of doctors){
      const av=await this.deps.doctorAvailability(d.doctorId,from,to,this.ctx(auth));
      for(const it of av.availableIntervals??[]){
        const s=this.ts(it.startAt),e=this.ts(it.endAt);
        if(!s||!e)continue;
        const slots=sliceInterval(s,e,it.slotDurationMinutes||30);
        for(const slot of slots){
          const occupied=await this.db.appointment.count({where:{assignedDoctorId:d.doctorId,status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED,AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE]},startAt:{lt:slot.endAt},endAt:{gt:slot.startAt}}});
          const held=await this.db.slotHold.count({where:{doctorId:d.doctorId,status:SlotHoldStatus.ACTIVE,expiresAt:{gt:new Date()},startAt:{lt:slot.endAt},endAt:{gt:slot.startAt}}});
          const isAvailable = (!occupied && !held);
          rows.push({
            serviceId:q.serviceId,
            selectionMode:q.selectionMode,
            doctorId:d.doctorId,
            doctorName:d.displayName||null,
            rankCode:d.consultationRankCode,
            roomId:it.roomId||null,
            roomCode:it.roomCode||null,
            roomName:it.roomName||null,
            room:it.roomCode?{id:it.roomId||null,code:it.roomCode,name:it.roomName||null}:null,
            startAt:slot.startAt,
            endAt:slot.endAt,
            availableCapacity:isAvailable?1:0,
            isAvailable
          });
        }
      }
    }
    rows.sort((a,b)=>new Date(a.startAt).getTime()-new Date(b.startAt).getTime());
    return{items:rows,nextPageToken:null};
  }

  // THUẬT TOÁN CHO CHẾ ĐỘ "BỆNH VIỆN TỰ ĐỘNG SẮP XẾP"
  type CandidateSlot={doctor:any;interval:any;startAt:Date;endAt:Date};
  const slotMap=new Map<string,{startAt:Date;endAt:Date;free:CandidateSlot[];busy:CandidateSlot[]}>();

  let patientId:string|undefined;
  if(auth.role==='PATIENT'&&auth.userId){
    try{
      const eligibility=await this.deps.patientEligibility(undefined,this.ctx(auth));
      if(eligibility?.patientId)patientId=String(eligibility.patientId);
    }catch{}
  }

  for(const d of doctors){
    const av=await this.deps.doctorAvailability(d.doctorId,from,to,this.ctx(auth));
    for(const it of av.availableIntervals??[]){
      const s=this.ts(it.startAt),e=this.ts(it.endAt);
      if(!s||!e)continue;
      const slots=sliceInterval(s,e,it.slotDurationMinutes||30);

      for(const slot of slots){
        const [occupied,held]=await Promise.all([
          this.db.appointment.count({where:{assignedDoctorId:d.doctorId,status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED,AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE]},startAt:{lt:slot.endAt},endAt:{gt:slot.startAt}}}),
          this.db.slotHold.count({where:{doctorId:d.doctorId,status:SlotHoldStatus.ACTIVE,expiresAt:{gt:new Date()},startAt:{lt:slot.endAt},endAt:{gt:slot.startAt}}}),
        ]);

        const key=`${slot.startAt.toISOString()}_${slot.endAt.toISOString()}`;
        if(!slotMap.has(key)){
          slotMap.set(key,{startAt:slot.startAt,endAt:slot.endAt,free:[],busy:[]});
        }
        const entry=slotMap.get(key)!;
        if(occupied===0&&held===0){
          entry.free.push({doctor:d,interval:it,startAt:slot.startAt,endAt:slot.endAt});
        }else{
          entry.busy.push({doctor:d,interval:it,startAt:slot.startAt,endAt:slot.endAt});
        }
      }
    }
  }

  const finalRows:any[]=[];
  for(const [_,entry] of slotMap.entries()){
    const start=entry.startAt;
    const startOfDay=new Date(start);startOfDay.setHours(0,0,0,0);
    const endOfDay=new Date(start);endOfDay.setHours(23,59,59,999);

    if(entry.free.length>0){
      const scored=await Promise.all(entry.free.map(async (c)=>{
        // Tiêu chí 1: Bác sĩ từng khám cho thai phụ (+50)
        const priorCount=patientId?await this.db.appointment.count({
          where:{patientId,assignedDoctorId:c.doctor.doctorId,status:AppointmentStatus.COMPLETED}
        }):0;
        const continuityScore=priorCount>0?MATCHING_WEIGHTS.CONTINUITY_OF_CARE_SCORE:0;

        // Tiêu chí 2: Cân bằng tải buồng khám (+30 max)
        const dayLoad=await this.db.appointment.count({
          where:{assignedDoctorId:c.doctor.doctorId,startAt:{gte:startOfDay,lte:endOfDay},status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE,AppointmentStatus.COMPLETED]}}
        });
        const loadScore=Math.max(0,MATCHING_WEIGHTS.LOAD_BALANCE_MAX_SCORE-dayLoad*MATCHING_WEIGHTS.LOAD_BALANCE_PENALTY_PER_APPOINTMENT);
        return{
          ...c,
          totalScore:continuityScore+loadScore,
          dayLoad,
          doctorId:c.doctor.doctorId
        };
      }));

      // Sắp xếp: Điểm cao nhất -> Ít ca hơn -> ID nhỏ hơn
      scored.sort((a,b)=>{
        if(b.totalScore!==a.totalScore)return b.totalScore-a.totalScore;
        if(a.dayLoad!==b.dayLoad)return a.dayLoad-b.dayLoad;
        return String(a.doctorId).localeCompare(String(b.doctorId));
      });

      const winner=scored[0];
      const it=winner.interval;
      finalRows.push({
        serviceId:q.serviceId,
        selectionMode:q.selectionMode,
        doctorId:winner.doctor.doctorId,
        doctorName:winner.doctor.displayName||null,
        rankCode:'BASIC',
        roomId:it.roomId||null,
        roomCode:it.roomCode||null,
        roomName:it.roomName||null,
        room:it.roomCode?{id:it.roomId||null,code:it.roomCode,name:it.roomName||null}:null,
        startAt:winner.startAt,
        endAt:winner.endAt,
        availableCapacity:entry.free.length,
        isAvailable:true
      });
    }else if(entry.busy.length>0){
      const sample=entry.busy[0];
      const it=sample.interval;
      finalRows.push({
        serviceId:q.serviceId,
        selectionMode:q.selectionMode,
        doctorId:sample.doctor.doctorId,
        doctorName:sample.doctor.displayName||null,
        rankCode:'BASIC',
        roomId:it.roomId||null,
        roomCode:it.roomCode||null,
        roomName:it.roomName||null,
        room:it.roomCode?{id:it.roomId||null,code:it.roomCode,name:it.roomName||null}:null,
        startAt:sample.startAt,
        endAt:sample.endAt,
        availableCapacity:0,
        isAvailable:false
      });
    }
  }

  finalRows.sort((a,b)=>new Date(a.startAt).getTime()-new Date(b.startAt).getTime());
  return{items:finalRows,nextPageToken:null};
}
 async createHold(dto:CreateHoldDto,auth:PublicAuthContext,key?:string){
  const idem=this.key(key),patientId=await this.resolvePatientId(dto.patientId,auth);
  if(dto.selectionMode===SelectionMode.DOCTOR){dto.requestedRankCode=undefined;}
  if(dto.selectionMode===SelectionMode.RANK){dto.requestedDoctorId=undefined;if(!dto.requestedRankCode)dto.requestedRankCode='BASIC';}
  this.selection(dto.selectionMode,dto.requestedDoctorId,dto.requestedRankCode);
  const start=new Date(dto.startAt),end=new Date(dto.endAt);
  this.interval(start,end);
  const ctx=this.ctx(auth,idem);
  const eligibility=await this.deps.patientEligibility(patientId,ctx);
  const isEligible=eligibility?.eligibleForBooking??(eligibility?.active&&eligibility?.profileComplete);
  if(!isEligible)this.fail(422,'PATIENT_NOT_ELIGIBLE','Patient not eligible');
  if(auth.role==='PATIENT'&&!eligibility.callerOwnsPatient)this.fail(403,'FORBIDDEN','Patient ownership mismatch');

  let doctor:any,rank=dto.requestedRankCode??'';
  let roomId:string|null=null,roomCode:string|null=null,roomName:string|null=null;
  const effectiveRank=dto.selectionMode===SelectionMode.RANK?'BASIC':(rank||'BASIC');
  const firstOffering=await this.deps.offering(dto.serviceId,effectiveRank,start,ctx);
  const specialty=firstOffering.offering.requiredSpecialtyId;

  if(dto.selectionMode===SelectionMode.DOCTOR){
    const result=await this.deps.doctorEligibility(dto.requestedDoctorId!,specialty,ctx);
    doctor=result.doctor;
    rank=doctor.consultationRankCode;
    if(!doctor||doctor.status!=='DOCTOR_OPERATIONAL_STATUS_ACTIVE')this.fail(422,'DOCTOR_NOT_ELIGIBLE','No eligible doctor');
    const av=await this.deps.doctorAvailability(doctor.doctorId,start,end,ctx);
    const matchedInterval=(av.availableIntervals??[]).find((x:any)=>{
      const s=this.ts(x.startAt),e=this.ts(x.endAt);
      return s&&e&&s<=start&&e>=end;
    });
    if(!matchedInterval)this.fail(409,'SLOT_NOT_AVAILABLE','Doctor not available');
    roomId=matchedInterval.roomId||null;
    roomCode=matchedInterval.roomCode||null;
    roomName=matchedInterval.roomName||null;
  }else{
    // BẮT BUỘC rank 'BASIC'
    rank='BASIC';
    const result=await this.deps.eligibleDoctors(specialty,'BASIC',start,end,ctx);
    const candidateDocs=(result.doctors??[]).filter((d:any)=>d.status==='DOCTOR_OPERATIONAL_STATUS_ACTIVE');
    if(!candidateDocs.length){
      this.fail(409,'SLOT_NOT_AVAILABLE','Không có bác sĩ tiêu chuẩn nào trực vào khung giờ này.');
    }

    // Bước A: Lọc cứng
    const validCandidates:any[]=[];
    for(const d of candidateDocs){
      const av=await this.deps.doctorAvailability(d.doctorId,start,end,ctx);
      const matched=(av.availableIntervals??[]).find((x:any)=>{
        const s=this.ts(x.startAt),e=this.ts(x.endAt);
        return s&&e&&s<=start&&e>=end;
      });
      if(!matched)continue;

      const [occupied,held]=await Promise.all([
        this.db.appointment.count({
          where:{assignedDoctorId:d.doctorId,status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED,AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE]},startAt:{lt:end},endAt:{gt:start}}
        }),
        this.db.slotHold.count({
          where:{doctorId:d.doctorId,status:SlotHoldStatus.ACTIVE,expiresAt:{gt:new Date()},startAt:{lt:end},endAt:{gt:start}}
        }),
      ]);

      if(occupied===0&&held===0){
        validCandidates.push({doc:d,interval:matched});
      }
    }

    if(validCandidates.length===0){
      this.fail(409,'SLOT_NOT_AVAILABLE','Khung giờ này vừa có người giữ chỗ hoặc đã kín lịch. Vui lòng chọn khung giờ khác.');
    }

    // Bước B: Chấm điểm
    const startOfDay=new Date(start);startOfDay.setHours(0,0,0,0);
    const endOfDay=new Date(start);endOfDay.setHours(23,59,59,999);

    const scored=await Promise.all(validCandidates.map(async (c)=>{
      const priorCount=patientId?await this.db.appointment.count({
        where:{patientId,assignedDoctorId:c.doc.doctorId,status:AppointmentStatus.COMPLETED}
      }):0;
      const continuityScore=priorCount>0?MATCHING_WEIGHTS.CONTINUITY_OF_CARE_SCORE:0;

      const dayLoad=await this.db.appointment.count({
        where:{assignedDoctorId:c.doc.doctorId,startAt:{gte:startOfDay,lte:endOfDay},status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE,AppointmentStatus.COMPLETED]}}
      });
      const loadScore=Math.max(0,MATCHING_WEIGHTS.LOAD_BALANCE_MAX_SCORE-dayLoad*MATCHING_WEIGHTS.LOAD_BALANCE_PENALTY_PER_APPOINTMENT);
      return{
        ...c,
        totalScore:continuityScore+loadScore,
        dayLoad,
        doctorId:c.doc.doctorId
      };
    }));

    scored.sort((a,b)=>{
      if(b.totalScore!==a.totalScore)return b.totalScore-a.totalScore;
      if(a.dayLoad!==b.dayLoad)return a.dayLoad-b.dayLoad;
      return String(a.doctorId).localeCompare(String(b.doctorId));
    });

    const winner=scored[0];
    doctor=winner.doc;
    roomId=winner.interval.roomId||null;
    roomCode=winner.interval.roomCode||null;
    roomName=winner.interval.roomName||null;
  }

  const hash=this.hash(dto);
  const replay=await this.replay('create-hold',idem,hash);
  if(replay)return replay;

  try{
    return await this.db.$transaction(async tx=>{
      await tx.slotHold.updateMany({where:{status:SlotHoldStatus.ACTIVE,expiresAt:{lte:new Date()}},data:{status:SlotHoldStatus.EXPIRED}});
      const overlap=await Promise.all([
        tx.appointment.count({where:{assignedDoctorId:doctor.doctorId,status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED,AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE]},startAt:{lt:end},endAt:{gt:start}}}),
        tx.slotHold.count({where:{doctorId:doctor.doctorId,status:SlotHoldStatus.ACTIVE,expiresAt:{gt:new Date()},startAt:{lt:end},endAt:{gt:start}}})
      ]);
      if(overlap[0]||overlap[1])this.fail(409,'SLOT_NOT_AVAILABLE','Slot no longer available');

      const hold=await tx.slotHold.create({
        data:{
          patientId,
          serviceId:dto.serviceId,
          doctorId:doctor.doctorId,
          rankCode:rank,
          selectionMode:dto.selectionMode,
          roomId,
          roomCode,
          roomName,
          startAt:start,
          endAt:end,
          expiresAt:new Date(Date.now()+MATCHING_WEIGHTS.SLOT_HOLD_TTL_MS)
        }
      });
      const body=presentHold(hold);
      await tx.appointmentIdempotencyRecord.create({data:{scope:'create-hold',key:idem,requestHash:hash,resourceId:hold.id,responseStatus:201,responseBody:body as any}});
      return body;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }catch(e){
    if(e instanceof AppointmentDomainException)throw e;
    this.fail(409,'SLOT_NOT_AVAILABLE','Concurrent slot conflict');
  }
}
 
 async releaseHold(id:string,auth:PublicAuthContext){
  const hold=await this.db.slotHold.findUnique({where:{id}});
  if(!hold)this.fail(404,'HOLD_NOT_FOUND','Hold not found');
  await this.authorizePatient(hold.patientId,auth);
  if(hold.status===SlotHoldStatus.ACTIVE)await this.db.slotHold.update({where:{id},data:{status:SlotHoldStatus.RELEASED}});
 }

 async createAppointment(dto:CreateAppointmentDto,auth:PublicAuthContext,key?:string){const idem=this.key(key),hash=this.hash(dto),ctx=this.ctx(auth,idem);const replay=await this.replay('create-appointment',idem,hash);if(replay)return replay;const hold=await this.db.slotHold.findUnique({where:{id:dto.holdId}});if(!hold)this.fail(404,'HOLD_NOT_FOUND','Hold not found');await this.authorizePatient(hold.patientId,auth);if(hold.status!==SlotHoldStatus.ACTIVE||hold.expiresAt<=new Date())this.fail(409,'HOLD_EXPIRED','Hold expired');const eligibility=await this.deps.patientEligibility(hold.patientId,ctx);const isEligible=eligibility?.eligibleForBooking??(eligibility?.active&&eligibility?.profileComplete);if(!isEligible)this.fail(422,'PATIENT_NOT_ELIGIBLE','Patient not eligible');const offering=(await this.deps.offering(hold.serviceId,hold.rankCode,hold.startAt,ctx)).offering;if(!offering?.requiredSpecialtyId)this.fail(422,'SERVICE_SPECIALTY_NOT_CONFIGURED','Catalog service specialty is not configured');const doctor=(await this.deps.doctorEligibility(hold.doctorId,offering.requiredSpecialtyId,ctx)).doctor;if(doctor.status!=='DOCTOR_OPERATIONAL_STATUS_ACTIVE'||doctor.consultationRankCode!==hold.rankCode)this.fail(422,'DOCTOR_NOT_ELIGIBLE','Doctor changed');const estimate=await this.deps.queueEstimate(offering.serviceCode||'INITIAL',hold.doctorId,hold.startAt,ctx);return this.db.$transaction(async tx=>{const consumed=await tx.slotHold.updateMany({where:{id:hold.id,status:SlotHoldStatus.ACTIVE,expiresAt:{gt:new Date()}},data:{status:SlotHoldStatus.CONSUMED}});if(consumed.count!==1)this.fail(409,'HOLD_EXPIRED','Hold expired');const appointment=await tx.appointment.create({data:{appointmentCode:this.code(),patientId:hold.patientId,serviceId:hold.serviceId,channel:dto.channel,selectionMode:hold.selectionMode,requestedDoctorId:hold.selectionMode===SelectionMode.DOCTOR?hold.doctorId:null,requestedRankCode:hold.selectionMode===SelectionMode.RANK?hold.rankCode:null,assignedDoctorId:hold.doctorId,assignedRankCode:hold.rankCode,specialtyId:offering.requiredSpecialtyId,roomId:hold.roomId??null,roomCode:hold.roomCode??null,roomNameSnapshot:hold.roomName??null,startAt:hold.startAt,endAt:hold.endAt,serviceNameSnapshot:offering.serviceName,serviceVersion:Number(offering.serviceVersion),basePriceId:offering.basePriceId,baseAmountMinor:BigInt(offering.basePrice.amountMinor),rankSurchargePriceId:offering.rankSurchargeId||null,rankSurchargeAmountMinor:BigInt(offering.rankSurcharge.amountMinor),estimatedTotalMinor:BigInt(offering.totalPrice.amountMinor),availabilityVersion:BigInt(doctor.availabilityVersion),queueEstimateMinutes:estimate?.estimatedWaitMinutes??null}});await tx.slotHold.update({where:{id:hold.id},data:{consumedByAppointmentId:appointment.id}});await this.auditOutbox(tx,appointment,'appointment.booked.v1',auth.userId);const body=presentAppointment(appointment);await tx.appointmentIdempotencyRecord.create({data:{scope:'create-appointment',key:idem,requestHash:hash,resourceId:appointment.id,responseStatus:201,responseBody:body as any}});return body;},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
 async get(id:string,auth?:PublicAuthContext){const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);const x=isUuid?await this.db.appointment.findUnique({where:{id}}):await this.db.appointment.findUnique({where:{appointmentCode:id}});if(!x)this.fail(404,'APPOINTMENT_NOT_FOUND','Appointment not found');if(auth?.role==='DOCTOR'){const resolved=await this.deps.doctorByAccount(auth.userId,this.ctx(auth));if(!resolved.found||resolved.doctorId!==x.assignedDoctorId)this.fail(404,'APPOINTMENT_NOT_FOUND','Not found');}else if(auth)await this.authorizePatient(x.patientId,auth);return presentAppointment(x);}
 async list(q:AppointmentListDto,auth:PublicAuthContext){let patientId=q.patientId;let doctorId=q.doctorId;if(auth.role==='DOCTOR'){const resolved=await this.deps.doctorByAccount(auth.userId,this.ctx(auth));if(!resolved.found||!resolved.doctorId)this.fail(403,'DOCTOR_PROFILE_NOT_FOUND','Doctor profile not found');if(doctorId&&doctorId!==resolved.doctorId)this.fail(403,'FORBIDDEN','Doctor mismatch');doctorId=resolved.doctorId;}if(auth.role==='PATIENT'){patientId=await this.resolvePatientId(undefined,auth);}else if(!STAFF.includes(auth.role)&&auth.role!=='DOCTOR')this.fail(403,'FORBIDDEN','Staff only');const searchCode=q.appointmentCode||q.code;const rows=await this.db.appointment.findMany({where:{...(patientId?{patientId}:{}),...(doctorId?{assignedDoctorId:doctorId}:{}),...(q.roomId?{roomId:q.roomId}:{}),...(q.roomCode?{roomCode:q.roomCode}:{}),...(q.status?{status:q.status as AppointmentStatus}:{}),...(searchCode?{appointmentCode:{contains:searchCode,mode:'insensitive'}}:{}),...(q.from||q.to?{startAt:{...(q.from?{gte:new Date(q.from)}:{}),...(q.to?{lte:new Date(q.to)}:{})}}:{})},orderBy:[{startAt:'asc'},{id:'asc'}],take:(q.limit??20)+1,...(q.cursor?{cursor:{id:q.cursor},skip:1}:{})});const items=rows.slice(0,q.limit??20);const names=new Map<string,string>();if(auth.role==='DOCTOR'){const ids=[...new Set(items.map(x=>x.patientId))];await Promise.all(ids.map(async id=>{const result=await this.deps.patientIdentity(id,this.ctx(auth));names.set(id,result.patient?.fullName??'');}));}return{items:items.map(x=>({...presentAppointment(x),...(auth.role==='DOCTOR'?{patientName:names.get(x.patientId)??''}:{})})),nextPageToken:rows.length>(q.limit??20)?items.at(-1)?.id:null};}
 async cancel(id:string,dto:ReasonVersionDto,auth:PublicAuthContext,key?:string){this.staff(auth);return this.transition(id,dto.expectedVersion,[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED],AppointmentStatus.CANCELLED,{cancellationReason:dto.reason},'appointment.cancelled.v1',auth,key,dto);}
 async reschedule(id:string,dto:RescheduleDto,auth:PublicAuthContext,key?:string){this.staff(auth);const current=await this.db.appointment.findUnique({where:{id}}),hold=await this.db.slotHold.findUnique({where:{id:dto.newHoldId}});if(!current||!hold)this.fail(404,'RESOURCE_NOT_FOUND','Appointment or hold missing');if(hold.patientId!==current.patientId||hold.status!==SlotHoldStatus.ACTIVE||hold.expiresAt<=new Date())this.fail(409,'INVALID_HOLD_STATE','Invalid new hold');const offering=(await this.deps.offering(hold.serviceId,hold.rankCode,hold.startAt,this.ctx(auth,key))).offering;return this.db.$transaction(async tx=>{const u=await tx.appointment.updateMany({where:{id,version:dto.expectedVersion,status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED]}},data:{serviceId:hold.serviceId,selectionMode:hold.selectionMode,assignedDoctorId:hold.doctorId,assignedRankCode:hold.rankCode,specialtyId:offering.requiredSpecialtyId,roomId:hold.roomId??current.roomId,roomCode:hold.roomCode??current.roomCode,roomNameSnapshot:hold.roomName??current.roomNameSnapshot,startAt:hold.startAt,endAt:hold.endAt,serviceNameSnapshot:offering.serviceName,serviceVersion:Number(offering.serviceVersion),basePriceId:offering.basePriceId,baseAmountMinor:BigInt(offering.basePrice.amountMinor),rankSurchargePriceId:offering.rankSurchargeId||null,rankSurchargeAmountMinor:BigInt(offering.rankSurcharge.amountMinor),estimatedTotalMinor:BigInt(offering.totalPrice.amountMinor),status:AppointmentStatus.BOOKED,rescheduleCount:{increment:1},version:{increment:1}}});if(u.count!==1)this.fail(409,'VERSION_CONFLICT','Stale appointment');await tx.slotHold.update({where:{id:hold.id},data:{status:SlotHoldStatus.CONSUMED,consumedByAppointmentId:id}});const x=await tx.appointment.findUnique({where:{id}});await this.auditOutbox(tx,x!,'appointment.rescheduled.v1',auth.userId,dto.reason,current.assignedDoctorId);return presentAppointment(x);});}
 async reassign(id:string,dto:ReassignDto,auth:PublicAuthContext,key?:string){this.staff(auth);const current=await this.db.appointment.findUnique({where:{id}});if(!current)this.fail(404,'APPOINTMENT_NOT_FOUND','Not found');const ctx=this.ctx(auth,key);const doctor=(await this.deps.doctorEligibility(dto.doctorId,current.specialtyId,ctx)).doctor;if(doctor.status!=='DOCTOR_OPERATIONAL_STATUS_ACTIVE')this.fail(422,'DOCTOR_NOT_ELIGIBLE','Doctor not eligible');let roomId=current.roomId,roomCode=current.roomCode,roomNameSnapshot=current.roomNameSnapshot;try{const av=await this.deps.doctorAvailability(dto.doctorId,current.startAt,current.endAt,ctx);const matched=(av?.availableIntervals??[]).find((x:any)=>x.roomCode);if(matched){roomId=matched.roomId||null;roomCode=matched.roomCode||null;roomNameSnapshot=matched.roomName||null;}}catch{}return this.db.$transaction(async tx=>{const u=await tx.appointment.updateMany({where:{id,version:dto.expectedVersion,status:{in:[AppointmentStatus.BOOKED,AppointmentStatus.REASSIGNMENT_REQUIRED]}},data:{assignedDoctorId:dto.doctorId,assignedRankCode:doctor.consultationRankCode,roomId,roomCode,roomNameSnapshot,status:AppointmentStatus.BOOKED,version:{increment:1}}});if(u.count!==1)this.fail(409,'VERSION_CONFLICT','Stale appointment');await tx.appointmentAssignmentHistory.create({data:{appointmentId:id,fromDoctorId:current.assignedDoctorId,toDoctorId:dto.doctorId,rankCode:doctor.consultationRankCode,reason:dto.reason+' | '+dto.confirmationEvidence,actorId:auth.userId}});const x=await tx.appointment.findUnique({where:{id}});await this.auditOutbox(tx,x!,'appointment.reassigned.v1',auth.userId,dto.reason,current.assignedDoctorId);return presentAppointment(x);});}
 async validateAdmission(id:string,patientId:string){const isUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);const x=isUuid?await this.db.appointment.findUnique({where:{id}}):await this.db.appointment.findUnique({where:{appointmentCode:id}});if(!x||x.patientId!==patientId)return{valid:false,failureCode:'APPOINTMENT_NOT_FOUND'};return{valid:x.status===AppointmentStatus.BOOKED,failureCode:x.status===AppointmentStatus.BOOKED?'':'INVALID_STATE',appointment:presentAppointment(x),lateMinutes:Math.max(0,Math.floor((Date.now()-x.startAt.getTime())/60000))};}
 async checkIn(id:string,input:any,key?:string){if(!['PAID','APPROVED_CREDIT','ADMISSION_PAYMENT_CONDITION_PAID','ADMISSION_PAYMENT_CONDITION_APPROVED_CREDIT'].includes(input.paymentCondition))this.fail(422,'PAYMENT_CONDITION_NOT_MET','Payment required');return this.transition(id,Number(input.expectedVersion),[AppointmentStatus.BOOKED],AppointmentStatus.CHECKED_IN,{receptionCaseId:input.receptionCaseId,encounterId:input.encounterId,checkedInAt:input.checkedInAt??new Date()},'appointment.checked_in.v1',{userId:input.actorId??'',role:'RECEPTIONIST'},key,input);}
 markClinicalStarted(id:string,input:any,key?:string){return this.transition(id,Number(input.expectedVersion),[AppointmentStatus.CHECKED_IN],AppointmentStatus.IN_CLINICAL_CARE,{encounterId:input.encounterId,clinicalStartedAt:input.startedAt??new Date()},'appointment.clinical_started.v1',{userId:'',role:'SERVICE'},key,input);}
 markClinicalCompleted(id:string,input:any,key?:string){return this.transition(id,Number(input.expectedVersion),[AppointmentStatus.CHECKED_IN,AppointmentStatus.IN_CLINICAL_CARE],AppointmentStatus.COMPLETED,{encounterId:input.encounterId,completedAt:input.completedAt??new Date()},'appointment.completed.v1',{userId:'',role:'SERVICE'},key,input);}
 markNoShow(id:string,input:any,key?:string){return this.transition(id,Number(input.expectedVersion),[AppointmentStatus.BOOKED],AppointmentStatus.NO_SHOW,{},'appointment.no_show.v1',{userId:'system',role:'SERVICE'},key,input);}
 private async transition(id:string,version:number,from:AppointmentStatus[],to:AppointmentStatus,data:any,event:string,auth:{userId:string;role:string},key?:string,payload?:any){const idem=key?this.key(key):undefined;const hash=this.hash(payload??{});if(idem){const r=await this.replay(event,idem,hash);if(r)return r;}return this.db.$transaction(async tx=>{const u=await tx.appointment.updateMany({where:{id,version,status:{in:from}},data:{...data,status:to,version:{increment:1}}});if(u.count!==1)this.fail(409,'INVALID_STATE_TRANSITION','Invalid state or version');const x=await tx.appointment.findUnique({where:{id}});await this.auditOutbox(tx,x!,event,auth.userId,data.cancellationReason);const body=presentAppointment(x);if(idem)await tx.appointmentIdempotencyRecord.create({data:{scope:event,key:idem,requestHash:hash,resourceId:id,responseStatus:200,responseBody:body as any}});return body;});}
 private async authorizePatient(patientId:string,auth:PublicAuthContext){if(STAFF.includes(auth.role))return;if(auth.role!=='PATIENT')this.fail(403,'FORBIDDEN','Forbidden');const x=await this.deps.patientEligibility(patientId,this.ctx(auth));if(!x.callerOwnsPatient)this.fail(404,'APPOINTMENT_NOT_FOUND','Not found');}
 private async resolvePatientId(value:string|undefined,auth:PublicAuthContext):Promise<string>{if(auth.role==='PATIENT'){if(!auth.userId)this.fail(401,'UNAUTHENTICATED','Authenticated user id is required');const eligibility=await this.deps.patientEligibility(undefined,this.ctx(auth));if(!eligibility?.patientId)this.fail(404,'PATIENT_PROFILE_NOT_FOUND','Patient profile was not found');return String(eligibility.patientId);}if(!STAFF.includes(auth.role))this.fail(403,'FORBIDDEN','Forbidden');if(!value)this.fail(400,'PATIENT_ID_REQUIRED','patientId required for staff booking');return value;}
 private staff(auth:PublicAuthContext){if(!STAFF.includes(auth.role))this.fail(403,'FORBIDDEN','Staff only');}
 private selection(mode:SelectionMode,doctor?:string,rank?:string){if((mode===SelectionMode.DOCTOR)!==Boolean(doctor)||(mode===SelectionMode.RANK)!==Boolean(rank))this.fail(400,'VALIDATION_FAILED','Exactly one doctor or rank is required');}
 private interval(s:Date,e:Date){if(!(s<e)||Number.isNaN(s.getTime())||Number.isNaN(e.getTime()))this.fail(400,'VALIDATION_FAILED','Invalid interval');}
 private key(v?:string){if(!v||v.length>128)this.fail(400,'IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key required');return v;}
 private hash(v:any){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
 private async replay(scope:string,key:string,hash:string){const x=await this.db.appointmentIdempotencyRecord.findUnique({where:{scope_key:{scope,key}}});if(!x)return null;if(x.requestHash!==hash)this.fail(409,'IDEMPOTENCY_KEY_REUSED','Key reused');return x.responseBody;}
 private code(){return 'APT'+Date.now().toString(36).toUpperCase()+randomUUID().replace(/-/g,'').slice(0,6).toUpperCase();}
 private ts(x:any){if(!x)return undefined;return new Date(Number(x.seconds)*1000+Math.floor(Number(x.nanos??0)/1e6));}
 private ctx(auth:PublicAuthContext,key?:string):Ctx{return{requestId:randomUUID(),correlationId:randomUUID(),idempotencyKey:key,actorAccountId:auth.userId,actorRole:auth.role};}
 private async auditOutbox(tx:any,x:any,event:string,actorId?:string,reason?:string,previousDoctorId?:string|null){await tx.appointmentAuditLog.create({data:{eventType:event,actorId:actorId||null,resourceId:x.id,reason:reason||null}});await tx.appointmentOutboxEvent.create({data:{eventType:event,aggregateId:x.id,aggregateVersion:x.version,payload:{eventVersion:1,aggregateType:'appointment',aggregateId:x.id,data:{appointmentId:x.id,patientId:x.patientId,doctorId:x.assignedDoctorId,previousDoctorId:previousDoctorId??null,status:x.status,roomId:x.roomId??null,roomCode:x.roomCode??null}}}});}
 private fail(status:number,code:string,message:string):never{throw new AppointmentDomainException(code,message,status);}
}
