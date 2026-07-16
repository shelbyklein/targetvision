import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { ThumbnailsSection } from "@/components/admin/ThumbnailsSection";
import { ImageIcon } from "lucide-react";

export default function AdminThumbnailsPage() {
  return (
    <AdminSectionShell title="Thumbnails" icon={ImageIcon}>
      <ThumbnailsSection />
    </AdminSectionShell>
  );
}
