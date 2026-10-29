import { Button, Empty, Space } from 'antd';
import type { DeskAppointment, DeskCatalog, DeskPatient, PatientMap } from '../../../services/receptionDesk';
import { PatientCard } from './PatientCard';

interface Props {
  query: string;
  patients: DeskPatient[];
  patientMap: PatientMap;
  appointments: DeskAppointment[];
  catalog?: DeskCatalog | null;
  busy?: boolean;
  onOpen: (a: DeskAppointment) => void;
  onCheckIn: (a: DeskAppointment) => void;
  onCancel?: (a: DeskAppointment) => void;
  onCollect?: (a: DeskAppointment) => void;
  onPrint?: (what: string) => void;
  onClear: () => void;
  onPatientUpdated?: (updated: DeskPatient) => void;
  onAppointmentUpdated?: (updated: DeskAppointment) => void;
}

export function SearchResults({
  query,
  patients,
  patientMap,
  appointments,
  catalog,
  busy,
  onOpen,
  onCheckIn,
  onCancel,
  onCollect,
  onPrint,
  onClear,
  onPatientUpdated,
  onAppointmentUpdated,
}: Props) {
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14 }}>
          Tìm thấy <b style={{ color: '#0B5CAD' }}>{patients.length}</b> bệnh nhân cho “<b>{query}</b>”
        </span>
        <Button onClick={onClear}>Xóa tìm kiếm</Button>
      </div>

      {patients.length === 0 ? (
        <Empty
          description={
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, color: '#4b5563', margin: 0 }}>
                Không tìm thấy bệnh nhân hoặc lịch hẹn phù hợp với “<b>{query}</b>”
              </p>
            </div>
          }
          style={{ background: '#fff', padding: '48px 24px', borderRadius: 12 }}
        />
      ) : (
        patients.map((p) => (
          <PatientCard
            key={p.id}
            patient={p}
            patients={patientMap}
            appointments={appointments.filter((a) => a.patientId === p.id)}
            catalog={catalog}
            busy={busy}
            onOpen={onOpen}
            onCheckIn={onCheckIn}
            onCancel={onCancel}
            onCollect={onCollect}
            onPrint={onPrint}
            onPatientUpdated={onPatientUpdated}
            onAppointmentUpdated={onAppointmentUpdated}
          />
        ))
      )}
    </Space>
  );
}
