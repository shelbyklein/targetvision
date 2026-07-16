import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { CapturedDatesSection } from "@/components/admin/CapturedDatesSection";
import { CalendarDays } from "lucide-react";

export default function AdminCapturedDatesPage() {
  return (
    <AdminSectionShell title="Captured Dates" icon={CalendarDays}>
      <CapturedDatesSection />
    </AdminSectionShell>
  );
}
