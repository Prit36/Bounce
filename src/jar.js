/* User-selected game files stay on this device. No upload or game download. */
(function () {
  const SHA256 = '77a24bf1de10ad8a1c440fc96aa1ed2e4b29f2102771f268eaa93ff910b55ee8';
  const MAX_BYTES = 1024 * 1024;
  function storage(mode, operation) {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('Browser storage is unavailable.')); return; }
      const request = indexedDB.open('bounce-jar-player', 1);
      let settled = false;
      const fail = () => { settled = true; reject(new Error('Could not access the remembered JAR.')); };
      request.onupgradeneeded = () => request.result.createObjectStore('files');
      request.onerror = fail;
      request.onblocked = fail;
      request.onsuccess = () => {
        const db = request.result;
        if (settled) { db.close(); return; }
        try {
          const transaction = db.transaction('files', mode);
          const result = operation(transaction.objectStore('files'));
          transaction.oncomplete = () => { settled = true; db.close(); resolve(result.result); };
          transaction.onerror = transaction.onabort = () => { db.close(); fail(); };
        } catch (error) { db.close(); settled = true; reject(error); }
      };
    });
  }
  window.BounceJar = {
    SHA256,
    async remember(name, blob) {
      await storage('readwrite', store => store.put({ name, blob }, 'game'));
    },
    async load() {
      const record = await storage('readonly', store => store.get('game'));
      if (!record) return null;
      if (!record.blob || typeof record.blob.arrayBuffer !== 'function') throw new Error('The remembered JAR is unreadable.');
      const blob = await this.validate({ name: record.name, size: record.blob.size, arrayBuffer: () => record.blob.arrayBuffer() });
      return { name: record.name, blob };
    },
    async forget() {
      if (!globalThis.indexedDB) return;
      await storage('readwrite', store => store.delete('game'));
    },
    async validate(file) {
      if (!file || !/\.jar$/i.test(file.name || '')) throw new Error('Choose a .jar file from your device.');
      if (file.size <= 0 || file.size > MAX_BYTES) throw new Error('Choose a non-empty JAR smaller than 1 MB.');
      if (!globalThis.crypto?.subtle) throw new Error('File verification needs HTTPS or localhost. Open the player using a local server.');
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      if (hash !== SHA256) throw new Error('This JAR is not the supported Nokia Bounce 1.24 file. Choose your matching original copy.');
      // Launch the exact bytes that were verified, even if a local file changes.
      return new Blob([bytes], { type: 'application/java-archive' });
    }
  };
})();
