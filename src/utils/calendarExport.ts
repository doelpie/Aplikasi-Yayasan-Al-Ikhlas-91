import { Activity } from '../types';

/**
 * Format string date & time ke format iCalendar UTC/Local: YYYYMMDDTHHMMSS
 */
function formatIcsDateTime(dateStr: string, timeStr: string = '08:00'): string {
  // dateStr: YYYY-MM-DD, timeStr: HH:mm
  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = timeStr.replace(/:/g, '') + '00';
  return `${cleanDate}T${cleanTime}`;
}

/**
 * Sanitasi string untuk format file .ics
 */
function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate string konten .ICS untuk satu atau beberapa kegiatan
 */
export function generateIcsContent(activities: Activity[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  const events = activities.map((act) => {
    const dtStart = formatIcsDateTime(act.tanggal, act.jamMulai || '08:00');
    // Jika ada jam selesai gunakan itu, jika tidak tambah 2 jam dari jamMulai
    let dtEnd: string;
    if (act.jamSelesai) {
      dtEnd = formatIcsDateTime(act.tanggal, act.jamSelesai);
    } else {
      const [h, m] = (act.jamMulai || '08:00').split(':').map(Number);
      const endH = String(Math.min(23, h + 2)).padStart(2, '0');
      dtEnd = formatIcsDateTime(act.tanggal, `${endH}:${String(m).padStart(2, '0')}`);
    }

    const jenisLabel = act.jenis === 'rapat_pengurus' 
      ? 'Rapat Pengurus' 
      : act.jenis === 'pengajian_umum' 
        ? 'Pengajian Umum' 
        : 'Arisan';

    const description = `Jenis: ${jenisLabel}\\nDeskripsi: ${act.deskripsi || '-'}\\n\\nYayasan Al Ikhlas Sembilan Satu Dalung Bali`;
    const location = act.lokasi || 'Gedung Yayasan Al Ikhlas Sembilan Satu, Dalung, Kuta Utara, Badung, Bali';

    return [
      'BEGIN:VEVENT',
      `UID:${act.id}-${now}@alikhlas91dalung.org`,
      `DTSTAMP:${now}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcsText(act.judul)} [${jenisLabel}]`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(location)}`,
      'STATUS:CONFIRMED',
      'ORGANIZER;CN=Yayasan Al Ikhlas Sembilan Satu:mailto:alikhlas91dalung@gmail.com',
      'END:VEVENT'
    ].join('\r\n');
  }).join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Yayasan Al Ikhlas Sembilan Satu//Kegiatan Kalender//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Kegiatan Yayasan Al Ikhlas Sembilan Satu',
    'X-WR-TIMEZONE:Asia/Makassar',
    events,
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Download file .ICS universal ke browser
 */
export function downloadIcsFile(activities: Activity[], filenamePrefix = 'Kalender_Kegiatan_Yayasan_Al-Ikhlas'): void {
  if (!activities || activities.length === 0) {
    alert('Tidak ada kegiatan yang dapat diexport.');
    return;
  }

  const icsData = generateIcsContent(activities);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Buat link Google Calendar web (membuka langsung form tambah jadwal Google Calendar)
 */
export function getGoogleCalendarUrl(activity: Activity): string {
  const dtStart = formatIcsDateTime(activity.tanggal, activity.jamMulai || '08:00');
  let dtEnd: string;
  if (activity.jamSelesai) {
    dtEnd = formatIcsDateTime(activity.tanggal, activity.jamSelesai);
  } else {
    const [h, m] = (activity.jamMulai || '08:00').split(':').map(Number);
    const endH = String(Math.min(23, h + 2)).padStart(2, '0');
    dtEnd = formatIcsDateTime(activity.tanggal, `${endH}:${String(m).padStart(2, '0')}`);
  }

  const jenisLabel = activity.jenis === 'rapat_pengurus' 
    ? 'Rapat Pengurus' 
    : activity.jenis === 'pengajian_umum' 
      ? 'Pengajian Umum' 
      : 'Arisan';

  const title = encodeURIComponent(`${activity.judul} [${jenisLabel}]`);
  const details = encodeURIComponent(
    `Kegiatan: ${activity.judul}\nJenis: ${jenisLabel}\nDeskripsi: ${activity.deskripsi || '-'}\n\nYayasan Al Ikhlas Sembilan Satu Dalung`
  );
  const location = encodeURIComponent(activity.lokasi || 'Yayasan Al Ikhlas Sembilan Satu, Dalung, Badung, Bali');
  
  // Format dates: YYYYMMDDTHHmmSS/YYYYMMDDTHHmmSS
  const dates = `${dtStart}/${dtEnd}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}
