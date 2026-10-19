import React from 'react';
import { X, ExternalLink, Download, FileText } from 'lucide-react';

interface DocumentViewerModalProps {
  title: string;
  url?: string;
  fileName?: string;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  title,
  url,
  fileName,
  onClose,
}) => {
  if (!url) return null;

  const isPdf = url.includes('application/pdf') || fileName?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-900 text-white">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-400" />
            <span className="text-sm font-semibold truncate">{title} · {fileName || 'Dokumen'}</span>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1 rounded-full hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-stone-100 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
          {isPdf ? (
            <iframe
              src={url}
              title={title}
              className="w-full h-[500px] rounded-lg border border-gray-300"
            />
          ) : (
            <img
              src={url}
              alt={title}
              className="max-h-[500px] w-auto max-w-full rounded-lg object-contain shadow-sm border border-gray-200 bg-white"
            />
          )}
        </div>

        <div className="p-3.5 bg-white border-t border-gray-100 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-500 truncate">{fileName || title}</span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={fileName || 'dokumen.png'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh</span>
            </a>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#83141a] hover:bg-[#6c1015] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
