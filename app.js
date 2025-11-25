// eslint-disable-next-line no-unused-expressions
(function initApp() {
  const STORAGE_KEY = 'two-tab-todo-v1';
  const firebaseApi = window.todoFirebase;

  const ui = {
    tabs: document.querySelectorAll('.tab'),
    taskList: document.getElementById('taskList'),
    taskTemplate: document.getElementById('taskTemplate'),
    taskForm: document.getElementById('taskForm'),
    newTaskInput: document.getElementById('newTask'),
    showCompletedInput: document.getElementById('showCompleted'),
    emptyState: document.querySelector('[data-empty]'),
    counterBadge: document.querySelector('[data-counter]'),
    resetButton: document.getElementById('resetData'),
    userLabel: document.querySelector('[data-user-label]'),
    userEmail: document.querySelector('[data-user-email]'),
    userMenuButton: document.getElementById('userMenuButton'),
    userMenuPanel: document.getElementById('userMenuPanel'),
    toast: document.querySelector('[data-toast]'),
    authModal: document.getElementById('authModal'),
    closeAuthButtons: document.querySelectorAll('[data-close-auth]'),
    signInForm: document.getElementById('signInForm'),
    signUpForm: document.getElementById('signUpForm'),
    continueGuest: document.getElementById('continueGuest'),
    menuButtons: {
      sync: document.querySelector('[data-menu="sync"]'),
      signin: document.querySelector('[data-menu="signin"]'),
      signout: document.querySelector('[data-menu="signout"]'),
    },
  };

  const defaultState = {
    activeTab: 'work',
    tasks: [],
    showCompleted: false,
  };

  let state = loadState();
  let currentUser = null;
  let unsubscribeRemote = null;
  let toastTimeout = null;
  let pendingGuestSnapshot = state.tasks.map((task) => ({ ...task }));

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored) return { ...defaultState };
      return {
        activeTab: stored.activeTab || 'work',
        tasks: Array.isArray(stored.tasks) ? stored.tasks : [],
        showCompleted: typeof stored.showCompleted === 'boolean' ? stored.showCompleted : false,
      };
    } catch (error) {
      console.warn('Unable to parse saved tasks', error);
      return { ...defaultState };
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Unable to save tasks:', error);
    }
  }

  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 10);
  }

  function showToast(message, duration = 2600) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    if (toastTimeout) window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {
      ui.toast.hidden = true;
    }, duration);
  }

  function toggleUserMenu(force) {
    const shouldOpen = typeof force === 'boolean' ? force : ui.userMenuPanel.hidden;
    ui.userMenuPanel.hidden = !shouldOpen;
    ui.userMenuButton.setAttribute('aria-expanded', String(shouldOpen));
  }

  function updateTabsUI() {
    ui.tabs.forEach((tabBtn) => {
      const isActive = tabBtn.dataset.tab === state.activeTab;
      tabBtn.setAttribute('aria-selected', String(isActive));
      tabBtn.tabIndex = isActive ? 0 : -1;
    });
    ui.newTaskInput.placeholder = `Add a ${state.activeTab === 'work' ? 'Work' : 'Personal'} task`;
  }

  function updateCounter(tasksInTab) {
    const completedCount = tasksInTab.filter((task) => task.completed).length;
    const totalLabel = `${tasksInTab.length} task${tasksInTab.length === 1 ? '' : 's'}`;
    const detail = completedCount ? ` · ${completedCount} done` : '';
    ui.counterBadge.textContent = totalLabel + detail;
  }

  function render() {
    updateTabsUI();
    ui.showCompletedInput.checked = state.showCompleted;

    const tasksInTab = state.tasks.filter((task) => (task.tab || 'work') === state.activeTab);
    const visibleTasks = tasksInTab.filter((task) => (state.showCompleted ? true : !task.completed));

    ui.taskList.innerHTML = '';
    visibleTasks.forEach((task) => {
      const fragment = ui.taskTemplate.content.firstElementChild.cloneNode(true);
      const checkbox = fragment.querySelector('input[type="checkbox"]');
      const titleEl = fragment.querySelector('.task__title');
      const deleteBtn = fragment.querySelector('.icon-button');

      fragment.classList.toggle('completed', task.completed);
      checkbox.checked = task.completed;
      checkbox.setAttribute(
        'aria-label',
        `Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`,
      );
      titleEl.textContent = task.title;

      checkbox.addEventListener('change', () => toggleTask(task.id));
      deleteBtn.addEventListener('click', () => deleteTask(task.id));

      ui.taskList.appendChild(fragment);
    });

    const nothingToShow = visibleTasks.length === 0;
    ui.emptyState.hidden = !nothingToShow;
    ui.emptyState.textContent = nothingToShow
      ? `No ${state.activeTab} tasks${state.showCompleted ? '' : ' yet'}.`
      : '';

    updateCounter(tasksInTab);
  }

  function setActiveTab(tab) {
    if (state.activeTab === tab) return;
    state.activeTab = tab;
    persist();
    render();
  }

  function maybeSyncTask(task) {
    if (!currentUser || !firebaseApi || !firebaseApi.isReady()) return;
    firebaseApi.saveTask(currentUser.uid, task).catch((error) => {
      console.error('Sync failed', error);
      showToast('Unable to sync task right now.');
    });
  }

  function addTask(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const newTask = {
      id: uid(),
      title: trimmed,
      tab: state.activeTab,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    state.tasks = [newTask, ...state.tasks];
    persist();
    render();
    ui.newTaskInput.value = '';
    ui.newTaskInput.focus();
    maybeSyncTask(newTask);
  }

  function toggleTask(id) {
    const updatedTasks = state.tasks.map((task) =>
      task.id === id ? { ...task, completed: !task.completed } : task,
    );
    state.tasks = updatedTasks;
    persist();
    render();
    const changedTask = state.tasks.find((task) => task.id === id);
    if (changedTask) maybeSyncTask(changedTask);
  }

  function deleteTask(id) {
    const task = state.tasks.find((item) => item.id === id);
    state.tasks = state.tasks.filter((taskItem) => taskItem.id !== id);
    persist();
    render();
    if (currentUser && task && firebaseApi && firebaseApi.isReady()) {
      firebaseApi.deleteTask(currentUser.uid, id).catch((error) => {
        console.error('Delete sync failed', error);
        showToast('Unable to delete task in cloud.');
      });
    }
  }

  function clearLocalState() {
    state = { ...defaultState };
    persist();
    render();
  }

  async function clearData() {
    const confirmed = window.confirm('Remove all saved tasks?');
    if (!confirmed) return;
    if (currentUser && firebaseApi && firebaseApi.isReady()) {
      try {
        await firebaseApi.clearTasks(currentUser.uid);
        showToast('Cleared cloud tasks');
      } catch (error) {
        console.error('Failed to clear remote tasks', error);
        showToast('Unable to clear remote tasks');
      }
    }
    clearLocalState();
  }

  function handleKeyboardShortcuts(event) {
    if (event.key.toLowerCase() === 'n' && document.activeElement !== ui.newTaskInput) {
      ui.newTaskInput.focus();
      event.preventDefault();
    }
  }

  function openAuthModal() {
    if (!ui.authModal) return;
    ui.authModal.hidden = false;
    ui.authModal.setAttribute('aria-hidden', 'false');
  }

  function closeAuthModal() {
    if (!ui.authModal) return;
    ui.authModal.hidden = true;
    ui.authModal.setAttribute('aria-hidden', 'true');
    ui.signInForm?.reset();
    ui.signUpForm?.reset();
  }

  function setAuthFormsDisabled(disabled) {
    [ui.signInForm, ui.signUpForm].forEach((form) => {
      if (!form) return;
      Array.from(form.elements).forEach((element) => {
        element.disabled = disabled;
      });
    });
  }

  async function handleSignIn(event) {
    event.preventDefault();
    if (!firebaseApi || !firebaseApi.isReady()) {
      showToast('Firebase is not configured yet.');
      return;
    }
    const formData = new FormData(ui.signInForm);
    const email = formData.get('email');
    const password = formData.get('password');
    try {
      setAuthFormsDisabled(true);
      await firebaseApi.signIn(email, password);
      closeAuthModal();
      showToast('Signed in. Syncing tasks…');
    } catch (error) {
      console.error('Sign in failed', error);
      showToast(error.message || 'Sign in failed');
    } finally {
      setAuthFormsDisabled(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    if (!firebaseApi || !firebaseApi.isReady()) {
      showToast('Firebase is not configured yet.');
      return;
    }
    const formData = new FormData(ui.signUpForm);
    const email = formData.get('email');
    const password = formData.get('password');
    try {
      setAuthFormsDisabled(true);
      await firebaseApi.signUp(email, password);
      closeAuthModal();
      showToast('Account created. Signed in.');
    } catch (error) {
      console.error('Sign up failed', error);
      showToast(error.message || 'Account creation failed');
    } finally {
      setAuthFormsDisabled(false);
    }
  }

  async function handleSignOut() {
    if (!firebaseApi || !firebaseApi.isReady()) return;
    try {
      await firebaseApi.signOut();
      showToast('Signed out. Back to guest mode.');
    } catch (error) {
      console.error('Sign out failed', error);
      showToast('Unable to sign out right now.');
    }
  }

  async function manualSync() {
    if (!currentUser || !firebaseApi || !firebaseApi.isReady()) {
      showToast('Sign in to sync across devices.');
      return;
    }
    try {
      showToast('Syncing…');
      await firebaseApi.upsertTasks(currentUser.uid, state.tasks);
      showToast('Sync complete.');
    } catch (error) {
      console.error('Manual sync failed', error);
      showToast('Unable to sync right now.');
    }
  }

  function updateUserUI(user) {
    const label = user ? user.email : 'Guest mode';
    const detail = user ? user.email : 'Not signed in';
    ui.userLabel.textContent = label;
    if (ui.userEmail) ui.userEmail.textContent = detail;
    ui.menuButtons.signout.disabled = !user;
    ui.menuButtons.sync.disabled = !user;
    ui.menuButtons.signin.disabled = !!user;
  }

  function stopRemoteSync() {
    if (unsubscribeRemote) {
      unsubscribeRemote();
      unsubscribeRemote = null;
    }
  }

  function startRemoteSync(user) {
    if (!firebaseApi || !firebaseApi.isReady()) return;
    stopRemoteSync();
    unsubscribeRemote = firebaseApi.subscribeToTasks(
      user.uid,
      (tasks) => {
        state.tasks = Array.isArray(tasks) ? tasks : [];
        persist();
        render();
      },
      (error) => {
        console.error('Realtime sync error', error);
        showToast('Realtime sync failed.');
      },
    );

    if (pendingGuestSnapshot.length) {
      firebaseApi
        .upsertTasks(user.uid, pendingGuestSnapshot)
        .then(() => {
          pendingGuestSnapshot = [];
        })
        .catch((error) => {
          console.error('Failed to import guest tasks', error);
        });
    }
  }

  function handleAuthChange(user) {
    currentUser = user;
    updateUserUI(user);
    toggleUserMenu(false);
    if (user) {
      pendingGuestSnapshot = state.tasks.map((task) => ({ ...task }));
      startRemoteSync(user);
    } else {
      stopRemoteSync();
      state = loadState();
      render();
    }
  }

  function initAuth() {
    if (!firebaseApi || !firebaseApi.isReady()) {
      showToast('Firebase not configured. Staying in guest mode.');
      ui.menuButtons.sync.disabled = true;
      ui.menuButtons.signout.disabled = true;
      return;
    }
    firebaseApi.onAuthStateChanged(handleAuthChange);
  }

  function bindEvents() {
    ui.tabs.forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => setActiveTab(tabBtn.dataset.tab));
    });

    ui.taskForm.addEventListener('submit', (event) => {
      event.preventDefault();
      addTask(ui.newTaskInput.value);
    });

    ui.showCompletedInput.addEventListener('change', () => {
      state.showCompleted = ui.showCompletedInput.checked;
      persist();
      render();
    });

    ui.resetButton.addEventListener('click', clearData);
    document.addEventListener('keydown', handleKeyboardShortcuts);

    ui.userMenuButton.addEventListener('click', () => toggleUserMenu());
    document.addEventListener('click', (event) => {
      if (!ui.userMenuPanel.contains(event.target) && !ui.userMenuButton.contains(event.target)) {
        toggleUserMenu(false);
      }
    });

    ui.menuButtons.signin.addEventListener('click', () => {
      toggleUserMenu(false);
      openAuthModal();
    });
    ui.menuButtons.signout.addEventListener('click', () => {
      toggleUserMenu(false);
      handleSignOut();
    });
    ui.menuButtons.sync.addEventListener('click', () => {
      toggleUserMenu(false);
      manualSync();
    });

    ui.closeAuthButtons.forEach((button) => button.addEventListener('click', closeAuthModal));
    ui.continueGuest.addEventListener('click', closeAuthModal);
    ui.signInForm.addEventListener('submit', handleSignIn);
    ui.signUpForm.addEventListener('submit', handleSignUp);
  }

  function init() {
    render();
    bindEvents();
    initAuth();
  }

  init();
})();
