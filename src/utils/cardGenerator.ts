import { Member } from '../types';
import { formatIndonesianDate, getInitials, getPeranLabel, maskNik, maskPhoneNumber } from './storage';

/**
 * Generates and downloads high-resolution PNG of the Member Card
 * with authentic Hijau NU theme and photo portrait integration
 */
export async function downloadMemberCardImage(member: Member): Promise<void> {
  const canvas = document.createElement('canvas');
  const width = 1000;
  const height = 630;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Top NU Green Header Bar (#0b5d34)
  const headerHeight = 135;
  ctx.fillStyle = '#0b5d34';
  ctx.fillRect(0, 0, width, headerHeight);

  // Gold accent strip below header
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(0, headerHeight, width, 5);

  // Logo circle
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(75, 68, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0b5d34';
  ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AI', 75, 69);
  ctx.restore();

  // Header Titles
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Yayasan Al Ikhlas Sembilan Satu', 135, 52);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Jl. Raya Dalung No. 91 Br. Kaja - Dalung, Badung - Bali', 135, 78);

  // Role tag in header
  const roleLabel = getPeranLabel(member.peranKeluarga).toUpperCase();
  ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#fef08a'; // gold text
  ctx.fillText(`KARTU ANGGOTA KELUARGA · ${roleLabel}`, 135, 105);

  // Photo Box (Left side)
  const boxX = 55;
  const boxY = 175;
  const boxW = 210;
  const boxH = 265;

  // Border frame for photo
  ctx.fillStyle = '#e8f5e9';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#0b5d34';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // Load and render photo if available
  let photoDrawn = false;
  if (member.fotoUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = member.fotoUrl!;
      });
      // Draw image clipped inside box
      ctx.save();
      ctx.beginPath();
      ctx.rect(boxX + 2, boxY + 2, boxW - 4, boxH - 4);
      ctx.clip();
      ctx.drawImage(img, boxX, boxY, boxW, boxH);
      ctx.restore();
      photoDrawn = true;
    } catch (e) {
      photoDrawn = false;
    }
  }

  // Fallback monogram if photo couldn't load
  if (!photoDrawn) {
    ctx.fillStyle = '#0b5d34';
    ctx.font = 'bold 88px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(member.nama), boxX + boxW / 2, boxY + boxH / 2);
  }

  // Right Details
  const contentX = 300;
  let currentY = 195;

  // 1. Status Hubungan Keluarga Badge
  ctx.fillStyle = '#0b5d34';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`STATUS: ${roleLabel}`, contentX, currentY);

  // 2. Nama Sesuai KTP
  currentY += 28;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NAMA LENGKAP (SESUAI KTP)', contentX, currentY);

  currentY += 26;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(member.nama, contentX, currentY);

  // 3. No. KTP / NIK (or KIA)
  currentY += 34;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  const idLabel = member.peranKeluarga === 'anak' ? 'NOMOR IDENTITAS (NIK / KIA)' : 'NOMOR INDUK KEPENDUDUKAN (NIK)';
  ctx.fillText(idLabel, contentX, currentY);

  currentY += 22;
  ctx.fillStyle = '#0b5d34';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(maskNik(member.nik), contentX, currentY);

  // 4. No. Kartu Keluarga (KK)
  currentY += 32;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NOMOR KARTU KELUARGA (KK)', contentX, currentY);

  currentY += 22;
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 17px monospace';
  ctx.fillText(member.noKk || '-', contentX, currentY);

  // 5. Alamat Lengkap
  currentY += 32;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ALAMAT DOMISILI', contentX, currentY);

  currentY += 22;
  ctx.fillStyle = '#1e293b';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  
  // Wrap address
  const maxWidth = 640;
  const words = member.alamat.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), contentX, currentY);
      line = words[n] + ' ';
      currentY += 20;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), contentX, currentY);

  // 6. No HP / WA
  currentY += 28;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NO. HP / WHATSAPP: ' + maskPhoneNumber(member.noHp), contentX, currentY);

  // Footer separator
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(55, 540);
  ctx.lineTo(width - 55, 540);
  ctx.stroke();

  // Footer Metadata
  ctx.fillStyle = '#475569';
  ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`ID Anggota: ${member.id}`, 55, 565);

  const printDate = formatIndonesianDate(member.tanggalDisetujui);
  ctx.textAlign = 'right';
  ctx.fillText(`Dicetak: ${printDate}`, width - 55, 565);

  // Hijau NU bottom bar
  ctx.fillStyle = '#0b5d34';
  ctx.fillRect(55, 580, width - 110, 4);

  // Gold sub-bar
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(55, 584, width - 110, 2);

  // Footnote
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Kartu ini merupakan bukti keanggotaan resmi Yayasan Al Ikhlas Sembilan Satu', width / 2, 608);

  // Download trigger
  const link = document.createElement('a');
  link.download = `Kartu_Anggota_NU_${member.id}_${member.nama.replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
