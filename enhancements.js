/* Budgtree product enhancements: landing, recovery UI, contextual tutorials and Learn hub. */
(() => {
  const $ = (id) => document.getElementById(id);

  const landing = $('landingView');

  const auth = $('authView');

  const app = $('appView');

  const pageNames = {
    dashboard: 'Dashboard', transactions: 'Transactions', budget: 'Budget planner',
    savings: 'Savings goals', allowance: 'Allowance tracker', calendar: 'Financial calendar',
    reports: 'Reports & insights'
  };

  $('landingYear').textContent = new Date().getFullYear();

  // Local demo mode has no email delivery provider; hide the unavailable email-reset action.
  if (!$('sendPasswordResetEmail') || !window.Budgtree_CONFIG?.SUPABASE_URL || !window.Budgtree_CONFIG?.SUPABASE_ANON_KEY) {
    $('sendPasswordResetEmail')?.classList.add('hidden');

  }

  window.showLanding = function () {
    if (typeof window.setBudgtreeView === 'function') window.setBudgtreeView('landingView');

    else {
      landing?.classList.remove('hidden');
if (landing) landing.style.display = '';

      auth?.classList.add('hidden');
if (auth) auth.style.display = 'none';

      app?.classList.add('hidden');
if (app) app.style.display = 'none';

    }
    window.scrollTo({ top: 0, behavior: 'instant' });

  };

  const originalShowAuth = window.showAuth;

  window.showAuth = function (tab = 'login') {
    if (typeof window.setBudgtreeView === 'function') window.setBudgtreeView('authView');

    else { landing?.classList.add('hidden');
if (landing) landing.style.display = 'none';
app?.classList.add('hidden');
if (app) app.style.display = 'none';
auth?.classList.remove('hidden');
if (auth) auth.style.display = '';
}
    $('forgotPanel')?.classList.add('hidden');

    $('loginForm')?.classList.toggle('hidden', tab !== 'login');

    $('registerForm')?.classList.toggle('hidden', tab !== 'register');

    document.querySelectorAll('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b.dataset.authTab === tab));

    try { sessionStorage.setItem('Budgtree_auth_tab', tab);
} catch (_) {}
    if (typeof originalShowAuth === 'function') originalShowAuth(tab);

    landing?.classList.add('hidden');

    app?.classList.add('hidden');

    auth?.classList.remove('hidden');

    $('forgotPanel')?.classList.add('hidden');

    $('loginForm')?.classList.toggle('hidden', tab !== 'login');

    $('registerForm')?.classList.toggle('hidden', tab !== 'register');

    document.querySelectorAll('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b.dataset.authTab === tab));

  };

  const originalShowApp = window.showApp;

  if (typeof originalShowApp === 'function') {
    window.showApp = async function (...args) {
      if (typeof window.setBudgtreeView === 'function') window.setBudgtreeView('appView');

      else { landing?.classList.add('hidden');
if (landing) landing.style.display = 'none';
auth?.classList.add('hidden');
if (auth) auth.style.display = 'none';
app?.classList.remove('hidden');
if (app) app.style.display = '';
}
      return originalShowApp.apply(this, args);

    };

  }

  // Use the recovery dialog already present in index.html. The former code referenced
  // removed forgotPanel/recoveryEmail/forgotForm elements and caused runtime errors.
  if ($('forgotPassword')) $('forgotPassword').onclick = (event) => {
    event.preventDefault();

    const loginValue = $('loginEmail')?.value.trim() || '';

    $('recoveryIdentifier').value = loginValue;

    $('recoveryOldPassword').value = '';

    $('recoveryNewPassword').value = '';

    $('recoveryConfirmPassword').value = '';

    $('recoveryPasswordError').textContent = '';

    if ($('passwordRecoveryDialog') && !$('passwordRecoveryDialog').open) {
      $('passwordRecoveryDialog').showModal();

    }
  };

  document.addEventListener('click', (event) => {
    const authButton = event.target.closest('[data-open-auth]');

    if (authButton) {
      event.preventDefault();

      window.showAuth(authButton.dataset.openAuth || 'login');

    }
  });

  // Supabase password recovery callback: show a dedicated new-password dialog.
  const openPasswordReset = () => {
    const dialog = $('passwordRecoveryDialog');

    if (dialog && !dialog.open) dialog.showModal();

  };

  // Hosted recovery is intentionally not initialized in local demo mode.

  // Page-specific tutorials: each tutorial sits at the bottom of its relevant existing page.
  const tutorialData = {
    dashboard: ['Your Budgtree dashboard', 'Understand your balance, income, expenses, spending analysis, and recent activity.', 'tutorial-dashboard.mp4'],
    transactions: ['Recording transactions', 'Learn how to add, edit, filter, and review allowance and expense records.', 'tutorial-transactions.mp4'],
    budget: ['Planning your budget', 'Set category limits, compare your spending, and recognize when a budget is close to its limit.', 'tutorial-budget-planner.mp4'],
    savings: ['Setting savings goals', 'Create a goal, set a target, and record deposits to follow your progress.', 'tutorial-savings-goals.mp4'],
    allowance: ['Using the allowance tracker', 'Set your allowance amount and schedule to understand your estimated spending pace.', 'tutorial-allowance-tracker.mp4'],
    calendar: ['Using the financial calendar', 'Choose a date, record money activity, and keep useful notes for upcoming plans.', 'tutorial-financial-calendar.mp4'],
    reports: ['Understanding reports and insights', 'Read your income, expenses, cash flow, and category breakdowns.', 'tutorial-reports.mp4']
  };

  Object.entries(tutorialData).forEach(([page, item]) => {
    const host = $(`page-${page}`);

    if (!host || host.querySelector('.page-tutorial')) return;

    const section = document.createElement('section');

    section.className = 'page-tutorial';

    section.innerHTML = `
      <div class="tutorial-heading"><div><span class="eyebrow">PAGE WALKTHROUGH</span><h2>How to use ${pageNames[page]}</h2><p>${item[1]}</p></div><span class="tutorial-badge">VIDEO GUIDE</span></div>
      <div class="tutorial-content"><div class="tutorial-video-wrap"><video controls preload="metadata" playsinline aria-label="${item[0]}"><source src="media/${item[2]}" type="video/mp4">Your browser does not support video playback.</video><div class="video-empty"><span>▶</span><b>Tutorial video coming soon</b><small>Your Budgtree team can add its recorded walkthrough as <code>${item[2]}</code> inside the media folder.</small></div></div><div class="tutorial-side"><span class="eyebrow">QUICK GUIDE</span><h3>${item[0]}</h3><p>${item[1]}</p><ul><li>Follow the steps shown in the video.</li><li>Pause and replay any section when needed.</li><li>Use the page's actual controls to practice.</li></ul><details><summary>Read the tutorial overview</summary><p>${item[1]} The tutorial recording should demonstrate the current Budgtree interface and avoid showing real student personal or financial information.</p></details></div></div>`;

    host.appendChild(section);

    const video = section.querySelector('video');

    video.addEventListener('loadeddata', () => section.classList.add('has-video'));

    video.addEventListener('error', () => section.classList.remove('has-video'));

  });

  // Learn hub filtering and downloadable original starter guide.
  document.querySelectorAll('[data-learn-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-learn-tab]').forEach((b) => b.classList.toggle('active', b === button));

      const filter = button.dataset.learnTab;

      document.querySelectorAll('.learn-resource').forEach((card) => {
        card.classList.toggle('hidden', filter !== 'all' && card.dataset.resourceType !== filter);

      });

    });

  });

  document.querySelectorAll('.download-guide').forEach((button) => button.addEventListener('click', () => {
    const guide = `BUDGTREE | STUDENT BUDGETING STARTER GUIDE\n\n1. KNOW YOUR MONEY\nList the allowance or other money you receive and how often you receive it.\n\n2. PLAN YOUR NEEDS FIRST\nWrite down essential school, transportation, food, and personal expenses before planning optional spending.\n\n3. SET REALISTIC LIMITS\nChoose spending limits that fit your actual allowance. Review them regularly and adjust when needed.\n\n4. SAVE WITH A CLEAR GOAL\nChoose something meaningful, set a target amount, and divide it into smaller achievable steps.\n\n5. TRACK AND REVIEW\nRecord spending honestly. At the end of each week, look for patterns and decide what you want to improve.\n\n6. NEEDS AND WANTS\nPause before optional purchases. Ask whether the item is necessary now and whether it fits your plan.\n\nThis original educational guide is general learning material, not individualized financial advice. Budgtree is a record-keeping and learning platform; it does not process payments or move real money.\n`;

    const blob = new Blob([guide], { type: 'text/plain;charset=utf-8' });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
link.href = url;
link.download = 'Budgtree-Student-Budgeting-Starter-Guide.txt';
link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

  }));

  // Improve navigation labels and ensure Learn works with the existing page router.
  const oldNavigate = window.navigate;

  if (typeof oldNavigate === 'function') {
    window.navigate = function (page) {
      oldNavigate(page);

      if (page === 'learn') {
        document.querySelectorAll('.nav-link').forEach((b) => b.classList.toggle('active', b.dataset.page === 'learn'));

        $('crumbName').textContent = 'Learn';

      }
    };

  }

  // Keep the landing screen as the first view for signed-out visitors.
  if (auth && !auth.classList.contains('hidden') && app?.classList.contains('hidden')) window.showLanding();

})();
