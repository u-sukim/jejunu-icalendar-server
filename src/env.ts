import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// 환경변수 이름 대소문자 수정
if (
  !process.env.USERNAME || 
  !process.env.PASSWORD || 
  !process.env.AWS_ACCESS_KEY_ID || 
  !process.env.AWS_SECRET_ACCESS_KEY
) throw new Error('필수 환경변수가 설정되지 않았습니다.');

const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;

export { username, password, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY };
