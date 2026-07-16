import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { AiServicesSection } from "@/components/admin/AiServicesSection";
import { Bot } from "lucide-react";

export default function AdminAiServicesPage() {
  return (
    <AdminSectionShell title="AI Services" icon={Bot}>
      <AiServicesSection />
    </AdminSectionShell>
  );
}
