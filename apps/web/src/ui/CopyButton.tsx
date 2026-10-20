import { useState } from "react";

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn ghost tiny"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1200);
          },
          () => setDone(false),
        );
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
