# PassVault — Personal Password Manager

PassVault adalah aplikasi web personal password manager yang memungkinkan pengguna menyimpan, mengelola, dan mengakses kredensial (username dan password) untuk berbagai layanan online secara aman dalam satu tempat terpusat.

Live Demo: https://passvault-production-group13.up.railway.app

---

## Deskripsi Aplikasi

PassVault ditujukan untuk pengguna individual yang ingin meninggalkan kebiasaan menggunakan password yang sama di banyak layanan, atau menyimpan password di tempat yang tidak aman seperti catatan di browser, file teks, atau aplikasi pesan.

PassVault termasuk kategori security-critical application — aplikasi yang fungsi utamanya adalah menyimpan dan melindungi data sensitif pengguna. Berbeda dengan aplikasi e-commerce atau sosial media yang menyimpan data pribadi sebagai konsekuensi sampingan, di PassVault data sensitif (kredensial pengguna) adalah core asset yang dijaga. Konsekuensi langsungnya: ekspektasi terhadap kualitas keamanan kode, dependency, dan deployment pipeline jauh lebih ketat dibanding aplikasi pada umumnya.

### Fitur Utama

- Autentikasi dengan master password yang di-hash menggunakan bcrypt
- Penyimpanan vault entry (nama layanan, URL, username, password) dengan enkripsi AES-256-GCM di sisi server sebelum data tersimpan ke database
- Pencarian dan filter entry berdasarkan nama layanan atau kategori
- Session management dengan JWT token dan timeout otomatis untuk meminimalkan risiko session hijacking
- Audit log — setiap aksi sensitif (login, view password, edit, delete) dicatat untuk akuntabilitas

### Tech Stack

| Komponen | Teknologi |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js 4 |
| Database | PostgreSQL 16 |
| Authentication | bcrypt + JWT |
| Enkripsi Data | Node crypto (AES-256-GCM) |
| Frontend | EJS templates + Tailwind CSS |
| Testing | Jest + Supertest |
| CI/CD | GitHub Actions |
| Deployment | Railway |

---

## Cara Menjalankan Lokal

### Prerequisites

- Docker dan Docker Compose

### Setup

```bash
# Clone repository
git clone https://github.com/callduck/PassVault.git
cd PassVault

# Jalankan aplikasi dan database sekaligus
docker compose up
```

Aplikasi berjalan di http://localhost:3000

---

## Arsitektur Pipeline CI/CD

Pipeline CI/CD dirancang dengan prinsip defense-in-depth: multiple layers of security checks sebelum kode boleh masuk ke branch utama. Pendekatan ini disebut shift-left security — pemeriksaan keamanan dilakukan di tahap paling awal pengembangan (pada saat kode di-commit, bukan pada saat aplikasi sudah deploy).

### Trigger Pipeline

| Event | Workflow yang Berjalan |
|---|---|
| Push ke main | CI + Security + Build |
| Pull Request ke main | CI + Security + Build |
| Jadwal mingguan | Security (deteksi CVE baru) |
| Manual (workflow_dispatch) | Semua |

### Alur Pipeline

```
Developer push / open PR
         |
   ------+------
   |     |     |
  CI  Security Build
   ------+------
         |
   Quality Gate
   (semua harus lulus)
         |
   ------+------
   |           |
 MERGE OK   BLOCK PR
```

Seluruh workflow harus lulus tanpa ada satupun yang gagal. Ketika terdapat satu job yang gagal maka pull request akan otomatis terblokir dan tidak dapat di-merge ke branch main.

---

## Continuous Integration (CI)

File: `.github/workflows/ci.yml`

Pipeline CI memverifikasi kualitas kode dan kebenaran fungsional sebelum kode di-merge. Terdiri dari tiga job paralel sehingga total waktu eksekusi minimal.

### Lint dan Static Analysis

ESLint dengan `eslint-plugin-security` mendeteksi pola kode rawan seperti penggunaan `eval`, regex tidak aman, dan pola berbahaya lainnya.

### Unit dan Integration Test

Jest untuk unit test (validasi enkripsi, hashing) dan Supertest untuk integration test endpoint Express (auth, CRUD vault entry). Service container PostgreSQL 16 disediakan GitHub Actions untuk test integrasi database. Coverage threshold minimal 70% — di bawah angka ini, pipeline gagal.

### Docker Build

Build image Docker untuk memastikan Dockerfile valid dan semua dependencies terinstall dengan benar.

---

## Security Pipeline

File: `.github/workflows/security.yml`

Empat lapisan pemeriksaan keamanan otomatis yang mencakup spektrum ancaman berbeda: kerentanan dependency, kebocoran rahasia, kelemahan kode, hingga vulnerability di image container.

### 1. Dependency Vulnerability Scanning — npm audit

```yaml
- name: NPM Audit
  run: npm audit --audit-level=high
```

Memeriksa seluruh package dependency terhadap database publik vulnerability (NVD, GitHub Advisory). Pipeline gagal jika ditemukan vulnerability dengan severity high atau critical.

Relevansi dengan PassVault: satu vulnerability di library kriptografi atau parser HTTP dapat berakibat fatal — contohnya Heartbleed (OpenSSL) atau prototype pollution di library JavaScript yang dapat memungkinkan attacker membaca seluruh isi vault.

### 2. Secret Scanning — Gitleaks

```yaml
- uses: gitleaks/gitleaks-action@v2
```

Memindai seluruh history commit untuk mendeteksi pola yang menyerupai secret: API key, JWT secret, private key, password yang ter-hardcode, dan sebagainya.

Relevansi dengan PassVault: secret yang paling kritis adalah ENCRYPTION_KEY — kunci AES-256-GCM yang mengenkripsi seluruh password vault. Jika kunci ini bocor via commit tidak sengaja, semua data password yang tersimpan di database dapat didekripsi.

### 3. Static Application Security Testing — CodeQL

```yaml
- uses: github/codeql-action/init@v3
  with:
    languages: javascript-typescript
    queries: security-and-quality
- uses: github/codeql-action/analyze@v3
```

Analisis statis source code JavaScript untuk mendeteksi pola vulnerability dari OWASP Top 10: SQL injection, XSS, Path Traversal, SSRF, insecure deserialization, dan lain-lain.

Relevansi dengan PassVault: aplikasi ini memiliki kombinasi rawan vulnerability klasik — form input pengguna (rentan XSS), query database untuk pencarian vault (rentan SQL injection), dan endpoint API yang menerima URL eksternal (rentan SSRF). Satu kelemahan dapat menyebabkan vault entry pengguna lain dapat diakses.

### 4. Container Image Scanning — Trivy

```yaml
- uses: aquasecurity/trivy-action@master
  with:
    image-ref: passvault:${{ github.sha }}
    severity: CRITICAL,HIGH
    exit-code: 1
```

Memindai Docker image untuk vulnerability di OS package level maupun language-level package. Pipeline gagal jika ditemukan vulnerability high atau critical. Trivy melengkapi npm audit dengan menambahkan layer pemeriksaan di luar dependency npm — termasuk OS layer dan runtime Node.js yang dibawa oleh base image.

### Ringkasan Coverage Security

| Tool | Lapisan yang Diperiksa | Ancaman yang Dimitigasi |
|---|---|---|
| npm audit | Dependency npm | CVE pada library |
| Gitleaks | Git history | Kebocoran secret dan API key |
| CodeQL | Source code | OWASP Top 10 (SQL injection, XSS, dll.) |
| Trivy | Docker image (OS dan app) | CVE pada base image dan runtime |

---

## Temuan dan Remediasi Security

Selama implementasi pipeline, ditemukan beberapa security issue yang berhasil diidentifikasi oleh tooling dan kemudian di-remediate.

### CodeQL — Missing Rate Limiting (High, 10 temuan)

CodeQL mendeteksi bahwa endpoint auth dan vault tidak memiliki rate limiting, sehingga rentan terhadap brute force attack. Untuk password manager, serangan brute force pada endpoint login dapat memungkinkan attacker mencoba ribuan kombinasi password secara otomatis.

Remediasi: ditambahkan `express-rate-limit` dengan dua konfigurasi berbeda. Rate limiter umum membatasi semua request maksimal 100 request per 15 menit. Rate limiter khusus auth lebih ketat, membatasi endpoint login dan register maksimal 20 request per 15 menit.

```javascript
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Terlalu banyak percobaan login, coba lagi nanti' }
});
```

### CodeQL — Missing CSRF Middleware (High, 1 temuan)

CodeQL mendeteksi bahwa form-based endpoint tidak memiliki proteksi CSRF (Cross-Site Request Forgery), sehingga attacker dapat membuat halaman web berbahaya yang diam-diam mengirim request ke PassVault atas nama user yang sedang login.

Remediasi: ditambahkan library `csrf-csrf` dengan implementasi Double Submit Cookie pattern. Setiap form menyertakan hidden input berisi token CSRF yang diverifikasi server sebelum memproses request.

### CodeQL — Missing CSRF (Test Environment, Dismissed)

CodeQL juga mendeteksi bahwa CSRF middleware di-bypass saat `NODE_ENV=test`. Ini merupakan false positive karena bypass dilakukan secara eksplisit untuk keperluan automated testing — bukan karena kelalaian implementasi. Alert di-dismiss dengan keterangan "used in tests".

### Trivy — False Positive CVE dari DevDependencies (3 CVE)

Trivy mendeteksi tiga CVE pada package `cross-spawn`, `glob`, dan `minimatch`. Setelah investigasi, ketiganya merupakan false positive karena:

1. Package-package tersebut merupakan transitive dependency dari Jest yang hanya digunakan saat development dan testing, tidak pernah jalan di production.
2. Trivy membaca `package-lock.json` di dalam Docker image yang mencatat semua dependency termasuk devDependencies, meski production stage sudah menggunakan `npm ci --omit=dev`.
3. Versi yang actually terinstall di production image sudah merupakan versi yang aman.

Remediasi: ketiga CVE di-whitelist di file `.trivyignore` dengan dokumentasi alasan masing-masing.

```
# cross-spawn - false positive, fixed in 7.0.6 (devDependency via Jest)
CVE-2024-21538
# glob - false positive, fixed in 11.1.0 (devDependency via Jest)
CVE-2025-64756
# minimatch - false positive, fixed in 9.0.6 (devDependency via Jest)
CVE-2026-26996
```

---

## Anggota Kelompok 13

| NIM | Nama | GitHub |
|---|---|---|
| 2802478114 | Kettin | callduck |
| 2802522443 | Kineta Valerie Prudentia Wibisono | kinetavlr |
| 2802533850 | Kevina Aretha | kevinaa06 |
| 2802540723 | Nadia Amelia Ramadhani | nadiaa-jpg |
