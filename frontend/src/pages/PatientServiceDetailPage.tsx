import { useEffect, useState } from 'react';
import { useAuthSession } from '../app/AuthSessionProvider';
import { navigate } from '../app/navigation';
import { PatientSidebar } from '../components/navigation/PatientSidebar';
import { LoadingPlaceholder } from '../components/ui/LoadingPlaceholder';
import { getCatalogService, type CatalogService } from '../services/catalog';
import '../styles/patient-service-detail.css';

function serviceName(service: CatalogService) { return String(service.name ?? service.displayName ?? 'Dịch vụ khám'); }
function categoryName(service: CatalogService) { return service.categories?.find((category) => category.isPrimary)?.name ?? service.categories?.[0]?.name ?? 'Dịch vụ y tế'; }
function formatMoney(amount?: number, currency = 'VND') { return amount === undefined ? 'Theo bảng giá cơ sở' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
function servicePrice(service: CatalogService) { const price = service.prices?.[0]; return price ? formatMoney(price.amountMinor, price.currency) : 'Theo bảng giá cơ sở'; }
function serviceDescription(service: CatalogService) { return String(service.summary ?? service.description ?? 'Thông tin dịch vụ được cập nhật theo cấu hình của phòng khám.'); }
function serviceId(service: CatalogService) { return String(service.id ?? service.slug ?? ''); }
function CheckIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>; }
function HeartIcon({ filled = false }: { filled?: boolean }) { return <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true"><path d="M20.8 8.7c0 5.5-8.8 10.2-8.8 10.2S3.2 14.2 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>; }
type DetailTab = 'overview' | 'process' | 'notes';

export function PatientServiceDetailPage({ serviceId: requestedServiceId }: { serviceId: string }) {
  const auth = useAuthSession();
  const [service, setService] = useState<CatalogService | null>(null);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [saved, setSaved] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCatalogService(auth.request, requestedServiceId)
      .then((value) => { if (!active) return; setService(value); setState('ready'); })
      .catch((reason) => { if (!active) return; setError(reason instanceof Error ? reason.message : 'Không thể tải thông tin dịch vụ.'); setState('error'); });
    return () => { active = false; };
  }, [auth.request, requestedServiceId]);

  useEffect(() => {
    if (!service) return;
    const id = serviceId(service);
    try { setSaved((JSON.parse(localStorage.getItem('anTamSavedServices') ?? '[]') as string[]).includes(id)); } catch { setSaved(false); }
  }, [service]);

  function toggleSaved() {
    if (!service) return;
    const id = serviceId(service);
    setSaved((current) => {
      let savedIds: string[];
      try { savedIds = JSON.parse(localStorage.getItem('anTamSavedServices') ?? '[]') as string[]; } catch { savedIds = []; }
      const next = current ? savedIds.filter((item) => item !== id) : [...savedIds.filter((item) => item !== id), id];
      try { localStorage.setItem('anTamSavedServices', JSON.stringify(next)); } catch { /* storage unavailable */ }
      return !current;
    });
  }

  const tabs: Array<{ id: DetailTab; label: string }> = [{ id: 'overview', label: 'Thông tin dịch vụ' }, { id: 'process', label: 'Quy trình' }, { id: 'notes', label: 'Lưu ý' }];
  const description = service ? serviceDescription(service) : '';
  const id = service ? serviceId(service) : requestedServiceId;
  const tabLabel = tabs.find((item) => item.id === tab)?.label ?? 'Thông tin dịch vụ';

  return <div className="patient-home-shell patient-desktop-portal">
    <PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} />
    <main className="patient-main-view"><section className="service-detail-page" aria-labelledby="service-detail-title">
      <button className="service-detail-breadcrumb" type="button" onClick={() => navigate('/dich-vu')}><span aria-hidden="true">←</span><strong>Dịch vụ y tế</strong><span>/</span><span>{service ? serviceName(service) : 'Chi tiết dịch vụ'}</span></button>
      <LoadingPlaceholder visible={state === 'loading'} label="Đang tải thông tin dịch vụ" />
      {state === 'error' && <div className="service-detail-feedback" role="alert"><strong>Không thể tải thông tin dịch vụ</strong><span>{error}</span><button type="button" onClick={() => navigate('/dich-vu')}>Quay lại danh mục</button></div>}
      {state === 'ready' && service && <><div className="service-detail-hero">
        <div className="service-detail-media">{service.thumbnailUrl ? <img src={service.thumbnailUrl} alt={serviceName(service)} /> : <div className="service-detail-media-fallback" aria-hidden="true"><span>{serviceName(service).slice(0, 2).toUpperCase()}</span></div>}</div>
        <aside className="service-detail-summary"><div className="service-detail-summary-body"><span className="service-detail-category">{categoryName(service)}</span><h1 id="service-detail-title">{serviceName(service)}</h1><p className="service-detail-description">{description}</p><div className="service-detail-price"><span>Chi phí</span><strong>{servicePrice(service)}</strong></div><ul className="service-detail-checklist"><li><CheckIcon /><span>Thông tin dịch vụ được hiển thị rõ ràng</span></li><li><CheckIcon /><span>Chọn ngày và khung giờ phù hợp</span></li><li><CheckIcon /><span>Xác nhận trước khi tạo lịch hẹn</span></li></ul><div className="service-detail-actions"><button className="service-detail-book" type="button" onClick={() => navigate('/dat-lich?serviceId=' + encodeURIComponent(id))}>Đặt lịch hẹn</button><button className={'service-detail-save ' + (saved ? 'is-saved' : '')} type="button" aria-label={saved ? 'Bỏ lưu dịch vụ' : 'Lưu dịch vụ'} aria-pressed={saved} onClick={toggleSaved}><HeartIcon filled={saved} /></button></div></div></aside>
      </div><div className="service-detail-content"><nav className="service-detail-tabs" role="tablist" aria-label="Nội dung dịch vụ">{tabs.map((item) => <button key={item.id} className={'service-detail-tab ' + (tab === item.id ? 'is-active' : '')} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav><div className="service-detail-panel" role="tabpanel"><h2>{tabLabel}</h2>{tab === 'overview' && <p>{description}</p>}{tab === 'process' && <p>Chọn ngày, khung giờ và thông tin người khám ở bước đặt lịch. Lịch hẹn chỉ được tạo sau khi bạn kiểm tra và xác nhận lần cuối.</p>}{tab === 'notes' && <p>Vui lòng chuẩn bị thông tin cá nhân cần thiết và đến đúng giờ đã chọn để quá trình tiếp nhận được thuận tiện.</p>}</div></div></>}
    </section></main>
  </div>;
}
