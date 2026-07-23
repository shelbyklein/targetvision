import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { RegistrationSection } from "@/components/admin/RegistrationSection";
import { UserPlus } from "lucide-react";

export default function AdminRegistrationPage() {
  return (
    <AdminSectionShell title="Registration" scope="platform" icon={UserPlus}>
      <RegistrationSection />
    </AdminSectionShell>
  );
}
