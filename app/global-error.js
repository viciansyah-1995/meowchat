'use client';

export default function GlobalError() {
  return (
    <html lang="id">
      <body style={{ margin: 0, padding: '32px 20px', background: '#f5f7ff', color: '#172033', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ maxWidth: 440, margin: '40px auto', lineHeight: 1.6 }}>
          <h1>Database</h1>
          <p>Aplikasi gagal dimuat. Pastikan koneksi internet tersedia, lalu buka ulang.</p>
          <button type="button" onClick={() => window.location.reload()}
            style={{ minHeight: 44, padding: '10px 18px', border: 0, borderRadius: 12, background: '#293681', color: '#fff', fontSize: 16 }}>
            Muat ulang aplikasi
          </button>
        </main>
      </body>
    </html>
  );
}
