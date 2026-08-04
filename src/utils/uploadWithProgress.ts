/**
 * XMLHttpRequest 기반 파일 업로드 — fetch 대비 upload progress 이벤트 지원
 */
export const uploadWithProgress = (
  url: string,
  formData: FormData,
  token: string,
  onProgress?: (pct: number) => void,
): Promise<any> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error('네트워크 오류로 업로드에 실패했습니다.'));
    xhr.send(formData);
  });

// ── 업로드 큐 아이템 타입 ─────────────────────────────────────────
export interface UploadQueueItem {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

// ── 파일 크기 포맷 유틸 ───────────────────────────────────────────
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
