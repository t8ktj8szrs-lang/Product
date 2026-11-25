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

  window.showLanding = function () {
    landing?.classList.remove('hidden');
    auth?.classList.add('hidden');
    app?.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const originalShowAuth = window.showAuth;
  window.showAuth = function (tab = 'login') {
    landing?.classList.add('hidden');
    app?.classList.add('hidden');
    auth?.classList.remove('hidden');
    $('forgotPanel')?.classList.add('hidden');
    $('loginForm')?.classList.toggle('hidden', tab !== 'login');
    $('registerForm')?.classList.toggle('hidden', tab !== 'register');
    document.querySelectorAll('[data-auth-tab]').forEach((b) => b.classList.toggle('active', b.dataset.authTab === tab));
    try { sessionStorage.setItem('Budgtree_auth_tab', tab); } catch (_) {}
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
      landing?.classList.add('hidden');
      auth?.classList.add('hidden');
      app?.classList.remove('hidden');
      return originalShowApp.apply(this, args);
    };
  }

  // Dedicated recovery flow: verified email first, one-time server-verified backup code second.
  const openForgotPanel = () => {
    $('loginForm')?.classList.add('hidden');
    $('registerForm')?.classList.add('hidden');
    $('forgotPanel')?.classList.remove('hidden');
    const email = $('loginEmail')?.value.trim() || '';
    if (email.includes('@')) {
      $('recoveryEmail').value = email;
    }
  };
  if ($('forgotPassword')) {
    // Remove the legacy prompt-based onclick handler installed by app.js.
    $('forgotPassword').onclick = null;
    $('forgotPassword').addEventListener('click', (event) => {
      event.preventDefault();
      openForgotPanel();
    });
  }
  $('backToLogin')?.addEventListener('click', () => window.showAuth('login'));
  document.addEventListener('click', (event) => {
    const authButton = event.target.closest('[data-open-auth]');
    if (authButton) {
      event.preventDefault();
      window.showAuth(authButton.dataset.openAuth || 'login');
    }
  });

  const validEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const getAuthClient = () => window.BudgtreeAuthClient || null;
  $('forgotForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('recoveryEmail').value.trim().toLowerCase();
    $('forgotError').textContent = '';
    $('forgotSuccess').textContent = '';
    if (!validEmail(email)) {
      $('forgotError').textContent = 'Enter a valid email address.';
      $('recoveryEmail').focus();
      return;
    }
    const submit = $('forgotForm').querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Sending secure link…';
    try {
      const client = getAuthClient();
      if (!client) throw new Error('Online password recovery is unavailable in demo mode. Configure the Budgtree Supabase project to enable secure recovery.');
      const redirectTo = `${location.origin}${location.pathname}?reset=1`;
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      $('forgotSuccess').textContent = 'If an account matches this email, a secure reset link will be sent. Check your inbox and spam folder.';
      $('forgotForm').reset();
    } catch (error) {
      $('forgotError').textContent = error.message || 'We could not send the reset link. Please try again later.';
    } finally {
      submit.disabled = false;
      submit.innerHTML = 'Send reset link <span>→</span>';
    }
  });

  // A recovery link must establish a PASSWORD_RECOVERY session before updateUser can succeed.
  const openPasswordReset = () => {
    const dialog = $('passwordRecoveryDialog');
    if (dialog && !dialog.open) dialog.showModal();
  };
  const authClient = getAuthClient();
  if (authClient) {
    authClient.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') openPasswordReset();
    });
    if (new URLSearchParams(location.search).has('reset') || location.hash.includes('type=recovery')) {
      setTimeout(openPasswordReset, 700);
    }
    $('passwordRecoveryForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = $('recoveryNewPassword').value;
      const confirm = $('recoveryConfirmPassword').value;
      $('recoveryPasswordError').textContent = '';
      if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
        $('recoveryPasswordError').textContent = 'Use at least 10 characters, including a letter and a number.';
        return;
      }
      if (password !== confirm) {
        $('recoveryPasswordError').textContent = 'Your passwords do not match.';
        return;
      }
      const button = $('passwordRecoveryForm').querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Updating password…';
      try {
        const { data: sessionData } = await authClient.auth.getSession();
        if (!sessionData?.session) throw new Error('This recovery link is invalid or has expired. Request a new password-reset link.');
        const { error } = await authClient.auth.updateUser({ password });
        if (error) throw error;
        $('passwordRecoveryDialog').close();
        $('passwordRecoveryForm').reset();
        history.replaceState({}, document.title, location.pathname);
        await authClient.auth.signOut();
        window.showAuth('login');
        const success = document.createElement('p');
        success.className = 'form-success recovery-complete-message';
        success.textContent = 'Your password has been changed. You can now sign in with your new password.';
        $('loginForm')?.prepend(success);
      } catch (error) {
        $('recoveryPasswordError').textContent = error.message || 'Password could not be updated. Request a new recovery link if this one has expired.';
      } finally {
        button.disabled = false;
        button.textContent = 'Update password';
      }
    });
  }

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
    const link = document.createElement('a'); link.href = url; link.download = 'Budgtree-Student-Budgeting-Starter-Guide.txt'; link.click();
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
