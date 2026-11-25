import template from './template.html?raw';
import additions from './landing.css?raw';
import surfaceStyles from './landing-surfaces.css?raw';
import journeyStyles from './journey-ring.css?raw';
import journeyScript from './journey-ring.js?raw';
import footerStyles from '../../../../shared/components/portal/patient-footer.css?raw';

// Free Unsplash images used only when an API record has no image of its own.
// They depict care settings rather than purporting to be portraits of staff.
const stockCarePhotos = [
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1654931800911-7a9cfb3b7c17?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1632052999447-e542d08d4f7d?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1758691463331-2ac00e6f676f?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1758691461957-474a7686e388?auto=format&fit=crop&w=1200&q=82',
  'https://images.unsplash.com/photo-1758691462126-2ee47c8bf9e7?auto=format&fit=crop&w=1200&q=82',
] as const;

const stockPregnancyPhotos = [
  'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=82',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=82',
  'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=82',
  'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=800&q=82',
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=82',
  'https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=800&q=82',
] as const;

export interface LandingDoctor {
  id: string;
  profile?: {
    fullName?: string;
    biography?: string;
    professionalTitle?: string;
    practiceStartYear?: number;
    photoUrl?: string;
  };
  fullName?: string;
  specialties?: { name: string }[];
}
export interface LandingData {
  specialties: { slug: string; name: string; description?: string | null }[];
  services: {
    id?: string;
    slug?: string;
    name?: string;
    summary?: string;
    prices?: { amountMinor?: number; currency?: string; status?: string }[];
  }[];
  doctors: LandingDoctor[];
  errors: string[];
}
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
export function buildLandingDocument(data: LandingData) {
  const doc = new DOMParser().parseFromString(template, 'text/html');
  const style = doc.createElement('style');
  style.textContent = [additions, surfaceStyles, journeyStyles, footerStyles].join('\n');
  doc.head.append(style);
  const heroVideo = doc.querySelector<HTMLVideoElement>('#hero .vv');
  if (heroVideo) {
    // Pexels / MART PRODUCTION, video 7089369 (illustrative stock footage).
    heroVideo.innerHTML = '<source src="/videos/patient-home-pexels-7089369.mp4" type="video/mp4">';
    heroVideo.preload = 'metadata';
    heroVideo.insertAdjacentHTML('afterend', '<button class="landing-video-toggle" type="button" aria-label="Tạm dừng video" aria-pressed="false">Tạm dừng video</button>');
    const videoControls = doc.createElement('script');
    videoControls.textContent = `(function(){var v=document.querySelector('#hero .vv'),b=document.querySelector('.landing-video-toggle');if(!v||!b)return;function sync(){b.textContent=v.paused?'Phát video':'Tạm dừng video';b.setAttribute('aria-label',b.textContent);b.setAttribute('aria-pressed',String(v.paused))}v.addEventListener('play',sync);v.addEventListener('pause',sync);b.addEventListener('click',function(){if(v.paused){v.play().catch(sync)}else v.pause()});sync()})();`;
    doc.body.append(videoControls);
  }
  doc
    .querySelector('#hero')!
    .insertAdjacentHTML('afterend', '<div id="patient-summary"></div>');
  const statistics = doc.querySelector('#hero .vs');
  if (statistics) doc.querySelector('#about')!.after(statistics);
  doc.querySelector('#spec .p')!.textContent =
    'Khám phá các chuyên khoa và tìm hiểu dịch vụ chăm sóc phù hợp với bạn.';
  doc.querySelector('#bs')?.removeAttribute('data-theme-s');
  const gallery = doc.querySelector('#ag')!;
  const cards = Array.from(gallery.children, (element) => element.outerHTML);
  gallery.innerHTML =
    data.specialties
      .map((s, i) => {
        const temp = doc.createElement('div');
        temp.innerHTML = cards[i % cards.length];
        temp.querySelector('h3')!.textContent = s.name;
        temp.querySelector('small')!.textContent =
          s.description || 'Tìm hiểu chuyên khoa';
        temp.querySelector('.ag-n')!.textContent = String(i + 1).padStart(
          2,
          '0',
        );
        const media = temp.querySelector<HTMLElement>('.ag-m')!;
        media.style.backgroundImage = `url("${stockCarePhotos[i % stockCarePhotos.length]}")`;
        media.style.backgroundPosition = 'center';
        media.style.backgroundSize = 'cover';
        media.style.background = `url("${stockCarePhotos[i % stockCarePhotos.length]}") center / cover no-repeat`;
        temp.firstElementChild!.setAttribute('aria-label', s.name);
        temp
          .querySelector('.ag-t')!
          .insertAdjacentHTML(
            'beforeend',
            `<a class="live-link" href="/chuyen-khoa/${encodeURIComponent(s.slug)}">Xem chuyên khoa →</a>`,
          );
        return temp.innerHTML;
      })
      .join('') ||
    '<p>Chưa tải được danh sách chuyên khoa. <a href="/bac-si">Xem danh bạ</a></p>';
  if (!data.specialties.length) gallery.classList.add('landing-empty');
  doc.querySelector('#dv .gr3')!.innerHTML =
    data.services
      .slice(0, 6)
      .map((s, index) => {
        const price =
          s.prices?.find((p) => p.status === 'ACTIVE') ??
          s.prices?.find((p) => !p.status);
        const label =
          price?.amountMinor != null
            ? new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: price.currency || 'VND',
              }).format(price.amountMinor)
            : 'Liên hệ để biết giá';
        const title = (s.name || '').toLocaleLowerCase('vi');
        const photo = /sơ sinh|sinh con|sinh mổ|trẻ/.test(title) ? '/images/pregnancy-7055910.jpg'
          : /siêu âm|khám|xét nghiệm/.test(title) ? '/images/pregnancy-7089337.jpg'
          : '/images/pregnancy-7055918.jpg';
        return `<article class="cd rv service-photo-card" style="--service-photo:url('${photo}')">
          <span class="service-card-photo" aria-hidden="true"></span>
          <div class="service-card-content">
            <span class="service-card-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
            <h3>${esc(s.name)}</h3>
            <div class="service-card-reveal"><div class="service-card-details">
              <p>${esc(s.summary)}</p><b class="pr">${esc(label)}</b>
              <a class="live-link" href="/dich-vu/${encodeURIComponent(s.slug || s.id || '')}">Xem dịch vụ →</a>
            </div></div>
          </div>
        </article>`;
      })
      .join('') ||
    '<p>Chưa tải được dịch vụ. <a href="/dich-vu">Mở danh mục dịch vụ</a></p>';
  doc
    .querySelector('#dv')!
    .insertAdjacentHTML(
      'beforeend',
      '<a class="live-link" href="/dich-vu">Xem tất cả dịch vụ →</a>',
    );
  doc
    .querySelector('#bs')!
    .insertAdjacentHTML(
      'beforeend',
      '<a class="live-link" href="/bac-si">Xem danh sách bác sĩ →</a>',
    );
  const fallbackDoctors = doc.createElement('div');
  fallbackDoctors.className = 'landing-doctor-fallback';
  fallbackDoctors.innerHTML = data.doctors
    .map(
      (d) =>
        `<article><h3>${esc(d.profile?.fullName || d.fullName || 'Bác sĩ')}</h3><p>${esc(d.specialties?.map((s) => s.name).join(', '))}</p><a href="/dat-lich">Đặt lịch khám →</a></article>`,
    )
    .join('');
  doc.querySelector('#row')!.after(fallbackDoctors);
  doc
    .querySelector('#ts .p')!
    .insertAdjacentHTML(
      'afterend',
      '<p class="landing-note"><a href="/cam-nang-thai-ky">Mở cẩm nang thai kỳ →</a></p>',
    );
  doc.querySelector('#cylCta')!.setAttribute('href', '/dat-lich');
  doc.querySelectorAll<HTMLElement>('.journey-entries article').forEach((entry, index) => {
    entry.dataset.photo = stockPregnancyPhotos[index];
  });
  // Replace About section SVG illustrations with real photos.
  const aboutMain = doc.querySelector('#about .am')!;
  aboutMain.innerHTML = `<img src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80" alt="Quầy lễ tân phòng khám Tâm An" style="width:100%;height:100%;object-fit:cover;display:block">`;
  const aboutSub = doc.querySelector('#about .as')!;
  aboutSub.innerHTML = `<img src="https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=600&q=80" alt="Khu chờ phòng khám" style="width:100%;height:100%;object-fit:cover;display:block">`;
  doc.querySelector('#vas')!.setAttribute('href', '/dat-lich');
  doc.querySelector('#vas')!.lastChild!.textContent = 'Đặt lịch khám';
  doc.querySelector('#fb .p')!.textContent =
    'Các lời chia sẻ dưới đây là nội dung minh họa của thiết kế.';
  if (data.errors.length)
    doc
      .querySelector('#about')!
      .insertAdjacentHTML(
        'beforebegin',
        `<div class="landing-note" role="status">Không tải được: ${esc(data.errors.join(', '))}. <button id="retry-public" type="button">Thử lại</button></div>`,
      );
  // Only adapt data and routing. The supplied animation algorithms and timings remain intact.
  for (const script of Array.from(doc.querySelectorAll('script:not([src])'))) {
    let code = script.textContent || '';
    code = code.replace(
      "var t=q(a.getAttribute('href'));",
      "var h=a.getAttribute('href');if(!h||h==='#')return;var t=q(h);",
    );
    code = code.replace(
      'act=2,mq=',
      `act=${Math.min(2, Math.max(0, data.specialties.length - 1))},mq=`,
    );
    code = code.replace(' acc();', data.specialties.length ? ' acc();' : '');
    code = code.replace(
      '!window.SplitText)',
      '!window.SplitText||!window.DrawSVGPlugin)',
    );
    code = code.replace(
      '{show();return}',
      "{H.setAttribute('data-animation-fallback','');show();return}",
    );
    code = code.replace(
      'function row(){',
      "function row(){document.querySelector('.landing-doctor-fallback').hidden=true;",
    );
    code = code.replace(
      /Dn=\[\[.*?\]\],N=6,G=12/,
      () =>
        `Dn=${json(data.doctors.map((d) => [d.profile?.fullName || d.fullName || 'Bác sĩ', d.specialties?.map((s) => s.name).join(', ') || '']))},N=${data.doctors.length},G=12`,
    );
    code = code.replace(
      /var DI=\[.*?\];/s,
      () =>
        `var DI=${json(data.doctors.map((d) => ({ y: d.profile?.practiceStartYear ? Math.max(0, new Date().getFullYear() - d.profile.practiceStartYear) : '', e: d.profile?.professionalTitle || '', b: d.profile?.biography || 'Thông tin đang được cập nhật.', s: d.specialties?.map((s) => esc(s.name)) || [], t: 'Xem khung giờ còn trống tại trang đặt lịch.' })))};`,
    );
    code = code.replace("d.y+'+'", "d.y===''?'—':d.y+'+'");
    // Preserve carousel transforms; use the profile image first, then a clearly
    // decorative care-scene fallback when a record has no photo.
    code = code.replace(
      'el.insertBefore(c,el.firstChild);return c',
      () =>
        `var photo=${json(data.doctors.map((d) => d.profile?.photoUrl || ''))}[i],isProfile=!!photo;if(!photo)photo=${json(stockCarePhotos)}[i%${stockCarePhotos.length}];if(photo&&/^(https?:\\/\\/|\\/(?!\\/))/.test(photo)){var img=document.createElement('img');img.draggable=false;img.src=photo;img.alt=isProfile?d[0]:'Ảnh minh họa chăm sóc y tế';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=function(){img.remove()};c.appendChild(img)}el.insertBefore(c,el.firstChild);return c`,
    );
    code = code.replace(
      'href="#lienhe">Liên hệ tư vấn</a></div>',
      'href="/dat-lich">Đặt lịch khám</a></div>',
    );
    code = code.replace(
      /wr\.querySelector\('\.dbk'\)\.addEventListener\('click',function\(e\)\{.*?\}\);/,
      "wr.querySelector('.dbk').addEventListener('click',function(){op=-1});",
    );
    code = code.replace(
      "p.addEventListener('click',function(){if(act",
      "p.addEventListener('click',function(e){if(e.target.closest('a'))return;if(act",
    );
    if (data.specialties.length === 1)
      code = code.replace('gr=(r*(n-1))/(1-r)', 'gr=1');
    code = code
      .replaceAll('P[i][', 'P[i%P.length][')
      .replaceAll("+' / 06'", "+' / '+String(N).padStart(2,'0')");
    if (!data.doctors.length) code = code.replace(' row();', '');
    script.textContent = code;
  }
  if (!data.doctors.length) {
    doc.querySelector('#row')!.innerHTML =
      '<p>Chưa có dữ liệu bác sĩ để hiển thị.</p>';
    doc.querySelector('#row')!.classList.add('landing-empty');
  }
  const journey = doc.createElement('script');
  journey.textContent = journeyScript;
  doc.body.append(journey);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
