/// <reference lib="webworker" />
export default null; // keep TS happy: treat as module

self.onmessage = async (ev: MessageEvent) => {
    const { name, bytes, parse } = ev.data as { name: string; bytes: ArrayBuffer; parse: boolean };

    try {
        // OPFS write via Sync Access Handle (worker-only)
        // @ts-ignore - TS might not know this API yet
        const root = await (self as any).navigator.storage.getDirectory();
        const imagesDir = await root.getDirectoryHandle('images', { create: true });
        const fh = await imagesDir.getFileHandle(name, { create: true });

        // @ts-ignore
        const access = await fh.createSyncAccessHandle();
        try {
            access.truncate(0);
            access.write(new Uint8Array(bytes), { at: 0 });
            access.flush();
        } finally {
            access.close();
        }

        // optional: metadata parse here if you port the parser
        (self as any).postMessage({ ok: true, name });
    } catch (err: any) {
        (self as any).postMessage({ ok: false, name, error: String(err?.message ?? err) });
    }
};