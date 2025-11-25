(function initTodoFirebase() {
  const firebaseConfig = {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'YOUR_FIREBASE_AUTH_DOMAIN',
    projectId: 'YOUR_FIREBASE_PROJECT_ID',
    storageBucket: 'YOUR_FIREBASE_STORAGE_BUCKET',
    messagingSenderId: 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
    appId: 'YOUR_FIREBASE_APP_ID',
  };

  const hasConfig = Object.values(firebaseConfig).every(
    (value) => typeof value === 'string' && value && !value.startsWith('YOUR_FIREBASE'),
  );

  let initialized = false;
  let auth;
  let db;

  function ensureInitialized() {
    if (initialized) return true;
    if (!window.firebase) {
      console.warn('Firebase SDK not loaded. Check script tags in index.html.');
      return false;
    }
    if (!hasConfig) {
      console.warn('Firebase config missing. Update firebase-auth.js with your project keys.');
      return false;
    }
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    initialized = true;
    return true;
  }

  function noop() {
    return undefined;
  }

  function noopUnsubscribe() {
    return () => {};
  }

  const api = {
    isReady() {
      return ensureInitialized();
    },
    onAuthStateChanged(callback) {
      if (!ensureInitialized()) {
        callback(null);
        return noopUnsubscribe();
      }
      return auth.onAuthStateChanged(callback);
    },
    async signIn(email, password) {
      if (!ensureInitialized()) throw new Error('Firebase not configured');
      return auth.signInWithEmailAndPassword(email, password);
    },
    async signUp(email, password) {
      if (!ensureInitialized()) throw new Error('Firebase not configured');
      return auth.createUserWithEmailAndPassword(email, password);
    },
    async signOut() {
      if (!ensureInitialized()) return noop();
      return auth.signOut();
    },
    async saveTask(uid, task) {
      if (!ensureInitialized()) return noop();
      const ref = db.collection('users').doc(uid).collection('tasks').doc(task.id);
      const payload = { ...task, updatedAt: new Date().toISOString() };
      return ref.set(payload);
    },
    async deleteTask(uid, taskId) {
      if (!ensureInitialized()) return noop();
      const ref = db.collection('users').doc(uid).collection('tasks').doc(taskId);
      return ref.delete();
    },
    async upsertTasks(uid, tasks) {
      if (!ensureInitialized() || !tasks.length) return noop();
      const batch = db.batch();
      const col = db.collection('users').doc(uid).collection('tasks');
      tasks.forEach((task) => {
        batch.set(col.doc(task.id), { ...task, updatedAt: new Date().toISOString() });
      });
      return batch.commit();
    },
    async clearTasks(uid) {
      if (!ensureInitialized()) return noop();
      const col = db.collection('users').doc(uid).collection('tasks');
      const snapshot = await col.get();
      if (snapshot.empty) return noop();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(col.doc(doc.id)));
      return batch.commit();
    },
    subscribeToTasks(uid, onUpdate, onError) {
      if (!ensureInitialized()) {
        if (onError) onError(new Error('Firebase not configured'));
        return noopUnsubscribe();
      }
      const query = db
        .collection('users')
        .doc(uid)
        .collection('tasks')
        .orderBy('createdAt', 'desc');

      return query.onSnapshot(
        (snapshot) => {
          const tasks = snapshot.docs.map((doc) => {
            const data = doc.data();
            const normalize = { ...data };
            ['createdAt', 'updatedAt'].forEach((key) => {
              if (normalize[key] && normalize[key].toDate) {
                normalize[key] = normalize[key].toDate().toISOString();
              }
            });
            return normalize;
          });
          onUpdate(tasks);
        },
        (error) => {
          if (onError) onError(error);
        },
      );
    },
  };

  window.todoFirebase = api;
})();
