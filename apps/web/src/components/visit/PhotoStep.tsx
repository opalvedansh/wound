"use client"
import { useEffect, useRef, useState } from "react";
import { Camera, EyeOff, RotateCcw, Sun, Smartphone, Square } from "lucide-react";
import { Button } from "../ui/button";
import { preparePhoto } from "../../lib/photo";

const TIPS = [
  { icon: Square, text: "Stick the printed calibration sticker flat on the skin beside the wound, never on it. Without it the size can't be measured." },
  { icon: Smartphone, text: "Hold the phone parallel to the skin, 30–40 cm away, with the whole sticker and wound in the frame." },
  { icon: Sun, text: "Use room light or daylight. No flash: it causes glare on wet wounds." },
  { icon: EyeOff, text: "Keep faces, tattoos and jewellery out of the photo." },
];

/** Guide card, then the rear camera (or a file on a computer), a preview, and Retake / Use photo. */
export function PhotoStep({
  photo,
  onPhoto,
  issues,
}: {
  photo: Blob | null;
  onPhoto: (photo: Blob | null) => void;
  /** Why the last photo was refused (quality gate), shown above the camera button. */
  issues?: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!photo) return setPreview(undefined);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setProblem(undefined);
    try {
      onPhoto(await preparePhoto(file));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "The photo couldn't be prepared.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {issues && issues.length > 0 && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Please retake the photo</p>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {preview ? (
        <div className="flex flex-col gap-3">
          <img src={preview} alt="The wound photo to analyse" className="w-full max-h-[60vh] object-contain rounded-2xl bg-black/5" />
          <Button type="button" variant="outline" className="self-start" onClick={() => input.current?.click()}>
            <RotateCcw className="w-4 h-4 mr-2" /> Retake
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 bg-surface-alt p-5 dark:border-white/10">
          <p className="text-sm font-semibold mb-3">Before you take the photo</p>
          <ul className="space-y-3">
            {TIPS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm">
                <Icon className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
          <Button type="button" className="mt-5" disabled={busy} onClick={() => input.current?.click()}>
            <Camera className="w-4 h-4 mr-2" /> {busy ? "Preparing…" : "Take photo"}
          </Button>
        </div>
      )}

      {/* `capture` opens the rear camera on phones; on a computer it is a normal file picker. */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Wound photo"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      {problem && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}
