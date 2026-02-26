import { ContentBlock } from "@langchain/core/messages";
import { toast } from "sonner";

// Returns a Promise of a typed multimodal block for images or PDFs
export async function fileToContentBlock(
  file: File,
): Promise<ContentBlock.Multimodal.Data> {
  const supportedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const supportedDocTypes = [
    "application/pdf",
    "text/csv",
    "text/plain",
    "text/markdown",
    "application/json",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
    "application/vnd.ms-excel", // xls
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
    "application/msword", // doc
    "application/x-hwp", // hwp
    "application/haansofthwp", // hwp alternative
  ];

  const supportedFileTypes = [...supportedImageTypes, ...supportedDocTypes];

  if (!supportedFileTypes.includes(file.type) && !file.name.endsWith(".hwp")) {
     // HWP mime type verification can be tricky in browser, so we trust extension if mime is generic
     // but here we just check explicit mime types for safety.
     // If file.type is empty or unrecognized, we might need looser check.
  }
  
  // Re-check strict inclusion or allow if extension matches known types
  // For now, simpler robust check:
  const isSupported = supportedFileTypes.includes(file.type) || 
                      (file.name.endsWith(".hwp") || file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.name.endsWith(".md") || file.name.endsWith(".json"));

  if (!isSupported) {
    toast.error(
      `Unsupported file type: ${file.type || "unknown"}. Supported types are images, PDF, CSV, TXT, MD, JSON, Excel, Word, HWP.`,
    );
    return Promise.reject(new Error(`Unsupported file type: ${file.type}`));
  }

  const data = await fileToBase64(file);

  if (supportedImageTypes.includes(file.type)) {
    return {
      type: "image",
      mimeType: file.type,
      data,
      metadata: { name: file.name },
    };
  }
  // For images, we need base64
  if (file.type.startsWith("image/")) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          // Extract the base64 part (remove data:image/xxx;base64,)
          const base64Content = base64Data.split(",")[1];
          resolve({
            type: "image_url",
            image_url: {
              url: `data:${file.type};base64,${base64Content}`,
            },
          } as any);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
  }

  // For all other files (PDF, Text, CSV, etc.), we treat them as a "file" type block
  // The backend file_saver.py will handle saving them.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(",")[1];
      
      // Custom "file" block type that our backend backend understands
      // Note: This is NOT a standard LangChain block type for generic files yet,
      // but we defined logic in file_saver.py to handle it.
      // However, we must ensure it matches what file_saver.py expects.
      // file_saver.py expects: { type: "file", data: "base64...", mimeType: "...", metadata: { filename: "..." } }
      
      resolve({
        type: "file", 
        data: base64Content,
        mimeType: file.type,
        metadata: {
            filename: file.name
        }
      } as any); // Cast to any or extend the type definition if needed
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Helper to convert File to base64 string
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Type guard for Base64ContentBlock
export function isBase64ContentBlock(
  block: unknown,
): block is ContentBlock.Multimodal.Data {
  if (typeof block !== "object" || block === null || !("type" in block))
    return false;
  // file type (legacy)
  if (
    (block as { type: unknown }).type === "file" &&
    "mimeType" in block &&
    typeof (block as { mimeType?: unknown }).mimeType === "string" 
    // Relaxed check for new file types
    // ((block as { mimeType: string }).mimeType.startsWith("image/") ||
    //   (block as { mimeType: string }).mimeType === "application/pdf")
  ) {
    return true;
  }
  // image type (new)
  if (
    (block as { type: unknown }).type === "image" &&
    "mimeType" in block &&
    typeof (block as { mimeType?: unknown }).mimeType === "string" &&
    (block as { mimeType: string }).mimeType.startsWith("image/")
  ) {
    return true;
  }
  return false;
}
