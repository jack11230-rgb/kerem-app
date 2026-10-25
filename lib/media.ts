import path from 'node:path';
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './data/uploads');
export const MEDIA_TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.pdf': 'application/pdf' };
