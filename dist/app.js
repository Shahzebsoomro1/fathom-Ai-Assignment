const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const planetVideo = document.querySelector('.planet-decoration');
if (reduceMotion) {
  planetVideo.removeAttribute('autoplay');
  planetVideo.pause();
  planetVideo.addEventListener('loadeddata', () => { planetVideo.currentTime = .2; planetVideo.pause(); }, { once: true });
}

// Lightweight starfield: deterministic positions, no external runtime or trackers.
const canvas = document.querySelector('#starfield');
const ctx = canvas.getContext('2d');
let starWidth = 0;
let starHeight = 0;
let stars = [];
function resizeStars() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  starWidth = window.innerWidth;
  starHeight = window.innerHeight;
  canvas.width = starWidth * dpr;
  canvas.height = starHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let seed = 1947;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  stars = Array.from({ length: Math.round(starWidth * starHeight / 6600) }, () => ({ x: random() * starWidth, y: random() * starHeight, radius: .4 + random() * 1.65, opacity: .14 + random() * .65, phase: random() * 6.28, blue: random() > .35 }));
  drawStars(0);
}
function drawStars(time) {
  ctx.clearRect(0, 0, starWidth, starHeight);
  for (const star of stars) {
    const opacity = star.opacity * (reduceMotion ? 1 : .8 + .2 * Math.sin(time / 2200 + star.phase));
    ctx.fillStyle = star.blue ? `rgba(162,225,247,${opacity})` : `rgba(237,237,245,${opacity})`;
    ctx.shadowColor = star.blue ? '#6dc8e4' : '#e1e1ed';
    ctx.shadowBlur = star.radius > 1.5 ? 5 : 0;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}
resizeStars();
window.addEventListener('resize', resizeStars);
if (!reduceMotion) {
  let lastFrame = 0;
  function animateStars(time) {
    if (!document.hidden && time - lastFrame > 65) { drawStars(time); lastFrame = time; }
    window.requestAnimationFrame(animateStars);
  }
  window.requestAnimationFrame(animateStars);
}

const header = document.querySelector('.site-header');
function updateHeader() { header.classList.toggle('scrolled', window.scrollY > 30); }
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');
function closeMobileMenu() { mobileNav.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'Open navigation'); }
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  mobileNav.hidden = !open;
});
mobileNav.addEventListener('click', e => { if (e.target.closest('a')) closeMobileMenu(); });
window.addEventListener('resize', () => { if (window.innerWidth > 960) closeMobileMenu(); });
const dropdowns = [...document.querySelectorAll('.nav-dropdown')];
dropdowns.forEach(dropdown => dropdown.addEventListener('toggle', () => {
  if (dropdown.open) dropdowns.filter(other => other !== dropdown).forEach(other => { other.open = false; });
}));
document.addEventListener('click', event => { dropdowns.forEach(dropdown => { if (!dropdown.contains(event.target)) dropdown.open = false; }); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    dropdowns.forEach(dropdown => { if (dropdown.open) { dropdown.open = false; dropdown.querySelector('summary').focus(); } });
    if (!mobileNav.hidden) { closeMobileMenu(); menuToggle.focus(); }
  }
});

const track = document.querySelector('.carousel-track');
const cards = [...document.querySelectorAll('.carousel-card')];
const dots = [...document.querySelectorAll('[data-slide]')];
const carouselNames = ['Capture notes', 'AI summaries', 'AI assistants', 'Key topics'];
let currentSlide = 1;
function showSlide(index) {
  currentSlide = (index + cards.length) % cards.length;
  const cardWidth = cards[0].getBoundingClientRect().width;
  const gap = parseFloat(getComputedStyle(track).gap);
  const offset = (window.innerWidth - cardWidth) / 2 - currentSlide * (cardWidth + gap);
  track.style.transform = `translateX(${offset}px)`;
  dots.forEach((dot, i) => { if (i === currentSlide) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current'); });
  document.querySelector('#carousel-status').textContent = `Feature ${currentSlide + 1} of ${cards.length}: ${carouselNames[currentSlide]}`;
}
dots.forEach((dot, index) => dot.addEventListener('click', () => showSlide(index)));
document.querySelector('[data-carousel=previous]').addEventListener('click', () => showSlide(currentSlide - 1));
document.querySelector('[data-carousel=next]').addEventListener('click', () => showSlide(currentSlide + 1));
document.querySelector('.product-carousel').addEventListener('keydown', event => {
  if (event.key === 'ArrowRight') { event.preventDefault(); showSlide(currentSlide + 1); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); showSlide(currentSlide - 1); }
});
let touchStart = null;
track.addEventListener('touchstart', e => { touchStart = e.touches[0].clientX; }, { passive: true });
track.addEventListener('touchend', e => {
  if (touchStart === null) return;
  const delta = touchStart - e.changedTouches[0].clientX;
  if (Math.abs(delta) > 45) showSlide(currentSlide + (delta > 0 ? 1 : -1));
  touchStart = null;
}, { passive: true });
window.addEventListener('resize', () => showSlide(currentSlide));
showSlide(currentSlide);

const audienceTabs = [...document.querySelectorAll('[data-tab]')];
function selectAudience(name, focus = false) {
  audienceTabs.forEach(tab => {
    const active = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.querySelector(`#${tab.dataset.tab}-panel`).hidden = !active;
    if (active && focus) tab.focus();
  });
}
audienceTabs.forEach(tab => tab.addEventListener('click', () => selectAudience(tab.dataset.tab)));
document.querySelectorAll('[data-audience]').forEach(link => link.addEventListener('click', () => selectAudience(link.dataset.audience)));
function tabKeyboard(tabs, select) {
  tabs.forEach((tab, index) => tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); select(next, true); }
  }));
}
tabKeyboard(audienceTabs, (index, focus) => selectAudience(audienceTabs[index].dataset.tab, focus));

const workflowTabs = [...document.querySelectorAll('[data-workflow]')];
const workflows = [
  { name: 'Clarity', title: 'Unforgettable meetings…<br>quite literally.', text: 'Accurate transcripts, instant summaries, and action items, delivered straight to your inbox. Every detail captured, so you can be fully present.', image: 'clarity.avif', alt: 'Fathom summarizes the important details from your conversation' },
  { name: 'Momentum', title: 'Less admin.<br>More forward motion.', text: 'Ask Fathom about your meetings and get summaries tailored to your team’s workflow. Spend less time searching and more time doing.', image: 'momentum.avif', alt: 'Find answers and clear next steps from your meeting history' },
  { name: 'Ease', title: 'Your conversations.<br>Your workflow.', text: 'Meeting notes, insights, and action items sync with the tools you already use, so follow-through fits naturally into your day.', image: 'ease.avif', alt: 'Fathom meeting notes connect with your everyday work tools' },
];
function selectWorkflow(index, focus = false) {
  const workflow = workflows[index];
  workflowTabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; if (focus && i === index) tab.focus(); });
  document.querySelector('#workflow-heading').innerHTML = workflow.title;
  document.querySelector('#workflow-description').textContent = workflow.text;
  const preview = document.querySelector('#workflow-preview');
  preview.setAttribute('aria-label', `${workflow.name} preview`);
  preview.querySelector('img').src = `/assets/${workflow.image}`;
  preview.querySelector('img').alt = workflow.alt;
}
workflowTabs.forEach((tab, i) => tab.addEventListener('click', () => selectWorkflow(i)));
tabKeyboard(workflowTabs, selectWorkflow);
