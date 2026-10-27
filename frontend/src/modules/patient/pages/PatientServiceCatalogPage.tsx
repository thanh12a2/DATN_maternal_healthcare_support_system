import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAuthSession } from '../../../app/AuthSessionProvider';
import { navigate } from '../../../app/navigation';
import { PatientSidebar } from '../../../shared/components/navigation/PatientSidebar';
import { LoadingPlaceholder } from '../../../shared/components/ui/LoadingPlaceholder';
import { listCatalogCategories, listCatalogServices, type CatalogCategory, type CatalogService } from '../../../services/catalog';
import '../../../styles/patient-service-catalog.css';

function serviceId(service: CatalogService) { return String(service.id ?? service.slug ?? ''); }
function serviceName(service: CatalogService) { return String(service.name ?? service.displayName ?? 'Dịch vụ khám'); }
function formatMoney(amount?: number, currency = 'VND') { return amount === undefined ? 'Theo bảng giá' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
function servicePrice(service: CatalogService) { const price = service.prices?.[0]; return price ? formatMoney(price.amountMinor, price.currency) : 'Theo bảng giá'; }
function categoryName(service: CatalogService) { return service.categories?.find((category) => category.isPrimary)?.name ?? service.categories?.[0]?.name ?? 'Dịch vụ y tế'; }
function categoryKey(category: CatalogCategory) { return String(category.slug ?? category.id ?? category.code ?? ''); }
function tagKey(tag: Record<string, unknown>) { return String(tag.slug ?? tag.id ?? tag.code ?? ''); }
function tagName(tag: Record<string, unknown>) { return String(tag.name ?? tag.code ?? ''); }

function SearchIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>; }
function ArrowIcon() { return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" /></svg>; }
function HeartIcon({ filled = false }: { filled?: boolean }) { return <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} aria-hidden="true"><path d="M20.8 8.7c0 5.5-8.8 10.2-8.8 10.2S3.2 14.2 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>; }
function ChevronIcon() { return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>; }
function ServiceTitle({ children }: { children: string }) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);
  useEffect(() => {
    const checkOverflow = () => { if (viewportRef.current && textRef.current) setOverflowDistance(Math.max(0, textRef.current.scrollWidth - viewportRef.current.clientWidth)); };
    checkOverflow();
    const observer = typeof ResizeObserver !== 'undefined' && viewportRef.current ? new ResizeObserver(checkOverflow) : null;
    if (observer && viewportRef.current) observer.observe(viewportRef.current);
    return () => observer?.disconnect();
  }, [children]);
  const style = overflowDistance ? { '--service-catalog-title-shift': `-${overflowDistance}px` } as CSSProperties : undefined;
  return <span className={`service-catalog-title-viewport ${overflowDistance ? 'is-overflowing' : ''}`} ref={viewportRef}><span className="service-catalog-card-title" ref={textRef} style={style}>{children}</span></span>;
}

export function PatientServiceCatalogPage() {
  const auth = useAuthSession();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortOpen, setSortOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [needOpen, setNeedOpen] = useState(true);
  const categoryTilesRef = useRef<HTMLDivElement>(null);
  const [sortMode, setSortMode] = useState<'rating' | 'newest'>('rating');
  const [priceMode, setPriceMode] = useState<'low' | 'high' | 'all'>('all');
  const [saved, setSaved] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('anTamSavedServices') ?? '[]') as string[]; } catch { return []; } });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listCatalogServices(auth.request), listCatalogCategories(auth.request)])
      .then(([serviceItems, categoryItems]) => { if (!active) return; setServices(serviceItems.filter((service) => service.bookingEnabled !== false)); setCategories(categoryItems); setState('ready'); })
      .catch((reason) => { if (!active) return; setError(reason instanceof Error ? reason.message : 'Không thể tải danh mục dịch vụ.'); setState('error'); });
    return () => { active = false; };
  }, [auth.request]);

  const tags = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    services.flatMap((service) => service.tags ?? []).forEach((tag) => { const key = tagKey(tag); if (key) map.set(key, tag); });
    return [...map.values()].slice(0, 8);
  }, [services]);
  const visibleServices = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi');
    const filtered = services.filter((service) => {
      const searchable = [serviceName(service), service.summary, service.description, categoryName(service), ...(service.tags ?? []).map(tagName)].filter(Boolean).join(' ').toLocaleLowerCase('vi');
      const categoryMatch = selectedCategory === 'all' || service.categories?.some((category) => categoryKey(category) === selectedCategory);
      const tagMatch = selectedTag === 'all' || service.tags?.some((tag) => tagKey(tag) === selectedTag);
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && categoryMatch && tagMatch;
    });
    return [...filtered].sort((a, b) => {
      if (priceMode !== 'all') {
        const aPrice = a.prices?.[0]?.amountMinor ?? Number.POSITIVE_INFINITY;
        const bPrice = b.prices?.[0]?.amountMinor ?? Number.POSITIVE_INFINITY;
        if (aPrice !== bPrice) return priceMode === 'low' ? aPrice - bPrice : bPrice - aPrice;
      }
      if (sortMode === 'newest') return String(b.publishedAt ?? b.createdAt ?? '').localeCompare(String(a.publishedAt ?? a.createdAt ?? ''));
      return serviceName(a).localeCompare(serviceName(b), 'vi');
    });
  }, [priceMode, query, selectedCategory, selectedTag, services, sortMode]);

  function scrollCategoryTiles(direction: 'left' | 'right') { categoryTilesRef.current?.scrollBy({ left: direction === 'right' ? 420 : -420, behavior: 'smooth' }); }
  function openBooking(service: CatalogService) { const id = serviceId(service); if (id) navigate(`/dat-lich?serviceId=${encodeURIComponent(id)}`); }
  function toggleSaved(service: CatalogService) { const id = serviceId(service); if (!id) return; setSaved((current) => { const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; try { localStorage.setItem('anTamSavedServices', JSON.stringify(next)); } catch { /* storage unavailable */ } return next; }); }

  return <div className="patient-home-shell patient-desktop-portal">
    <PatientSidebar onLogout={() => void auth.signOut().then(() => navigate('/dang-nhap', { replace: true }))} />
    <main className="patient-main-view"><section className="service-catalog-page">
      <header className="service-catalog-banner" aria-labelledby="service-catalog-banner-title"><div className="service-catalog-banner-copy"><h1 id="service-catalog-banner-title">Dịch vụ y tế</h1></div><span className="service-catalog-banner-cross" aria-hidden="true"></span><span className="service-catalog-banner-dot" aria-hidden="true"></span></header>
      <div className="service-catalog-toolbar"><label className="service-catalog-search"><SearchIcon /><span className="sr-only">Tìm kiếm dịch vụ</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm dịch vụ khám..." type="search" /></label></div>
      <div className="service-catalog-category-viewport"><button className="service-catalog-category-arrow prev" type="button" aria-label="Xem nhóm dịch vụ trước" onClick={() => scrollCategoryTiles('left')}><span aria-hidden="true">‹</span></button><div className="service-catalog-category-tiles" ref={categoryTilesRef}><button type="button" className={`service-catalog-category-tile ${selectedCategory === 'all' ? 'is-active' : ''}`} onClick={() => setSelectedCategory('all')}><span><PlusIcon /></span><strong>Tất cả dịch vụ</strong></button>{categories.map((category) => <button key={categoryKey(category)} type="button" className={`service-catalog-category-tile ${selectedCategory === categoryKey(category) ? 'is-active' : ''}`} onClick={() => setSelectedCategory(categoryKey(category))}><span><PlusIcon /></span><strong>{category.name}</strong></button>)}</div><button className="service-catalog-category-arrow next" type="button" aria-label="Xem nhóm dịch vụ tiếp theo" onClick={() => scrollCategoryTiles('right')}><span aria-hidden="true">›</span></button></div>
      <LoadingPlaceholder visible={state === 'loading'} label="Đang tải danh mục dịch vụ" />
      {state === 'error' && <div className="service-catalog-empty is-error" role="alert"><strong>Không thể tải danh mục dịch vụ</strong><span>{error}</span></div>}
      {state === 'ready' && <div className="service-catalog-body"><aside className="service-catalog-filter" aria-label="Bộ lọc dịch vụ"><div className={`service-catalog-filter-section service-catalog-filter-collapsible ${sortOpen ? 'is-open' : ''}`}><button className="service-catalog-filter-heading" type="button" aria-expanded={sortOpen} onClick={() => setSortOpen((value) => !value)}><strong>Sắp xếp</strong><ChevronIcon /></button>{sortOpen && <div className="service-catalog-filter-options"><label><input type="radio" name="catalog-sort" checked={sortMode === 'rating'} onChange={() => setSortMode('rating')} /> Đánh giá cao nhất</label><label><input type="radio" name="catalog-sort" checked={sortMode === 'newest'} onChange={() => setSortMode('newest')} /> Mới nhất</label></div>}</div><div className={`service-catalog-filter-section service-catalog-filter-collapsible ${priceOpen ? 'is-open' : ''}`}><button className="service-catalog-filter-heading" type="button" aria-expanded={priceOpen} onClick={() => setPriceOpen((value) => !value)}><strong>Giá</strong><ChevronIcon /></button>{priceOpen && <div className="service-catalog-filter-options"><label><input type="radio" name="catalog-price" checked={priceMode === 'low'} onChange={() => setPriceMode('low')} /> Từ thấp đến cao</label><label><input type="radio" name="catalog-price" checked={priceMode === 'high'} onChange={() => setPriceMode('high')} /> Từ cao đến thấp</label></div>}</div>{tags.length > 0 && <div className={`service-catalog-filter-section service-catalog-filter-collapsible ${needOpen ? 'is-open' : ''}`}><button className="service-catalog-filter-heading" type="button" aria-expanded={needOpen} onClick={() => setNeedOpen((value) => !value)}><strong>Nhu cầu</strong><ChevronIcon /></button>{needOpen && <div className="service-catalog-filter-options"><label><input type="radio" name="catalog-tag" checked={selectedTag === 'all'} onChange={() => setSelectedTag('all')} /> Tất cả</label>{tags.map((tag) => <label key={tagKey(tag)}><input type="radio" name="catalog-tag" checked={selectedTag === tagKey(tag)} onChange={() => setSelectedTag(tagKey(tag))} /> {tagName(tag)}</label>)}</div>}</div>}</aside><div className="service-catalog-results"><div className="service-catalog-results-head"><span>Danh sách dịch vụ</span><strong>{String(visibleServices.length).padStart(2, '0')} dịch vụ</strong></div>{!visibleServices.length ? <div className="service-catalog-empty" role="status"><strong>Không tìm thấy dịch vụ phù hợp</strong><span>Thử từ khóa khác hoặc chọn nhóm dịch vụ khác.</span></div> : <div className="service-catalog-grid">{visibleServices.map((service, index) => { const id = serviceId(service); const isSaved = saved.includes(id); return <article className="service-catalog-card" key={id || serviceName(service)}><span className="service-catalog-media">{service.thumbnailUrl ? <img src={service.thumbnailUrl} alt={serviceName(service)} loading="lazy" /> : <span className="service-catalog-media-fallback" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span></span>}{index === 0 && <span className="service-catalog-badge">Được chọn nhiều</span>}</span><div className="service-catalog-card-body"><span className="service-catalog-category">{categoryName(service)}</span><ServiceTitle>{serviceName(service)}</ServiceTitle><span className="service-catalog-description">{service.summary ?? service.description ?? 'Thông tin chi tiết của dịch vụ được cập nhật theo cấu hình phòng khám.'}</span><span className="service-catalog-card-meta"><span>{service.durationMinutes ? `${service.durationMinutes} phút` : 'Theo lịch trống'}</span><span>Đặt lịch tại cơ sở</span></span><span className="service-catalog-price"><small>Chi phí dự kiến</small><strong>{servicePrice(service)}</strong></span><div className="service-catalog-actions"><button className="service-catalog-choose" type="button" onClick={() => openBooking(service)}>Chọn dịch vụ <ArrowIcon /></button><button className={`service-catalog-save ${isSaved ? 'is-saved' : ''}`} type="button" aria-label={`${isSaved ? 'Bỏ lưu' : 'Lưu'} ${serviceName(service)}`} aria-pressed={isSaved} onClick={() => toggleSaved(service)}><HeartIcon filled={isSaved} /></button></div></div></article>; })}</div>}</div></div>}
      <div className="service-catalog-trust-row"><div>Thông tin dịch vụ được lấy theo cấu hình của phòng khám.</div><div>Khung giờ chỉ hiển thị sau khi chọn dịch vụ.</div><div>Có thể xem lại thông tin trước khi xác nhận.</div></div>
    </section></main>
  </div>;
}
