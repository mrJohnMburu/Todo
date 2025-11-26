// eslint-disable-next-line no-unused-expressions
(function initApp() {
  const STORAGE_KEY = 'two-tab-todo-v1';
  const firebaseApi = window.todoFirebase;
  const TAG_COLORS = ['#FF6B5A', '#FFB347', '#FFD93D', '#6BD2DB', '#7C83FD', '#FF8FAB', '#B28DFF', '#4CAF50'];

  const ui = {
    tabs: document.querySelectorAll('.tab'),
    taskList: document.getElementById('taskList'),
    taskTemplate: document.getElementById('taskTemplate'),
    taskForm: document.getElementById('taskForm'),
    newTaskInput: document.getElementById('newTask'),
    showCompletedInput: document.getElementById('showCompleted'),
    sortImportantInput: document.getElementById('sortImportant'),
    tagFilterSelect: document.getElementById('tagFilter'),
    emptyState: document.querySelector('[data-empty]'),
    counterBadge: document.querySelector('[data-counter]'),
    resetButton: document.getElementById('resetData'),
    statsButton: document.getElementById('statsButton'),
    statsModal: document.getElementById('statsModal'),
    closeStatsButtons: document.querySelectorAll('[data-close-stats]'),
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
    manageTagsButton: document.getElementById('manageTags'),
    tagsModal: document.getElementById('tagsModal'),
    closeTagsButtons: document.querySelectorAll('[data-close-tags]'),
    tagList: document.querySelector('[data-tag-list]'),
    tagForm: document.getElementById('tagForm'),
    tagNameInput: document.getElementById('tagName'),
    tagColorContainer: document.querySelector('[data-tag-colors]'),
    taskTagSelect: document.getElementById('taskTag'),
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
    sortImportant: false,
    tags: [],
    activeTagFilter: 'all',
  };

  let state = loadState();
  let currentUser = null;
  let unsubscribeRemote = null;
  let unsubscribeTags = null;
  let toastTimeout = null;
  let pendingGuestTasks = state.tasks.map((task) => ({ ...task }));
  let pendingGuestTags = state.tags.map((tag) => ({ ...tag }));
  let draggedTaskId = null;
  let selectedTagColor = TAG_COLORS[0];

  function normalizeTag(tag) {
    if (!tag || typeof tag !== 'object') return null;
    const name = String(tag.name || '').trim();
    if (!name) return null;
    return {
      id: tag.id || uid(),
      name,
      color: typeof tag.color === 'string' ? tag.color : TAG_COLORS[0],
      createdAt: tag.createdAt || new Date().toISOString(),
    };
  }

  function normalizeTask(task) {
    if (!task || typeof task !== 'object') return null;
    return {
      ...task,
      tab: task.tab === 'personal' ? 'personal' : 'work',
      completed: Boolean(task.completed),
      important: Boolean(task.important),
      tagId: typeof task.tagId === 'string' ? task.tagId : null,
    };
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!stored) return { ...defaultState };
      const storedTasks = Array.isArray(stored.tasks)
        ? stored.tasks.map(normalizeTask).filter(Boolean)
        : [];
      const storedTags = Array.isArray(stored.tags)
        ? stored.tags.map(normalizeTag).filter(Boolean)
        : [];
      return {
        activeTab: stored.activeTab || 'work',
        tasks: storedTasks,
        showCompleted: typeof stored.showCompleted === 'boolean' ? stored.showCompleted : false,
        sortImportant: typeof stored.sortImportant === 'boolean' ? stored.sortImportant : false,
        tags: storedTags,
        activeTagFilter: stored.activeTagFilter || 'all',
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

  function getTagById(tagId) {
    if (!tagId) return null;
    return state.tags.find((tag) => tag.id === tagId) || null;
  }

  function getContrastingTextColor(hex) {
    if (!hex || typeof hex !== 'string') return '#2D2520';
    let normalized = hex.replace('#', '');
    if (normalized.length === 3) {
      normalized = normalized
        .split('')
        .map((char) => char + char)
        .join('');
    }
    if (normalized.length !== 6) return '#2D2520';
    const r = parseInt(normalized.slice(0, 2), 16) / 255;
    const g = parseInt(normalized.slice(2, 4), 16) / 255;
    const b = parseInt(normalized.slice(4, 6), 16) / 255;
    const [rl, gl, bl] = [r, g, b].map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
    );
    const luminance = 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
    return luminance > 0.6 ? '#2D2520' : '#FFF';
  }

  function applyTagColorToSelect(selectEl, tag) {
    if (!selectEl) return;
    if (tag) {
      selectEl.style.setProperty('--tag-select-color', tag.color);
      selectEl.style.setProperty('--tag-select-text', getContrastingTextColor(tag.color));
    } else {
      selectEl.style.removeProperty('--tag-select-color');
      selectEl.style.removeProperty('--tag-select-text');
    }
  }

  function isTaskInActiveTab(task) {
    return (task.tab || 'work') === state.activeTab;
  }

  function matchesCompletionFilter(task) {
    return state.showCompleted ? true : !task.completed;
  }

  function matchesTagFilter(task) {
    return state.activeTagFilter === 'all' || (task.tagId || '') === state.activeTagFilter;
  }

  function isTaskVisible(task) {
    return isTaskInActiveTab(task) && matchesCompletionFilter(task) && matchesTagFilter(task);
  }

  function getVisibleTaskIndices() {
    const indices = [];
    state.tasks.forEach((task, index) => {
      if (isTaskVisible(task)) {
        indices.push(index);
      }
    });
    return indices;
  }

  function populateTaskTagSelect(selectEl, selectedId) {
    if (!selectEl) return;
    const valueToUse = selectedId || '';
    selectEl.innerHTML = '';
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'No tag';
    selectEl.appendChild(noneOption);
    state.tags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag.id;
      option.textContent = tag.name;
      selectEl.appendChild(option);
    });
    selectEl.value = state.tags.some((tag) => tag.id === valueToUse) ? valueToUse : '';
    applyTagColorToSelect(selectEl, getTagById(selectEl.value));
  }

  function populateTagFilterSelect() {
    if (!ui.tagFilterSelect) return;
    const currentValue = state.activeTagFilter;
    ui.tagFilterSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All tags';
    ui.tagFilterSelect.appendChild(allOption);
    state.tags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag.id;
      option.textContent = tag.name;
      ui.tagFilterSelect.appendChild(option);
    });
    const validValue = currentValue === 'all' || state.tags.some((tag) => tag.id === currentValue)
      ? currentValue
      : 'all';
    if (state.activeTagFilter !== validValue) {
      state.activeTagFilter = validValue;
      persist();
    }
    ui.tagFilterSelect.value = validValue;
  }

  function renderTagList() {
    if (!ui.tagList) return;
    ui.tagList.innerHTML = '';
    if (!state.tags.length) {
      const empty = document.createElement('li');
      empty.className = 'tag-list__empty';
      empty.textContent = 'No tags yet. Add your first tag below.';
      ui.tagList.appendChild(empty);
      return;
    }
    state.tags.forEach((tag) => {
      const item = document.createElement('li');
      item.className = 'tag-list__item';
      const info = document.createElement('div');
      info.className = 'tag-list__info';
      const dot = document.createElement('span');
      dot.className = 'tag-dot';
      dot.style.background = tag.color;
      const name = document.createElement('span');
      name.textContent = tag.name;
      info.append(dot, name);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'icon-button';
      deleteBtn.textContent = '✕';
      deleteBtn.setAttribute('aria-label', `Delete ${tag.name} tag`);
      deleteBtn.addEventListener('click', () => deleteTag(tag.id));

      item.append(info, deleteBtn);
      ui.tagList.appendChild(item);
    });
  }

  function syncGlobalTagControls() {
    populateTagFilterSelect();
    populateTaskTagSelect(ui.taskTagSelect, ui.taskTagSelect?.value || '');
    renderTagList();
  }

  function setSelectedTagColor(color) {
    selectedTagColor = color;
    if (!ui.tagColorContainer) return;
    ui.tagColorContainer.querySelectorAll('.tag-color-chip').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip.dataset.color === color));
    });
  }

  function renderTagColorPicker() {
    if (!ui.tagColorContainer) return;
    ui.tagColorContainer.innerHTML = '';
    TAG_COLORS.forEach((color, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tag-color-chip';
      button.style.background = color;
      button.dataset.color = color;
       button.setAttribute('aria-label', `Select ${color} tag color`);
      button.setAttribute('aria-pressed', String(index === 0));
      button.addEventListener('click', () => {
        setSelectedTagColor(color);
      });
      ui.tagColorContainer.appendChild(button);
    });
    setSelectedTagColor(selectedTagColor);
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
    syncGlobalTagControls();

    const tasksInTab = state.tasks.filter((task) => isTaskInActiveTab(task));
    const orderedTasks = state.sortImportant
      ? [...tasksInTab].sort((a, b) => Number(b.important) - Number(a.important))
      : tasksInTab;
    const visibleTasks = orderedTasks.filter(
      (task) => matchesCompletionFilter(task) && matchesTagFilter(task),
    );

    ui.taskList.innerHTML = '';
    visibleTasks.forEach((task) => {
      const fragment = ui.taskTemplate.content.firstElementChild.cloneNode(true);
      const checkbox = fragment.querySelector('input[type="checkbox"]');
      const titleEl = fragment.querySelector('.task__title');
      const importantBtn = fragment.querySelector('.icon-button--important');
      const deleteBtn = fragment.querySelector('[data-role="delete"]');
      const tagSelect = fragment.querySelector('.task__tag-select');
      const dragHandle = fragment.querySelector('[data-drag-handle]');

      fragment.classList.toggle('completed', task.completed);
      fragment.classList.toggle('task--important', task.important);
      fragment.setAttribute('draggable', state.sortImportant ? 'false' : 'true');
      fragment.draggable = !state.sortImportant;
      fragment.dataset.taskId = task.id;
      if (dragHandle) {
        dragHandle.classList.toggle('task__drag-handle--disabled', state.sortImportant);
        dragHandle.title = state.sortImportant
          ? 'Disable "Important first" to reorder'
          : 'Drag to reorder';
      }
      checkbox.checked = task.completed;
      checkbox.setAttribute(
        'aria-label',
        `Mark ${task.title} as ${task.completed ? 'incomplete' : 'complete'}`,
      );
      titleEl.textContent = task.title;
      importantBtn.setAttribute('aria-pressed', String(task.important));
      importantBtn.textContent = task.important ? '★' : '☆';
      importantBtn.setAttribute(
        'aria-label',
        `${task.important ? 'Remove' : 'Mark'} ${task.title} ${
          task.important ? 'from' : 'as'
        } important`,
      );

      checkbox.addEventListener('change', () => toggleTask(task.id));
      populateTaskTagSelect(tagSelect, task.tagId || '');
      tagSelect.addEventListener('change', (event) => {
        updateTaskTag(task.id, event.target.value || null);
      });
      importantBtn.addEventListener('click', () => toggleImportant(task.id));
      deleteBtn.addEventListener('click', () => deleteTask(task.id));
      
      if (!state.sortImportant) {
        fragment.addEventListener('dragstart', handleDragStart);
        fragment.addEventListener('dragend', handleDragEnd);
        fragment.addEventListener('dragover', handleDragOver);
        fragment.addEventListener('drop', handleDrop);
      }

      ui.taskList.appendChild(fragment);
    });

    const nothingToShow = visibleTasks.length === 0;
    ui.emptyState.hidden = !nothingToShow;
    ui.emptyState.textContent = nothingToShow
      ? state.activeTagFilter === 'all'
        ? `No ${state.activeTab} tasks${state.showCompleted ? '' : ' yet'}.`
        : 'No tasks match this tag yet.'
      : '';

    if (ui.sortImportantInput) {
      ui.sortImportantInput.checked = state.sortImportant;
    }
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

  function maybeSyncTag(tag) {
    if (!currentUser || !firebaseApi || !firebaseApi.isReady()) return;
    firebaseApi.saveTag(currentUser.uid, tag).catch((error) => {
      console.error('Tag sync failed', error);
      showToast('Unable to sync tag right now.');
    });
  }

  function maybeDeleteTagRemote(tagId) {
    if (!currentUser || !firebaseApi || !firebaseApi.isReady()) return;
    firebaseApi.deleteTag(currentUser.uid, tagId).catch((error) => {
      console.error('Delete tag sync failed', error);
      showToast('Unable to delete tag in cloud.');
    });
  }

  function addTask(title) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const selectedTagId = ui.taskTagSelect?.value || '';
    const normalizedTagId = state.tags.some((tag) => tag.id === selectedTagId) ? selectedTagId : null;
    const newTask = {
      id: uid(),
      title: trimmed,
      tab: state.activeTab,
      completed: false,
      important: false,
      tagId: normalizedTagId,
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

  function toggleImportant(id) {
    let changedTask = null;
    state.tasks = state.tasks.map((task) => {
      if (task.id !== id) return task;
      changedTask = { ...task, important: !task.important };
      return changedTask;
    });
    if (!changedTask) return;
    persist();
    render();
    maybeSyncTask(changedTask);
  }

  function updateTaskTag(id, tagId) {
    const normalizedTagId = state.tags.some((tag) => tag.id === tagId) ? tagId : null;
    let changedTask = null;
    state.tasks = state.tasks.map((task) => {
      if (task.id !== id) return task;
      changedTask = { ...task, tagId: normalizedTagId };
      return changedTask;
    });
    if (!changedTask) return;
    persist();
    render();
    maybeSyncTask(changedTask);
  }

  function addTag(name, color) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const exists = state.tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      showToast('Tag name already exists.');
      return;
    }
    const newTag = {
      id: uid(),
      name: trimmed,
      color,
      createdAt: new Date().toISOString(),
    };
    state.tags = [...state.tags, newTag];
    persist();
    render();
    maybeSyncTag(newTag);
  }

  function deleteTag(tagId) {
    const tag = getTagById(tagId);
    if (!tag) return;
    const confirmed = window.confirm(
      `Delete the "${tag.name}" tag? Tasks using it will lose their tag.`,
    );
    if (!confirmed) return;
    state.tags = state.tags.filter((item) => item.id !== tagId);
    state.tasks = state.tasks.map((task) =>
      task.tagId === tagId ? { ...task, tagId: null } : task,
    );
    if (state.activeTagFilter === tagId) {
      state.activeTagFilter = 'all';
    }
    persist();
    render();
    maybeDeleteTagRemote(tagId);
    if (currentUser && firebaseApi && firebaseApi.isReady()) {
      firebaseApi
        .upsertTasks(currentUser.uid, state.tasks)
        .catch((error) => console.error('Failed to sync tag removal for tasks', error));
    }
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

  function handleTagFormSubmit(event) {
    event.preventDefault();
    if (!ui.tagNameInput) return;
    const name = ui.tagNameInput.value;
    addTag(name, selectedTagColor || TAG_COLORS[0]);
    ui.tagForm.reset();
    setSelectedTagColor(TAG_COLORS[0]);
    ui.tagNameInput.focus();
  }

  function clearLocalState() {
    state = { ...defaultState };
    persist();
    render();
    pendingGuestTasks = [];
    pendingGuestTags = [];
  }

  async function clearData() {
    const confirmed = window.confirm('Remove all saved tasks?');
    if (!confirmed) return;
    if (currentUser && firebaseApi && firebaseApi.isReady()) {
      try {
        await Promise.all([
          firebaseApi.clearTasks(currentUser.uid),
          firebaseApi.clearTags(currentUser.uid),
        ]);
        showToast('Cleared cloud tasks and tags');
      } catch (error) {
        console.error('Failed to clear remote tasks', error);
        showToast('Unable to clear remote tasks');
      }
    }
    clearLocalState();
  }

  function handleDragStart(event) {
    draggedTaskId = event.currentTarget.dataset.taskId;
    event.currentTarget.classList.add('dragging');
  }

  function handleDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
    draggedTaskId = null;
  }

  function handleDragOver(event) {
    event.preventDefault();
    const afterElement = event.currentTarget;
    if (afterElement.dataset.taskId !== draggedTaskId) {
      document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
      afterElement.classList.add('drag-over');
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    if (state.sortImportant) return;
    const dropTarget = event.currentTarget;
    dropTarget.classList.remove('drag-over');
    
    if (!draggedTaskId || draggedTaskId === dropTarget.dataset.taskId) return;

    const visibleIndices = getVisibleTaskIndices();
    const draggedGlobalIndex = visibleIndices.find(
      (index) => state.tasks[index].id === draggedTaskId,
    );
    const dropGlobalIndex = visibleIndices.find(
      (index) => state.tasks[index].id === dropTarget.dataset.taskId,
    );

    console.log('Drag drop debug:', {
      draggedTaskId,
      dropTaskId: dropTarget.dataset.taskId,
      draggedGlobalIndex,
      dropGlobalIndex,
      visibleIndices,
      totalTasks: state.tasks.length
    });

    if (typeof draggedGlobalIndex !== 'number' || typeof dropGlobalIndex !== 'number') {
      console.warn('Invalid indices - drag aborted');
      return;
    }

    // Remove the dragged task
    const [draggedTask] = state.tasks.splice(draggedGlobalIndex, 1);
    
    // Recalculate drop position after removal
    const newDropIndex = draggedGlobalIndex < dropGlobalIndex ? dropGlobalIndex - 1 : dropGlobalIndex;
    
    console.log('Reordering:', {
      draggedTaskTitle: draggedTask.title,
      fromIndex: draggedGlobalIndex,
      toIndex: newDropIndex
    });
    
    // Insert at new position
    state.tasks.splice(newDropIndex, 0, draggedTask);
    
    persist();
    render();
    draggedTaskId = null;
    
    if (currentUser && firebaseApi && firebaseApi.isReady()) {
      firebaseApi.upsertTasks(currentUser.uid, state.tasks).catch((error) => {
        console.error('Reorder sync failed', error);
      });
    }
  }

  function openStatsModal() {
    if (!ui.statsModal) return;
    
    const workTasks = state.tasks.filter((t) => t.tab === 'work');
    const workDone = workTasks.filter((t) => t.completed).length;
    const personalTasks = state.tasks.filter((t) => t.tab === 'personal');
    const personalDone = personalTasks.filter((t) => t.completed).length;
    const totalTasks = state.tasks.length;
    const totalDone = workDone + personalDone;
    const completionRate = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
    
    document.querySelector('[data-stat="work-total"]').textContent = workTasks.length;
    document.querySelector('[data-stat="work-done"]').textContent = workDone;
    document.querySelector('[data-stat="personal-total"]').textContent = personalTasks.length;
    document.querySelector('[data-stat="personal-done"]').textContent = personalDone;
    document.querySelector('[data-stat="completion-rate"]').textContent = `${completionRate}%`;
    
    ui.statsModal.hidden = false;
    ui.statsModal.setAttribute('aria-hidden', 'false');
  }

  function closeStatsModal() {
    if (!ui.statsModal) return;
    ui.statsModal.hidden = true;
    ui.statsModal.setAttribute('aria-hidden', 'true');
  }

  function openTagsModal() {
    if (!ui.tagsModal) return;
    renderTagList();
    ui.tagsModal.hidden = false;
    ui.tagsModal.setAttribute('aria-hidden', 'false');
    ui.tagNameInput?.focus();
  }

  function closeTagsModal() {
    if (!ui.tagsModal) return;
    ui.tagsModal.hidden = true;
    ui.tagsModal.setAttribute('aria-hidden', 'true');
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
      const syncTasks = firebaseApi.upsertTasks(currentUser.uid, state.tasks);
      const syncTags = state.tags.length
        ? firebaseApi.upsertTags(currentUser.uid, state.tags)
        : Promise.resolve();
      await Promise.all([syncTasks, syncTags]);
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
    if (unsubscribeTags) {
      unsubscribeTags();
      unsubscribeTags = null;
    }
  }

  function startRemoteSync(user) {
    if (!firebaseApi || !firebaseApi.isReady()) return;
    stopRemoteSync();
    unsubscribeRemote = firebaseApi.subscribeToTasks(
      user.uid,
      (tasks) => {
        state.tasks = Array.isArray(tasks) ? tasks.map(normalizeTask).filter(Boolean) : [];
        persist();
        render();
      },
      (error) => {
        console.error('Realtime sync error', error);
        showToast('Realtime sync failed.');
      },
    );

    unsubscribeTags = firebaseApi.subscribeToTags(
      user.uid,
      (tags) => {
        state.tags = Array.isArray(tags) ? tags.map(normalizeTag).filter(Boolean) : [];
        persist();
        render();
      },
      (error) => {
        console.error('Realtime tag sync error', error);
        showToast('Realtime tag sync failed.');
      },
    );

    if (pendingGuestTasks.length) {
      firebaseApi
        .upsertTasks(user.uid, pendingGuestTasks)
        .then(() => {
          pendingGuestTasks = [];
        })
        .catch((error) => {
          console.error('Failed to import guest tasks', error);
        });
    }

    if (pendingGuestTags.length) {
      firebaseApi
        .upsertTags(user.uid, pendingGuestTags)
        .then(() => {
          pendingGuestTags = [];
        })
        .catch((error) => {
          console.error('Failed to import guest tags', error);
        });
    }
  }

  function handleAuthChange(user) {
    currentUser = user;
    updateUserUI(user);
    toggleUserMenu(false);
    if (user) {
      pendingGuestTasks = state.tasks.map((task) => ({ ...task }));
      pendingGuestTags = state.tags.map((tag) => ({ ...tag }));
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

    ui.taskTagSelect?.addEventListener('change', (event) => {
      applyTagColorToSelect(ui.taskTagSelect, getTagById(event.target.value));
    });

    ui.showCompletedInput.addEventListener('change', () => {
      state.showCompleted = ui.showCompletedInput.checked;
      persist();
      render();
    });

    ui.tagFilterSelect?.addEventListener('change', (event) => {
      state.activeTagFilter = event.target.value;
      persist();
      render();
    });

    if (ui.sortImportantInput) {
      ui.sortImportantInput.addEventListener('change', () => {
        state.sortImportant = ui.sortImportantInput.checked;
        persist();
        render();
        draggedTaskId = null;
      });
    }

    ui.resetButton.addEventListener('click', clearData);
    ui.statsButton.addEventListener('click', openStatsModal);
    ui.closeStatsButtons.forEach((button) => button.addEventListener('click', closeStatsModal));
    
    if (ui.manageTagsButton) {
      ui.manageTagsButton.addEventListener('click', openTagsModal);
    }
    
    if (ui.closeTagsButtons) {
      ui.closeTagsButtons.forEach((button) => button.addEventListener('click', closeTagsModal));
    }
    
    if (ui.tagForm) {
      ui.tagForm.addEventListener('submit', handleTagFormSubmit);
    }
    
    // Keyboard shortcut for quick add removed per user request.

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
    renderTagColorPicker();
    render();
    bindEvents();
    initAuth();
  }

  init();
})();
