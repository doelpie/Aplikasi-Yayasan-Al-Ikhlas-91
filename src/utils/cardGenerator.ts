import { Member } from '../types';
import { formatIndonesianDate, getInitials, maskPhoneNumber } from './storage';

/**
 * Generates and downloads high-resolution PNG of the Member Card
 * matching screenshot IMG-20261018-WA0016.jpg
 */
export function downloadMemberCardImage(member: Member): void {
  const canvas = document.createElement('canvas');
  const width = 1000;
  const height = 620;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Top Crimson Header Bar
  const headerHeight = 130;
  ctx.fillStyle = '#83141a'; // Deep maroon red
  ctx.fillRect(0, 0, width, headerHeight);

  // Logo circle "AI"
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(75, 65, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#83141a';
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AI', 75, 66);
  ctx.restore();

  // Header Texts
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Yayasan Al Ikhlas Sembilan Satu', 135, 52);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Jl. Raya Dalung No. 91 Br. Kaja - Dalung', 135, 80);

  ctx.font = '500 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Kartu Anggota Keluarga', 135, 104);

  // Left Monogram Box
  const boxX = 55;
  const boxY = 165;
  const boxSize = 220;
  
  ctx.fillStyle = '#fceeee';
  ctx.fillRect(boxX, boxY, boxSize, boxSize);

  ctx.fillStyle = '#83141a';
  ctx.font = 'bold 96px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getInitials(member.nama), boxX + boxSize / 2, boxY + boxSize / 2);

  // Right Details
  const contentX = 315;
  let currentY = 185;

  // 1. Nama Kepala Keluarga
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NAMA KEPALA KELUARGA', contentX, currentY);

  currentY += 30;
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(member.nama, contentX, currentY);

  // 2. Alamat
  currentY += 42;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ALAMAT', contentX, currentY);

  currentY += 25;
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  
  // Wrap address if long
  const maxWidth = 630;
  const words = member.alamat.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), contentX, currentY);
      line = words[n] + ' ';
      currentY += 24;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), contentX, currentY);

  // 3. Jumlah Keluarga
  currentY += 38;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('JUMLAH KELUARGA', contentX, currentY);

  currentY += 25;
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${member.jumlahKeluarga} orang`, contentX, currentY);

  // 4. No Telp / HP
  currentY += 36;
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('NO. TELP / HP', contentX, currentY);

  currentY += 25;
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(maskPhoneNumber(member.noHp), contentX, currentY);

  // Footer divider line
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(55, 520);
  ctx.lineTo(width - 55, 520);
  ctx.stroke();

  // Footer Metadata
  ctx.fillStyle = '#4b5563';
  ctx.font = '500 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`ID Anggota: ${member.id}`, 55, 546);

  const printDate = formatIndonesianDate(member.tanggalDisetujui);
  ctx.textAlign = 'right';
  ctx.fillText(`Dicetak: ${printDate}`, width - 55, 546);

  // Red accent line
  ctx.fillStyle = '#83141a';
  ctx.fillRect(55, 560, width - 110, 4);

  // Subtext
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6b7280';
  ctx.font = '13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Kartu ini merupakan bukti keanggotaan resmi Yayasan Al Ikhlas Sembilan Satu', width / 2, 588);

  // Trigger download
  const link = document.createElement('a');
  link.download = `Kartu_Anggota_${member.id}_${member.nama.replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
