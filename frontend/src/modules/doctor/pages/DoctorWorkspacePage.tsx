import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate, usePathname } from '../../../app/navigation';
import { DoctorWorkspaceFrame } from '../components/DoctorWorkspaceFrame';
import { DoctorWorkspace } from '../components/DoctorWorkspace';
import '../../../styles/patient-home.css';
import '../../../styles/patient-portal.css';
import '../../../styles/doctor-content.css';

export function DoctorWorkspacePage() {
  const auth = useAuthSession();
  const pathname = usePathname();
  const section = pathname.split('/').filter(Boolean).at(-1) || 'overview';

  return (
    <div className="patient-home-shell patient-desktop-portal doctor-portal">
      <PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} />
      <main className="patient-main-view doctor-main">
        <DoctorWorkspaceFrame section={section} email={auth.user?.email}>
          <DoctorWorkspace section={section} request={auth.request} userId={auth.user?.userId} />
        </DoctorWorkspaceFrame>
      </main>
    </div>
  );
}
