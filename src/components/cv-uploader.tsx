import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { uploadAndExtractCV } from "@/lib/profile.functions";
import type { UserProfile } from "@/lib/profile.functions";

interface CVUploaderProps {
  currentProfile: UserProfile | null;
  onSuccess: (profile: UserProfile) => void;
}

const ACCEPTED_TYPES = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};
const MAX_SIZE_MB = 10;

export function CVUploader({ currentProfile, onSuccess }: CVUploaderProps) {
  const uploadFn = useServerFn(uploadAndExtractCV);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "extracting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  async function handleFile(file: File) {
    if (!Object.keys(ACCEPTED_TYPES).includes(file.type)) {
      setError("Please upload a PDF or DOCX file.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB} MB.`);
      return;
    }

    setError(null);
    setStatus("uploading");
    setProgress(20);

    try {
      // Read file as base64
      const base64 = await readFileAsBase64(file);
      setProgress(40);
      setStatus("extracting");

      const result = await uploadFn({
        data: {
          fileBase64: base64,
          fileName: file.name,
          mimeType: file.type,
        },
      });

      setProgress(100);

      if (result.success && result.profile) {
        setStatus("done");
        qc.invalidateQueries({ queryKey: ["profile"] });
        qc.invalidateQueries({ queryKey: ["recommendations"] });
        onSuccess(result.profile);
      } else {
        setStatus("error");
        setError(result.error ?? "Upload failed. Please try again.");
      }
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Unexpected error during upload.");
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const hasCV = !!currentProfile?.cv_filename;
  const isLoading = status === "uploading" || status === "extracting";

  return (
    <div className="space-y-4">
      {/* Current CV indicator */}
      {hasCV && status !== "done" && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {currentProfile.cv_filename}
            </div>
            <div className="text-xs text-muted-foreground">
              Uploaded {new Date(currentProfile.updated_at).toLocaleDateString()}
            </div>
          </div>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !isLoading && inputRef.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-primary bg-primary/10"
            : isLoading
            ? "cursor-not-allowed border-border bg-surface/30"
            : "border-border bg-surface/50 hover:border-primary/50 hover:bg-primary/5"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="sr-only"
          onChange={onInputChange}
          disabled={isLoading}
        />

        {isLoading ? (
          <>
            <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">
                {status === "uploading" ? "Uploading your CV…" : "Extracting CV data with AI…"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {status === "extracting"
                  ? "Claude is reading your resume. This takes ~10 seconds."
                  : "Sending file to Supabase Storage…"}
              </div>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : status === "done" ? (
          <>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">CV processed successfully!</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Click to replace with a different file.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <div className="font-semibold text-foreground">
                {hasCV ? "Replace your CV" : "Upload your CV"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                Drag & drop or click — PDF or DOCX, up to {MAX_SIZE_MB} MB
              </div>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
