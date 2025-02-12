import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});

export const upload = async (data: string) => {
  try {
    console.log('S3 업로드 시작...');
    const response = await client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: 'calendar.ics',
        Body: data,
        ContentType: 'text/calendar',
        ACL: 'public-read'
      })
    );
    console.log('S3 업로드 완료:', response);
    return response;
  } catch (error) {
    console.error('S3 업로드 실패:', error);
    throw error;
  }
}
