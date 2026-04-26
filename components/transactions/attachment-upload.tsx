"use client";

import { useRef, useState } from "react";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export interface PendingAttachment {
  file: File;
  previewUrl: string | null; // object URL for image previews
}

interface AttachmentUploadProps {
  attachments: PendingAttachment[];
  onChange: (next: PendingAttachment[]) => void;
}

export function AttachmentUpload({ attachments, onChange }: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);

    const valid: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_MIME.includes(file.type)) {
        setError(`"${file.name}" is not a supported file type (images or PDF only)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" is larger than 5 MB`);
        continue;
      }
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      valid.push({ file, previewUrl });
    }

    if (valid.length > 0) {
      onChange([...attachments, ...valid]);
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(index: number) {
    const next = attachments.slice();
    const [removed] = next.splice(index, 1);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Receipts &amp; Proof{" "}
          <span className="text-slate-400 font-normal">(optional)</span>
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          <Upload className="w-3.5 h-3.5" /> Add File
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_MIME.join(",")}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {error && <p className="text-xs text-red-500">{error}</p>}

      {attachments.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
        >
          <Upload className="w-6 h-6 mx-auto text-slate-400 mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click to upload screenshots or PDF receipts
          </p>
          <p className="text-xs text-slate-400 mt-1">
            JPG / PNG / WEBP / GIF / PDF — max 5 MB each
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="relative group border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800"
            >
              {att.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={att.previewUrl}
                  alt={att.file.name}
                  className="w-full h-24 object-cover"
                />
              ) : (
                <div className="w-full h-24 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
              )}
              <div className="p-1.5 text-xs">
                <p className="truncate text-slate-700 dark:text-slate-300" title={att.file.name}>
                  {att.file.name}
                </p>
                <p className="text-slate-400">
                  {(att.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute top-1 right-1 p-1 bg-white/90 dark:bg-slate-900/90 rounded-full text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Read-only display for already-saved attachments (used in transaction table)
interface SavedAttachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
}

interface AttachmentListProps {
  attachments: SavedAttachment[];
  signedUrls: Record<string, string>; // attachment id → signed URL
}

export function AttachmentList({ attachments, signedUrls }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
      {attachments.map((att) => {
        const url = signedUrls[att.id];
        const isImage = att.mime_type?.startsWith("image/");
        return (
          <a
            key={att.id}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block border border-slate-200 dark:border-slate-700 rounded overflow-hidden hover:border-blue-400 transition-colors"
            title={att.file_name}
          >
            {isImage && url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={att.file_name} className="w-full h-20 object-cover" />
            ) : (
              <div className="w-full h-20 flex items-center justify-center bg-slate-50 dark:bg-slate-800">
                {isImage ? (
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                ) : (
                  <FileText className="w-6 h-6 text-slate-400" />
                )}
              </div>
            )}
            <p className="text-xs truncate p-1 text-slate-600 dark:text-slate-300">
              {att.file_name}
            </p>
          </a>
        );
      })}
    </div>
  );
}
