(() => {
  const root = document.querySelector('#cyl');
  const stage = root.querySelector('.journey-stage');
  const scene = root.querySelector('.journey-scene');
  const layout = root.querySelector('.journey-layout');
  const slot = root.querySelector('.journey-photo-slot');
  const marker = root.querySelector('.journey-marker');
  const caption = root.querySelector('.journey-caption');
  const back = root.querySelector('.journey-back');
  const thumbs = root.querySelector('.journey-thumbs');
  const copy = root.querySelector('.journey-copy');
  const booking = document.querySelector('#cylCta');
  const entries = Array.from(root.querySelectorAll('.journey-entries article'));
  const count = entries.length;
  const slices = 12;
  const step = 2 * Math.PI / count;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? { matches: true };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const wrap = value => ((value % count) + count) % count;
  const number = index => String(index + 1).padStart(2, '0');
  const mix = (from, to, t) => from + (to - from) * t;
  const ease = t => t * t * (3 - 2 * t);
  const make = (tag, name, parent) => {
    const el = document.createElement(tag);
    el.className = name;
    parent.append(el);
    return el;
  };

  // Narrow strips share one source photo. Their tangent planes form a curved print
  // on the ring, and become coplanar as the selected print opens.
  scene.style.setProperty('--slices', slices);
  const prints = entries.map((entry, index) => {
    const title = entry.querySelector('h3').textContent;
    const photo = entry.dataset.photo;
    const print = make('div', 'journey-print', scene);
    print.dataset.index = index;
    const rail = make('i', 'journey-rail', print);
    const label = make('span', 'journey-no', print);
    label.textContent = number(index);
    const panels = Array.from({ length: slices }, (_, part) => {
      const panel = make('div', 'journey-strip', print);
      const img = make('img', '', panel);
      img.loading = 'lazy';
      img.alt = '';
      img.draggable = false;
      img.src = photo;
      img.style.left = `calc(-1 * var(--photo-width) * ${part / slices})`;
      return panel;
    });
    const thumb = make('button', '', thumbs);
    thumb.type = 'button';
    thumb.setAttribute('aria-label', entry.querySelector('small').textContent + ' · ' + title);
    thumb.style.setProperty('--index', index);
    const image = make('img', '', thumb);
    image.src = photo;
    image.alt = '';
    image.loading = 'lazy';
    thumb.addEventListener('click', () => open(index));
    return { print, panels, label, rail, thumb, title, week: entry.querySelector('small').textContent };
  });

  let width, height, radius, photoWidth, photoHeight, slotX, slotY, slotScale;
  let target = 0, position = 0, velocity = 0, targetPitch = -.27, pitch = -.27;
  let sway = 0, swayVelocity = 0, flare = 0;
  let selected = null, featured = 0, progress = 0, currentCaption = -1;
  let drag = null, wheelTimer, closeTimer, frame = 0, lastTime = 0, visible = true;

  function measure() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    if (!width || !height) return;
    photoWidth = Math.min(clamp(width * .265, 148, 360), width * .53);
    photoHeight = photoWidth * 1.16;
    radius = photoWidth / (step * .66);
    // Use layout coordinates, independent of scroll or the page entrance transforms.
    slotX = slot.offsetLeft + slot.offsetWidth / 2 - width / 2;
    slotY = slot.offsetTop + slot.offsetHeight / 2 - height / 2;
    slotScale = Math.min(slot.offsetWidth / photoWidth, slot.offsetHeight / photoHeight);
    scene.style.setProperty('--photo-width', photoWidth + 'px');
    scene.style.setProperty('--photo-height', photoHeight + 'px');
    scene.style.setProperty('--perspective', Math.max(width * 1.1, 700) + 'px');
    schedule();
  }

  function setCaption(index) {
    if (currentCaption === index) return;
    currentCaption = index;
    const { week, title } = prints[index];
    caption.querySelector('small').textContent = number(index) + ' / ' + number(count - 1) + '　·　' + week;
    const heading = document.createElement('strong');
    heading.textContent = title;
    caption.querySelector('strong').replaceWith(heading);
    booking.textContent = 'Đặt lịch khám mốc ' + week.toLocaleLowerCase('vi');
  }

  function nearest(index) {
    return target + wrap(index - target + count / 2) - count / 2;
  }

  function open(index) {
    const entering = selected === null;
    selected = featured = index;
    target = nearest(index);
    if (!entering) position = target;
    clearTimeout(wheelTimer);
    clearTimeout(closeTimer);
    root.classList.remove('is-closing');
    velocity = 0;
    targetPitch = 0;
    root.style.setProperty('--intro', entering ? '430ms' : '0ms');
    root.classList.add('is-open');
    layout.inert = false;
    caption.setAttribute('aria-expanded', 'true');
    const fields = Array.from(entries[index].children, node => node.cloneNode(true));
    fields[0].textContent = number(index) + ' / ' + number(count - 1) + '　·　' + prints[index].week;
    const prompt = document.createElement('b');
    prompt.textContent = 'Gợi ý hỏi bác sĩ';
    fields.at(-1).prepend(prompt);
    fields.forEach((field, line) => field.style.setProperty('--line', line));
    copy.replaceChildren(...fields);
    prints.forEach(({ thumb }, i) => thumb.setAttribute('aria-pressed', String(i === index)));
    setCaption(index);
    measure();
    if (entering) back.focus({ preventScroll: true });
  }

  function close() {
    if (selected === null) return;
    selected = null;
    root.classList.remove('is-open');
    if (!reduce.matches) {
      root.classList.add('is-closing');
      closeTimer = setTimeout(() => { root.classList.remove('is-closing'); measure(); }, 240);
    }
    layout.inert = true;
    caption.setAttribute('aria-expanded', 'false');
    stage.focus({ preventScroll: true });
    measure();
  }

  function turn(direction) {
    target = Math.round(target) + direction;
    schedule();
  }

  function paint() {
    if (!width) return;
    const flatten = ease(progress);
    const active = selected ?? wrap(Math.round(position));
    const cameraPitch = pitch * (1 - flatten);
    const tiltScale = 1 / (1 + .48 * Math.abs(Math.sin(cameraPitch)));
    const cameraY = radius * Math.sin(cameraPitch);
    const cameraZ = -radius * Math.cos(cameraPitch);
    marker.style.top = (height / 2 - (photoHeight / 2 + 9) * Math.cos(cameraPitch) * tiltScale) + 'px';
    marker.style.opacity = String(1 - Math.min(1, progress * 4));

    prints.forEach((item, i) => {
      const { print, label, rail, panels } = item;
      const angle = (wrap(i - position + count / 2) - count / 2) * step;
      const chosen = i === featured;
      const unfold = chosen ? flatten : 0;
      const distance = Math.min(wrap(i - featured), wrap(featured - i));
      const roll = chosen ? 0 : ease(clamp((progress - distance * .038) / .78, 0, 1));
      print.style.visibility = roll >= .999 ? 'hidden' : 'visible';
      if (roll >= .999) return;
      const depth = radius * Math.cos(angle);
      print.style.pointerEvents = selected === null && Math.cos(angle) > .15 ? 'auto' : 'none';
      const x = mix(radius * Math.sin(angle) * tiltScale, slotX, unfold);
      const y = mix((cameraY - depth * Math.sin(cameraPitch)) * tiltScale, slotY, unfold);
      const z = mix((cameraZ + depth * Math.cos(cameraPitch)) * tiltScale, 0, unfold);
      const scale = mix(tiltScale, slotScale, unfold);
      const bend = (1 - unfold) / radius;
      print.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateX(${cameraPitch}rad) rotateY(${angle * (1 - unfold)}rad) scale3d(${scale},${scale},${scale}) translateY(${-photoHeight / 2}px) skewX(${sway * (1 - flatten)}rad) rotateX(${flare * (1 - flatten)}rad)`;
      print.style.setProperty('--roll', (roll * 100) + '%');
      print.style.setProperty('--wash', String((1 - Math.cos(angle)) * .28 * (1 - unfold)));
      const edge = -photoWidth / 2;
      const curveX = x => bend < .000001 ? x : Math.sin(bend * x) / bend;
      const curveZ = x => bend < .000001 ? 0 : -2 * Math.sin(bend * x / 2) ** 2 / bend;
      if (item.bend !== bend || item.width !== photoWidth) {
        item.bend = bend;
        item.width = photoWidth;
        for (let j = 0; j < slices; j++) {
          const u = edge + j * photoWidth / slices;
          panels[j].style.transform = `translate3d(${curveX(u)}px,0,${curveZ(u)}px) rotateY(${bend * (u + photoWidth / slices / 2)}rad)`;
        }
      }
      const edgeTransform = `translate3d(${curveX(edge)}px,0,${curveZ(edge)}px)`;
      label.style.transform = edgeTransform + ` rotateY(${-angle * (1 - unfold)}rad)`;
      rail.style.transform = edgeTransform;
      rail.style.opacity = label.style.opacity = String((1 - roll) * (1 - flatten));
    });
    setCaption(active);
  }

  function animate(time) {
    frame = 0;
    const elapsed = (time - (lastTime || time - 16)) / 1000;
    const dt = clamp(elapsed, .001, .032);
    lastTime = time;
    const end = selected === null ? 0 : 1;
    const reduced = reduce.matches;
    // A critically damped turn, with a separate underdamped spring at the hem.
    const frequency = drag?.moved ? 19 : 10;
    const acceleration = frequency ** 2 * (target - position) - 2 * frequency * velocity;
    velocity += acceleration * dt;
    position += velocity * dt;
    swayVelocity += (clamp(acceleration * .07, -18, 18) - 48 * sway - 5 * swayVelocity) * dt;
    sway = clamp(sway + swayVelocity * dt, -.28, .28);
    flare = mix(flare, clamp(velocity ** 2 * .015, 0, .18), 1 - Math.exp(-7 * dt));
    pitch = mix(pitch, targetPitch, 1 - Math.exp(-7 * dt));
    progress += clamp(end - progress, -elapsed / 1.45, elapsed / 1.25);
    const settled = Math.abs(target - position) + Math.abs(velocity) + Math.abs(pitch - targetPitch)
      + Math.abs(sway) + Math.abs(swayVelocity) + flare < .002 && progress === end;
    if (settled || reduced) {
      position = target; pitch = targetPitch; progress = end;
      velocity = sway = swayVelocity = flare = 0;
    }
    paint();
    if (!settled && !reduced) schedule();
    else lastTime = 0;
  }

  function schedule() {
    if (!frame && visible) frame = requestAnimationFrame(animate);
  }

  function hit(x, y) {
    // Test the projected photo strips, including when the pointer falls on a seam.
    // A CSS 3D ancestor can itself be reported as the target by the browser.
    const candidates = prints.map((item, index) => ({ item, index, facing: Math.cos((index - position) * step) }))
      .filter(({ facing }) => facing > .15)
      .sort((a, b) => b.facing - a.facing);
    for (const { item, index } of candidates) {
      if (item.panels.some(panel => {
        const rect = panel.getBoundingClientRect();
        return x >= rect.left - .5 && x <= rect.right + .5 && y >= rect.top && y <= rect.bottom;
      })) return index;
    }
    return null;
  }

  scene.addEventListener('pointerdown', event => {
    if (selected !== null || event.button !== 0 || !event.isPrimary) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: target,
      tilt: targetPitch, index: hit(event.clientX, event.clientY), moved: false,
      lastX: event.clientX, time: event.timeStamp, speed: 0 };
    clearTimeout(wheelTimer);
    scene.setPointerCapture(event.pointerId);
    stage.focus({ preventScroll: true });
  });
  scene.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    stage.classList.add('is-dragging');
    const travel = radius * step;
    target = drag.start - dx / travel;
    targetPitch = clamp(drag.tilt - dy * .0049, -1.36, 1.46);
    drag.speed = (drag.lastX - event.clientX) / travel * 1000 / Math.max(8, event.timeStamp - drag.time);
    drag.lastX = event.clientX;
    drag.time = event.timeStamp;
    schedule();
  });
  function release(event) {
    if (drag?.id !== event.pointerId) return;
    const gesture = drag;
    drag = null;
    stage.classList.remove('is-dragging');
    const cancelled = event.type !== 'pointerup';
    if (!cancelled && !gesture.moved && gesture.index !== null) open(gesture.index);
    else {
      const speed = cancelled || event.timeStamp - gesture.time > 100 ? 0 : gesture.speed;
      target = Math.round(target + clamp(speed * .25, -2, 2));
      schedule();
    }
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => scene.addEventListener(type, release));

  stage.addEventListener('wheel', event => {
    if (event.ctrlKey || event.target.closest('.journey-detail, .journey-thumbs')) return;
    event.preventDefault();
    event.stopPropagation();
    if (selected !== null) { close(); return; }
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    target += delta * unit / (radius * step);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { target = Math.round(target); schedule(); }, 150);
    schedule();
  }, { passive: false });

  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected !== null) { event.preventDefault(); close(); return; }
    if (event.target !== stage) return;
    switch (event.key) {
      case 'ArrowLeft': turn(-1); break;
      case 'ArrowRight': turn(1); break;
      case 'ArrowUp': targetPitch = clamp(targetPitch - .21, -1.36, 1.46); break;
      case 'ArrowDown': targetPitch = clamp(targetPitch + .21, -1.36, 1.46); break;
      case 'Home': targetPitch = 0; break;
      case 'Enter': case ' ': open(wrap(Math.round(position))); break;
      default: return;
    }
    event.preventDefault();
    schedule();
  });
  back.addEventListener('click', () => close());
  caption.addEventListener('click', () => open(wrap(Math.round(position))));
  root.querySelector('.journey-prev').addEventListener('click', () => turn(-1));
  root.querySelector('.journey-next').addEventListener('click', () => turn(1));
  if (window.ResizeObserver) new ResizeObserver(measure).observe(stage);
  else window.addEventListener('resize', measure);
  if (window.IntersectionObserver) new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  }).observe(root);
  reduce.addEventListener?.('change', schedule);
  measure();
  setCaption(0);
})();
