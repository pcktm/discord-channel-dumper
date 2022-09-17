import {Queue, Worker, Job} from 'bullmq';
import stream from 'stream';
import consola from 'consola';
import fs from 'fs-extra';
import {promisify} from 'util';
import axios from 'axios';
import path from 'path';

const QUEUE_NAME = 'attachments';
type JobType = {
  url: string;
  size: number;
  channelId: string;
  channelName: string;
  targetFilename: string;
};

export const attachmentQueue = new Queue<JobType>(QUEUE_NAME, {
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

export const attachmentWorker = new Worker(QUEUE_NAME, async (job: Job<JobType>) => {
  consola.info(`Downloading ${job.data.url}`);
  // if size in bytes bigger than 5MB, reject this job
  if (job.data.size > 5 * 1024 * 1024) {
    consola.warn(`Attachment ${job.data.url} is too big, skipping`);
    return false;
  }
  const dir = path.join(process.cwd(), 'dump', `${job.data.channelName}-${job.data.channelId}`, 'attachments');
  await fs.ensureDir(dir);
  await downloadFile(job.data.url, path.join(dir, job.data.targetFilename), (progress) => {
    const percent = Math.round((progress / job.data.size) * 100);
    job.updateProgress(percent);
  });
  job.updateProgress(100);
  return true;
}, {
  concurrency: 5,
  connection: {
    host: 'localhost',
    port: 6379,
  },
});

const finished = promisify(stream.finished);
export async function downloadFile(fileUrl: string, outputLocationPath: string, progressCallback?: (progress: number) => void) {
  const writer = fs.createWriteStream(outputLocationPath);
  // download file and update on progress
  return axios({
    url: fileUrl,
    method: 'GET',
    responseType: 'stream',
  })
    .then((response) => {
      response.data.pipe(writer);
      if (progressCallback) {
        let downloaded = 0;
        response.data.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          progressCallback(downloaded);
        });
      }
      return finished(writer);
    });
}
