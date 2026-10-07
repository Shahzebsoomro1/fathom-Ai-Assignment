// Keep the clone's account journeys in the local frontend.
document.querySelectorAll('a[href]').forEach(link => {
  if (link.href.startsWith('https://fathom.video/users/sign_up')) link.href = '/signup';
  if (link.href.startsWith('https://fathom.video/users/sign_in')) link.href = '/login';
});
