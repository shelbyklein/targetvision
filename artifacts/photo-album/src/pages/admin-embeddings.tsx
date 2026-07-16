import { AdminSectionShell } from "@/components/admin/AdminSectionShell";
import { EmbeddingsSection } from "@/components/admin/EmbeddingsSection";
import { Braces } from "lucide-react";

export default function AdminEmbeddingsPage() {
  return (
    <AdminSectionShell title="Embeddings" icon={Braces}>
      <EmbeddingsSection />
    </AdminSectionShell>
  );
}
