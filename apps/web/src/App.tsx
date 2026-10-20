import { Navigate, Route, Routes } from "react-router-dom";
import { ActivityView } from "./ui/ActivityView";
import { AllowlistView } from "./ui/AllowlistView";
import { Overview } from "./ui/Overview";
import { Shell } from "./ui/Shell";
import { VaultView } from "./ui/VaultView";

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/vault" element={<VaultView />} />
        <Route path="/allowlist" element={<AllowlistView />} />
        <Route path="/activity" element={<ActivityView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
