import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { ImageOptimizationSection } from "@/components/admin/ImageOptimizationSection";
import { ImageDown } from "lucide-react";

export default function AdminImageOptimizationPage() {
  return (
    <AdminSectionShell title="Image Optimization" icon={ImageDown}>
      <ImageOptimizationSection />
    </AdminSectionShell>
  );
}
