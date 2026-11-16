import { IllosUploadDropzone } from "@/components/ui/illos-upload-dropzone";

export default function Demo() {
  return (
    <div className="flex min-h-[640px] w-full items-center justify-center bg-background p-6">
      <IllosUploadDropzone className="max-w-xl" accept="image/*,.pdf" />
    </div>
  );
}
