# Patient homepage integration

`PortalLandingPage.tsx` serves `/`. `template.html` is an exact copy of the supplied
Tâm An HTML (SHA-256 `94992a838b535b76407fbc9a3febaba765171e656d2130dc6a4d26b6e67cb8a9`).
Keep this source unchanged so animation changes can be reviewed against the design.

`document.ts` injects live public catalog data and existing application routes.
The document runs in a same-origin `srcDoc` iframe to preserve the original
viewport, CSS, GSAP/ScrollTrigger/SplitText/DrawSVG and Lenis lifecycle. Leaving
the homepage destroys that animation context. React portals mount account
controls, the existing notification bell and `PatientSummary` inside the frame;
they retain the application's auth context. Auth state changes do not rebuild
the frame. The existing chatbot stays in the parent document.

The adapter changes data, counts and destinations, not animation timings or
easing. `landing.css` adds integration styles. Existing CDN versions and Google
Fonts are retained; when animation libraries cannot load, static doctor cards
and readable specialty links remain available.

Public reads: `/api/doctors/specialties` (fallback `/specialties`),
`/api/catalog/services?limit=100`, `/api/doctors`. Private patient reads retain
`/api/patients/me`, `/api/medical-records/pregnancy-episodes?patientId=...` and
`/api/appointment/appointments?limit=50`. Requests have a 12-second deadline and
are aborted on unmount. No new backend contracts or patient writes are added.

The pregnancy explorer remains a manual illustration; actual gestational age
comes from the signed-in patient's active episode. Testimonials, introductory
figures and contact details are marked as design/demo content. Unavailable
policy pages are not represented by working links.

Tests cover generated script syntax, variable catalog counts, escaped API text,
original CSS/video/timing preservation, account/routing integration, partial
API failure and patient summaries. jsdom does not render the GSAP animations;
visual desktop/mobile verification still requires a browser. Live appointment
and notification E2E additionally require the backend services.
