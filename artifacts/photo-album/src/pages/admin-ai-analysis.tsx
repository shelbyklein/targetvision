import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { AiAnalysisBackfillSection } from "@/components/admin/AiAnalysisBackfillSection";
import { Sparkles } from "lucide-react";

export default function AdminAiAnalysisPage() {
  return (
    <AdminSectionShell title="AI Analysis" icon={Sparkles}>
      <AiAnalysisBackfillSection />
    </AdminSectionShell>
  );
}
