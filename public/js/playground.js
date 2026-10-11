// Interactive Code Playground for Informatics & KKA
const codeTemplates = {
  ispu: `# ========================================================
# KKA: Program Klasifikasi Kualitas Udara (ISPU) & PJJ
# ========================================================

# Data riwayat ISPU 7 hari terakhir selama kabut asap
riwayat_ispu = [115, 140, 185, 210, 245, 215, 205]

def analisis_ispu(data):
    total = sum(data)
    rata_rata = total / len(data)
    print("--- HASIL ANALISIS SENSOR UDARA SEKOLAH ---")
    print(f"Data Harian         : {data}")
    print(f"Rata-Rata 7 Hari    : {rata_rata:.2f}")
    
    tertinggi = max(data)
    print(f"Nilai Tertinggi     : {tertinggi}")
    
    # Klasifikasi Status
    if rata_rata <= 50:
        kategori = "BAIK (Kelas Tatap Muka Normal)"
        rekomendasi = "Aktivitas luar ruangan aman."
    elif rata_rata <= 100:
        kategori = "SEDANG (Waspada Kelompok Sensitif)"
        rekomendasi = "Batasi olahraga berat di luar."
    elif rata_rata <= 200:
        kategori = "TIDAK SEHAT (Gunakan Masker)"
        rekomendasi = "Kurangi aktivitas luar ruangan."
    elif rata_rata <= 300:
        kategori = "SANGAT TIDAK SEHAT (PJJ Daring Aktif!)"
        rekomendasi = "Seluruh KBM dipindahkan ke pembelajaran jarak jauh."
    else:
        kategori = "BERBAHAYA (Krisis Bencana Asap)"
        rekomendasi = "Evakuasi atau tetap di ruang berpenyaring udara."
        
    print(f"Status Kualitas     : {kategori}")
    print(f"Rekomendasi Sekolah : {rekomendasi}")
    print("-------------------------------------------")

# Eksekusi Analisis
analisis_ispu(riwayat_ispu)
`,

  ml_prompt: `# ========================================================
# KKA: Prompt Engineering Evaluator & AI Reasoning Test
# ========================================================

class PromptEvaluator:
    def __init__(self, prompt_text):
        self.prompt = prompt_text
        self.words = prompt_text.split()
        
    def evaluasi(self):
        score = 0
        catatan = []
        
        # 1. Cek Komponen Role
        if any(w in self.prompt.lower() for w in ["bertindaklah", "sebagai", "peran", "role", "pakar"]):
            score += 25
            catatan.append("[V] Memiliki definisi Peran (Role) yang jelas.")
        else:
            catatan.append("[X] Belum mendefinisikan Peran (Role).")
            
        # 2. Cek Konteks
        if any(w in self.prompt.lower() for w in ["karena", "kondisi", "kabut asap", "pjj", "sekolah"]):
            score += 25
            catatan.append("[V] Memiliki Konteks situasi spesifik.")
        else:
            catatan.append("[X] Konteks masih terlalu umum.")
            
        # 3. Cek Instruksi Tugas (Task)
        if any(w in self.prompt.lower() for w in ["buatlah", "analisis", "tuliskan", "rangkumlah"]):
            score += 25
            catatan.append("[V] Memiliki Instruksi Tugas yang terarah.")
        else:
            catatan.append("[X] Instruksi tugas kurang spesifik.")
            
        # 4. Cek Format Batasan (Constraints)
        if any(w in self.prompt.lower() for w in ["poin", "tabel", "singkat", "maksimal", "format"]):
            score += 25
            catatan.append("[V] Memiliki batasan format output yang rapi.")
        else:
            catatan.append("[X] Tambahkan batasan format (misal: bentuk poin).")
            
        return score, catatan

prompt_siswa = """Bertindaklah sebagai guru informatika yang ramah. Karena saat ini sedang ada kabut asap pekat dan sekolah mengadakan PJJ, buatlah 3 tips menjaga fokus belajar koding di rumah. Tuliskan dalam format poin singkat."""

evaluator = PromptEvaluator(prompt_siswa)
skor, rincian = evaluator.evaluasi()

print("PROMPT YANG DIUJI:")
print(f'"{prompt_siswa}"')
print("HASIL EVALUASI REKAYASA PROMPT:")
print(f"Skor Kualitas Prompt: {skor} / 100")
for r in rincian:
    print(" ->", r)
`,

  algo_search: `# ========================================================
# INFORMATIKA: Studi Kasus Algoritma Pencarian & Sorting
# ========================================================

# Data NISN Siswa yang terdaftar di kelas daring
daftar_nisn = [102, 105, 112, 120, 134, 145, 150, 168, 172, 190]
target_cari = 145

print("Daftar NISN Siswa:", daftar_nisn)
print(f"Mencari NISN Siswa: {target_cari}")

# Implementasi Binary Search (Pencarian Biner)
def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    langkah = 0
    
    while low <= high:
        langkah += 1
        mid = (low + high) // 2
        print(f"Langkah {langkah}: Periksa indeks {mid} (Nilai: {arr[mid]})")
        
        if arr[mid] == target:
            return mid, langkah
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
            
    return -1, langkah

indeks, total_langkah = binary_search(daftar_nisn, target_cari)

if indeks != -1:
    print(f"Status: Ditemukan pada indeks ke-{indeks} dalam {total_langkah} langkah!")
else:
    print(f"Status: Data tidak ditemukan setelah {total_langkah} langkah.")
`,

  cyber_pass: `# ========================================================
# INFORMATIKA: Cyber Hygiene - Password Strength Checker
# ========================================================

def cek_keamanan_password(kata_sandi):
    skor = 0
    alasan = []
    
    if len(kata_sandi) >= 8:
        skor += 25
        alasan.append("[V] Panjang minimal 8 karakter terpenuhi")
    else:
        alasan.append("[X] Terlalu pendek (kurang dari 8 karakter)")
        
    if any(c.isupper() for c in kata_sandi):
        skor += 25
        alasan.append("[V] Mengandung huruf besar (A-Z)")
    else:
        alasan.append("[X] Belum ada huruf besar")
        
    if any(c.isdigit() for c in kata_sandi):
        skor += 25
        alasan.append("[V] Mengandung angka (0-9)")
    else:
        alasan.append("[X] Belum ada angka numerik")
        
    if any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in kata_sandi):
        skor += 25
        alasan.append("[V] Mengandung simbol khusus (!@#$)")
    else:
        alasan.append("[X] Belum ada simbol karakter khusus")
        
    return skor, alasan

pwd_uji = "InforKKA@2026"
print(f"Menguji Password Akun Siswa: {pwd_uji}")
skor_akhir, rincian = cek_keamanan_password(pwd_uji)

print(f"Skor Keamanan: {skor_akhir}/100")
for item in rincian:
    print(" -", item)
if skor_akhir >= 75:
    print("Rekomendasi: Password Kuat & Aman untuk PJJ!")
else:
    print("Peringatan: Password Lemah, ganti sebelum akun dibobol.")
`
};

function initPlayground() {
  const editor = document.getElementById('codeEditorArea');
  const output = document.getElementById('codeOutputArea');
  const templateSelect = document.getElementById('playgroundTemplateSelect');
  const runBtn = document.getElementById('runCodeBtn');
  const clearBtn = document.getElementById('clearOutputBtn');

  if (!editor || !templateSelect) return;

  // Set initial template
  editor.value = codeTemplates.ispu;

  templateSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (codeTemplates[key]) {
      editor.value = codeTemplates[key];
      appendOutput(`[Memuat Template: ${e.target.options[e.target.selectedIndex].text}]\n`);
    }
  });

  runBtn.addEventListener('click', () => {
    executeCode(editor.value);
  });

  clearBtn.addEventListener('click', () => {
    output.innerText = '[Terminal Dibersihkan]\n';
  });
}

function appendOutput(text) {
  const output = document.getElementById('codeOutputArea');
  if (output) {
    output.innerText += text;
    output.scrollTop = output.scrollHeight;
  }
}

// Client-side execution simulator
function executeCode(code) {
  const output = document.getElementById('codeOutputArea');
  output.innerText = `>>> Memulai Eksekusi Program... (${new Date().toLocaleTimeString()})\n\n`;

  try {
    // Collect simulated outputs
    const logs = [];
    const customPrint = (...args) => {
      const line = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          return JSON.stringify(arg);
        }
        return String(arg);
      }).join(' ');
      logs.push(line);
    };

    // Python-to-JS lightweight simulation for the educational demos
    // Convert common python constructs so browser can execute safely
    let transpiled = code;

    // Handle comments
    transpiled = transpiled.replace(/^(\s*)#(.*)$/gm, '$1// $2');

    // Handle f-strings roughly: f"hello {x}" -> `hello ${x}`
    transpiled = transpiled.replace(/f"([^"\n]*)"/g, (match, p1) => {
      const converted = p1.replace(/\{([^\}]+)\}/g, (m, exp) => {
        // handle format specifiers like :.2f
        if (exp.includes(':')) {
          const [varName, fmt] = exp.split(':');
          if (fmt.includes('.2f')) {
            return `\${Number(${varName}).toFixed(2)}`;
          }
        }
        return `\${${exp}}`;
      });
      return '`' + converted + '`';
    });
    
    // Handle f-strings single quotes: f'hello {x}' -> `hello ${x}`
    transpiled = transpiled.replace(/f'([^'\n]*)'/g, (match, p1) => {
      const converted = p1.replace(/\{([^\}]+)\}/g, (m, exp) => {
        if (exp.includes(':')) {
          const [varName, fmt] = exp.split(':');
          if (fmt.includes('.2f')) {
            return `\${Number(${varName}).toFixed(2)}`;
          }
        }
        return `\${${exp}}`;
      });
      return '`' + converted + '`';
    });

    // Handle Python print to customPrint
    transpiled = transpiled.replace(/\bprint\s*\(/g, 'customPrint(');

    // Handle Python len() to .length
    transpiled = transpiled.replace(/\blen\s*\(([^)]+)\)/g, '($1).length');

    // Handle Python sum()
    transpiled = transpiled.replace(/\bsum\s*\(([^)]+)\)/g, '($1).reduce((a,b)=>a+b, 0)');

    // Handle Python max()
    transpiled = transpiled.replace(/\bmax\s*\(([^)]+)\)/g, 'Math.max(...$1)');

    // Handle Python // to Math.floor(/)
    transpiled = transpiled.replace(/(\w+)\s*\/\/\s*(\w+)/g, 'Math.floor($1 / $2)');

    // Execute with sandboxed function
    const sandboxFn = new Function('customPrint', `
      try {
        ${transpiled}
      } catch(e) {
        customPrint("[Eksekusi Info] " + e.message);
      }
    `);

    sandboxFn(customPrint);

    if (logs.length > 0) {
      output.innerText += logs.join('\n') + '\n\n>>> [Program Selesai Dieksekusi Secara Sukses (Exit Code 0)]';
    } else {
      output.innerText += 'Program dieksekusi tanpa luaran teks (print).\n';
    }
  } catch (err) {
    output.innerText += `[Error Sintaks]: ${err.message}\nSilakan periksa kembali tanda baca atau kode koding Anda.`;
  }
}
