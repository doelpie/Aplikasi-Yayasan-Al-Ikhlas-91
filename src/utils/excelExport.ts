import ExcelJS from 'exceljs';
import { Member, Activity } from '../types';
import { getPeranLabel, getActivityTypeLabel } from './storage';

/**
 * Generates a realistic visual KTP/KIA or KK or Profile card on an HTML5 Canvas
 * when a legacy/initial member record does not have a custom uploaded image,
 * or converts any existing image URL (base64 JPEG/PNG, SVG data URI, or local asset path)
 * into a standard JPEG base64 string compatible with ExcelJS image embedding.
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export function generateDocumentPreviewDataUrl(
  type: 'profil' | 'ktp' | 'kk',
  member: Member
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');

  if (type === 'profil') {
    canvas.width = 240;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#0b5d34';
    ctx.fillRect(0, 0, 240, 300);

    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(10, 10, 220, 280);

    // Avatar circle
    ctx.fillStyle = '#0b5d34';
    ctx.beginPath();
    ctx.arc(120, 105, 52, 0, Math.PI * 2);
    ctx.fill();

    // Initials
    const initials = member.nama
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() || '')
      .join('');
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(initials || 'YA', 120, 118);

    // Name & ID
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(member.nama.slice(0, 22), 120, 195);

    ctx.fillStyle = '#047857';
    ctx.font = '12px sans-serif';
    ctx.fillText(`ID: ${member.id}`, 120, 218);
    ctx.fillText(getPeranLabel(member.peranKeluarga), 120, 238);

    ctx.fillStyle = '#d4af37';
    ctx.fillRect(30, 255, 180, 4);

    return canvas.toDataURL('image/jpeg', 0.88);
  }

  if (type === 'ktp') {
    canvas.width = 400;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Outer card border
    ctx.fillStyle = '#0b5d34';
    ctx.fillRect(0, 0, 400, 250);

    // Inner KTP background
    ctx.fillStyle = '#f0fdf4';
    ctx.fillRect(8, 8, 384, 234);

    // Header
    ctx.fillStyle = '#0b5d34';
    ctx.fillRect(8, 8, 384, 46);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PROVINSI BALI - KABUPATEN BADUNG', 200, 27);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.fillText(
      member.peranKeluarga === 'anak' ? 'KARTU IDENTITAS ANAK (KIA) / NIK' : 'KARTU TANDA PENDUDUK (KTP)',
      200,
      44
    );

    // Details on left
    ctx.textAlign = 'left';
    ctx.fillStyle = '#064e3b';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`NIK : ${member.nik}`, 22, 76);

    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`Nama : ${member.nama.slice(0, 28)}`, 22, 100);

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#374151';
    ctx.fillText(`TTL : ${(member.tempatTanggalLahir || '-').slice(0, 30)}`, 22, 122);
    ctx.fillText(`Status : ${getPeranLabel(member.peranKeluarga)}`, 22, 142);

    // Wrap address into 2 lines
    const addr = member.alamat || '-';
    ctx.fillText(`Alamat : ${addr.slice(0, 32)}`, 22, 162);
    if (addr.length > 32) {
      ctx.fillText(`         ${addr.slice(32, 64)}`, 22, 178);
    }

    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`No. KK : ${member.noKk}  |  ID: ${member.id}`, 22, 206);

    ctx.fillStyle = '#0b5d34';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('✓ TERVERIFIKASI YAYASAN AL IKHLAS SEMBILAN SATU', 22, 226);

    // Photo box on right
    ctx.fillStyle = '#bbf7d0';
    ctx.fillRect(305, 68, 72, 92);
    ctx.strokeStyle = '#0b5d34';
    ctx.lineWidth = 2;
    ctx.strokeRect(305, 68, 72, 92);

    ctx.fillStyle = '#0b5d34';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    const initials = member.nama
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase() || '')
      .join('');
    ctx.fillText(initials || 'KT', 341, 122);

    return canvas.toDataURL('image/jpeg', 0.88);
  }

  // KK Preview
  canvas.width = 400;
  canvas.height = 250;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 400, 250);

  ctx.fillStyle = '#eff6ff';
  ctx.fillRect(8, 8, 384, 234);

  // Header
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(8, 8, 384, 48);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('KARTU KELUARGA (KK) REPUBLIK INDONESIA', 200, 28);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#93c5fd';
  ctx.fillText(`No. KK : ${member.noKk}`, 200, 46);

  // Body table box
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(20, 68, 360, 140);
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 68, 360, 140);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 12px sans-serif';
  const headName =
    member.namaKepalaKeluarga ||
    (member.peranKeluarga === 'kepala_keluarga' ? member.nama : member.nama);
  ctx.fillText(`Kepala Keluarga : ${headName.slice(0, 26)}`, 32, 92);

  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Anggota Terdaftar : ${member.nama.slice(0, 26)}`, 32, 114);
  ctx.fillText(`NIK Anggota       : ${member.nik}`, 32, 134);
  ctx.fillText(`Hubungan Keluarga : ${getPeranLabel(member.peranKeluarga)}`, 32, 154);

  const addr = member.alamat || '-';
  ctx.fillText(`Alamat Domisili   : ${addr.slice(0, 28)}`, 32, 174);
  if (addr.length > 28) {
    ctx.fillText(`                    ${addr.slice(28, 58)}`, 32, 190);
  }

  ctx.fillStyle = '#1d4ed8';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText(`✓ DOKUMEN KK KELUARGA TERDAFTAR (ID: ${member.id})`, 22, 226);

  return canvas.toDataURL('image/jpeg', 0.88);
}

/**
 * Converts any image source (base64 JPEG/PNG, SVG data URI, or URL) into a pure
 * base64 JPEG string (without the data:image/jpeg;base64, prefix) for ExcelJS.
 */
async function convertToExcelBase64Jpeg(
  sourceUrl: string | undefined,
  type: 'profil' | 'ktp' | 'kk',
  member: Member
): Promise<string> {
  const targetW = type === 'profil' ? 240 : 400;
  const targetH = type === 'profil' ? 300 : 250;

  if (sourceUrl && !sourceUrl.startsWith('data:application/pdf')) {
    try {
      const img = await loadImageElement(sourceUrl);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);

        // Calculate object-contain / object-cover fit
        const scale =
          type === 'profil'
            ? Math.max(targetW / (img.width || targetW), targetH / (img.height || targetH))
            : Math.min(targetW / (img.width || targetW), targetH / (img.height || targetH));
        const drawW = (img.width || targetW) * scale;
        const drawH = (img.height || targetH) * scale;
        const offsetX = (targetW - drawW) / 2;
        const offsetY = (targetH - drawH) / 2;

        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        // Draw subtle border
        ctx.strokeStyle = '#0b5d34';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, targetW - 2, targetH - 2);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      }
    } catch (err) {
      console.warn(`Fallback canvas render for ${type} of ${member.nama}:`, err);
    }
  }

  // Fallback to generated visual card if no image or failed load
  const fallbackDataUrl = generateDocumentPreviewDataUrl(type, member);
  return fallbackDataUrl.replace(/^data:image\/jpeg;base64,/, '');
}

/**
 * Exports all members to an official .xlsx Excel file with embedded images:
 * - Foto Profil / Diri
 * - Foto KTP / KIA
 * - Foto Kartu Keluarga (KK)
 * Plus all detailed member fields.
 */
export async function exportMembersToExcelWithImages(
  members: Member[],
  onProgress?: (status: string) => void
): Promise<void> {
  onProgress?.('Menyiapkan dokumen Excel (.xlsx)...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Yayasan Al Ikhlas Sembilan Satu';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Data Anggota Lengkap', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  // Define 19 columns
  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'id', width: 13 },
    { key: 'regNumber', width: 25 },
    { key: 'status', width: 16 },
    { key: 'peran', width: 18 },
    { key: 'kepalaKeluarga', width: 24 },
    { key: 'nama', width: 28 },
    { key: 'nik', width: 22 },
    { key: 'noKk', width: 22 },
    { key: 'ttl', width: 25 },
    { key: 'alamat', width: 38 },
    { key: 'noHp', width: 18 },
    { key: 'email', width: 25 },
    { key: 'jmlKeluarga', width: 14 },
    { key: 'tglDaftar', width: 18 },
    { key: 'tglDisetujui', width: 18 },
    { key: 'fotoProfil', width: 18 }, // Col 17 (0-idx 16)
    { key: 'fotoKtp', width: 28 },    // Col 18 (0-idx 17)
    { key: 'fotoKk', width: 28 },     // Col 19 (0-idx 18)
  ];

  // Row 1: Title Banner
  sheet.mergeCells('A1:S1');
  const titleRow = sheet.getRow(1);
  titleRow.height = 32;
  const titleCell = sheet.getCell('A1');
  titleCell.value =
    'DATA INDUK ANGGOTA & KELUARGA BESERTA FOTO PROFIL, KTP & KK — YAYASAN AL IKHLAS SEMBILAN SATU';
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0B5D34' },
  };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 2: Subtitle Info
  sheet.mergeCells('A2:S2');
  const subRow = sheet.getRow(2);
  subRow.height = 22;
  const subCell = sheet.getCell('A2');
  const nowFormatted = new Date().toLocaleString('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  subCell.value = `Diunduh pada: ${nowFormatted}  |  Total Data: ${members.length} Anggota (Termasuk Lampiran Foto Profil, Foto KTP/KIA, dan Foto Kartu Keluarga)`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF064E3B' } };
  subCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFECFDF5' },
  };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 3: Spacer
  sheet.getRow(3).height = 8;

  // Row 4: Table Headers
  const headerTitles = [
    'No',
    'ID Anggota',
    'No. Registrasi',
    'Status Verifikasi',
    'Hubungan Keluarga',
    'Nama Kepala Keluarga',
    'Nama Lengkap Sesuai KTP',
    'NIK (KTP / KIA)',
    'Nomor Kartu Keluarga (KK)',
    'Tempat & Tanggal Lahir',
    'Alamat Lengkap Domisili',
    'No. HP / WhatsApp',
    'Alamat Email',
    'Jml Keluarga',
    'Tanggal Daftar',
    'Tanggal Disetujui',
    'Foto Profil / Diri',
    'Foto KTP / KIA',
    'Foto Kartu Keluarga (KK)',
  ];

  const headerRow = sheet.getRow(4);
  headerRow.height = 30;
  headerTitles.forEach((title, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = title;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B5D34' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD4AF37' } },
      bottom: { style: 'medium', color: { argb: 'FFD4AF37' } },
      left: { style: 'thin', color: { argb: 'FF166534' } },
      right: { style: 'thin', color: { argb: 'FF166534' } },
    };
  });

  // Populate each member row and embed the 3 photos
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const rowNumber = 5 + i;
    onProgress?.(`Memproses data & foto (${i + 1}/${members.length}): ${m.nama}...`);

    const row = sheet.getRow(rowNumber);
    row.height = 96; // ~128px height so photos fit cleanly

    const statusLabel =
      m.status === 'disetujui'
        ? 'DISETUJUI'
        : m.status === 'ditolak'
        ? 'DITOLAK'
        : 'MENUNGGU ACC';

    const headName =
      m.namaKepalaKeluarga || (m.peranKeluarga === 'kepala_keluarga' ? m.nama : '-');

    const tglDaftar = m.tanggalDaftar
      ? new Date(m.tanggalDaftar).toLocaleDateString('id-ID')
      : '-';
    const tglDisetujui = m.tanggalDisetujui
      ? new Date(m.tanggalDisetujui).toLocaleDateString('id-ID')
      : '-';

    const rowValues = [
      i + 1,
      m.id,
      m.regNumber || '-',
      statusLabel,
      getPeranLabel(m.peranKeluarga),
      headName,
      m.nama,
      m.nik,
      m.noKk,
      m.tempatTanggalLahir || '-',
      m.alamat || '-',
      m.noHp || '-',
      m.email || '-',
      m.peranKeluarga === 'kepala_keluarga' ? m.jumlahKeluarga ?? 1 : '-',
      tglDaftar,
      tglDisetujui,
      '', // Foto Profil placeholder cell (image embedded)
      '', // Foto KTP placeholder cell (image embedded)
      '', // Foto KK placeholder cell (image embedded)
    ];

    const isEven = i % 2 === 1;
    const rowBg = isEven ? 'FFF8FAF9' : 'FFFFFFFF';

    rowValues.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: colIdx === 1 || colIdx === 6,
        color: { argb: 'FF1F2937' },
      };

      // Status color styling
      if (colIdx === 3) {
        if (m.status === 'disetujui') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        } else if (m.status === 'ditolak') {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF991B1B' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        } else {
          cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF92400E' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
        }
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      }

      // Format NIK, KK, HP as text
      if (colIdx === 7 || colIdx === 8 || colIdx === 11) {
        cell.numFmt = '@';
      }

      cell.alignment = {
        vertical: 'middle',
        horizontal:
          colIdx === 0 || colIdx === 1 || colIdx === 3 || colIdx === 13 || colIdx >= 14
            ? 'center'
            : 'left',
        wrapText: true,
      };

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });

    // Convert & Embed the 3 Images (Foto Profil, Foto KTP, Foto KK)
    const [profilBase64, ktpBase64, kkBase64] = await Promise.all([
      convertToExcelBase64Jpeg(m.fotoUrl, 'profil', m),
      convertToExcelBase64Jpeg(m.ktpUrl, 'ktp', m),
      convertToExcelBase64Jpeg(m.kkUrl, 'kk', m),
    ]);

    if (profilBase64) {
      const profilImgId = workbook.addImage({
        base64: profilBase64,
        extension: 'jpeg',
      });
      sheet.addImage(profilImgId, {
        tl: { col: 16.12, row: rowNumber - 1 + 0.07 } as any,
        ext: { width: 88, height: 110 },
        editAs: 'oneCell',
      });
    }

    if (ktpBase64) {
      const ktpImgId = workbook.addImage({
        base64: ktpBase64,
        extension: 'jpeg',
      });
      sheet.addImage(ktpImgId, {
        tl: { col: 17.08, row: rowNumber - 1 + 0.07 } as any,
        ext: { width: 176, height: 110 },
        editAs: 'oneCell',
      });
    }

    if (kkBase64) {
      const kkImgId = workbook.addImage({
        base64: kkBase64,
        extension: 'jpeg',
      });
      sheet.addImage(kkImgId, {
        tl: { col: 18.08, row: rowNumber - 1 + 0.07 } as any,
        ext: { width: 176, height: 110 },
        editAs: 'oneCell',
      });
    }
  }

  onProgress?.('Menyusun file Excel (.xlsx) untuk diunduh...');
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.download = `Data_Anggota_Lengkap_Foto_KTP_KK_Yayasan_Al_Ikhlas_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Exports Activity Attendance (Daftar Hadir) to .xlsx Excel complete with Member Photos, KTP, and KK.
 */
export async function exportAttendanceToExcelWithImages(
  activity: Activity,
  allMembers: Member[],
  onProgress?: (status: string) => void
): Promise<void> {
  onProgress?.('Menyiapkan Excel Daftar Hadir Kegiatan...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Yayasan Al Ikhlas Sembilan Satu';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Daftar Hadir Kegiatan', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  sheet.columns = [
    { key: 'no', width: 6 },
    { key: 'memberId', width: 14 },
    { key: 'nama', width: 28 },
    { key: 'nik', width: 22 },
    { key: 'peran', width: 18 },
    { key: 'noHp', width: 18 },
    { key: 'alamat', width: 34 },
    { key: 'jamHadir', width: 22 },
    { key: 'kegiatan', width: 28 },
    { key: 'jenis', width: 18 },
    { key: 'fotoProfil', width: 18 }, // Col 11 (0-idx 10)
    { key: 'fotoKtp', width: 28 },    // Col 12 (0-idx 11)
    { key: 'fotoKk', width: 28 },     // Col 13 (0-idx 12)
  ];

  const typeLabel = getActivityTypeLabel(activity.jenis);

  sheet.mergeCells('A1:M1');
  const titleRow = sheet.getRow(1);
  titleRow.height = 30;
  const titleCell = sheet.getCell('A1');
  titleCell.value = `DAFTAR HADIR KEGIATAN: ${activity.judul.toUpperCase()} (${typeLabel.toUpperCase()})`;
  titleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5D34' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.mergeCells('A2:M2');
  const subRow = sheet.getRow(2);
  subRow.height = 20;
  const subCell = sheet.getCell('A2');
  subCell.value = `Tanggal: ${activity.tanggal} | Jam: ${activity.jamMulai} WITA | Total Hadir: ${activity.kehadiran.length} Orang`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF064E3B' } };
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.getRow(3).height = 8;

  const headers = [
    'No',
    'ID Anggota',
    'Nama Lengkap',
    'NIK (KTP / KIA)',
    'Hubungan Keluarga',
    'No. HP / WA',
    'Alamat Domisili',
    'Waktu Absen Hadir',
    'Judul Kegiatan',
    'Jenis Kegiatan',
    'Foto Profil / Diri',
    'Foto KTP / KIA',
    'Foto Kartu Keluarga (KK)',
  ];

  const headerRow = sheet.getRow(4);
  headerRow.height = 28;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5D34' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  for (let i = 0; i < activity.kehadiran.length; i++) {
    const k = activity.kehadiran[i];
    const rowNumber = 5 + i;
    const matchedMember =
      allMembers.find((m) => m.id === k.memberId || m.nik === k.memberNik) ||
      ({
        id: k.memberId,
        nama: k.memberNama,
        nik: k.memberNik,
        noKk: '-',
        peranKeluarga: (k.memberPeran as any) || 'kepala_keluarga',
        alamat: '-',
        noHp: '-',
        tempatTanggalLahir: '-',
        fotoUrl: k.memberFotoUrl,
        status: 'disetujui',
        tanggalDaftar: '',
      } as Member);

    onProgress?.(`Memproses daftar hadir (${i + 1}/${activity.kehadiran.length}): ${k.memberNama}...`);

    const row = sheet.getRow(rowNumber);
    row.height = 96;

    const vals = [
      i + 1,
      k.memberId,
      k.memberNama,
      k.memberNik,
      getPeranLabel((k.memberPeran as any) || 'kepala_keluarga'),
      matchedMember.noHp || '-',
      matchedMember.alamat || '-',
      k.scanTimeFormatted,
      activity.judul,
      typeLabel,
      '',
      '',
      '',
    ];

    vals.forEach((v, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = v;
      cell.font = { name: 'Arial', size: 10 };
      if (colIdx === 3 || colIdx === 5) cell.numFmt = '@';
      cell.alignment = {
        vertical: 'middle',
        horizontal: colIdx === 0 || colIdx === 1 || colIdx >= 10 ? 'center' : 'left',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });

    const [profilBase64, ktpBase64, kkBase64] = await Promise.all([
      convertToExcelBase64Jpeg(matchedMember.fotoUrl || k.memberFotoUrl, 'profil', matchedMember),
      convertToExcelBase64Jpeg(matchedMember.ktpUrl, 'ktp', matchedMember),
      convertToExcelBase64Jpeg(matchedMember.kkUrl, 'kk', matchedMember),
    ]);

    if (profilBase64) {
      const imgId = workbook.addImage({ base64: profilBase64, extension: 'jpeg' });
      sheet.addImage(imgId, {
        tl: { col: 10.12, row: rowNumber - 1 + 0.07 } as any,
        ext: { width: 88, height: 110 },
        editAs: 'oneCell',
      });
    }
    if (ktpBase64) {
      const imgId = workbook.addImage({ base64: ktpBase64, extension: 'jpeg' });
      sheet.addImage(imgId, {
        tl: { col: 11.08, row: rowNumber - 1 + 0.07 } as any,
        ext: { width: 176, height: 110 },
        editAs: 'oneCell',
      });
    }
    if (kkBase64) {
      const imgId = workbook.addImage({ base64: kkBase64, extension: 'jpeg' });
      sheet.addImage(imgId, {
        tl: { col: 12.08, row: rowNumber - 1 + 0.07 } as any,
        ext: { width: 176, height: 110 },
        editAs: 'oneCell',
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanTitle = activity.judul.replace(/\s+/g, '_').slice(0, 30);
  link.download = `Daftar_Hadir_Lengkap_Foto_${cleanTitle}_${activity.tanggal}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
