import { useEffect, type ReactNode } from 'react';
import { AuthSessionProvider, useAuthSession } from './AuthSessionProvider';
import { navigate, usePathname } from './navigation';
import { AuthPage } from '../pages/AuthPage';
import { PatientHomePage } from '../pages/PatientHomePage';
import { PatientProfilePage } from '../pages/PatientProfilePage';
import { NotFoundPage } from '../pages/NotFoundPage';

function Redirect({to}:{to:string}){useEffect(()=>navigate(to,{replace:true}),[to]);return null;}
function Protected({children}:{children:ReactNode}){const auth=useAuthSession();if(auth.status==='loading')return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>;if(auth.status==='anonymous')return <Redirect to="/dang-nhap"/>;if(auth.user?.role!=='PATIENT')return <main className="app-loading"><h1>Khu vực dành cho bệnh nhân</h1><p>Tài khoản hiện tại không có quyền truy cập Patient Portal.</p><button onClick={()=>void auth.signOut().then(()=>navigate('/dang-nhap',{replace:true}))}>Đăng xuất</button></main>;return <>{children}</>;}
function Routes(){const path=usePathname();const auth=useAuthSession();if(auth.status==='loading')return <main className="app-loading" role="status">Đang khôi phục phiên đăng nhập…</main>;
  if(path==='/dang-nhap'||path==='/dang-ky'){if(auth.status==='authenticated')return <Redirect to="/tong-quan"/>;return <AuthPage mode={path==='/dang-ky'?'register':'login'}/>;}
  if(path==='/tong-quan')return <Protected><PatientHomePage/></Protected>;
  if(path==='/ho-so/hoan-thien')return <Protected><PatientProfilePage/></Protected>;
  return <NotFoundPage/>;
}
export function AppRouter(){return <AuthSessionProvider><Routes/></AuthSessionProvider>;}
